import {
	DependencyClosure,
	DependencyCorpus,
	type DependencyDirection,
	type DependencyIdentity,
	type DependencyRecordLike,
	dependencyEdges,
	matchRecords,
} from "./dependency-closure.ts";
import { collectDependencyDefects, type DependencyDefect } from "./dependency-defects.ts";
import { canonicalTaskId } from "./task-id.ts";
import { isTerminalStatus } from "./terminal-status.ts";

/**
 * The three dependency questions a reader actually asks, answered from the local corpus:
 * what a task transitively depends on and how far away each of those is, what transitively depends
 * on it, and which unfinished task is the real blocker at the end of the chain.
 *
 * One traversal, one corpus shape, and no source to choose between: the walk in
 * src/utils/dependency-closure.ts answers this query, BACK-707's write gate and BACK-708's doctor
 * report, so all three cannot drift. Nothing here starts a graph service or asks one for an answer -
 * the records are already on disk, and on this fork the graph backend is a memory map that the CLI,
 * the TUI and MCP do not even have.
 *
 * The corpus is the pool the gate enforces and the doctor report walks: tasks + completed, where
 * the completed *directory* is the completion evidence. Milestones are not part of it at all, and a
 * draft is never returned as a dependency - it may depend on a task, so its own edges are worth
 * walking when a caller asks, but nothing may be read back *as* depending on a draft.
 */

/** One task in an answer: identity, what the corpus knows about it, and how far away it is. */
export interface DependencyQueryRow {
	id: string;
	title: string;
	status: string;
	/** Shortest number of hops from the subject, along the direction that was asked for. */
	hops: number;
	/** True when the record is finished: it sits in completed/, or its status is a terminal one. */
	terminal: boolean;
}

/** One direction's answer: the rows, the blockers, the cycle and whether the walk was cut short. */
export interface DependencyDirectionAnswer {
	direction: DependencyDirection;
	/** One row per reachable task, shortest hops first, ties by id. */
	rows: DependencyQueryRow[];
	/**
	 * Members that are unfinished and have nothing of their own left to wait for. Only meaningful
	 * forward: a reverse answer lists dependents, not prerequisites, so it is always empty there.
	 */
	blockers: DependencyQueryRow[];
	/** The shortest chain from the subject back to itself when it sits on a cycle; empty otherwise. */
	cycle: string[];
	/** True when the walk stopped at the hop bound with more still to reach. */
	truncated: boolean;
}

/**
 * Both directions in one answer, which is what a popup needs: it shows what the record waits for and
 * what waits on it, and one corpus build answers both, so the client makes one request instead of
 * polling or asking twice.
 */
export interface DependencyQueryAnswer {
	subject: DependencyQueryRow;
	dependencies: DependencyDirectionAnswer;
	dependents: DependencyDirectionAnswer;
	/**
	 * References held by the subject or one of its members that resolve to nothing. Reported rather
	 * than dropped because such a reference contributes no edge: without this list a caller would
	 * read the closure as complete when the file says otherwise.
	 */
	unresolved: DependencyDefect[];
	/** What the answer was computed over, so a caller can tell which records were in scope. */
	corpus: { tasks: number; completed: number; drafts: number; milestones: number; released: number };
}

export interface DependencyQueryResult {
	subject: DependencyQueryRow;
	direction: DependencyDirection;
	rows: DependencyQueryRow[];
	blockers: DependencyQueryRow[];
	cycle: string[];
	truncated: boolean;
	unresolved: DependencyDefect[];
	corpus: { tasks: number; completed: number; drafts: number; milestones: number; released: number };
}

export interface DependencyQueryInput {
	/** Active records: backlog/tasks. */
	tasks: readonly DependencyRecordLike[];
	/** Completed records: backlog/completed, whose directory position is the completion evidence. */
	completed: readonly DependencyRecordLike[];
	/** Records that may depend on a task but may never be depended on. */
	drafts?: readonly DependencyRecordLike[];
	/** Records that exist but are not tasks. */
	milestones?: readonly DependencyIdentity[];
	/** Records that left the pool, so their ids are free again. */
	released?: readonly DependencyIdentity[];
	/** The project's status list, which decides what counts as unfinished. */
	statuses: readonly string[];
	/**
	 * Whether the drafts' own edges take part in the walk, which is what makes a draft a legitimate
	 * subject of a reverse query. Off unless the caller asks (AC #2): with it on, a draft can appear
	 * as a *dependent* of a task, never as a dependency.
	 */
	includeDrafts?: boolean;
}

/**
 * A prepared query. The corpus, the edges and the closure are built once and answer for any subject,
 * which is what lets one request per popup open serve every task that popup renders - the corpus is
 * not re-read per task.
 */
export class DependencyQuery {
	private readonly corpus: DependencyCorpus;
	private readonly closure: DependencyClosure;
	private readonly records = new Map<string, DependencyRecordLike>();
	/** The records this query answers about: the targets, plus the drafts when they were asked for. */
	private readonly scope: readonly DependencyRecordLike[];
	private readonly completedIds = new Set<string>();
	private readonly statuses: readonly string[];
	private readonly defects: DependencyDefect[];
	private readonly counts: DependencyQueryResult["corpus"];

	constructor(input: DependencyQueryInput) {
		const targets = [...input.tasks, ...input.completed];
		const drafts = input.drafts ?? [];
		this.statuses = input.statuses;
		this.corpus = new DependencyCorpus({
			targets,
			drafts,
			milestones: input.milestones,
			released: input.released,
		});
		// A draft is only in scope for a query that asked for drafts. Leaving it out of the lookup
		// means a draft subject answers null rather than an empty closure, which would read as "this
		// draft depends on nothing" when the truth is that its edges were never walked.
		this.scope = input.includeDrafts ? [...targets, ...drafts] : targets;
		for (const record of this.scope) {
			this.records.set(canonicalTaskId(record.id), record);
		}
		for (const record of input.completed) {
			this.completedIds.add(canonicalTaskId(record.id));
		}

		// One resolver for both edge sets, so a draft's reference is read through the same identity
		// rules as a task's and cannot resolve to something the gate would not accept.
		const resolve = (reference: string): string[] =>
			matchRecords(targets, reference).map((record) => canonicalTaskId(record.id));
		const edges = input.includeDrafts
			? [...dependencyEdges(targets, resolve), ...dependencyEdges(drafts, resolve)]
			: dependencyEdges(targets, resolve);
		this.closure = new DependencyClosure(edges);

		// Every reference that contributed no edge, in one list: a dangling id, a released id whose
		// only record sits under archive/, a target that exists but may not be depended on, and an
		// ambiguous id. The cycle diagnostic is separate because a cycle does produce edges.
		const sources = this.scope;
		const report = collectDependencyDefects(this.corpus, sources);
		this.defects = [...report.dangling, ...report.released, ...report.ineligible, ...report.ambiguous];

		this.counts = {
			tasks: input.tasks.length,
			completed: input.completed.length,
			drafts: drafts.length,
			milestones: (input.milestones ?? []).length,
			released: (input.released ?? []).length,
		};
	}

	/** The answer for one subject in one direction, or null when the corpus holds no such record. */
	answer(
		subjectId: string,
		options?: { direction?: DependencyDirection; maxHops?: number },
	): DependencyQueryResult | null {
		const subject = this.subjectRecord(subjectId);
		if (!subject) {
			return null;
		}
		const direction = options?.direction ?? "dependencies";
		const walked = this.walk(subject, direction, options?.maxHops);
		return {
			subject: this.describe(subject, 0),
			direction,
			rows: walked.rows,
			blockers: walked.blockers,
			cycle: walked.cycle,
			truncated: walked.truncated,
			unresolved: this.unresolvedAround(subject, walked.rows),
			corpus: this.counts,
		};
	}

	/**
	 * Both directions at once: what the record waits for and what waits on it. One corpus build
	 * answers both, so a popup needs a single request rather than one per direction.
	 */
	answerBoth(subjectId: string, options?: { maxHops?: number }): DependencyQueryAnswer | null {
		const subject = this.subjectRecord(subjectId);
		if (!subject) {
			return null;
		}
		const dependencies = this.walk(subject, "dependencies", options?.maxHops);
		const dependents = this.walk(subject, "dependents", options?.maxHops);
		return {
			subject: this.describe(subject, 0),
			dependencies,
			dependents,
			unresolved: this.unresolvedAround(subject, [...dependencies.rows, ...dependents.rows]),
			corpus: this.counts,
		};
	}

	/**
	 * The canonical identity of a record in scope, or null when the corpus does not hold it.
	 *
	 * Resolved through matchRecords, the one rule a reference is read by everywhere else, rather than
	 * by looking the canonical id up in a map. The two differ in the two cases that matter: a map
	 * reads a bare "414" as TASK-414, because canonicalTaskId has no prefix to infer and falls back to
	 * TASK, while this corpus stores BACK-414 - the spelling the CLI and the other task endpoints
	 * accept would 404; and where two records claim one id a map silently keeps whichever was stored
	 * last, whereas an identity nobody can pin down is better reported as absent than answered as a
	 * guess.
	 */
	private subjectRecord(subjectId: string): string | null {
		const candidates = matchRecords(this.scope, subjectId).map((record) => canonicalTaskId(record.id));
		// No match and several matches are the same answer: no single identity to report about.
		return candidates.length === 1 ? (candidates[0] ?? null) : null;
	}

	private walk(subject: string, direction: DependencyDirection, maxHops?: number): DependencyDirectionAnswer {
		const { rows, cycle, truncated } = this.closure.closureFrom(subject, { direction, maxHops });
		const described = rows.map((row) => this.describe(row.id, row.hops));
		return {
			direction,
			rows: described,
			// A blocker is the end of a chain of prerequisites, so the question only has an answer in
			// the forward direction; asking it of dependents would name the wrong tasks.
			blockers:
				direction === "dependencies"
					? described.filter((row) => !row.terminal && this.closure.dependenciesOf(row.id).length === 0)
					: [],
			cycle,
			truncated,
		};
	}

	/** The unresolved references held by the subject or one of the rows the walk reached. */
	private unresolvedAround(subject: string, rows: readonly DependencyQueryRow[]): DependencyDefect[] {
		const scope = new Set<string>([subject, ...rows.map((row) => row.id)]);
		return this.defects.filter((defect) => scope.has(defect.source));
	}

	private describe(id: string, hops: number): DependencyQueryRow {
		const record = this.records.get(id);
		const status = record?.status ?? "";
		return {
			id,
			title: record?.title ?? "",
			status,
			hops,
			// The completed directory is evidence on its own: a record that moved there is finished
			// even if its frontmatter still carries a historical status.
			terminal: this.completedIds.has(id) || isTerminalStatus(status, this.statuses),
		};
	}
}
