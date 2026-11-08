/**
 * Task loading with optimized index-first, hydrate-later pattern
 * Dramatically reduces git operations for multi-branch task loading
 *
 * This is the single module for all cross-branch task loading:
 * - Local filesystem tasks
 * - Other local branch tasks
 * - Remote branch tasks
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import type { GitBranchTip, GitOperations } from "../git/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { backlogCacheDir } from "../utils/cache-dir.ts";
import { isCacheDisabled } from "../utils/cache-policy.ts";
import { logLine } from "../utils/log.ts";
import { extractAnyPrefix } from "../utils/prefix-config.ts";
import {
	canonicalTaskId,
	extractTaskIdFromFilename,
	normalizeTaskId,
	normalizeTaskIdentity,
} from "../utils/task-path.ts";
import type { TaskDirectoryType } from "./cross-branch-tasks.ts";
import { normalizeTaskLifecyclePath } from "./task-identity-index.ts";

/** Default prefix for tasks */
const DEFAULT_TASK_PREFIX = "task";

/**
 * Cross-restart cache for per-commit branch indexes and parsed tasks. A branch tip resolves to a
 * commit; that commit is content-addressed, so an unchanged branch (same tip commit) reuses the
 * cached index + parsed tasks without a single git read. Only a branch whose tip commit changed is
 * re-read. Namespaced by repo root so unrelated repositories never collide.
 */
const BRANCH_CACHE_MAX_INDEX_FILES = 512;
const BRANCH_CACHE_MAX_TASK_BUNDLES = 128;

function branchCacheRootFor(repoRoot: string): string {
	const rootHash = createHash("sha256").update(repoRoot).digest("hex");
	return backlogCacheDir("branch-cache", rootHash);
}

function branchIndexCacheFile(root: string, key: string): string {
	return join(root, "commit-index", `${createHash("sha256").update(key).digest("hex")}.json`);
}

/**
 * One bundle per commit, not one file per task: a commit that contributes ~1.7k tasks would
 * otherwise mean ~1.7k small awaited writes (mkdir + write + rename each), which dominates
 * startup on Windows. Bundling keeps a warm branch to a single read and a cold one to a
 * single write.
 */
function branchTaskBundleFile(root: string, commit: string): string {
	return join(root, "tasks", `${createHash("sha256").update(commit).digest("hex")}.json`);
}

async function readJson<T>(file: string): Promise<T> {
	return JSON.parse(await readFile(file, "utf8")) as T;
}

/** Commits are 40 chars; logs only need enough to tell branches apart. */
function shortCommit(commit: string): string {
	return commit.slice(0, 7);
}

/** Cache logs name the branch and whether it is local or remote, so a slow phase is attributable. */
function describeRef(ref: string, source: "remote" | "local-branch"): string {
	return `${ref} (${source === "remote" ? "remote" : "local"})`;
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
	await mkdir(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	await writeFile(tmp, JSON.stringify(data), "utf8");
	await rename(tmp, file);
}

/** Cap a cache directory's file count by deleting the oldest entries (best-effort, fire-and-forget safe). */
async function pruneDirIfNeeded(dir: string, maxFiles: number): Promise<void> {
	try {
		const entries = await readdir(dir);
		if (entries.length <= maxFiles) return;
		const withMtime = await Promise.all(
			entries.map(async (name) => ({ name, mtime: (await stat(join(dir, name))).mtimeMs })),
		);
		withMtime.sort((a, b) => a.mtime - b.mtime);
		const toDelete = withMtime.slice(0, withMtime.length - maxFiles);
		await Promise.all(toDelete.map((e) => rm(join(dir, e.name), { force: true })));
	} catch {
		// Best-effort cache hygiene; never fail a real request over it.
	}
}

export function getBranchHistoryCutoff(activeBranchDays: number, now = Date.now()): Date | undefined {
	if (!activeBranchDays) return undefined;
	const cutoff = new Date(now);
	cutoff.setUTCHours(0, 0, 0, 0);
	cutoff.setUTCDate(cutoff.getUTCDate() - activeBranchDays);
	return cutoff;
}

export interface BranchTaskStateEntry {
	id: string;
	type: TaskDirectoryType;
	lastModified: Date;
	branch: string;
	path: string;
	task?: Task;
}

export interface BranchTaskLoadResult {
	entries: BranchTaskStateEntry[];
	/** False when at least one branch index or selected task payload could not be read. */
	complete: boolean;
}

function extractConfiguredTaskId(filePath: string, prefix: string): string | null {
	const filename = filePath.slice(filePath.lastIndexOf("/") + 1);
	const taskId = extractTaskIdFromFilename(filename, prefix);
	const taskPrefix = taskId ? extractAnyPrefix(taskId) : null;
	return taskPrefix?.toLowerCase() === prefix.toLowerCase() ? taskId : null;
}

const STATE_DIRECTORIES: Array<{ path: string; type: TaskDirectoryType }> = [
	{ path: "tasks", type: "task" },
	{ path: "drafts", type: "draft" },
	{ path: "archive/tasks", type: "archived" },
	{ path: "completed", type: "completed" },
];

function getTaskTypeFromPath(path: string, backlogDir: string): TaskDirectoryType | null {
	const normalized = path.startsWith(`${backlogDir}/`) ? path.slice(backlogDir.length + 1) : path;

	for (const { path: dir, type } of STATE_DIRECTORIES) {
		if (normalized.startsWith(`${dir}/`)) {
			return type;
		}
	}

	return null;
}

/**
 * Get the appropriate loading message based on remote operations configuration
 */
export function getTaskLoadingMessage(config: BacklogConfig | null): string {
	return config?.remoteOperations === false
		? "Loading tasks from local branches..."
		: "Loading tasks from local and remote branches...";
}

interface RemoteIndexEntry {
	id: string;
	branch: string;
	path: string; // "backlog/tasks/task-123 - title.md"
	lastModified: Date;
	commit: string;
	stateEntry?: BranchTaskStateEntry;
}

interface HydrationCandidate {
	id: string;
	ref: string;
	path: string;
	commit: string;
	stateEntry?: BranchTaskStateEntry;
}

interface CachedTaskTreeEntry {
	id: string;
	path: string;
	type: TaskDirectoryType | null;
	lastModified: number;
}

interface PinnedBranchRef {
	branch: string;
	ref: string;
	commit: string;
	source: "local-branch" | "remote";
}

interface HydrationOptions {
	source: "local-branch" | "remote";
	loadTask: (commit: string, path: string) => Promise<Task | null>;
}

function logicalTaskPath(path: string, backlogDir: string): string {
	const normalizedPath = path.replaceAll("\\", "/");
	const normalizedBacklogDir = backlogDir
		.replaceAll("\\", "/")
		.replace(/^\.\//, "")
		.replace(/^\/+|\/+$/g, "");
	const backlogMarker = `/${normalizedBacklogDir}/`;
	const markerIndex = normalizedPath.indexOf(backlogMarker);
	const logicalPath = markerIndex >= 0 ? normalizedPath.slice(markerIndex + 1) : normalizedPath.replace(/^\.\//, "");
	return normalizeTaskLifecyclePath(logicalPath, normalizedBacklogDir);
}

function lifecycleRank(type: TaskDirectoryType | undefined): number {
	if (type === "task") return 2;
	if (type === "completed") return 1;
	return 0;
}

function isPreferredIdentityEntry(candidate: RemoteIndexEntry, current: RemoteIndexEntry): boolean {
	const timeDifference = candidate.lastModified.getTime() - current.lastModified.getTime();
	if (timeDifference !== 0) return timeDifference > 0;
	const rankDifference = lifecycleRank(candidate.stateEntry?.type) - lifecycleRank(current.stateEntry?.type);
	if (rankDifference !== 0) return rankDifference > 0;
	return `${candidate.branch}\0${candidate.path}`.localeCompare(`${current.branch}\0${current.path}`) < 0;
}

function selectPreferredIdentityEntry(entries: RemoteIndexEntry[]): RemoteIndexEntry {
	const first = entries[0];
	if (!first) throw new Error("Cannot select a task from an empty branch index");
	return entries
		.slice(1)
		.reduce((current, candidate) => (isPreferredIdentityEntry(candidate, current) ? candidate : current), first);
}

function chooseIdentityHydrationCandidates(
	index: Map<string, RemoteIndexEntry[]>,
	localTasks: Task[] | undefined,
	backlogDir: string,
	toRef: (entry: RemoteIndexEntry) => string,
): HydrationCandidate[] {
	const localIdentities = new Set(
		(localTasks ?? [])
			.filter((task) => task.filePath)
			.map((task) => `${canonicalTaskId(task.id)}\0${logicalTaskPath(task.filePath ?? "", backlogDir)}`),
	);
	const winners = new Map<string, RemoteIndexEntry>();
	for (const entries of index.values()) {
		for (const entry of entries) {
			const identity = `${canonicalTaskId(entry.id)}\0${logicalTaskPath(entry.path, backlogDir)}`;
			if (localIdentities.has(identity)) continue;
			const current = winners.get(identity);
			if (!current || isPreferredIdentityEntry(entry, current)) winners.set(identity, entry);
		}
	}

	return [...winners.values()].map((entry) => ({
		id: entry.id,
		ref: toRef(entry),
		path: entry.path,
		commit: entry.commit,
		stateEntry: entry.stateEntry,
	}));
}

function mergeHydrationCandidates(
	primary: HydrationCandidate[],
	supplemental: HydrationCandidate[],
): HydrationCandidate[] {
	const candidates = new Map<string, HydrationCandidate>();
	for (const candidate of [...primary, ...supplemental]) {
		candidates.set(`${candidate.ref}\0${candidate.path}\0${candidate.commit}`, candidate);
	}
	return [...candidates.values()];
}

function normalizeRemoteBranch(branch: string): string | null {
	let br = branch.trim();
	if (!br) return null;
	br = br.replace(/^refs\/remotes\//, "");
	if (br === "origin" || br === "HEAD" || br === "origin/HEAD") return null;
	if (br.startsWith("origin/")) br = br.slice("origin/".length);
	// Filter weird cases like "origin" again after stripping prefix
	if (!br || br === "HEAD" || br === "origin") return null;
	return br;
}

/**
 * Normalize a local branch name, filtering out invalid entries
 */
function normalizeLocalBranch(branch: string, currentBranch: string): string | null {
	const br = branch.trim();
	if (!br) return null;
	// Skip HEAD, origin refs, and current branch
	if (br === "HEAD" || br.includes("HEAD")) return null;
	if (br.startsWith("origin/") || br.startsWith("refs/remotes/")) return null;
	if (br === "origin") return null;
	// Skip current branch - we already have its tasks from filesystem
	if (br === currentBranch) return null;
	return br;
}

/**
 * Hydrate tasks by fetching their content
 * Only call this for the "winner" tasks that we actually need
 */
async function hydrateTasks(winners: HydrationCandidate[], options: HydrationOptions): Promise<boolean> {
	const CONCURRENCY = 8;
	let i = 0;
	let complete = true;

	async function worker() {
		while (i < winners.length) {
			const idx = i++;
			if (idx >= winners.length) break;

			const w = winners[idx];
			if (!w) break;

			try {
				const task = await options.loadTask(w.commit, w.path);
				if (task) {
					task.source = options.source;
					task.branch = options.source === "remote" ? w.ref.replace(/^origin\//, "") : w.ref;
					if (w.stateEntry) w.stateEntry.task = task;
				}
			} catch (error) {
				complete = false;
				console.error(`Failed to hydrate task ${w.id} from ${w.ref}:${w.path}`, error);
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, winners.length) }, worker));
	return complete;
}

/**
 * Choose which remote tasks need to be hydrated based on strategy
 * Returns only the tasks that are newer or more progressed than local versions
 */
function chooseWinners(
	localById: Map<string, Task>,
	remoteIndex: Map<string, RemoteIndexEntry[]>,
	strategy: "most_recent" | "most_progressed",
	toRef: (entry: RemoteIndexEntry) => string,
): HydrationCandidate[] {
	const winners: HydrationCandidate[] = [];

	for (const [id, entries] of remoteIndex) {
		const local = localById.get(id);

		if (!local) {
			// No local version - take the newest remote
			const best = selectPreferredIdentityEntry(entries);
			winners.push({
				id,
				ref: toRef(best),
				path: best.path,
				commit: best.commit,
				stateEntry: best.stateEntry,
			});
			continue;
		}

		// If strategy is "most_recent", only hydrate if any remote is newer
		if (strategy === "most_recent") {
			const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
			const newestRemote = selectPreferredIdentityEntry(entries);

			if (newestRemote.lastModified.getTime() > localTs) {
				winners.push({
					id,
					ref: toRef(newestRemote),
					path: newestRemote.path,
					commit: newestRemote.commit,
					stateEntry: newestRemote.stateEntry,
				});
			}
			continue;
		}

		// For "most_progressed", we might need to check if remote is newer
		// to potentially have a more progressed status
		const localTs = local.updatedDate ? new Date(local.updatedDate).getTime() : 0;
		const maybeNewer = entries.some((e) => e.lastModified.getTime() > localTs);

		if (maybeNewer) {
			// Only hydrate the newest remote to check if it's more progressed
			const newestRemote = selectPreferredIdentityEntry(entries);
			winners.push({
				id,
				ref: toRef(newestRemote),
				path: newestRemote.path,
				commit: newestRemote.commit,
				stateEntry: newestRemote.stateEntry,
			});
		}
	}

	return winners;
}

/**
 * Reuses immutable branch trees and task blobs for the lifetime of one Core.
 * Branch names are deliberately kept out of cache keys: several refs at one
 * commit share the same Git reads, while fresh state entries retain each ref's
 * provenance for identity and ambiguity resolution.
 */
export class BranchTaskLoader {
	private readonly commitIndexCache = new Map<string, Promise<readonly CachedTaskTreeEntry[]>>();
	private readonly taskCache = new Map<string, { commit: string; promise: Promise<Task | null> }>();
	/** commit -> path -> parsed task, loaded once per commit from one bundle file. */
	private readonly taskBundles = new Map<string, Promise<Record<string, Task>>>();
	/** Commits whose in-memory bundle gained entries that are not on disk yet. */
	private readonly dirtyTaskBundles = new Set<string>();
	/** Human label per commit (branch ref + local/remote) for cache logs. */
	private readonly commitLabels = new Map<string, string>();
	/** Build start times per commit, so the flush can report how long the build took. */
	private readonly bundleBuildStartedAt = new Map<string, number>();
	/** Lazily resolved repo-root cache directory; null means disk caching is unavailable (degrade to in-memory). */
	private repoCacheRootPromise: Promise<string | null> | null = null;

	constructor(private readonly git: GitOperations) {}

	private resolveRepoCacheRoot(): Promise<string | null> {
		if (!this.repoCacheRootPromise) {
			this.repoCacheRootPromise = (async () => {
				try {
					const root = await this.git.getRepositoryRoot();
					if (!root) return null;
					const cacheRoot = branchCacheRootFor(root);
					logLine("cache", `branch cache dir ${cacheRoot}`);
					return cacheRoot;
				} catch {
					return null;
				}
			})();
		}
		return this.repoCacheRootPromise;
	}

	clear(): void {
		this.commitIndexCache.clear();
		this.taskCache.clear();
		this.taskBundles.clear();
		this.dirtyTaskBundles.clear();
	}

	retainSnapshot(
		tips: readonly GitBranchTip[],
		options: { backlogDir: string; prefix: string; activeBranchDays: number },
	): void {
		const historyCutoff = getBranchHistoryCutoff(options.activeBranchDays);
		const retainedCommits = new Set(tips.map((tip) => tip.commit));
		const retainedIndexKeys = new Set(
			[...retainedCommits].map((commit) =>
				this.commitIndexKey(commit, options.backlogDir, options.prefix, historyCutoff),
			),
		);
		for (const key of this.commitIndexCache.keys()) {
			if (!retainedIndexKeys.has(key)) this.commitIndexCache.delete(key);
		}
		for (const [key, entry] of this.taskCache) {
			if (!retainedCommits.has(entry.commit)) this.taskCache.delete(key);
		}
	}

	async load(
		tips: readonly GitBranchTip[],
		userConfig: BacklogConfig | null,
		localTasks: Task[],
		includeCompleted: boolean,
		backlogDir: string = DEFAULT_DIRECTORIES.BACKLOG,
		onProgress?: (message: string) => void,
		currentBranch?: string,
	): Promise<BranchTaskLoadResult> {
		const branchRefs = await this.getPinnedBranchRefs(tips, userConfig, currentBranch);
		if (branchRefs.length === 0) return { entries: [], complete: true };

		const remoteCount = branchRefs.filter((branch) => branch.source === "remote").length;
		const localCount = branchRefs.length - remoteCount;
		if (remoteCount > 0) onProgress?.(`Indexing ${remoteCount} recent remote branches...`);
		if (localCount > 0) onProgress?.(`Indexing ${localCount} other local branches...`);

		const prefix = userConfig?.prefixes?.task ?? DEFAULT_TASK_PREFIX;
		const historyCutoff = getBranchHistoryCutoff(userConfig?.activeBranchDays ?? 30);
		const stateEntries: BranchTaskStateEntry[] = [];
		const remoteIndex = new Map<string, RemoteIndexEntry[]>();
		const localIndex = new Map<string, RemoteIndexEntry[]>();
		const queue = [...branchRefs];
		const CONCURRENCY = 4;
		let complete = true;
		// Bundle logs fire once per commit (not per ref), so remember which ref first asked for it.
		for (const branchRef of branchRefs) {
			if (!this.commitLabels.has(branchRef.commit)) {
				this.commitLabels.set(branchRef.commit, describeRef(branchRef.ref, branchRef.source));
			}
		}

		const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
			while (queue.length > 0) {
				const branchRef = queue.pop();
				if (!branchRef) break;
				try {
					const tree = await this.loadCommitIndex(
						branchRef.commit,
						backlogDir,
						prefix,
						historyCutoff,
						describeRef(branchRef.ref, branchRef.source),
					);
					const index = branchRef.source === "remote" ? remoteIndex : localIndex;
					for (const cached of tree) {
						const lastModified = new Date(cached.lastModified);
						const entry: RemoteIndexEntry = {
							id: cached.id,
							branch: branchRef.branch,
							path: cached.path,
							lastModified,
							commit: branchRef.commit,
						};
						if (cached.type) {
							entry.stateEntry = {
								id: cached.id,
								type: cached.type,
								branch: branchRef.ref,
								path: cached.path,
								lastModified,
							};
							stateEntries.push(entry.stateEntry);
						}
						if (cached.type === "task" || (includeCompleted && cached.type === "completed")) {
							const entries = index.get(cached.id);
							if (entries) entries.push(entry);
							else index.set(cached.id, [entry]);
						}
					}
				} catch (error) {
					complete = false;
					if (process.env.DEBUG) {
						console.debug(`Skipping branch ${branchRef.ref}: ${error}`);
					}
				}
			}
		});
		await Promise.all(workers);

		const localById = new Map(localTasks.map((task) => [normalizeTaskId(task.id), task]));
		const strategy = userConfig?.taskResolutionStrategy ?? "most_progressed";
		const candidatesFor = (
			index: Map<string, RemoteIndexEntry[]>,
			source: "local-branch" | "remote",
		): HydrationCandidate[] => {
			const toRef =
				source === "remote"
					? (entry: RemoteIndexEntry) => `origin/${entry.branch}`
					: (entry: RemoteIndexEntry) => entry.branch;
			let candidates: HydrationCandidate[];
			if (localTasks.length > 0) {
				candidates = chooseWinners(localById, index, strategy, toRef);
			} else {
				candidates = [];
				for (const [id, entries] of index) {
					const best = selectPreferredIdentityEntry(entries);
					candidates.push({
						id,
						ref: toRef(best),
						path: best.path,
						commit: best.commit,
						stateEntry: best.stateEntry,
					});
				}
			}
			return mergeHydrationCandidates(
				candidates,
				chooseIdentityHydrationCandidates(index, localTasks, backlogDir, toRef),
			);
		};

		const loadTask = (commit: string, path: string) => this.loadCachedTask(commit, path);
		const hydrationResults = await Promise.all([
			hydrateTasks(candidatesFor(remoteIndex, "remote"), { source: "remote", loadTask }),
			hydrateTasks(candidatesFor(localIndex, "local-branch"), {
				source: "local-branch",
				loadTask,
			}),
		]);
		await this.flushTaskBundles();
		return {
			entries: stateEntries,
			complete: complete && hydrationResults.every(Boolean),
		};
	}

	private async getPinnedBranchRefs(
		tips: readonly GitBranchTip[],
		userConfig: BacklogConfig | null,
		snapshotCurrentBranch?: string,
	): Promise<PinnedBranchRef[]> {
		const isRemote = (name: string) => {
			const normalized = name.trim().replace(/^refs\/remotes\//, "");
			return normalized.startsWith("origin/");
		};
		const currentTip = tips.find((tip) => tip.current && !isRemote(tip.name));
		const currentBranch = currentTip?.name ?? snapshotCurrentBranch ?? (await this.git.getCurrentBranch()).trim();
		const refs: PinnedBranchRef[] = [];
		const seen = new Set<string>();

		for (const tip of tips) {
			let branchRef: PinnedBranchRef | null = null;
			if (isRemote(tip.name)) {
				if (userConfig?.remoteOperations === false) continue;
				const branch = normalizeRemoteBranch(tip.name);
				if (branch) {
					branchRef = { branch, ref: `origin/${branch}`, commit: tip.commit, source: "remote" };
				}
			} else if (currentBranch && !tip.current) {
				const branch = normalizeLocalBranch(tip.name, currentBranch);
				if (branch) branchRef = { branch, ref: branch, commit: tip.commit, source: "local-branch" };
			}

			if (!branchRef) continue;
			const key = `${branchRef.source}\0${branchRef.ref}\0${branchRef.commit}`;
			if (seen.has(key)) continue;
			seen.add(key);
			refs.push(branchRef);
		}
		return refs;
	}

	private commitIndexKey(commit: string, backlogDir: string, prefix: string, cutoff: Date | undefined): string {
		return JSON.stringify([commit, backlogDir, prefix.toLowerCase(), cutoff?.getTime() ?? null]);
	}

	private async loadCommitIndex(
		commit: string,
		backlogDir: string,
		prefix: string,
		historyCutoff: Date | undefined,
		label: string,
	): Promise<readonly CachedTaskTreeEntry[]> {
		const key = this.commitIndexKey(commit, backlogDir, prefix, historyCutoff);
		const cached = this.commitIndexCache.get(key);
		if (cached) return await cached;

		// Set the cache synchronously so concurrent loads of the same commit (e.g. a local and a
		// remote ref pointing at the same tip) dedupe on the in-memory promise instead of each
		// hitting git. The disk read runs inside the promise and short-circuits the git walk.
		const promise = (async (): Promise<readonly CachedTaskTreeEntry[]> => {
			const root = await this.resolveRepoCacheRoot();
			if (root && !isCacheDisabled()) {
				const fromDisk = await readJson<CachedTaskTreeEntry[]>(branchIndexCacheFile(root, key)).catch(() => null);
				if (fromDisk) {
					logLine("cache", `restored index  ${label} @ ${shortCommit(commit)} (${fromDisk.length} entries)`);
					return fromDisk;
				}
			}
			logLine("cache", `building index  ${label} @ ${shortCommit(commit)}`);
			const startedAt = Date.now();
			const files = await this.git.listFilesInTree(commit, backlogDir);
			const lastModified =
				files.length === 0
					? new Map<string, Date>()
					: await this.git.getBranchLastModifiedMap(commit, backlogDir, historyCutoff);
			const result = files.flatMap((path) => {
				const id = extractConfiguredTaskId(path, prefix);
				if (!id) return [];
				return [
					{
						id,
						path,
						type: getTaskTypeFromPath(path, backlogDir),
						lastModified: (lastModified.get(path) ?? new Date(0)).getTime(),
					},
				];
			});
			if (root) {
				await writeJsonAtomic(branchIndexCacheFile(root, key), result);
				void pruneDirIfNeeded(join(root, "commit-index"), BRANCH_CACHE_MAX_INDEX_FILES);
			}
			logLine(
				"cache",
				`built    index  ${label} @ ${shortCommit(commit)} (${result.length} entries, ${Date.now() - startedAt}ms)`,
			);
			return result;
		})();
		this.commitIndexCache.set(key, promise);
		try {
			return await promise;
		} catch (error) {
			if (this.commitIndexCache.get(key) === promise) this.commitIndexCache.delete(key);
			throw error;
		}
	}

	private loadTaskBundle(commit: string): Promise<Record<string, Task>> {
		let bundle = this.taskBundles.get(commit);
		if (!bundle) {
			bundle = (async () => {
				const root = await this.resolveRepoCacheRoot();
				if (!root) return {};
				const label = this.commitLabels.get(commit) ?? shortCommit(commit);
				const fromDisk = isCacheDisabled()
					? null
					: await readJson<Record<string, Task>>(branchTaskBundleFile(root, commit)).catch(() => null);
				if (fromDisk) {
					logLine("cache", `restored tasks  ${label} @ ${shortCommit(commit)} (${Object.keys(fromDisk).length} tasks)`);
					return fromDisk;
				}
				logLine("cache", `building tasks  ${label} @ ${shortCommit(commit)}`);
				this.bundleBuildStartedAt.set(commit, Date.now());
				return {};
			})();
			this.taskBundles.set(commit, bundle);
		}
		return bundle;
	}

	/**
	 * Persist every commit bundle that gained entries this load. One awaited write per commit, so a
	 * warm start is a handful of writes at most; failures are best-effort and never fail the load.
	 */
	private async flushTaskBundles(): Promise<void> {
		if (this.dirtyTaskBundles.size === 0) return;
		const root = await this.resolveRepoCacheRoot();
		if (!root) {
			this.dirtyTaskBundles.clear();
			return;
		}
		const commits = [...this.dirtyTaskBundles];
		this.dirtyTaskBundles.clear();
		await Promise.all(
			commits.map(async (commit) => {
				const bundle = await this.taskBundles.get(commit);
				if (!bundle) return;
				const label = this.commitLabels.get(commit) ?? shortCommit(commit);
				const startedAt = this.bundleBuildStartedAt.get(commit) ?? Date.now();
				this.bundleBuildStartedAt.delete(commit);
				try {
					await writeJsonAtomic(branchTaskBundleFile(root, commit), bundle);
					logLine(
						"cache",
						`built    tasks  ${label} @ ${shortCommit(commit)} (${Object.keys(bundle).length} tasks, ${Date.now() - startedAt}ms)`,
					);
				} catch {
					// Best-effort cache; the next load simply re-reads from git.
				}
			}),
		);
		void pruneDirIfNeeded(join(root, "tasks"), BRANCH_CACHE_MAX_TASK_BUNDLES);
	}

	private async loadCachedTask(commit: string, path: string): Promise<Task | null> {
		const key = `${commit}\0${path}`;
		const cached = this.taskCache.get(key);
		if (cached) {
			const task = await cached.promise;
			return task ? structuredClone(task) : null;
		}

		// Set the cache synchronously (mirrors loadCommitIndex) so concurrent loads dedupe; the
		// bundle read runs inside the promise and short-circuits the git show + parse on restart.
		const promise = (async (): Promise<Task | null> => {
			const bundle = await this.loadTaskBundle(commit);
			const fromDisk = bundle[path];
			if (fromDisk) return fromDisk;
			const content = await this.git.showFile(commit, path);
			let task: Task | null;
			try {
				task = normalizeTaskIdentity(parseTask(content));
			} catch (error) {
				console.error(`Failed to parse task ${commit}:${path}`, error);
				return null;
			}
			if (task) {
				bundle[path] = task;
				this.dirtyTaskBundles.add(commit);
			}
			return task;
		})();
		const entry = { commit, promise };
		this.taskCache.set(key, entry);
		try {
			const task = await promise;
			return task ? structuredClone(task) : null;
		} catch (error) {
			if (this.taskCache.get(key)?.promise === promise) this.taskCache.delete(key);
			throw error;
		}
	}
}
