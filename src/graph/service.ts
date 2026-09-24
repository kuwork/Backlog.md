import { closeSync, type FSWatcher, mkdirSync, openSync, readFileSync, unlinkSync, watch, writeSync } from "node:fs";
import { join } from "node:path";
import type { Core } from "../core/backlog";
import type { ParseReports } from "./cold-start";
import {
	computeAggregateFingerprint,
	computeFileHash,
	loadMetaCache,
	type MetaCache,
	PARSER_VERSION,
	saveMetaCache,
} from "./fingerprint";
import { applyChangeSet, changeSetIsEmpty, computeChangeSet, ensureRecordCache, RecordCache } from "./incremental";
import type { GraphPaths, GraphSlot } from "./paths";
import { DEFAULT_SLOT, graphPaths } from "./paths";
import type { WhitelistDirs } from "./scanner";
import { DEFAULT_WHITELIST, scanWhitelistedDirs } from "./scanner";
import type { GraphEdge, GraphNode, GraphStore } from "./store";
import { openGraphStore } from "./store";

/**
 * Graph Service (doc-014 §3): the single process holding the task graph.
 *
 * Host-agnostic by design: every host (Web UI, TUI, MCP) runs this same class, so the build and
 * hot-update logic exists once. A host only picks its slot - the cache entry, see paths.ts - and
 * how it reacts to changes; `startGraphService` below is that one entry point.
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
	/** Instance slot choosing the cache entry: `portSlot(port)` for the Web UI, "tui" for the TUI. */
	slot?: GraphSlot;
	/** Override for tests. */
	debounceMs?: number;
	/** Override for tests. */
	reconcileMs?: number;
	/** Decide what happens when this slot's lock file is already there - see GraphLockConflictHandler. */
	onLockConflict?: GraphLockConflictHandler;
}

/** What we can tell about the process that holds a lock file: its pid, and whether it still runs. */
export interface GraphLockInfo {
	/** The blocking lock file (one lock per database; see paths.ts). */
	lockPath: string;
	/** The pid the lock names, or null when the file could not be parsed (a crash mid-write). */
	pid: number | null;
	/**
	 * Whether that pid is running right now. This is the only clue available, and it is enough to
	 * spot a lock whose holder is gone, but not to tell a real holder from a pid that Windows has
	 * since reused for an unrelated process - which is why the host gets to decide.
	 */
	holderRunning: boolean;
}

/**
 * Called when the lock file for this slot already exists, before the service decides anything.
 * Return true to delete it and race for it once more, false to run without the graph.
 *
 * `conflict` says which round it is: "blocked" is the original conflict, "still-held" means the
 * deletion was authorised but the lock came back (or could not be removed) before we could take
 * it - nothing is left to decide there, the return value is ignored.
 *
 * With no handler the service recycles a lock whose holder is gone without a word (the hard-kill
 * case) and gives up quietly on anything else.
 */
export type GraphLockConflictHandler = (
	info: GraphLockInfo,
	conflict: "blocked" | "still-held",
) => boolean | Promise<boolean>;

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
	/** The cache entry this service owns: one database, sidecar and lock per (project, slot). */
	private readonly paths: GraphPaths;
	private lockHeld = false;
	private lockFd: number | null = null;

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
	) {
		this.paths = graphPaths(projectRoot, options.slot ?? DEFAULT_SLOT);
	}

	// ---------------------------------------------------------------- lifecycle

	/**
	 * Start the service: take this slot's lock, cold start, arm watcher + reconciliation. Returns
	 * false when another process of the same slot already holds the database.
	 */
	async start(): Promise<boolean> {
		mkdirSync(this.paths.dir, { recursive: true }); // the cache directory may not exist yet
		if (!(await this.acquireLock())) return false;

		this.onColdStart?.("start");
		try {
			this.store = await openGraphStore(
				this.paths.dbPath,
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
		const metaPath = this.paths.metaPath;
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

	/**
	 * Take this slot's lock, or explain why we cannot.
	 *
	 * The lock is one file per database, so its lifetime is that of the process that holds the
	 * database: a hard kill (taskkill, a crash, a power loss) leaves it behind. We can tell that
	 * the recorded pid is gone, and then it is safe to recycle without asking. We cannot tell a
	 * live holder from a pid that the OS has since handed to an unrelated process, so that case
	 * goes to the host, which can put the choice in front of a user.
	 */
	private async acquireLock(): Promise<boolean> {
		if (this.createLockFile()) return true;

		const info = readLockInfo(this.paths.lockPath);
		// Our own lock: never steal it from ourselves - two services of one process on one slot
		// would write the same database as siblings.
		if (info.pid === process.pid) return false;

		const handler = this.options.onLockConflict;
		if (handler) {
			if (!(await handler(info, "blocked"))) return false;
		} else if (info.pid === null || info.holderRunning) {
			return false; // a lock we must respect, and nobody to ask about it
		}

		if (!this.removeLockFile() || !this.createLockFile()) {
			await handler?.(info, "still-held"); // an opened door, but the lock was back first
			return false;
		}
		return true;
	}

	/** O_EXCL create: only one process can hold this slot's database (doc-014 §3.3/§5). */
	private createLockFile(): boolean {
		try {
			this.lockFd = openSync(this.paths.lockPath, "wx");
			writeSync(this.lockFd, `${process.pid}\n`);
			closeSync(this.lockFd);
			this.lockFd = null;
			this.lockHeld = true;
			return true;
		} catch {
			return false;
		}
	}

	private removeLockFile(): boolean {
		try {
			unlinkSync(this.paths.lockPath);
			return true;
		} catch {
			return false;
		}
	}

	private releaseLock(): void {
		if (!this.lockHeld) return;
		this.removeLockFile();
		this.lockHeld = false;
	}
}

function readLockInfo(lockPath: string): GraphLockInfo {
	let pid: number | null = null;
	try {
		const parsed = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
		if (Number.isFinite(parsed)) pid = parsed;
	} catch {
		// unreadable or empty: treat the holder as unknown
	}
	return { lockPath, pid, holderRunning: pid !== null && processExists(pid) };
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
function attachToCore(service: GraphService, core: Core): void {
	core.fs.onFilesChanged = (paths: string[]) => service.notify(paths);
}

export interface GraphHostOptions {
	/** Instance slot: `portSlot(port)` for the Web UI, `"tui"` for the TUI - see paths.ts. */
	slot: GraphSlot;
	/** Transport hook: the Web UI pushes a message to its sockets; the TUI can just re-read. */
	onChanged?: () => void;
	/** Startup phases, so a host can report one message at the beginning and one when ready. */
	onColdStart?: (phase: "start" | "complete" | "failed") => void;
	/** Lock-conflict hook, so a host can tell the user and confirm a takeover - see the type's doc. */
	onLockConflict?: GraphLockConflictHandler;
}

/**
 * The one way a host brings up the graph (doc-014 §3.3).
 *
 * Build and hot-update logic live entirely in this service and the store, so a host never
 * reimplements any of it - it chooses a slot (which cache entry to own) and what to do when the
 * graph changed. Returns null when a process of the same slot already holds the database, or when
 * the cache directory cannot be prepared; the caller's own features keep working off markdown.
 */
export async function startGraphService(core: Core, options: GraphHostOptions): Promise<GraphService | null> {
	const service = new GraphService(core.filesystem.rootDir, {
		slot: options.slot,
		onLockConflict: options.onLockConflict,
	});
	attachToCore(service, core);
	service.onGraphChanged = options.onChanged ?? null;
	service.onColdStart = options.onColdStart ?? null;
	return (await service.start()) ? service : null;
}
