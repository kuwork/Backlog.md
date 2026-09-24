import { closeSync, type FSWatcher, openSync, readFileSync, unlinkSync, watch, writeSync } from "node:fs";
import { join } from "node:path";
import type { Core } from "../core/backlog";
import type { ParseReports } from "./cold-start";
import { defaultMetaPath } from "./cold-start";
import {
	computeAggregateFingerprint,
	computeFileHash,
	loadMetaCache,
	type MetaCache,
	PARSER_VERSION,
	saveMetaCache,
} from "./fingerprint";
import { applyChangeSet, changeSetIsEmpty, computeChangeSet, ensureRecordCache, RecordCache } from "./incremental";
import type { WhitelistDirs } from "./scanner";
import { DEFAULT_WHITELIST, scanWhitelistedDirs } from "./scanner";
import type { GraphEdge, GraphNode, GraphStore } from "./store";
import { openGraphStore } from "./store";

/**
 * Graph Service (doc-014 §3): the single process holding the task graph.
 *
 * Consistency layers, in order of freshness:
 * 1. core notify hook - FileSystem.onFilesChanged reports every file the mutation layer wrote
 * 2. Bun.watch fallback - catches out-of-band edits (editors, git, scripts)
 * 3. a 5-minute stat-scan reconciliation - the safety net (§3.4)
 *
 * notify() and watcher events converge on one pending-path Set with a 150ms debounce; sync runs
 * are serialized by a lock so a notification arriving mid-sync cannot re-enter. After each
 * successful sync the service emits a graphChanged broadcast so the Web UI refetches /api/graph.
 */

const SYNC_DEBOUNCE_MS = 150;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

export interface GraphPayload {
	status: "building" | "ready";
	backend: GraphStore["backend"];
	nodes: GraphNode[];
	edges: GraphEdge[];
	reports: ParseReports;
	nodeCount: number;
}

export interface GraphServiceOptions {
	backend?: "kuzu" | "memory";
	dirs?: WhitelistDirs;
	/** Override for tests. */
	debounceMs?: number;
	/** Override for tests. */
	reconcileMs?: number;
}

export class GraphService {
	backend: GraphStore["backend"] = "memory";

	private store: GraphStore | null = null;
	private recordCache = new RecordCache();
	private pendingPaths = new Set<string>();
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private syncing = false;
	private resyncAfterSync = false;
	private watchers: FSWatcher[] = [];
	private reconcileTimer: ReturnType<typeof setInterval> | null = null;
	private reports: ParseReports = { invalidRelations: [], missingDependencies: [], ambiguousIds: [], warnings: [] };
	private ready = false;
	private stopped = false;

	/**
	 * Called after every successful sync so the host (the Web UI process) can push a
	 * graphChanged message to its clients. Injectable to keep this module transport-agnostic.
	 */
	onGraphChanged: (() => void) | null = null;

	/**
	 * Called once per service start around the initial build: "start" before the cold start
	 * begins, "complete" once the graph is ready, "failed" if the start itself threw (the lock
	 * is released and the service is dead). Lets the Web UI show one message at the beginning
	 * and one at the end of the startup build, in parallel with its normal loading flow.
	 */
	onColdStart: ((phase: "start" | "complete" | "failed") => void) | null = null;

	constructor(
		private readonly projectRoot: string,
		private readonly options: GraphServiceOptions = {},
	) {}

	// ---------------------------------------------------------------- lifecycle

	/** Start the service: acquire the single-holder lock, cold start, arm watcher + reconciliation. */
	async start(): Promise<boolean> {
		this.lockFilePath = join(this.projectRoot, "backlog", "graph.kuzu.lock");
		if (!this.acquireLock()) return false; // another process holds the graph

		this.onColdStart?.("start");
		try {
			this.store = await openGraphStore(
				this.projectRoot,
				this.options.backend ? { backend: this.options.backend } : {},
			);
			this.backend = this.store.backend;
			await this.reconcile(); // initial build/validation (runs a full stat-scan + fingerprint check)
		} catch (error) {
			await this.stop(); // release the lock and tear down partial state
			this.onColdStart?.("failed");
			throw error;
		}

		const dirs = this.options.dirs ?? DEFAULT_WHITELIST;
		for (const dirName of Object.keys(dirs) as (keyof WhitelistDirs)[]) {
			try {
				const dir = join(this.projectRoot, "backlog", dirs[dirName]);
				const watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
					// Coarse by design: the path only feeds the dedup Set; the sync re-scans and
					// re-hashes, so a missing filename costs at most one redundant stat.
					this.notify([filename ? join(dir, filename) : dir]);
				});
				watcher.on("error", (error) => {
					if (process.env.DEBUG) console.warn("Graph watcher error", error);
				});
				this.watchers.push(watcher);
			} catch {
				// Directory may not exist (e.g. no drafts yet); the 5-minute reconciliation covers it.
			}
		}

		this.reconcileTimer = setInterval(() => void this.reconcile(), this.options.reconcileMs ?? RECONCILE_INTERVAL_MS);
		this.ready = true;
		this.onColdStart?.("complete");
		return true;
	}

	async stop(): Promise<void> {
		this.stopped = true;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		if (this.reconcileTimer) clearInterval(this.reconcileTimer);
		for (const watcher of this.watchers) watcher.close();
		this.watchers = [];
		if (this.store && this.store.backend === "kuzu") await this.store.close();
		this.store = null;
		this.releaseLock();
	}

	// ---------------------------------------------------------------- notification

	/**
	 * Entry point for both the core mutation hook and watcher events. Paths are deduped; the
	 * debounce window absorbs editor save bursts and git checkout rewrites into one sync.
	 */
	notify(paths: string[]): void {
		if (this.stopped) return;
		for (const path of paths) this.pendingPaths.add(path);
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.syncNow();
		}, this.options.debounceMs ?? SYNC_DEBOUNCE_MS);
	}

	/** Force a sync immediately (used by the initial reconcile and the 5-minute loop). */
	private lockHeld = false;
	private lockFilePath = "";
	private lockFd: number | null = null;

	private async syncNow(): Promise<void> {
		if (this.syncing) {
			this.resyncAfterSync = true; // a notification arrived mid-sync; run once more after
			return;
		}
		this.syncing = true;
		try {
			do {
				this.resyncAfterSync = false;
				await this.reconcile();
			} while (this.resyncAfterSync && !this.stopped);
		} finally {
			this.syncing = false;
		}
	}

	/**
	 * One reconciliation pass: stat-scan, hash-gate, fingerprint compare, incremental apply.
	 * This is also the cold-start path, so the very first call builds the graph.
	 */
	private async reconcile(): Promise<void> {
		if (!this.store || this.stopped) return;
		const store = this.store;
		const metaPath = defaultMetaPath(this.projectRoot);
		const dirs = this.options.dirs ?? DEFAULT_WHITELIST;
		const scanned = await scanWhitelistedDirs(this.projectRoot, dirs);
		const cached = loadMetaCache(metaPath);

		const nextFiles: MetaCache["files"] = {};
		const { readFile } = await import("node:fs/promises");
		for (const file of scanned) {
			const entry = cached?.files[file.relPath];
			if (entry && entry.size === file.size && entry.mtimeMs === file.mtimeMs) {
				nextFiles[file.relPath] = entry;
			} else {
				const content = await readFile(file.absPath, "utf8");
				nextFiles[file.relPath] = { size: file.size, mtimeMs: file.mtimeMs, hash: computeFileHash(content) };
			}
		}

		const previous = cached?.backend === store.backend ? cached : null;
		const aggregate = computeAggregateFingerprint(nextFiles);
		if (previous && previous.parserVersion === PARSER_VERSION && previous.fingerprint === aggregate && this.ready) {
			return; // fingerprint match: nothing to do
		}

		const warnings: string[] = [];
		if (previous && this.ready) {
			// Incremental: diff against the previous cache, apply, rewrite cache.
			await ensureRecordCache(this.recordCache, scanned, warnings);
			const changeSet = computeChangeSet(previous.files, nextFiles);
			if (!changeSetIsEmpty(changeSet)) {
				const scannedByPath = new Map(scanned.map((f) => [f.relPath, f] as const));
				const result = await applyChangeSet(store, changeSet, this.recordCache, scannedByPath, warnings);
				this.reports = {
					invalidRelations: result.relations.invalidRelations,
					missingDependencies: result.relations.missingDependencies,
					ambiguousIds: result.relations.ambiguousIds,
					warnings,
				};
			}
		} else {
			// Full rebuild: missing/corrupt cache, parser upgrade, backend switch, or first start.
			const { buildGraphFromFiles } = await import("./cold-start");
			const { records, relations } = await buildGraphFromFiles(store, scanned, warnings);
			this.recordCache = RecordCache.from(records);
			this.reports = {
				invalidRelations: relations.invalidRelations,
				missingDependencies: relations.missingDependencies,
				ambiguousIds: relations.ambiguousIds,
				warnings,
			};
		}

		saveMetaCache(metaPath, {
			parserVersion: PARSER_VERSION,
			backend: store.backend,
			fingerprint: computeAggregateFingerprint(nextFiles),
			files: nextFiles,
		});
		this.onGraphChanged?.();
	}

	// ---------------------------------------------------------------- payload

	get isReady(): boolean {
		return this.ready;
	}

	async getPayload(): Promise<GraphPayload> {
		const store = this.store;
		if (!store || !this.ready) {
			return {
				status: "building",
				backend: this.backend ?? "memory",
				nodes: [],
				edges: [],
				reports: this.reports,
				nodeCount: 0,
			};
		}
		const [nodes, edges] = await Promise.all([store.getAllNodes(), store.getAllEdges()]);
		return {
			status: "ready",
			backend: store.backend,
			nodes,
			edges,
			reports: this.reports,
			nodeCount: nodes.length,
		};
	}

	// ---------------------------------------------------------------- single-holder lock

	private acquireLock(): boolean {
		try {
			// O_EXCL create: only one process can hold the graph (doc-014 §3.3/§5).
			this.lockFd = openSync(this.lockFilePath, "wx");
			writeSync(this.lockFd, `${process.pid}\n`);
			closeSync(this.lockFd);
			this.lockFd = null;
			this.lockHeld = true;
			return true;
		} catch {
			// Lock exists. A lock from a dead process whose pid no longer runs is stale.
			try {
				const pid = Number.parseInt(readFileSync(this.lockFilePath, "utf8").trim(), 10);
				if (Number.isFinite(pid) && pid !== process.pid && !processExists(pid)) {
					unlinkSync(this.lockFilePath);
					return this.acquireLock(); // one retry after stale removal
				}
			} catch {
				// fall through: treat as held
			}
			return false;
		}
	}

	private releaseLock(): void {
		if (!this.lockHeld) return;
		try {
			unlinkSync(this.lockFilePath);
		} catch {
			// already gone
		}
		this.lockHeld = false;
	}
}

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/** Wire the Graph Service to a Core instance: inject the FileSystem notify hook. */
export function attachToCore(service: GraphService, core: Core): void {
	core.fs.onFilesChanged = (paths: string[]) => service.notify(paths);
}
