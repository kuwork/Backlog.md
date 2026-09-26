import { readFile } from "node:fs/promises";
import type { MetaCache } from "./fingerprint";
import {
	computeAggregateFingerprint,
	computeFileHash,
	loadMetaCache,
	PARSER_VERSION,
	saveMetaCache,
} from "./fingerprint";
import { fullImport } from "./import";
import type { ParsedFile, ParsedRecord } from "./parser";
import { parseTaskFile } from "./parser";
import type { GraphSlot } from "./paths";
import { graphPaths } from "./paths";
import type { RelationResolution } from "./relations";
import { resolveRelations } from "./relations";
import type { ScannedFile, WhitelistDirs } from "./scanner";
import { DEFAULT_WHITELIST, scanWhitelistedDirs } from "./scanner";
import type { GraphStore } from "./store";
import { openGraphStore } from "./store";

/**
 * Cold start with incremental fingerprint validation (doc-014 §2.1).
 *
 * 1. stat-scan the whitelisted directories without reading contents
 * 2. reuse cached hashes for files whose size+mtime are unchanged; rehash only what changed
 * 3. compare the aggregate fingerprint against the cached one:
 *    - match -> reuse the graph as-is (no gray-matter parsing at all)
 *    - mismatch / null / corrupt cache -> full rebuild, then rewrite the cache
 */

export interface ParseReports {
	invalidRelations: string[];
	missingDependencies: string[];
	ambiguousIds: string[];
	/** Phase 3: `source_path` values that matched 0 or >1 records (doc-15 §5, fail-closed). */
	unresolvedSources: string[];
	/** Phase 3: wikilinks that named a page but resolved to no unique one (doc-15 §8). */
	unresolvedLinks: string[];
	/** Phase 3: expected noise, not defects - placeholders, embeds, and originals outside the corpus. */
	informational: string[];
	/** Files that could not be read/parsed and were skipped. */
	warnings: string[];
}

export function emptyParseReports(): ParseReports {
	return {
		invalidRelations: [],
		missingDependencies: [],
		ambiguousIds: [],
		unresolvedSources: [],
		unresolvedLinks: [],
		informational: [],
		warnings: [],
	};
}

/** Record one file's outcome: its skip warning. */
export function collectParseFindings(parsed: ParsedFile, reports: ParseReports): void {
	if (parsed.warning) reports.warnings.push(parsed.warning);
}

/** Fill the relation-derived report buckets. Replaces them - a resolution is a complete answer. */
export function collectRelationFindings(reports: ParseReports, relations: RelationResolution): void {
	reports.invalidRelations = relations.invalidRelations;
	reports.missingDependencies = relations.missingDependencies;
	reports.ambiguousIds = relations.ambiguousIds;
	reports.unresolvedSources = relations.unresolvedSources;
	reports.unresolvedLinks = relations.unresolvedLinks;
	reports.informational = relations.informational;
}

export interface ColdStartResult {
	backend: GraphStore["backend"];
	reused: boolean;
	nodeCount: number;
	scannedFiles: number;
	reports: ParseReports;
	/** The open store; memory stores stay warm as process singletons (see store.ts). */
	store: GraphStore;
	/** The relations, only populated when a rebuild ran (the fast path never parses). */
	relations?: RelationResolution;
	/** The parsed records, only populated when a rebuild ran. */
	records?: ParsedRecord[];
}

export interface ColdStartOptions {
	/** Force the native kuzu backend; default is the in-memory degraded mode (see store.ts). */
	backend?: "kuzu" | "memory";
	dirs?: WhitelistDirs;
	/** Instance slot that picks the cache entry; see paths.ts. */
	slot?: GraphSlot;
}

/** One shared implementation used by both the cold start and (later) hot-update reconciliation. */
export async function buildGraphFromFiles(
	store: GraphStore,
	scanned: ScannedFile[],
	reports: ParseReports = emptyParseReports(),
): Promise<{ records: ParsedRecord[]; relations: RelationResolution }> {
	const records: ParsedRecord[] = [];
	for (const file of scanned) {
		const parsed = parseTaskFile(file.absPath, file.relPath, file.kind);
		collectParseFindings(parsed, reports);
		if (parsed.record) records.push(parsed.record);
	}
	const relations = resolveRelations(records);
	collectRelationFindings(reports, relations);
	await fullImport(store, records, relations);
	return { records, relations };
}

export async function coldStart(projectRoot: string, options: ColdStartOptions = {}): Promise<ColdStartResult> {
	const paths = graphPaths(projectRoot, options.slot);
	const store = await openGraphStore(paths.dbPath, options.backend ? { backend: options.backend } : {});
	const metaPath = paths.metaPath;
	const dirs = options.dirs ?? DEFAULT_WHITELIST;

	try {
		const scanned = await scanWhitelistedDirs(projectRoot, dirs);
		const cached = loadMetaCache(metaPath);

		// Per-file: reuse cached hash when size+mtime are unchanged, rehash only what changed.
		const nextFiles: MetaCache["files"] = {};
		for (const file of scanned) {
			const cachedEntry = cached?.files[file.relPath];
			if (cachedEntry && cachedEntry.size === file.size && cachedEntry.mtimeMs === file.mtimeMs) {
				nextFiles[file.relPath] = cachedEntry;
			} else {
				const content = await readFile(file.absPath, "utf8");
				nextFiles[file.relPath] = { size: file.size, mtimeMs: file.mtimeMs, hash: computeFileHash(content) };
			}
		}

		// Correctness comes from the content hashes, not from mtimes: a touch with identical
		// content rehashes to the same aggregate and still takes the fast path.
		const aggregate = computeAggregateFingerprint(nextFiles);
		const cacheUsable =
			cached !== null &&
			cached.parserVersion === PARSER_VERSION &&
			cached.backend === store.backend &&
			cached.fingerprint === aggregate;

		if (cacheUsable) {
			const nodeCount = await store.countNodes();
			// A warm cache alone is not enough to reuse: the in-memory backend starts empty in
			// every new process, so a "reused" empty store would serve an empty graph after a
			// restart. The fast path only applies when the store already holds the graph (kuzu
			// persists it to disk; a warm memory singleton does after an in-process rebuild).
			if (nodeCount > 0) {
				return {
					backend: store.backend,
					reused: true,
					nodeCount,
					scannedFiles: scanned.length,
					reports: emptyParseReports(),
					store,
				};
			}
		}

		// Rebuild path (also rewrites the cache afterwards).
		const reports = emptyParseReports();
		const { records, relations } = await buildGraphFromFiles(store, scanned, reports);
		saveMetaCache(metaPath, {
			parserVersion: PARSER_VERSION,
			backend: store.backend,
			fingerprint: computeAggregateFingerprint(nextFiles),
			files: nextFiles,
		});
		return {
			backend: store.backend,
			reused: false,
			nodeCount: await store.countNodes(),
			scannedFiles: scanned.length,
			reports,
			store,
			relations,
			records,
		};
	} finally {
		// Only the native backend owns OS resources; memory singletons stay warm by design.
		if (store.backend === "kuzu") await store.close();
	}
}
