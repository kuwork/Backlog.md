import { useEffect, useState } from "react";
import type { Task, TaskSearchResult } from "../../types";
import { apiClient } from "../lib/api";

/**
 * Loads the completed corpus (backlog/completed/) only while a view opts in, so the
 * checkbox costs nothing while it is unchecked and completed records stay out of the
 * default board and task list. Both views share this hook rather than each rolling
 * their own request.
 */
export function useCompletedTasks(enabled: boolean): Task[] {
	const [tasks, setTasks] = useState<Task[]>([]);

	useEffect(() => {
		if (!enabled) {
			setTasks([]);
			return;
		}

		let cancelled = false;
		const load = async () => {
			try {
				const results = await apiClient.search({ types: ["task"], completed: true });
				if (cancelled) return;
				// The widened search returns the active corpus too, so keep only the archive
				// records: callers append this to their own task list and must not see duplicates.
				const records = results
					.filter((result): result is TaskSearchResult => result.type === "task")
					.map((result) => result.task)
					.filter((task) => task.source === "completed");
				setTasks(records);
			} catch (error) {
				console.error("Failed to load completed tasks:", error);
				if (!cancelled) {
					setTasks([]);
				}
			}
		};

		load();

		return () => {
			cancelled = true;
		};
	}, [enabled]);

	return tasks;
}
