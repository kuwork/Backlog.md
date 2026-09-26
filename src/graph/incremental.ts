import { collectParseFindings, collectRelationFindings, type ParseReports } from "./cold-start";
import type { MetaCache } from "./fingerprint";
import type { ParsedRecord } from "./parser";
import { parseTaskFile } from "./parser";
import type { RelationResolution } from "./relations";
import { resolveRelations } from "./relations";
import type { ScannedFile } from "./scanner";
import type { GraphNode, GraphStore } from "./store";

/**
 * Incremental rebuild (doc-014 §2.2) and the §3.5 migration scenarios.
 *
 * The change set is derived from the per-file fingerprint cache; only added/changed files are
 * parsed. Because a node is keyed by its path, every migration in §3.5 is the same two steps: the
 * old path loses its node, the new path gains one, and the edges touching either are rebuilt at the
 * end of the batch. No id comparison is needed - a rename, a demotion or a tasks/ -> completed/
 * move shows up as `removed` + `added` in one change set by construction, since the fingerprint
 * cache is keyed by path too.
 */

export interface ChangeSet {
	/** New relPaths not present in the previous cache. */
	added: string[];
	/** relPaths present in the previous cache but gone from disk. */
	removed: string[];
	/** relPaths present in both but whose content hash differs. */
	changed: string[];
}

export function computeChangeSet(previous: MetaCache["files"], next: MetaCache["files"]): ChangeSet {
	const added: string[] = [];
	const changed: string[] = [];
	for (const relPath of Object.keys(next)) {
		const prev = previous[relPath];
		if (!prev) {
			added.push(relPath);
		} else if (prev.hash !== next[relPath]?.hash) {
			changed.push(relPath);
		}
	}
	const removed = Object.keys(previous).filter((relPath) => !next[relPath]);
	return { added, removed, changed };
}

export function changeSetIsEmpty(changeSet: ChangeSet): boolean {
	return changeSet.added.length === 0 && changeSet.removed.length === 0 && changeSet.changed.length === 0;
}

/**
 * In-memory cache of the last parsed record per relPath. The Graph Service maintains it so an
 * incremental sync never has to re-parse untouched files. After a fingerprint fast-path reuse
 * (which never parses) the cache starts empty and is rebuilt lazily by `ensureRecordCache`.
 */
export class RecordCache {
	private byPath = new Map<string, ParsedRecord>();

	static from(records: ParsedRecord[]): RecordCache {
		const cache = new RecordCache();
		for (const record of records) cache.byPath.set(record.filePath, record);
		return cache;
	}

	get(relPath: string): ParsedRecord | undefined {
		return this.byPath.get(relPath);
	}

	set(record: ParsedRecord): void {
		this.byPath.set(record.filePath, record);
	}

	delete(relPath: string): void {
		this.byPath.delete(relPath);
	}

	all(): ParsedRecord[] {
		return [...this.byPath.values()];
	}

	get size(): number {
		return this.byPath.size;
	}
}

function toNode(record: ParsedRecord): GraphNode {
	return {
		path: record.filePath,
		id: record.id,
		// Empty when a knowledge file declares no usable file_type - never a folder guess.
		type: record.kind ?? "",
		title: record.title,
		status: record.status,
		updatedDate: record.updatedDate,
	};
}

export interface ApplyChangeSetResult {
	relations: RelationResolution;
	/** Those paths' nodes and edges were rewritten; peers outside this set were left untouched. */
	affectedPaths: string[];
}

/**
 * Apply a change set against the store. `scannedByPath` must cover the added/changed paths.
 * `warnings` collects parser skip warnings. The full relation set is re-resolved from the
 * (mostly cached) records, so the id -> path translation always sees every file, but only edges
 * touching an affected path are rewritten in the store.
 */
export async function applyChangeSet(
	store: GraphStore,
	changeSet: ChangeSet,
	recordCache: RecordCache,
	scannedByPath: Map<string, ScannedFile>,
	reports: ParseReports,
): Promise<ApplyChangeSetResult> {
	// Parse the new/changed files (the only content reads in an incremental sync).
	const freshRecords = new Map<string, ParsedRecord>();
	for (const relPath of [...changeSet.added, ...changeSet.changed]) {
		const scanned = scannedByPath.get(relPath);
		if (!scanned) continue;
		const parsed = parseTaskFile(scanned.absPath, relPath, scanned.kind);
		collectParseFindings(parsed, reports);
		if (parsed.record) freshRecords.set(relPath, parsed.record);
	}

	// Update the record cache.
	for (const relPath of changeSet.removed) recordCache.delete(relPath);
	for (const record of freshRecords.values()) recordCache.set(record);

	// Drop the node of every touched path first: a removed/renamed file takes its node away, and a
	// changed or added file is recreated from its fresh content below.
	const affectedPaths = [...new Set([...changeSet.added, ...changeSet.changed, ...changeSet.removed])];
	await store.deleteNodes(affectedPaths);

	// Nodes first, edges last: every edge touching an affected path is rebuilt after all nodes are
	// in place, so a reference between two files that moved in the same batch still resolves.
	if (freshRecords.size > 0) await store.upsertNodes([...freshRecords.values()].map(toNode));
	const affected = new Set(affectedPaths);
	const relations = resolveRelations(recordCache.all());
	// The relations are re-resolved from every record, so their findings describe the whole corpus
	// and replace whatever the previous pass reported.
	collectRelationFindings(reports, relations);
	await store.deleteEdgesTouching(affectedPaths);
	// Tag names are add-only and idempotent, so re-registering the full set keeps every Tag node a
	// TaggedWith edge could point at - including one only a peer outside this change set uses.
	await store.upsertTags(relations.tags);
	await store.upsertEdges(relations.edges.filter((edge) => affected.has(edge.from) || affected.has(edge.to)));
	return { relations, affectedPaths };
}

/**
 * Rebuild the record cache from disk when it is empty (the fingerprint fast path never parses).
 * Pure cache construction - the graph in the store is untouched.
 */
export async function ensureRecordCache(
	recordCache: RecordCache,
	scanned: ScannedFile[],
	reports: ParseReports,
): Promise<void> {
	if (recordCache.size > 0) return;
	for (const file of scanned) {
		const parsed = parseTaskFile(file.absPath, file.relPath, file.kind);
		collectParseFindings(parsed, reports);
		if (parsed.record) recordCache.set(parsed.record);
	}
}
