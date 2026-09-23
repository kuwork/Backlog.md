import { type FSWatcher, watch } from "node:fs";
import { stat } from "node:fs/promises";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { extractAnyPrefix, hasAnyPrefix } from "./prefix-config.ts";
import { extractTaskIdFromFilename, normalizeTaskId, normalizeTaskIdentity, taskIdsEqual } from "./task-path.ts";

export interface TaskWatcherCallbacks {
	/** Called when a new task file is created */
	onTaskAdded?: (task: Task) => void | Promise<void>;
	/** Called when an existing task file is modified */
	onTaskChanged?: (task: Task) => void | Promise<void>;
	/** Called when a task file is removed */
	onTaskRemoved?: (taskId: string) => void | Promise<void>;
}

interface TaskReconciliation {
	generation: number;
	processing: boolean;
	pending: boolean;
	hasPublishedState: boolean;
	lastPublishedSignature: string | null;
}

type TaskFileSnapshot = { state: "complete"; taskIds: Set<string> } | { state: "incomplete" };

const TASK_SETTLE_DELAY_MS = 50;
const TASK_RETRY_DELAY_MS = 35;
const TASK_READ_ATTEMPTS = 8;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUsableTask(task: Task | null, taskId: string): task is Task {
	return Boolean(task && taskIdsEqual(task.id, taskId) && task.title.trim() && task.status.trim());
}

/**
 * What counts as a content change for a task: everything except the fields that describe where the
 * record came from rather than what it says. Exported because the board compares the same signature
 * when it decides whether an open popup still matches the task behind it - one definition, so the
 * echo the watcher publishes after an in-popup edit compares equal instead of forcing a rebuild.
 */
export function taskContentSignature(task: Task): string {
	const { branch: _branch, filePath: _filePath, lastModified: _lastModified, source: _source, ...content } = task;
	return JSON.stringify(content);
}

function createReconciliation(initialTask?: Task): TaskReconciliation {
	return {
		generation: 0,
		processing: false,
		pending: false,
		hasPublishedState: initialTask !== undefined,
		lastPublishedSignature: initialTask ? taskContentSignature(initialTask) : null,
	};
}

/**
 * Which ids a folder currently holds, by filename. The prefix is read off each filename rather than
 * assumed, because the folder being watched is the drafts one in a drafts session and a project can
 * configure its own task prefix (this repository uses "back", not the default "task").
 */
function taskIdFromFilename(filename: string): string | null {
	const prefix = extractAnyPrefix(filename);
	return prefix ? extractTaskIdFromFilename(filename, prefix) : null;
}

async function readTaskFileSnapshot(dir: string): Promise<TaskFileSnapshot> {
	try {
		const directory = await stat(dir);
		if (!directory.isDirectory()) return { state: "incomplete" };
		const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: dir, followSymlinks: true }));
		await stat(dir);
		const taskIds = new Set<string>();
		for (const file of files) {
			const taskId = taskIdFromFilename(file);
			if (taskId) taskIds.add(normalizeTaskId(taskId));
		}
		return { state: "complete", taskIds };
	} catch {
		return { state: "incomplete" };
	}
}

/**
 * Watch a folder of records and emit incremental updates.
 *
 * Defaults to the checkout's tasks; a drafts session passes `{ drafts: true }` and gets the same
 * behaviour over the drafts folder, so the views behind it (the board, the list detail pane, the
 * task popup) follow a draft the CLI, the web UI or an editor writes - exactly as they follow a
 * task. Only the folder and the store that reads it change; the settle/retry budget, the content
 * signature, the directory reconciliation and the removal confirmation are shared.
 *
 * A single filesystem event is reconciled until task content is stable or absence is
 * confirmed, because atomic writes can make the event visible before the file is.
 */
export function watchTasks(
	core: Core,
	callbacks: TaskWatcherCallbacks,
	initialTasks: readonly Task[] = [],
	options: { drafts?: boolean } = {},
): { stop: () => void } {
	const watchDrafts = options.drafts === true;
	const dir = watchDrafts ? core.filesystem.draftsDir : core.filesystem.tasksDir;
	const loadRecord = (recordId: string) =>
		watchDrafts ? core.filesystem.loadDraft(recordId) : core.filesystem.loadTask(recordId);
	const listRecords = () => (watchDrafts ? core.filesystem.listDrafts() : core.filesystem.listTasks());
	const reconciliations = new Map(
		initialTasks.filter((task) => !task.branch).map((task) => [normalizeTaskId(task.id), createReconciliation(task)]),
	);
	let stopped = false;
	let directoryGeneration = 0;

	const reconcile = async (taskId: string, state: TaskReconciliation, eventGeneration: number): Promise<void> => {
		let previousCandidateSignature: string | null | undefined;

		for (let attempt = 0; attempt < TASK_READ_ATTEMPTS; attempt++) {
			await delay(attempt === 0 ? TASK_SETTLE_DELAY_MS : TASK_RETRY_DELAY_MS);
			if (stopped || eventGeneration !== state.generation) return;

			let task: Task | null = null;
			try {
				task = await loadRecord(taskId);
			} catch {
				continue;
			}

			if (!isUsableTask(task, taskId)) {
				previousCandidateSignature = task === null ? null : undefined;
				if (attempt < TASK_READ_ATTEMPTS - 1) continue;

				const fileSnapshot = await readTaskFileSnapshot(dir);
				const isConfirmedAbsent =
					task === null && fileSnapshot.state === "complete" && !fileSnapshot.taskIds.has(normalizeTaskId(taskId));
				if (isConfirmedAbsent && (!state.hasPublishedState || state.lastPublishedSignature !== null)) {
					try {
						await callbacks.onTaskRemoved?.(taskId);
						state.hasPublishedState = true;
						state.lastPublishedSignature = null;
					} catch {
						// Callback failures are bounded by the same finite reconciliation budget.
					}
				}
				return;
			}

			const signature = taskContentSignature(task);
			if (signature !== previousCandidateSignature) {
				previousCandidateSignature = signature;
				continue;
			}
			if (state.hasPublishedState && state.lastPublishedSignature === signature) return;

			try {
				if (!state.hasPublishedState || state.lastPublishedSignature === null) {
					await callbacks.onTaskAdded?.(normalizeTaskIdentity(task));
				} else {
					await callbacks.onTaskChanged?.(normalizeTaskIdentity(task));
				}
				state.hasPublishedState = true;
				state.lastPublishedSignature = signature;
				return;
			} catch {
				// Retry callback delivery while this event remains current.
			}
		}
	};

	const drain = async (taskId: string, state: TaskReconciliation): Promise<void> => {
		if (state.processing) return;
		state.processing = true;
		try {
			do {
				state.pending = false;
				await reconcile(taskId, state, state.generation);
			} while (!stopped && state.pending);
		} finally {
			state.processing = false;
			if (!stopped && state.pending) void drain(taskId, state).catch(() => {});
		}
	};

	const schedule = (taskId: string) => {
		const normalizedTaskId = normalizeTaskId(taskId);
		const state = reconciliations.get(normalizedTaskId) ?? createReconciliation();
		reconciliations.set(normalizedTaskId, state);
		state.generation += 1;
		state.pending = true;
		void drain(normalizedTaskId, state).catch(() => {});
	};
	const scheduleDirectoryReconciliation = () => {
		const eventGeneration = ++directoryGeneration;
		void (async () => {
			const visibleTaskIds = new Set<string>();
			let taskFileIds: Set<string> | null = null;
			for (let attempt = 0; attempt < TASK_READ_ATTEMPTS; attempt++) {
				await delay(attempt === 0 ? TASK_SETTLE_DELAY_MS : TASK_RETRY_DELAY_MS);
				if (stopped || eventGeneration !== directoryGeneration) return;

				const fileSnapshot = await readTaskFileSnapshot(dir);
				if (fileSnapshot.state === "incomplete") continue;
				let tasks: Task[];
				try {
					tasks = await listRecords();
				} catch {
					continue;
				}
				taskFileIds = fileSnapshot.taskIds;
				visibleTaskIds.clear();
				for (const task of tasks) {
					if (!isUsableTask(task, task.id)) continue;
					const taskId = normalizeTaskId(task.id);
					visibleTaskIds.add(taskId);
					const state = reconciliations.get(taskId);
					if (!state?.hasPublishedState || state.lastPublishedSignature !== taskContentSignature(task)) {
						schedule(taskId);
					}
				}
			}

			if (stopped || eventGeneration !== directoryGeneration || !taskFileIds) return;
			for (const taskId of reconciliations.keys()) {
				if (!visibleTaskIds.has(taskId) && !taskFileIds.has(taskId)) schedule(taskId);
			}
		})().catch(() => {});
	};

	const watcher: FSWatcher = watch(dir, { recursive: false }, (eventType, filename) => {
		if (eventType !== "change" && eventType !== "rename") return;

		const rawFilename: unknown = filename;
		const fileName =
			typeof rawFilename === "string" ? rawFilename : rawFilename != null ? String(rawFilename) : undefined;
		const [taskId] = fileName?.split(" ") ?? [];
		if (!fileName || !taskId || !hasAnyPrefix(taskId) || !fileName.endsWith(".md")) {
			scheduleDirectoryReconciliation();
			return;
		}

		schedule(taskId);
	});
	watcher.on("error", (error) => {
		if (process.env.DEBUG) console.warn("Task watcher error", error);
	});

	return {
		stop() {
			stopped = true;
			directoryGeneration += 1;
			for (const state of reconciliations.values()) {
				state.generation += 1;
				state.pending = false;
			}
			try {
				watcher.close();
			} catch {}
		},
	};
}
