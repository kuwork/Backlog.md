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
}

/** One DependsOn edge; both ends are already canonical. */
export interface DependencyEdge {
	from: string;
	to: string;
}

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

	constructor(edges: Iterable<DependencyEdge>) {
		for (const { from, to } of edges) {
			const targets = this.adjacency.get(from);
			if (!targets) {
				this.adjacency.set(from, [to]);
				continue;
			}
			if (!targets.includes(to)) {
				targets.push(to);
			}
		}
	}

	/** The identities `id` depends on directly. */
	dependenciesOf(id: string): readonly string[] {
		return this.adjacency.get(id) ?? [];
	}

	/**
	 * The shortest chain from `from` to `target`, both ends included, or null when `target` is not
	 * reachable. `from === target` answers with the single-node chain, because a record that
	 * reaches itself is exactly what a self-reference is.
	 *
	 * Breadth-first, so the chain a refusal prints is the shortest one it could find rather than
	 * whichever deep path the edge order happened to suggest.
	 */
	pathTo(from: string, target: string): string[] | null {
		if (from === target) {
			return [from];
		}
		const parent = new Map<string, string>();
		const seen = new Set<string>([from]);
		const queue: string[] = [from];
		for (let index = 0; index < queue.length; index += 1) {
			const current = queue[index] as string;
			for (const next of this.dependenciesOf(current)) {
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
	reaches(from: string, target: string): boolean {
		return this.pathTo(from, target) !== null;
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
