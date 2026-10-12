import { readFile } from "node:fs/promises";
import { buildGraphFromFiles, emptyParseReports, type ParseReports } from "./cold-start";
import { DEFAULT_DATABASE } from "./databases";
import {
	computeAggregateFingerprint,
	computeFileHash,
	loadMetaCache,
	type MetaCache,
	PARSER_VERSION,
	saveMetaCache,
} from "./fingerprint";
import { applyChangeSet, changeSetIsEmpty, computeChangeSet, ensureRecordCache, RecordCache } from "./incremental";
import type { GraphPaths } from "./paths";
import { DEFAULT_WHITELIST, scanWhitelistedDirs, type WhitelistDirs } from "./scanner";
import { dumpDatabase, hydrateDatabase, loadSnapshot, saveSnapshot, snapshotFingerprint } from "./snapshot";
import { type GraphStore, SCHEMA_VERSION } from "./store";

export interface ReconcileOnceResult {
	backend: GraphStore["backend"];
	/** True when the fingerprint matched and nothing was rebuilt (the on-disk graph was reused). */
	reused: boolean;
	/** True when a full or incremental build ran because the fingerprint did not match. */
	built: boolean;
	/** True when the store was filled from the derived-graph snapshot instead of re-parsing. */
	hydrated?: boolean;
}

/**
 * One-shot reconciliation for a standalone CLI process: bring the graph store up to date with the
 * markdown corpus without a long-lived watcher or timer.
 *
 * Mirrors `GraphService.reconcile` but drops the `ready`-gate, watchers and lock machinery.
 *
 * IMPORTANT (ryu WASM / Bun): the only Bun-compatible ryu build (`ryugraph-wasm/sync`) stores its
 * data in Emscripten's in-memory MEMFS, so the graph never survives a process exit. A fresh CLI
 * process therefore always opens an EMPTY store. The fingerprint/incremental reuse paths below are
 * only meaningful when the store actually persists (e.g. a long-lived Web process); for a short-lived
 * CLI process they must not be used, or the query would run against an empty graph. Pass
 * `forceBuild: true` from the CLI so it always performs a full build and never trusts a stale
 * on-disk fingerprint that points at data the current process cannot see.
 *
 * - `reuseSnapshot: true`                   -> hydrate the snapshot on a fingerprint match, else full build + dump (used by the CLI);
 * - `forceBuild: true`                      -> always full build (tests, one-shot rebuilds);
 * - fingerprint match (no forceBuild)       -> reuse the store, do nothing;
 * - previous cache (no forceBuild)          -> incremental apply (only changed files are re-written);
 * - no usable cache (no forceBuild)         -> full build.
 */
export async function reconcileGraphStoreOnce(
	projectRoot: string,
	store: GraphStore,
	paths: GraphPaths,
	options: { dirs?: WhitelistDirs; forceBuild?: boolean; reuseSnapshot?: boolean } = {},
): Promise<ReconcileOnceResult> {
	const metaPath = paths.metaPath;
	const dirs = options.dirs ?? DEFAULT_WHITELIST;
	const scanned = await scanWhitelistedDirs(projectRoot, dirs);
	const cached = loadMetaCache(metaPath);

	const nextFiles: MetaCache["files"] = {};
	for (const file of scanned) {
		const entry = cached?.files[file.relPath];
		if (entry && entry.size === file.size && entry.mtimeMs === file.mtimeMs) {
			nextFiles[file.relPath] = entry;
		} else {
			let content: string;
			try {
				content = await readFile(file.absPath, "utf8");
			} catch {
				continue; // file vanished between scan and read
			}
			nextFiles[file.relPath] = {
				size: file.size,
				mtimeMs: file.mtimeMs,
				hash: computeFileHash(content),
			};
		}
	}

	// CLI path (BACK-772): a cold process cannot reuse the store, but it *can* reuse the derived
	// graph's snapshot. When the corpus fingerprint, parser version and graph schema version all
	// still match the recorded snapshot, hydrate instead of re-parsing the markdown; otherwise do a
	// full build and write a fresh snapshot. It never "does nothing" - that is what made forceBuild
	// necessary before, because a skipped build against an empty MEMFS store serves an empty graph.
	if (options.reuseSnapshot) {
		if (await hydrateFromSnapshot(store, cached, paths, computeAggregateFingerprint(nextFiles))) {
			return { backend: store.backend, reused: true, built: false, hydrated: true };
		}
		const reports: ParseReports = emptyParseReports();
		await buildGraphFromFiles(store, scanned, reports);
		await persistSnapshot(store, paths, nextFiles);
		return { backend: store.backend, reused: false, built: true, hydrated: false };
	}

	// CLI path: ryu's MEMFS is empty on every process start, so a stale fingerprint must never make
	// us skip building. Always do a full build and record the fingerprint for informational use.
	if (options.forceBuild) {
		const reports: ParseReports = emptyParseReports();
		await buildGraphFromFiles(store, scanned, reports);
		saveMetaCache(metaPath, {
			parserVersion: PARSER_VERSION,
			backend: store.backend,
			fingerprint: computeAggregateFingerprint(nextFiles),
			files: nextFiles,
		});
		return { backend: store.backend, reused: false, built: true };
	}

	const previous = cached?.backend === store.backend ? cached : null;
	const aggregate = computeAggregateFingerprint(nextFiles);
	if (previous && previous.parserVersion === PARSER_VERSION && previous.fingerprint === aggregate) {
		return { backend: store.backend, reused: true, built: false };
	}

	const reports: ParseReports = emptyParseReports();
	if (previous) {
		const recordCache = new RecordCache();
		await ensureRecordCache(recordCache, scanned, reports);
		const changeSet = computeChangeSet(previous.files, nextFiles);
		if (!changeSetIsEmpty(changeSet)) {
			const scannedByPath = new Map(scanned.map((f) => [f.relPath, f] as const));
			await applyChangeSet(store, changeSet, recordCache, scannedByPath, reports);
		}
	} else {
		await buildGraphFromFiles(store, scanned, reports);
	}

	saveMetaCache(metaPath, {
		parserVersion: PARSER_VERSION,
		backend: store.backend,
		fingerprint: computeAggregateFingerprint(nextFiles),
		files: nextFiles,
	});
	return { backend: store.backend, reused: false, built: true };
}

/**
 * Where the derived graph's snapshot lives: beside its database in the OS cache directory. Unlike a
 * user database's snapshot this is a **cache** (the markdown corpus is the truth), so it is never
 * written into the repository and deleting it only costs one rebuild.
 */
export function derivedSnapshotPath(paths: GraphPaths): string {
	return `${paths.dbPath}.graph.json`;
}

/**
 * Restore the derived graph from its snapshot when - and only when - the snapshot provably belongs
 * to the corpus in front of us. Every failed check is a reason to rebuild instead: serving a graph
 * that does not match the corpus would be worse than paying for a rebuild.
 */
async function hydrateFromSnapshot(
	store: GraphStore,
	cached: MetaCache | null,
	paths: GraphPaths,
	aggregate: string,
): Promise<boolean> {
	if (!cached) return false;
	if (cached.backend !== store.backend) return false;
	if (cached.parserVersion !== PARSER_VERSION) return false;
	if (cached.fingerprint !== aggregate) return false;
	if (cached.graphSchemaVersion !== SCHEMA_VERSION) return false;
	if (!cached.snapshotFingerprint) return false;
	const snapshotPath = derivedSnapshotPath(paths);
	// The recorded hash ties the snapshot file to the corpus state, and also catches a snapshot that
	// was replaced or hand-edited behind our back.
	if (snapshotFingerprint(snapshotPath) !== cached.snapshotFingerprint) return false;
	try {
		await hydrateDatabase(store, loadSnapshot(snapshotPath));
		return true;
	} catch {
		return false; // unreadable snapshot: rebuild rather than serve a partial graph
	}
}

/** Write the snapshot for the corpus state that was just built, and record it in the meta cache. */
async function persistSnapshot(store: GraphStore, paths: GraphPaths, files: MetaCache["files"]): Promise<void> {
	const snapshotPath = derivedSnapshotPath(paths);
	saveSnapshot(snapshotPath, await dumpDatabase(store, DEFAULT_DATABASE));
	saveMetaCache(paths.metaPath, {
		parserVersion: PARSER_VERSION,
		backend: store.backend,
		fingerprint: computeAggregateFingerprint(files),
		files,
		snapshotFingerprint: snapshotFingerprint(snapshotPath),
		graphSchemaVersion: SCHEMA_VERSION,
	});
}
