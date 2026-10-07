import type { Task } from "../types/index.ts";
import { normalizeTaskId } from "./task-id.ts";

/**
 * Widen an active corpus with records that already left it.
 *
 * A completed task only ever widens the corpus: when both corpora claim one canonical id, the
 * active record wins, so a live task is never shadowed by its archived copy. Records that exist
 * only in the completed corpus are tagged with their source so callers can still tell where the
 * evidence came from.
 */
export function mergeCompletedIntoActive(activeTasks: Task[], completedTasks: Task[]): Task[] {
	if (completedTasks.length === 0) return activeTasks;
	const byId = new Map(activeTasks.map((task) => [normalizeTaskId(task.id).toLowerCase(), task]));
	for (const task of completedTasks) {
		const key = normalizeTaskId(task.id).toLowerCase();
		if (!byId.has(key)) byId.set(key, { ...task, source: "completed" as const });
	}
	return [...byId.values()];
}
