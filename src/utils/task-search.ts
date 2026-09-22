/**
 * Task search: the single owner of the searchable-text builder, the Fuse configuration, and the
 * task filter predicates. Every surface that searches or filters tasks (the CLI, the TUI views,
 * the MCP adapter, the web API, and the cross-branch SearchService) goes through this module so
 * the same query and the same filters mean the same thing everywhere.
 *
 * Callers still decide which corpus to search: the local working copy or the cross-branch store.
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { Task } from "../types/index.ts";
import { labelsToLower } from "./label-filter.ts";
import {
	createMilestoneFilterMatcher,
	type MilestoneFilterValueResolver,
	NO_MILESTONE_FILTER_VALUE,
} from "./milestone-filter.ts";
import { matchesModifiedFileFilters, normalizeModifiedFileFilters } from "./modified-files.ts";
import { getTaskReadiness, type ReadinessGraph } from "./readiness.ts";
import { normalizeStatusSet, statusMatchesSet } from "./status-filter.ts";
import { taskIdsEqual } from "./task-path.ts";

export type LabelMatchMode = "any" | "all";

/** The task fields the shared Fuse configuration indexes. */
export interface TaskSearchFields {
	title: string;
	bodyText: string;
	id: string;
	idVariants: string[];
	dependencyIds: string[];
	modifiedFiles: string[];
}

export interface TaskSearchOptions {
	query?: string;
	status?: string | string[];
	statusExcluded?: string | string[];
	priority?: string | string[];
	labels?: string | string[];
	labelMatch?: LabelMatchMode;
	modifiedFiles?: string | string[];
	/** Drop fuzzy results with a Fuse score above this value (0 = perfect, 1 = worst).
	 * Undefined keeps every match, matching the web UI's score <= 0.45 filter when set. */
	scoreThreshold?: number;
}

export interface SharedTaskFilterOptions {
	query?: string;
	statusExcluded?: string | string[];
	priority?: string | string[];
	labels?: string | string[];
	labelMatch?: LabelMatchMode;
	modifiedFiles?: string | string[];
	milestone?: string;
	resolveMilestoneLabel?: (milestone: string) => string;
	scoreThreshold?: number;
}

export interface TaskFilterOptions extends SharedTaskFilterOptions {
	/** Matches any of these when several are given, mirroring `statusExcluded`. */
	status?: string | string[];
	assignee?: string | string[];
	unassigned?: boolean;
	parentTaskId?: string;
	/**
	 * When set, keep only tasks that are ready according to this graph. The graph carries the full
	 * task corpus, so readiness never depends on which tasks survived the other filters.
	 */
	ready?: ReadinessGraph;
}

export interface TaskSearchIndex {
	search(options: TaskSearchOptions): Task[];
}

// Regex pattern to match any prefix (letters followed by dash)
const PREFIX_PATTERN = /^[a-zA-Z]+-/i;

/**
 * Extract prefix from an ID if present (e.g., "task-" from "task-123")
 */
function extractPrefix(id: string): string | null {
	const match = id.match(PREFIX_PATTERN);
	return match ? match[0] : null;
}

/**
 * Strip any prefix from an ID (e.g., "task-123" -> "123", "JIRA-456" -> "456")
 */
function stripPrefix(id: string): string {
	return id.replace(PREFIX_PATTERN, "");
}

function createTaskIdVariants(id: string): string[] {
	const segments = parseTaskIdSegments(id);
	const prefix = extractPrefix(id) ?? "task-"; // Default to task- if no prefix
	const lowerId = id.toLowerCase();

	if (!segments) {
		// Non-numeric ID - just return the ID and its lowercase variant
		return id === lowerId ? [id] : [id, lowerId];
	}

	const canonicalSuffix = segments.join(".");
	const variants = new Set<string>();

	// Add original ID and lowercase variant
	variants.add(id);
	variants.add(lowerId);

	// Add with extracted/default prefix
	variants.add(`${prefix}${canonicalSuffix}`);
	variants.add(`${prefix.toLowerCase()}${canonicalSuffix}`);

	// Add just the numeric part
	variants.add(canonicalSuffix);

	return Array.from(variants);
}

function parseTaskIdSegments(value: string): number[] | null {
	const withoutPrefix = stripPrefix(value);
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) {
		return null;
	}
	return withoutPrefix.split(".").map((segment) => Number.parseInt(segment, 10));
}

/**
 * Build the searchable text for one task. Labels and assignees are part of the searchable text on
 * every surface, so `--search backend` finds a task labelled `backend` from the CLI, the MCP
 * adapter, and the web API alike.
 */
export function buildTaskSearchBodyText(task: Task): string {
	const parts: string[] = [];
	if (task.description) parts.push(task.description);
	if (Array.isArray(task.acceptanceCriteriaItems) && task.acceptanceCriteriaItems.length > 0) {
		const lines = [...task.acceptanceCriteriaItems]
			.sort((a, b) => a.index - b.index)
			.map((criterion) => `- [${criterion.checked ? "x" : " "}] ${criterion.text}`);
		parts.push(lines.join("\n"));
	}
	if (task.implementationPlan) parts.push(task.implementationPlan);
	if (task.implementationNotes) parts.push(task.implementationNotes);
	if (Array.isArray(task.comments) && task.comments.length > 0) {
		parts.push(task.comments.map((comment) => comment.body).join("\n\n"));
	}
	if (task.labels?.length) parts.push(task.labels.join("\n"));
	if (task.assignee?.length) parts.push(task.assignee.join("\n"));
	if (task.modifiedFiles?.length) parts.push(task.modifiedFiles.join("\n"));

	return parts.join("\n\n");
}

/** Build every field the shared Fuse configuration indexes, so keys and content cannot drift. */
export function buildTaskSearchFields(task: Task): TaskSearchFields {
	return {
		title: task.title,
		bodyText: buildTaskSearchBodyText(task),
		id: task.id,
		idVariants: createTaskIdVariants(task.id),
		dependencyIds: (task.dependencies ?? []).flatMap((dependency) => createTaskIdVariants(dependency)),
		modifiedFiles: task.modifiedFiles ?? [],
	};
}

/** The shared fuzzy-match configuration. Consumers add `includeMatches` when they need highlights. */
export const TASK_SEARCH_FUSE_OPTIONS: IFuseOptions<TaskSearchFields> = {
	includeScore: true,
	threshold: 0.35,
	ignoreLocation: true,
	minMatchCharLength: 2,
	keys: [
		{ name: "title", weight: 0.35 },
		{ name: "bodyText", weight: 0.3 },
		{ name: "id", weight: 0.2 },
		{ name: "idVariants", weight: 0.1 },
		{ name: "dependencyIds", weight: 0.05 },
		{ name: "modifiedFiles", weight: 0.15 },
	],
};

function toList(value: string | string[] | undefined): string[] {
	if (!value) return [];
	const values = Array.isArray(value) ? value : [value];
	return values.map((item) => item.trim()).filter((item) => item.length > 0);
}

function toLowerList(value: string | string[] | undefined): string[] {
	return toList(value).map((item) => item.toLowerCase());
}

/**
 * Build the shared task predicate. `corpus` is the full task list the milestone matcher compares
 * against, so a milestone filter resolves the same way no matter which tasks survive other filters.
 */
export function createTaskFilterMatcher(options: TaskFilterOptions, corpus: Task[] = []): (task: Task) => boolean {
	const checks: Array<(task: Task) => boolean> = [];

	const wantedStatuses = normalizeStatusSet(options.status);
	if (wantedStatuses.size > 0) {
		checks.push((task) => statusMatchesSet(wantedStatuses, task.status));
	}

	const excludedStatuses = normalizeStatusSet(options.statusExcluded);
	if (excludedStatuses.size > 0) {
		checks.push((task) => !statusMatchesSet(excludedStatuses, task.status));
	}

	const priorities = new Set(toLowerList(options.priority));
	if (priorities.size > 0) {
		checks.push((task) => {
			const priority = task.priority?.toLowerCase();
			return Boolean(priority) && priorities.has(priority as string);
		});
	}

	const assignees = new Set(toLowerList(options.assignee));
	if (assignees.size > 0) {
		checks.push((task) => (task.assignee ?? []).some((value) => assignees.has(value.trim().toLowerCase())));
	}

	if (options.unassigned) {
		checks.push((task) => !(task.assignee ?? []).some((value) => value.trim().length > 0));
	}

	const requiredLabels = labelsToLower(toList(options.labels));
	if (requiredLabels.length > 0) {
		const matchAll = options.labelMatch === "all";
		checks.push((task) => {
			const taskLabels = new Set(labelsToLower(task.labels ?? []));
			if (taskLabels.size === 0) return false;
			return matchAll
				? requiredLabels.every((label) => taskLabels.has(label))
				: requiredLabels.some((label) => taskLabels.has(label));
		});
	}

	const modifiedFiles = normalizeModifiedFileFilters(options.modifiedFiles);
	if (modifiedFiles) {
		checks.push((task) => matchesModifiedFileFilters(task.modifiedFiles, modifiedFiles));
	}

	if (options.parentTaskId) {
		const parentFilter = options.parentTaskId;
		checks.push((task) => Boolean(task.parentTaskId) && taskIdsEqual(parentFilter, task.parentTaskId as string));
	}

	const milestone = options.milestone?.trim().toLowerCase();
	if (milestone) {
		const resolveLabel = options.resolveMilestoneLabel;
		if (milestone === NO_MILESTONE_FILTER_VALUE) {
			checks.push((task) => !task.milestone?.trim());
		} else if (resolveLabel && "resolveExactId" in resolveLabel) {
			// A full resolver knows the configured milestones, so it can match ids and closest titles.
			const matchesMilestone = createMilestoneFilterMatcher(
				options.milestone as string,
				corpus.map((task) => task.milestone ?? ""),
				resolveLabel as MilestoneFilterValueResolver,
			);
			checks.push((task) => Boolean(task.milestone) && matchesMilestone(task.milestone as string));
		} else {
			// A plain label lookup only supports exact, case-insensitive title comparison.
			checks.push(
				(task) =>
					Boolean(task.milestone) &&
					(resolveLabel ? resolveLabel(task.milestone as string) : (task.milestone as string)).trim().toLowerCase() ===
						milestone,
			);
		}
	}

	if (options.ready) {
		const graph = options.ready;
		checks.push((task) => getTaskReadiness(task, graph).isReady);
	}

	return (task) => checks.every((check) => check(task));
}

/**
 * Create an in-memory search index for tasks. Useful when the corpus is already loaded and the
 * caller wants to run several queries over it without rebuilding the index each time.
 */
export function createTaskSearchIndex(tasks: Task[]): TaskSearchIndex {
	const entries = tasks.map((task) => ({ task, fields: buildTaskSearchFields(task) }));
	const fuse = new Fuse(
		entries.map((entry) => entry.fields),
		TASK_SEARCH_FUSE_OPTIONS,
	);
	const taskByFields = new Map(entries.map((entry) => [entry.fields, entry.task]));

	return {
		search(options: TaskSearchOptions): Task[] {
			let matched: Task[];
			const query = options.query?.trim() ?? "";

			// If we have a query, use Fuse for fuzzy search
			if (query) {
				let fuseResults = fuse.search(query);
				const scoreThreshold = options.scoreThreshold;
				if (scoreThreshold !== undefined) {
					fuseResults = fuseResults.filter((result) => result.score === undefined || result.score <= scoreThreshold);
				}
				matched = fuseResults.map((result) => taskByFields.get(result.item) as Task);
			} else {
				// No query - start with all tasks
				matched = entries.map((entry) => entry.task);
			}

			const matches = createTaskFilterMatcher(options, tasks);
			return matched.filter(matches);
		},
	};
}

export function applyTaskFilters(tasks: Task[], options: TaskFilterOptions, index?: TaskSearchIndex): Task[] {
	const query = options.query?.trim() ?? "";
	const matched = query
		? (index ?? createTaskSearchIndex(tasks)).search({
				query,
				status: options.status,
				statusExcluded: options.statusExcluded,
				priority: options.priority,
				labels: options.labels,
				labelMatch: options.labelMatch,
				modifiedFiles: options.modifiedFiles,
				scoreThreshold: options.scoreThreshold,
			})
		: tasks;

	const matches = createTaskFilterMatcher(options, tasks);
	return matched.filter(matches);
}

export function applySharedTaskFilters(
	tasks: Task[],
	options: SharedTaskFilterOptions,
	index?: TaskSearchIndex,
): Task[] {
	return applyTaskFilters(
		tasks,
		{
			query: options.query,
			statusExcluded: options.statusExcluded,
			priority: options.priority,
			labels: options.labels,
			labelMatch: options.labelMatch,
			modifiedFiles: options.modifiedFiles,
			milestone: options.milestone,
			resolveMilestoneLabel: options.resolveMilestoneLabel,
			scoreThreshold: options.scoreThreshold,
		},
		index,
	);
}
