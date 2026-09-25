import type { Core } from "../core/backlog.ts";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { type DependencyClosure, DependencyCorpus, matchRecords, namesIdentity } from "./dependency-closure.ts";
import { AmbiguousIdError } from "./entity-id.ts";
import { AmbiguousTaskIdError, canonicalTaskId, normalizeTaskId, taskIdsEqual } from "./task-path.ts";

/**
 * Shared utilities for building tasks and validating dependencies
 * Used by both CLI and MCP to ensure consistent behavior
 */

/**
 * Normalize dependencies to proper task-X format
 * Handles both array and comma-separated string inputs
 */
export function normalizeDependencies(dependencies: unknown): string[] {
	if (!dependencies) return [];
	const normalizeList = (values: string[]): string[] =>
		values
			.map((value) => value.trim())
			.filter((value): value is string => value.length > 0)
			.map((value) => normalizeTaskId(value));

	if (Array.isArray(dependencies)) {
		return normalizeList(
			dependencies.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			),
		);
	}

	return normalizeList(String(dependencies).split(","));
}

/**
 * Resolve one dependency input against the corpus, or null when nothing matches.
 *
 * Several matches are never resolved silently, mirroring the identity rules every other read path
 * uses: an input naming more than one canonical identity is underspecified (bare numbers span the
 * separate task and draft counters), while several records claiming one identity is the
 * duplicate-ID defect `backlog doctor` repairs.
 */
function resolveUniqueDependency(dependency: string, matches: Task[]): string | null {
	const [first, ...rest] = matches;
	if (!first) return null;
	if (rest.length === 0) return first.id;

	const candidates = matches.map((match) => match.filePath ?? match.id);
	const [canonicalId, ...otherIdentities] = [...new Set(matches.map((match) => canonicalTaskId(match.id)))];
	if (canonicalId && otherIdentities.length === 0) {
		// Name the colliding identity rather than the input, which may be a bare number.
		throw new AmbiguousTaskIdError(canonicalId, candidates);
	}
	throw new AmbiguousIdError(
		"Dependency",
		dependency,
		candidates,
		`Use a full task ID instead of ${dependency.trim()} to choose one.`,
	);
}

/**
 * Raised when a record names itself as its own predecessor. A one-line cycle, refused before any
 * walk because the answer is known without looking at the corpus.
 */
export class SelfDependentTaskError extends Error {
	readonly taskId: string;

	constructor(taskId: string) {
		super(`${taskId} cannot depend on itself. Remove it from its own dependencies.`);
		this.name = "SelfDependentTaskError";
		this.taskId = taskId;
	}
}

/**
 * Raised when a dependency would close a cycle. Carries the chain so the message can name it -
 * a bare "invalid dependency" leaves the reader to find the loop by hand.
 */
export class DependencyCycleError extends Error {
	readonly chain: string[];

	constructor(chain: string[]) {
		super(`This dependency would close a cycle: ${chain.join(" -> ")}. Remove one of these edges first.`);
		this.name = "DependencyCycleError";
		this.chain = chain;
	}
}

/**
 * Raised when a dependency names a record that exists but can never be a target: a draft, or a
 * milestone. Worded apart from the "resolves to nothing" refusal on purpose, because "the ID is
 * real and is still not eligible" is a different answer from "nothing claims this ID".
 */
export class IneligibleDependencyTargetError extends Error {
	readonly dependency: string;
	readonly kind: "draft" | "milestone";

	constructor(dependency: string, kind: "draft" | "milestone") {
		super(
			kind === "draft"
				? `${dependency} cannot be a dependency target: a draft is never a valid target, because it can be abandoned while its dependents stay. Depend on a task instead, or promote the draft first.`
				: `${dependency} cannot be a dependency target: a milestone is not a task. Keep the milestone association in the milestone field instead.`,
		);
		this.name = "IneligibleDependencyTargetError";
		this.dependency = dependency;
		this.kind = kind;
	}
}

/**
 * The record a dependency list is being written for.
 *
 * Both fields are optional because the create path has neither: it allocates its ID after this gate
 * has run (src/core/backlog.ts:1627 versus the call at :1574), and it has no stored record to
 * compare against. Supplying no subject is not a hole in the checks, it is the rule - "when
 * creating, it has to exist" - and it is also why a create can never trip the cycle check: nothing
 * can already depend on an ID that did not exist.
 */
export interface DependencySubject {
	/** The identity being written, for the self-reference and reachability checks. */
	id?: string | undefined;
	/** The dependency list currently on disk, for the introduced/carried-over split. */
	storedDependencies?: string[] | undefined;
}

export interface DependencyValidation {
	/**
	 * IDs to persist, in the caller's order. A resolved reference is canonicalised to the identity
	 * that claimed it; a tolerated one keeps the spelling the stored record already holds, so a
	 * re-submit does not silently rewrite a historical spelling into a modern one.
	 */
	valid: string[];
	/** Unresolvable and introduced by this write: the caller refuses. */
	invalid: string[];
	/** Unresolvable but already stored: persisted as typed, and reported as a warning. */
	tolerated: string[];
}

/**
 * Validate a dependency list against the corpus, and answer three ways.
 *
 * Resolved references pass. References that resolve to nothing are split by who introduced them: one
 * the stored record already carries is tolerated - written through as typed and reported - while one
 * this write introduces is refused, on a create and on an edit alike. A write that carries a stale
 * ID over while adding a good one is the normal case, which is why the judgement is per candidate
 * rather than a comparison of the two lists as wholes.
 *
 * The subject also enables the structural checks: a candidate that reaches the record being written
 * - itself, or through a chain - is refused with the chain named.
 */
export async function validateDependencies(
	dependencies: string[],
	core: Core,
	subject?: DependencySubject,
): Promise<DependencyValidation> {
	const valid: string[] = [];
	const invalid: string[] = [];
	const tolerated: string[] = [];
	if (dependencies.length === 0) {
		return { valid, invalid, tolerated };
	}

	// The resolvable pool is tasks + completed, which is also the pool readiness reads back, so the
	// write path and the read path now agree instead of disagreeing about drafts. Task dependencies
	// honour cross-branch visibility when it is enabled in config, while draft dependencies stay
	// local-only. Completed records belong here: Done is the normal end state of a predecessor, so a
	// target that has left the working copy must stay a valid, editable dependency.
	//
	// Drafts and milestones are loaded for a different role - they are what lets a refusal say
	// "this ID exists and is still not eligible" rather than "nothing claims this ID". Keeping drafts
	// out of the pool is also what keeps a draft's own dependencies legal: they resolve against this
	// same corpus, so draft -> task works by construction while task -> draft stops being possible,
	// and the gate never needs to know the subject's own kind. Archived records are deliberately
	// absent from both lists: archiving releases the ID (the allocator counts active and completed
	// records only), so keeping an archived file here would make an ordinary dependency on the task
	// that later claims that identity ambiguous.
	const [tasks, completed, drafts, milestones] = await Promise.all([
		core.queryTasks(),
		core.filesystem.listCompletedTasks(),
		core.filesystem.listDrafts(),
		core.filesystem.listMilestones(),
	]);
	const known = [...tasks, ...completed];
	// One corpus object answers both questions this gate asks - what a reference resolves to, and
	// which edges exist - and it is the same object the doctor report builds (BACK-708). Neither
	// writes its own matching rule, which is what keeps the two from drifting apart.
	const corpus = new DependencyCorpus({ targets: known, drafts, milestones });
	const matchesOf = (id: string): Task[] => matchRecords(known, id);

	const storedDependencies = subject?.storedDependencies;
	// Compared on the normalised forms, because normalizeDependencies has already run normalizeTaskId
	// over the candidates: an un-normalised stored list would make the caller's own unchanged spelling
	// look freshly introduced and the tolerance would never fire.
	const storedSpellingOf = (dependency: string): string | undefined =>
		(storedDependencies ?? []).find((stored) => taskIdsEqual(dependency, normalizeTaskId(stored)));

	const subjectId = subject?.id;
	// Built on first use: a write that names no dependency, or a create with no subject, never pays
	// for an adjacency over the whole corpus.
	let closure: DependencyClosure | undefined;
	const reachability = (): DependencyClosure => (closure ??= corpus.closure());

	for (const dependency of dependencies) {
		const resolved = resolveUniqueDependency(dependency, matchesOf(dependency));
		if (!resolved) {
			if (namesIdentity(drafts, dependency)) {
				throw new IneligibleDependencyTargetError(dependency, "draft");
			}
			if (namesIdentity(milestones, dependency)) {
				throw new IneligibleDependencyTargetError(dependency, "milestone");
			}
			const stored = storedSpellingOf(dependency);
			if (stored !== undefined) {
				// Already on disk: written through in the spelling the record holds, and reported.
				if (!tolerated.includes(stored)) tolerated.push(stored);
				if (!valid.some((existing) => taskIdsEqual(existing, stored))) valid.push(stored);
				continue;
			}
			invalid.push(dependency);
			continue;
		}
		// Called for its ambiguity check: it raises AmbiguousTaskIdError when several working-copy
		// files (active or completed) claim this ID, which queryTasks() hides by collapsing one
		// identity to a single record.
		await core.loadTaskById(resolved, { includeCrossBranch: false });
		if (subjectId !== undefined) {
			if (taskIdsEqual(resolved, subjectId)) {
				throw new SelfDependentTaskError(resolved);
			}
			// The walk stops at its first arrival, so the subject's own outgoing edges - the ones this
			// write is about to replace - are never traversed. Only the other records' edges matter,
			// and those are already on disk.
			const chain = reachability().pathTo(canonicalTaskId(resolved), canonicalTaskId(subjectId));
			if (chain) {
				throw new DependencyCycleError([canonicalTaskId(subjectId), ...chain]);
			}
		}
		// Equivalent spellings of one task (1 and BACK-1) must not persist twice.
		if (!valid.some((existing) => taskIdsEqual(existing, resolved))) {
			valid.push(resolved);
		}
	}
	return { valid, invalid, tolerated };
}

/**
 * Process acceptance criteria options from CLI/MCP arguments
 * Handles both --ac and --acceptance-criteria options
 */
export function processAcceptanceCriteriaOptions(options: {
	ac?: string | string[];
	acceptanceCriteria?: string | string[];
}): string[] {
	const criteria: string[] = [];
	// Process --ac options
	if (options.ac) {
		const acCriteria = Array.isArray(options.ac) ? options.ac : [options.ac];
		criteria.push(...acCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	// Process --acceptance-criteria options
	if (options.acceptanceCriteria) {
		const accCriteria = Array.isArray(options.acceptanceCriteria)
			? options.acceptanceCriteria
			: [options.acceptanceCriteria];
		criteria.push(...accCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	return criteria;
}

/**
 * Normalize a list of string values by trimming whitespace, dropping empties, and deduplicating.
 * Returns `undefined` when the resulting list is empty so callers can skip optional updates.
 */
export function normalizeStringList(values: string[] | undefined): string[] | undefined {
	if (!values) return undefined;
	const unique = Array.from(new Set(values.map((value) => String(value).trim()).filter((value) => value.length > 0)));
	return unique.length > 0 ? unique : undefined;
}

/**
 * Convert Commander-style option values into a string array.
 * Handles single values, repeated flags, and undefined/null inputs.
 */
export function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item));
	}
	if (value === undefined || value === null) {
		return [];
	}
	return [String(value)];
}

/**
 * Parse repeated or comma-delimited CLI list values into a normalized string list.
 * Returns `undefined` when the resulting list is empty.
 */
export function parseDelimitedStringList(value: unknown): string[] | undefined {
	const entries = toStringArray(value).flatMap((entry) =>
		String(entry)
			.split(",")
			.map((item) => item.trim()),
	);
	return normalizeStringList(entries);
}

/**
 * Parse a CLI list option that supports an explicit empty value.
 * Returns `undefined` when the option was absent (no opinion) and `[]` when it was supplied
 * with only blank values (explicitly empty), so callers can tell the two cases apart.
 * An empty array counts as absent, so callers merging several flags into one list can pass the
 * merged values straight through.
 */
export function parseClearableStringList(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value) && value.length === 0) return undefined;
	return parseDelimitedStringList(value) ?? [];
}

/**
 * Parse a Commander option (single value or array) into a strictly positive integer list.
 * Throws an Error when any value is invalid so callers can surface CLI-friendly messaging.
 */
export function parsePositiveIndexList(value: unknown): number[] {
	const entries = (Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [])
		.flatMap((entry) =>
			String(entry)
				.split(",")
				.map((item) => item.trim()),
		)
		.filter((entry) => entry.length > 0);
	return entries.map((entry) => {
		const parsed = Number.parseInt(entry, 10);
		if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1) {
			throw new Error(`Invalid index: ${entry}. Index must be a positive number (1-based).`);
		}
		return parsed;
	});
}

export function stringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
}

export function buildDefinitionOfDoneItems(options: {
	defaults?: string[];
	add?: string[];
	disableDefaults?: boolean;
}): AcceptanceCriterion[] | undefined {
	const defaults = options.disableDefaults ? [] : (options.defaults ?? []);
	const additions = options.add ?? [];
	const combined = [...defaults, ...additions].map((value) => String(value).trim()).filter((value) => value.length > 0);
	if (combined.length === 0) {
		return undefined;
	}
	return combined.map((text, index) => ({ index: index + 1, text, checked: false }));
}
