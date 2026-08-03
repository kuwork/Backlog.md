import type { Task } from "../types/index.ts";
import { normalizeTaskId, taskIdsEqual } from "./task-path.ts";

/**
 * A group of task files whose IDs are equivalent (e.g., task-1 and task-01).
 */
export interface DuplicateGroup {
	/** Canonical ID for the group. */
	id: string;
	/** Tasks that share the same canonical ID. */
	tasks: Task[];
}

/**
 * Detect duplicate task IDs across a list of tasks.
 *
 * Equivalence is determined by {@link taskIdsEqual}, which handles:
 * - case-insensitive prefix comparison
 * - zero-padding equivalence (task-1 vs task-01)
 * - dotted hierarchical IDs (task-5.1 vs task-5.01)
 *
 * Archived tasks should be excluded before calling this function if archived IDs
 * are intentionally reusable.
 *
 * @param tasks - Tasks to analyze. Each task should have a filePath.
 * @returns Groups containing two or more tasks with equivalent IDs.
 */
export function detectDuplicateTaskIds(tasks: Task[]): DuplicateGroup[] {
	const groups: DuplicateGroup[] = [];

	for (const task of tasks) {
		let matchedGroup: DuplicateGroup | undefined;
		for (const group of groups) {
			if (taskIdsEqual(task.id, group.id)) {
				matchedGroup = group;
				break;
			}
		}

		if (matchedGroup) {
			matchedGroup.tasks.push(task);
		} else {
			groups.push({
				id: normalizeTaskId(task.id),
				tasks: [task],
			});
		}
	}

	return groups.filter((group) => group.tasks.length > 1);
}
