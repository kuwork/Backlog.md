import { readFile } from "node:fs/promises";
import { buildGraphFromFiles, emptyParseReports, type ParseReports } from "./cold-start";
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
import type { GraphStore } from "./store";

export interface ReconcileOnceResult {
	backend: GraphStore["backend"];
	/** True when the fingerprint matched and nothing was rebuilt (the on-disk graph was reused). */
	reused: boolean;
	/** True when a full or incremental build ran because the fingerprint did not match. */
	built: boolean;
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
 * - `forceBuild: true`                      -> always full build (used by the CLI);
 * - fingerprint match (no forceBuild)       -> reuse the store, do nothing;
 * - previous cache (no forceBuild)          -> incremental apply (only changed files are re-written);
 * - no usable cache (no forceBuild)         -> full build.
 */
export async function reconcileGraphStoreOnce(
	projectRoot: string,
	store: GraphStore,
	paths: GraphPaths,
	options: { dirs?: WhitelistDirs; forceBuild?: boolean } = {},
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
