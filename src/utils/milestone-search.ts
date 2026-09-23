import type { Task } from "../types/index.ts";
import { createTaskSearchIndex } from "./task-search.ts";

/**
 * Task matching shared by the milestone search boxes: the web milestone page and the
 * milestone TUI. Keeping one implementation is what makes a query mean the same thing on
 * both surfaces.
 *
 * A query resolves in three steps: an exact task ID wins outright; failing that a substring
 * of an ID or a title; failing that the shared fuzzy task index. Matching is scoped to the
 * corpus the caller passes, so a milestone view only ever matches tasks it can show.
 */
export function matchMilestoneSearchTaskIds(tasks: readonly Task[], query: string): Set<string> {
	const trimmed = query.trim();
	if (!trimmed) return new Set(tasks.map((task) => task.id));
	if (tasks.length === 0) return new Set();

	const normalizedQuery = trimmed.toLowerCase();
	const exactIdMatches = tasks.filter((task) => task.id.toLowerCase() === normalizedQuery);
	if (exactIdMatches.length > 0) return new Set(exactIdMatches.map((task) => task.id));

	const substringMatches = tasks.filter(
		(task) => task.id.toLowerCase().includes(normalizedQuery) || task.title.toLowerCase().includes(normalizedQuery),
	);
	if (substringMatches.length > 0) return new Set(substringMatches.map((task) => task.id));

	return new Set(
		createTaskSearchIndex([...tasks])
			.search({ query: trimmed })
			.map((task) => task.id),
	);
}

/** The tasks matching a milestone search query, in corpus order. */
export function filterTasksByMilestoneSearch(tasks: readonly Task[], query: string): Task[] {
	const matchedIds = matchMilestoneSearchTaskIds(tasks, query);
	return tasks.filter((task) => matchedIds.has(task.id));
}
