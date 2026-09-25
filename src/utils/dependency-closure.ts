import { canonicalTaskId, taskIdsEqual } from "./task-id.ts";

/**
 * Store-free dependency traversal, shared so that the write gate (src/utils/task-builders.ts),
 * the doctor report (BACK-708) and the read-side queries (BACK-709) answer from one
 * implementation instead of three that drift apart.
 *
 * The walk works on plain records: an adjacency list built from a node list and an edge list, a
 * visited set, and a chain reconstruction so a refusal can name the cycle instead of only the ID.
 * Nothing here needs a GraphStore, which is deliberate - no host has to start a graph service to
 * ask a dependency question, and src/graph/validation.ts keeps its own store-backed walk for the
 * graph side.
 *
 * Identity is resolved by the caller, never here. `taskIdsEqual` is asymmetric in a way that makes
 * an index unsafe: it accepts a bare number as an alias of any prefix ("358" equals "BACK-358"),
 * while `canonicalTaskId("358")` is "TASK-358" and `canonicalTaskId("BACK-358")` is "BACK-358".
 * Indexing by canonical ID would therefore silently drop every bare-number reference. The caller
 * hands in edges that its own resolution produced, and the walk compares canonical IDs by
 * equality, which is exactly right once resolution has happened.
 */

/** A record as the traversal needs it: an identity and the references it holds. */
export interface DependencyRecordLike {
	id: string;
	dependencies?: string[] | undefined;
	/** Optional, for a caller that wants to describe a row: the traversal itself reads neither. */
	title?: string | undefined;
	/** Optional status, for the terminal check BACK-709's root blockers need. */
	status?: string | undefined;
}

/** One DependsOn edge; both ends are already canonical. */
export interface DependencyEdge {
	from: string;
	to: string;
}

/**
 * Which way a walk travels: along DependsOn ("what does this depend on"), or against it ("what
 * depends on this"). The edges are the same; only the direction the caller asks in changes.
 */
export type DependencyDirection = "dependencies" | "dependents";

/** One reached task and how far away it is, in hops along the walked direction. */
export interface DependencyClosureRow {
	id: string;
	hops: number;
}

export interface DependencyClosureResult {
	/**
	 * One row per reached task, never the subject itself, ordered by hop count and then by id, so
	 * identical input gives identical output.
	 *
	 * A task reachable by several routes appears exactly once, at its *shortest* distance: with
	 * A -> B, A -> C and B -> C, C is one hop away, not two. The longest distance is a different
	 * question, and answering it would make the row order depend on which path the walk happened
	 * to take first.
	 */
	rows: DependencyClosureRow[];
	/** The shortest chain from the subject back to itself when it sits on a cycle; empty otherwise. */
	cycle: string[];
	/** True when the walk stopped at the hop bound with more still to reach. */
	truncated: boolean;
}

/**
 * How far a closure walks before giving up. The visited set is what actually guarantees
 * termination on a cyclic corpus; this is a second, explicit bound so a caller can cap an answer
 * and so a pathological corpus cannot produce an unbounded one.
 */
export const DEFAULT_MAX_HOPS = 50;

/**
 * Resolve one stored reference to the canonical identities it names. An empty list means the
 * reference resolves to nothing. More than one entry means an ambiguous reference, which the gate
 * refuses on its own account; following all of them keeps the walk an over-approximation, so it
 * can only ever report a cycle that is really reachable through some reading of the corpus.
 */
export type DependencyTargetResolver = (dependency: string) => readonly string[];

/** Build the DependsOn edge list from records, resolving each reference through `resolve`. */
export function dependencyEdges(
	records: readonly DependencyRecordLike[],
	resolve: DependencyTargetResolver,
): DependencyEdge[] {
	const edges: DependencyEdge[] = [];
	for (const record of records) {
		const from = canonicalTaskId(record.id);
		for (const dependency of record.dependencies ?? []) {
			for (const to of resolve(dependency)) {
				edges.push({ from, to });
			}
		}
	}
	return edges;
}

/** Rebuild the chain that arrived at `arrival`, walking the BFS parent links back to the origin. */
function chainTo(parent: Map<string, string>, arrival: string, target: string): string[] {
	const chain = [target];
	let cursor: string | undefined = arrival;
	while (cursor !== undefined) {
		chain.unshift(cursor);
		cursor = parent.get(cursor);
	}
	return chain;
}

/**
 * The DependsOn closure over a fixed edge set. Build it once per answer and reuse it: it answers
 * whether one identity can reach another, and nothing about it is learned from the edges of the
 * record a caller is about to write.
 */
export class DependencyClosure {
	private readonly adjacency = new Map<string, string[]>();
	private readonly reverse = new Map<string, string[]>();

	constructor(edges: Iterable<DependencyEdge>) {
		for (const { from, to } of edges) {
			pushUnique(this.adjacency, from, to);
			// The reverse index is what makes "who depends on this" answerable at all: the records
			// carry one direction, so the other one has to be derived here rather than read.
			pushUnique(this.reverse, to, from);
		}
	}

	/** The identities `id` depends on directly. */
	dependenciesOf(id: string): readonly string[] {
		return this.adjacency.get(id) ?? [];
	}

	/** The identities that depend on `id` directly: the same edges read the other way. */
	dependentsOf(id: string): readonly string[] {
		return this.reverse.get(id) ?? [];
	}

	/** One step in the direction the caller asked for. */
	private step(id: string, direction: DependencyDirection): readonly string[] {
		return direction === "dependencies" ? this.dependenciesOf(id) : this.dependentsOf(id);
	}

	/**
	 * The shortest chain from `from` to `target`, both ends included, or null when `target` is not
	 * reachable. `from === target` answers with the single-node chain, because a record that
	 * reaches itself is exactly what a self-reference is.
	 *
	 * Breadth-first, so the chain a refusal prints is the shortest one it could find rather than
	 * whichever deep path the edge order happened to suggest.
	 */
	pathTo(from: string, target: string, options?: { direction?: DependencyDirection }): string[] | null {
		const direction = options?.direction ?? "dependencies";
		if (from === target) {
			return [from];
		}
		const parent = new Map<string, string>();
		const seen = new Set<string>([from]);
		const queue: string[] = [from];
		for (let index = 0; index < queue.length; index += 1) {
			const current = queue[index] as string;
			for (const next of this.step(current, direction)) {
				if (seen.has(next)) continue;
				seen.add(next);
				parent.set(next, current);
				if (next === target) {
					return chainTo(parent, current, target);
				}
				queue.push(next);
			}
		}
		return null;
	}

	/** Whether `from` can reach `target`, the endpoints included. */
	reaches(from: string, target: string, options?: { direction?: DependencyDirection }): boolean {
		return this.pathTo(from, target, options) !== null;
	}

	/**
	 * The closure around one subject: every task reachable from it in the asked direction, with the
	 * shortest hop count of each, plus the cycle it sits on when there is one.
	 *
	 * A visited set keeps a cyclic corpus terminating through both mechanisms the task asks for: the
	 * walk never re-enters a node, and a node already seen is not queued again, so the frontier
	 * shrinks to nothing instead of enumerating paths. A subject that can be reached back from one of
	 * its own neighbours sits on a cycle, and that is worth reporting rather than hiding - the corpus
	 * arriving from a hand edit, a merge or a `git rm` can still hold one even though the write gate
	 * now refuses to create it (BACK-707).
	 */
	closureFrom(id: string, options?: { direction?: DependencyDirection; maxHops?: number }): DependencyClosureResult {
		const direction = options?.direction ?? "dependencies";
		const maxHops = options?.maxHops ?? DEFAULT_MAX_HOPS;

		const rows: DependencyClosureRow[] = [];
		const seen = new Set<string>([id]);
		let frontier: string[] = [id];
		let truncated = false;
		for (let hops = 1; frontier.length > 0; hops += 1) {
			if (hops > maxHops) {
				truncated = true;
				break;
			}
			const next: string[] = [];
			for (const node of frontier) {
				for (const neighbour of this.step(node, direction)) {
					if (seen.has(neighbour)) continue;
					seen.add(neighbour);
					rows.push({ id: neighbour, hops });
					next.push(neighbour);
				}
			}
			frontier = next;
		}
		// Sorted by (hops, id) rather than left in walk order: the frontier order follows the edge
		// insertion order, which follows the filesystem's, so leaving it unsorted would make the same
		// corpus answer differently depending on how the scan enumerated it.
		rows.sort((left, right) => left.hops - right.hops || left.id.localeCompare(right.id));

		return { rows, cycle: this.cycleThrough(id, direction), truncated };
	}

	/** The shortest chain from `id` back to itself when one of its own neighbours reaches it. */
	cycleThrough(id: string, direction: DependencyDirection = "dependencies"): string[] {
		for (const neighbour of this.step(id, direction)) {
			const chain = this.pathTo(neighbour, id, { direction });
			if (chain) {
				return [id, ...chain];
			}
		}
		return [];
	}
}

/** Add `to` to `key`'s list, once, keeping first-seen order. */
function pushUnique(index: Map<string, string[]>, key: string, value: string): void {
	const existing = index.get(key);
	if (!existing) {
		index.set(key, [value]);
		return;
	}
	if (!existing.includes(value)) {
		existing.push(value);
	}
}

/** A record that can be named by a reference; only its identity matters here. */
export interface DependencyIdentity {
	id: string;
}

/**
 * What the corpus makes of one stored reference. The write gate and the doctor report share this
 * vocabulary so the two cannot drift into different answers about the same edge - which is exactly
 * the failure this module exists to prevent: the gate once accepted a draft target while readiness
 * read the same edge back as unknown, because each had its own idea of the corpus.
 */
export type DependencyReferenceKind =
	/** Exactly one record in the target pool claims it. */
	| "resolved"
	/** Several records in the target pool claim it. */
	| "ambiguous"
	/** The record claiming it is a draft, which may never be a target. */
	| "draft"
	/** The record claiming it is a milestone, which is not a task. */
	| "milestone"
	/** Nothing in the pool claims it, but a record under backlog/archive carries the id. */
	| "released"
	/** Nothing anywhere claims it. */
	| "unresolvable";

export interface DependencyReferenceVerdict {
	kind: DependencyReferenceKind;
	/** The canonical identities the target pool matched, for a resolved or ambiguous reference. */
	matches: string[];
}

/** The pools a reference is judged against. Only `targets` contributes edges. */
export interface DependencyCorpusPools {
	/** Records whose dependencies are the edges: tasks + completed. */
	targets: readonly DependencyRecordLike[];
	/** Records that exist but may never be a target. */
	drafts?: readonly DependencyIdentity[];
	/** Records that exist but are not tasks. */
	milestones?: readonly DependencyIdentity[];
	/** Records that left the pool entirely, so their ids are free to be claimed again. */
	released?: readonly DependencyIdentity[];
}

/**
 * Records in `pool` claiming `reference`, by the identity rules every other path uses. This is the
 * one place a reference is matched, so the gate's pool and the report's pool answer alike.
 */
export function matchRecords<T extends DependencyIdentity>(pool: readonly T[], reference: string): T[] {
	return pool.filter((candidate) => taskIdsEqual(reference, candidate.id));
}

/**
 * Whether `reference` names one of these identities *exactly*. Deliberately stricter than
 * matchRecords, which treats a bare number as an alias of any prefix: a bare "1" is a way of naming
 * TASK-1, but it is not a way of naming M-1 or DRAFT-1, and reading it as one would tell a user
 * their milestone is not a task when they meant a task at all.
 */
export function namesIdentity(pool: readonly DependencyIdentity[], reference: string): boolean {
	const canonical = canonicalTaskId(reference);
	return pool.some((candidate) => canonicalTaskId(candidate.id) === canonical);
}

/**
 * The corpus a dependency question is asked of: the target pool plus the pools that decide how a
 * reference that resolves to nothing is worded. Build it from records the caller already has - it
 * reads nothing itself, starts no service, and needs no GraphStore.
 */
export class DependencyCorpus {
	private readonly targets: readonly DependencyRecordLike[];
	private readonly drafts: readonly DependencyIdentity[];
	private readonly milestones: readonly DependencyIdentity[];
	private readonly released: readonly DependencyIdentity[];

	constructor(pools: DependencyCorpusPools) {
		this.targets = pools.targets;
		this.drafts = pools.drafts ?? [];
		this.milestones = pools.milestones ?? [];
		this.released = pools.released ?? [];
	}

	/** The record claiming an identity, or null when nothing in the pool does. */
	recordOf(id: string): DependencyRecordLike | null {
		const canonical = canonicalTaskId(id);
		return this.targets.find((record) => canonicalTaskId(record.id) === canonical) ?? null;
	}

	/** What this corpus makes of one stored reference. */
	classify(reference: string): DependencyReferenceVerdict {
		const matched = matchRecords(this.targets, reference);
		const [only] = matched;
		if (only && matched.length === 1) {
			return { kind: "resolved", matches: [canonicalTaskId(only.id)] };
		}
		if (matched.length > 1) {
			return { kind: "ambiguous", matches: matched.map((record) => canonicalTaskId(record.id)) };
		}
		if (namesIdentity(this.drafts, reference)) return { kind: "draft", matches: [] };
		if (namesIdentity(this.milestones, reference)) return { kind: "milestone", matches: [] };
		if (namesIdentity(this.released, reference)) return { kind: "released", matches: [] };
		return { kind: "unresolvable", matches: [] };
	}

	/** The DependsOn edges the target pool implies; a reference that resolves to nothing adds none. */
	edges(): DependencyEdge[] {
		return dependencyEdges(this.targets, (reference) =>
			matchRecords(this.targets, reference).map((record) => canonicalTaskId(record.id)),
		);
	}

	/** The closure over those edges. Built per call, so ask once and keep it. */
	closure(): DependencyClosure {
		return new DependencyClosure(this.edges());
	}
}
