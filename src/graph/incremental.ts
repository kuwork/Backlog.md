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
 * parsed. Same-id path changes (completion tasks/ -> completed/, renames) update the node in
 * place so its edges survive; demote/promote (id changes) delete the old node and rebuild its
 * edges under the new id. Edges touching affected ids are rebuilt only after every node is in
 * place, so cross-file references always resolve.
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
		id: record.id,
		title: record.title,
		kind: record.kind,
		status: record.status,
		filePath: record.filePath,
	};
}

export interface ApplyChangeSetResult {
	relations: RelationResolution;
	affectedIds: string[];
}

interface AffectedOld {
	/** The previous record's id, or null when the record cache had no entry for the path. */
	id: string | null;
	filePath: string;
}

/**
 * Apply a change set against the store. `scannedByPath` must cover the added/changed paths.
 * `warnings` collects parser skip warnings. The full relation set is re-resolved from the
 * (mostly cached) records, but only edges touching affected ids are rewritten in the store.
 */
export async function applyChangeSet(
	store: GraphStore,
	changeSet: ChangeSet,
	recordCache: RecordCache,
	scannedByPath: Map<string, ScannedFile>,
	warnings: string[] = [],
): Promise<ApplyChangeSetResult> {
	const affectedOldRecords: AffectedOld[] = [...changeSet.removed, ...changeSet.changed].map((relPath) => ({
		id: recordCache.get(relPath)?.id ?? null,
		filePath: relPath,
	}));

	// Parse the new/changed files (the only content reads in an incremental sync).
	const freshRecords = new Map<string, ParsedRecord>();
	for (const relPath of [...changeSet.added, ...changeSet.changed]) {
		const scanned = scannedByPath.get(relPath);
		if (!scanned) continue;
		const parsed = parseTaskFile(scanned.absPath, relPath, scanned.kind);
		if (parsed.warning) warnings.push(parsed.warning);
		if (parsed.record) freshRecords.set(relPath, parsed.record);
	}

	// Update the record cache.
	for (const relPath of changeSet.removed) recordCache.delete(relPath);
	for (const record of freshRecords.values()) recordCache.set(record);

	// Split affected old records: same-id path changes update in place, everything else deletes.
	const freshById = new Map([...freshRecords.values()].map((r) => [r.id, r] as const));
	const inPlaceUpdates: ParsedRecord[] = [];
	const doomedIds: string[] = [];
	const stalePaths: string[] = [];
	for (const old of affectedOldRecords) {
		if (old.id && freshById.has(old.id)) {
			inPlaceUpdates.push(freshById.get(old.id) as ParsedRecord);
		} else if (old.id) {
			doomedIds.push(old.id);
		} else {
			stalePaths.push(old.filePath);
		}
	}

	if (doomedIds.length > 0) await store.deleteNodes(doomedIds);
	// Unknown old records (record cache was cold) are unreachable by id; drop them by matching
	// the old filePath so nodes of renamed/removed files cannot linger.
	if (stalePaths.length > 0) await store.deleteNodesByFilePath(stalePaths);

	// Nodes first: brand-new ids (added files + changed files whose id differs).
	const inPlaceIds = new Set(inPlaceUpdates.map((r) => r.id));
	const brandNew = [...freshRecords.values()].filter((r) => !inPlaceIds.has(r.id));
	if (brandNew.length > 0) await store.upsertNodes(brandNew.map(toNode));
	if (inPlaceUpdates.length > 0) await store.updateNodes(inPlaceUpdates.map(toNode));

	// Edges last: rebuild every edge touching an affected id after all nodes are in place.
	const affectedIds = [
		...new Set([
			...affectedOldRecords.filter((r): r is AffectedOld & { id: string } => r.id !== null).map((r) => r.id),
			...[...freshRecords.values()].map((r) => r.id),
		]),
	];
	const relations = resolveRelations(recordCache.all());
	await store.deleteEdgesTouching(affectedIds);
	await store.upsertEdges(
		relations.edges.filter((edge) => affectedIds.includes(edge.from) || affectedIds.includes(edge.to)),
	);
	return { relations, affectedIds };
}

/**
 * Rebuild the record cache from disk when it is empty (the fingerprint fast path never parses).
 * Pure cache construction - the graph in the store is untouched.
 */
export async function ensureRecordCache(
	recordCache: RecordCache,
	scanned: ScannedFile[],
	warnings: string[] = [],
): Promise<void> {
	if (recordCache.size > 0) return;
	for (const file of scanned) {
		const parsed = parseTaskFile(file.absPath, file.relPath, file.kind);
		if (parsed.warning) warnings.push(parsed.warning);
		if (parsed.record) recordCache.set(parsed.record);
	}
}
