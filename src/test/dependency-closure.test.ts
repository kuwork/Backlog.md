import { describe, expect, test } from "bun:test";
import type { DependencyRecordLike } from "../utils/dependency-closure.ts";
import { DependencyQuery } from "../utils/dependency-query.ts";

const STATUSES = ["To Do", "In Progress", "Done"];

function record(id: string, dependencies: string[] = [], status = "To Do"): DependencyRecordLike {
	return { id, title: `${id} title`, status, dependencies };
}

function queryOf(input: {
	tasks: DependencyRecordLike[];
	completed?: DependencyRecordLike[];
	drafts?: DependencyRecordLike[];
	milestones?: Array<{ id: string }>;
	released?: Array<{ id: string }>;
	includeDrafts?: boolean;
}): DependencyQuery {
	return new DependencyQuery({
		statuses: STATUSES,
		completed: [],
		...input,
	});
}

/** The rows as `ID@hops`, which is what the ordering and dedup questions are really about. */
function shape(rows: Array<{ id: string; hops: number }>): string[] {
	return rows.map((row) => `${row.id}@${row.hops}`);
}

describe("dependency query", () => {
	test("answers a chain forward with one row per task and its shortest hop count", () => {
		const query = queryOf({
			tasks: [record("TASK-1", ["TASK-2"]), record("TASK-2", ["TASK-3"]), record("TASK-3")],
		});

		const result = query.answer("TASK-1");

		expect(result).not.toBeNull();
		expect(result?.direction).toBe("dependencies");
		expect(shape(result?.rows ?? [])).toEqual(["TASK-2@1", "TASK-3@2"]);
		expect(result?.cycle).toEqual([]);
		expect(result?.truncated).toBe(false);
		expect(result?.subject).toMatchObject({ id: "TASK-1", hops: 0, terminal: false });
	});

	test("reports a diamond-shared task once, at its shortest distance", () => {
		// A -> B, A -> C, B -> C: C is reachable at one hop and at two.
		const query = queryOf({
			tasks: [record("TASK-1", ["TASK-2", "TASK-3"]), record("TASK-2", ["TASK-3"]), record("TASK-3")],
		});

		const rows = query.answer("TASK-1")?.rows ?? [];

		expect(shape(rows)).toEqual(["TASK-2@1", "TASK-3@1"]);
		expect(rows.filter((row) => row.id === "TASK-3").length).toBe(1);
	});

	test("lists what depends on a target, with hop counts, in the reverse direction", () => {
		const query = queryOf({
			tasks: [
				record("TASK-1", ["TASK-2"]),
				record("TASK-2", ["TASK-3"]),
				record("TASK-3"),
				record("TASK-4", ["TASK-2"]),
			],
		});

		const result = query.answer("TASK-3", { direction: "dependents" });

		expect(result?.direction).toBe("dependents");
		expect(shape(result?.rows ?? [])).toEqual(["TASK-2@1", "TASK-1@2", "TASK-4@2"]);
		// Blockers are a forward concept: a reverse answer lists dependents, not prerequisites.
		expect(result?.blockers).toEqual([]);
	});

	test("identifies the unfinished root of a chain and ignores a finished one", () => {
		const open = queryOf({
			tasks: [record("TASK-1", ["TASK-2"]), record("TASK-2", ["TASK-3"]), record("TASK-3")],
		});
		expect(shape(open.answer("TASK-1")?.blockers ?? [])).toEqual(["TASK-3@2"]);

		const done = queryOf({
			tasks: [record("TASK-1", ["TASK-2"]), record("TASK-2", ["TASK-3"]), record("TASK-3", [], "Done")],
		});
		expect(done.answer("TASK-1")?.blockers).toEqual([]);
	});

	test("treats the completed directory as completion evidence on its own", () => {
		const query = queryOf({
			tasks: [record("TASK-1", ["TASK-2"])],
			// A historical status that is not terminal, in the completed corpus: the directory decides.
			completed: [record("TASK-2", [], "In Progress")],
		});

		const result = query.answer("TASK-1");

		expect(shape(result?.rows ?? [])).toEqual(["TASK-2@1"]);
		expect(result?.rows[0]?.terminal).toBe(true);
		expect(result?.blockers).toEqual([]);
	});

	test("surfaces a reference that resolves to nothing instead of dropping it", () => {
		const query = queryOf({ tasks: [record("TASK-1", ["BACK-999"])] });

		const result = query.answer("TASK-1");

		// No edge exists for it, so the closure is empty and the reference is the whole answer.
		expect(result?.rows).toEqual([]);
		expect(result?.unresolved).toHaveLength(1);
		expect(result?.unresolved[0]).toMatchObject({
			source: "TASK-1",
			reference: "BACK-999",
			kind: "unresolvable",
		});
	});

	test("never returns a draft as a dependency, and walks a draft's edges only when asked", () => {
		const tasks = [record("TASK-1"), record("TASK-2", ["TASK-1"])];
		const drafts = [record("DRAFT-1", ["TASK-1"])];

		// Without the draft edges the reverse answer sees the real dependent and not the draft.
		const withoutDrafts = queryOf({ tasks, drafts });
		expect(shape(withoutDrafts.answer("TASK-1", { direction: "dependents" })?.rows ?? [])).toEqual(["TASK-2@1"]);
		expect(withoutDrafts.answer("DRAFT-1")).toBeNull();

		const withDrafts = queryOf({ tasks, drafts, includeDrafts: true });
		// A draft may depend on a task, so it shows up as a dependent, ordered with the others by id.
		expect(shape(withDrafts.answer("TASK-1", { direction: "dependents" })?.rows ?? [])).toEqual([
			"DRAFT-1@1",
			"TASK-2@1",
		]);
		// ...and it is a legitimate subject of its own forward query, which returns tasks only.
		expect(shape(withDrafts.answer("DRAFT-1")?.rows ?? [])).toEqual(["TASK-1@1"]);
	});

	test("keeps milestones out of the corpus", () => {
		const query = queryOf({
			tasks: [record("TASK-1", ["M-1"])],
			milestones: [{ id: "M-1" }],
		});

		const result = query.answer("TASK-1");

		expect(result?.rows).toEqual([]);
		expect(result?.unresolved[0]).toMatchObject({ reference: "M-1", kind: "milestone" });
	});

	test("terminates on a cycle and reports the chain it sits on", () => {
		const twoNode = queryOf({ tasks: [record("TASK-1", ["TASK-2"]), record("TASK-2", ["TASK-1"])] });
		const result = twoNode.answer("TASK-1");

		expect(shape(result?.rows ?? [])).toEqual(["TASK-2@1"]);
		expect(result?.cycle).toEqual(["TASK-1", "TASK-2", "TASK-1"]);

		const selfLoop = queryOf({ tasks: [record("TASK-1", ["TASK-1"])] });
		expect(selfLoop.answer("TASK-1")?.cycle).toEqual(["TASK-1", "TASK-1"]);
		expect(selfLoop.answer("TASK-1")?.rows).toEqual([]);
	});

	test("orders rows by hops then id, whatever order the records arrived in", () => {
		const forward = queryOf({
			tasks: [record("TASK-1", ["TASK-3", "TASK-2"]), record("TASK-2"), record("TASK-3")],
		});
		const reversed = queryOf({
			tasks: [record("TASK-3"), record("TASK-2"), record("TASK-1", ["TASK-2", "TASK-3"])],
		});

		expect(shape(forward.answer("TASK-1")?.rows ?? [])).toEqual(["TASK-2@1", "TASK-3@1"]);
		expect(shape(reversed.answer("TASK-1")?.rows ?? [])).toEqual(shape(forward.answer("TASK-1")?.rows ?? []));
	});

	test("stops at the hop bound and says so", () => {
		const query = queryOf({
			tasks: [record("TASK-1", ["TASK-2"]), record("TASK-2", ["TASK-3"]), record("TASK-3")],
		});

		const result = query.answer("TASK-1", { maxHops: 1 });

		expect(shape(result?.rows ?? [])).toEqual(["TASK-2@1"]);
		expect(result?.truncated).toBe(true);
	});

	test("describes the corpus it answered over, and refuses an unknown subject", () => {
		const query = queryOf({
			tasks: [record("TASK-1")],
			completed: [record("TASK-2", [], "Done")],
			drafts: [record("DRAFT-1")],
			milestones: [{ id: "M-1" }],
			released: [{ id: "TASK-77" }],
		});

		expect(query.answer("TASK-1")?.corpus).toMatchObject({
			tasks: 1,
			completed: 1,
			drafts: 1,
			milestones: 1,
			released: 1,
		});
		expect(query.answer("TASK-404")).toBeNull();
	});

	test("resolves a subject the way every other entry point reads an id", () => {
		const query = queryOf({ tasks: [record("BACK-414", ["BACK-2"]), record("BACK-2")] });

		// Case and zero padding are spellings of the same identity.
		expect(query.answer("back-414")?.subject.id).toBe("BACK-414");
		expect(query.answer("BACK-0414")?.subject.id).toBe("BACK-414");
		// The bare number is the spelling the CLI and the other task endpoints accept, and a map
		// keyed by canonical id would miss it: canonicalTaskId has no prefix to infer, so it reads
		// "414" as TASK-414 while this corpus stores BACK-414.
		expect(query.answer("414")?.subject.id).toBe("BACK-414");
		expect(shape(query.answer("414")?.rows ?? [])).toEqual(["BACK-2@1"]);
		// A different explicit prefix is a different identity, which is the rule the gate follows too.
		expect(query.answer("TASK-414")).toBeNull();
		expect(query.answer("BACK-999")).toBeNull();
	});

	test("refuses a bare number two records claim rather than picking one", () => {
		// Only reachable when a corpus carries two prefixes, which is what the duplicate-id diagnosis
		// is for - and an id that names both records has no single answer to give.
		const query = queryOf({ tasks: [record("BACK-7"), record("TASK-7")] });

		expect(query.answer("7")).toBeNull();
		expect(query.answer("BACK-7")?.subject.id).toBe("BACK-7");
	});
});
