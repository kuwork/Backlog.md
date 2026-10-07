import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { canonicalTaskId } from "../../utils/task-id";
import { apiClient } from "../lib/api";

/**
 * Resolves the hierarchy records the caller's corpus cannot see.
 *
 * A parent learns its children only from each child's own parent_task_id, and that link outlives
 * the child's move to backlog/completed. The default task list deliberately carries active records
 * only, so a completed child (or a completed parent) is missing from it and the hierarchy section
 * renders nothing. This loads just those relatives instead of the whole completed corpus: one
 * `parent` request for the children, and a single task read when the parent itself is not in view.
 */

// Outlives the component: drilling into a child and back remounts the detail view, and without this
// the section would paint the children already in the corpus first, then repaint once the completed
// ones arrive. The load still runs on every mount, so a served value is only a first paint.
const relativesByTask = new Map<string, Task[]>();

export function useTaskHierarchyCorpus(task: Task | null | undefined, availableTasks: Task[]): Task[] {
	// Keyed on a string because availableTasks is a new array on every render.
	const corpusKey = availableTasks.map((candidate) => canonicalTaskId(candidate.id)).join(",");
	const taskId = task?.id ?? "";
	const parentId = task?.parentTaskId ?? "";
	const [loaded, setLoaded] = useState(new Map<string, Task[]>());

	useEffect(() => {
		if (!taskId) return;

		let cancelled = false;
		const load = async () => {
			try {
				const known = new Set(corpusKey.length > 0 ? corpusKey.split(",") : []);
				const records: Task[] = [];

				const children = await apiClient.fetchTasks({ parent: taskId, completed: true });
				for (const child of children) {
					if (!known.has(canonicalTaskId(child.id))) records.push(child);
				}

				if (parentId && !known.has(canonicalTaskId(parentId))) {
					try {
						records.push(await apiClient.fetchTask(parentId));
					} catch {
						// A dangling parent link is not an error worth breaking the section over.
					}
				}

				if (cancelled) return;
				relativesByTask.set(taskId, records);
				setLoaded((previous) => new Map(previous).set(taskId, records));
			} catch (error) {
				console.error("Failed to load completed hierarchy records:", error);
				if (cancelled) return;
				relativesByTask.set(taskId, []);
				setLoaded((previous) => new Map(previous).set(taskId, []));
			}
		};

		load();

		return () => {
			cancelled = true;
		};
	}, [taskId, parentId, corpusKey]);

	return loaded.get(taskId) ?? relativesByTask.get(taskId) ?? [];
}
