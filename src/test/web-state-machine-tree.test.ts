import { describe, expect, it } from "bun:test";
import type { StatusDefinition } from "../types/index.ts";
import { buildStateMachineTreeSource } from "../web/utils/state-machine-tree.ts";

const SEVEN_COLUMN: StatusDefinition[] = [
	{ name: "To Do", category: "active", next: [{ to: "Planning" }, { to: "Dropped" }] },
	{ name: "Planning", category: "wip", next: [{ to: "Plan Review" }] },
	{ name: "Plan Review", category: "blocked", next: [{ to: "In Progress" }, { to: "Planning" }] },
	{ name: "In Progress", category: "wip", next: [{ to: "In Review" }, { to: "Planning" }] },
	{ name: "In Review", category: "blocked", next: [{ to: "Done" }, { to: "In Progress" }] },
	{ name: "Done", category: "done", exit: "complete", next: [] },
	{ name: "Dropped", category: "dropped", exit: "archive", next: [] },
];

describe("buildStateMachineTreeSource", () => {
	it("renders every status reachable from the root exactly once", () => {
		const source = buildStateMachineTreeSource(SEVEN_COLUMN);
		const declared = source.split("\n").filter((line) => line.includes("["));
		expect(declared).toHaveLength(7);
		for (const name of ["To Do", "Planning", "Plan Review", "In Progress", "In Review", "Done", "Dropped"]) {
			expect(source).toContain(name);
		}
		// One declaration per node: the tree never opens a second subtree for a status.
		expect(declared.filter((line) => line.includes("Plan Review"))).toHaveLength(1);
	});

	it("draws a back-reference instead of expanding a loop", () => {
		const source = buildStateMachineTreeSource(SEVEN_COLUMN);
		const edges = source.split("\n").filter((line) => line.includes("-->") || line.includes("-.->"));
		// Plan Review → Planning and In Review → In Progress point back at a node already in the tree.
		expect(edges.some((edge) => edge.includes("-.->"))).toBe(true);
		expect(edges.filter((edge) => edge.includes("-.->")).length).toBeGreaterThanOrEqual(2);
	});

	it("terminates on a pure cycle", () => {
		const cycle: StatusDefinition[] = [
			{ name: "A", next: [{ to: "B" }] },
			{ name: "B", next: [{ to: "A" }] },
		];
		const source = buildStateMachineTreeSource(cycle);
		expect(source.split("\n").filter((line) => line.includes("["))).toHaveLength(2);
		expect(source).toContain("-.->");
	});

	it("keeps unreachable statuses visible as isolated nodes", () => {
		const source = buildStateMachineTreeSource([
			{ name: "A", next: [{ to: "B" }] },
			{ name: "B", next: [] },
			{ name: "Orphan", next: [] },
		]);
		expect(source).toContain("Orphan");
		expect(source.includes("Orphan -->")).toBe(false);
	});

	it("skips a transition whose target no longer exists", () => {
		const source = buildStateMachineTreeSource([{ name: "A", next: [{ to: "Ghost" }] }]);
		expect(source).not.toContain("Ghost");
	});

	it("quotes a label so mermaid can parse it", () => {
		const source = buildStateMachineTreeSource([
			{ name: "A", next: [{ to: "B", when: 'say "hi" and go' }] },
			{ name: "B", next: [] },
		]);
		expect(source).toContain("#quot;");
	});
});
