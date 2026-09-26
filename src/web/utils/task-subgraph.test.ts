import { describe, expect, it } from "bun:test";
import type { GraphEdgeDto, GraphNodeDto } from "../lib/api.ts";
import { buildRelationshipSubgraph, type RelationshipGraphPayload, SUBGRAPH_MAX_DEPTH } from "./task-subgraph";

let seq = 0;
const node = (id: string, kind: GraphNodeDto["kind"] = "task"): GraphNodeDto => {
	seq += 1;
	return {
		id,
		title: `Title ${id}`,
		kind,
		status: kind === "milestone" ? "" : "To Do",
		filePath: `${kind === "milestone" ? "milestones" : "tasks"}/${id}-${seq}.md`,
	};
};
const edge = (type: GraphEdgeDto["type"], from: string, to: string): GraphEdgeDto => ({
	type,
	from,
	to,
});

// Parent chain BACK-1 -> BACK-2 -> BACK-3 (ParentOf: child -> parent),
// BACK-1 depends on BACK-4, BACK-1 belongs to milestone m-1, BACK-5 unconnected.
const payload = (): RelationshipGraphPayload => ({
	nodes: [node("BACK-1"), node("BACK-2"), node("BACK-3"), node("BACK-4"), node("BACK-5"), node("m-1", "milestone")],
	edges: [
		edge("ParentOf", "BACK-1", "BACK-2"),
		edge("ParentOf", "BACK-2", "BACK-3"),
		edge("DependsOn", "BACK-1", "BACK-4"),
		edge("BelongsToMilestone", "BACK-1", "m-1"),
	],
});

describe("buildRelationshipSubgraph", () => {
	it("walks every relation type in both directions from the focus", () => {
		const graph = buildRelationshipSubgraph(payload(), "BACK-2");
		const ids = graph.nodes.map((n) => n.id);
		// BACK-2 reaches its child (BACK-1, reverse ParentOf), its parent (BACK-3),
		// the dependency BACK-4 and the milestone, all through BACK-1.
		expect(ids).toEqual(expect.arrayContaining(["BACK-1", "BACK-3", "BACK-4", "m-1"]));
		expect(ids).not.toContain("BACK-5");
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));
		expect(byId.get("BACK-2")?.isRoot).toBe(true);
		expect(byId.get("BACK-1")?.isRoot).toBe(false);
	});

	it("keeps node kind/status and edge types inside the subgraph", () => {
		const graph = buildRelationshipSubgraph(payload(), "BACK-1");
		const byId = new Map(graph.nodes.map((n) => [n.id, n]));
		expect(byId.get("m-1")?.kind).toBe("milestone");
		expect(byId.get("BACK-2")?.kind).toBe("task");
		expect(byId.get("BACK-2")?.status).toBe("To Do");
		const types = graph.edges.map((e) => e.type).sort();
		expect(types).toEqual(["BelongsToMilestone", "DependsOn", "ParentOf", "ParentOf"]);
	});

	it("does not follow phase-3 knowledge edges: tags and wiki pages stay out", () => {
		// A task's labels produce TaggedWith edges and its body may cite pages, but the modal is a
		// task view (and has no way to open a Tag or a wiki page).
		const knowledge: RelationshipGraphPayload = {
			nodes: [node("BACK-1"), node("tag:bug", "tag"), node("wiki/concepts/a.md", "wiki")],
			edges: [edge("TaggedWith", "BACK-1", "tag:bug"), edge("LinksTo", "BACK-1", "wiki/concepts/a.md")],
		};
		const graph = buildRelationshipSubgraph(knowledge, "BACK-1");
		expect(graph.nodes.map((n) => n.id)).toEqual(["BACK-1"]);
		expect(graph.edges).toEqual([]);
	});

	it("matches the focus id case-insensitively", () => {
		const graph = buildRelationshipSubgraph(payload(), "back-1");
		expect(graph.nodes.some((n) => n.isRoot)).toBe(true);
		expect(graph.nodes.find((n) => n.isRoot)?.id).toBe("BACK-1");
	});

	it("returns an empty subgraph when the focus is not in the payload", () => {
		const graph = buildRelationshipSubgraph(payload(), "MISSING-9");
		expect(graph.nodes).toHaveLength(0);
		expect(graph.edges).toHaveLength(0);
	});

	it("survives dependency cycles by visiting each node once", () => {
		const cyclic: RelationshipGraphPayload = {
			nodes: [node("A"), node("B")],
			edges: [edge("DependsOn", "A", "B"), edge("DependsOn", "B", "A")],
		};
		const graph = buildRelationshipSubgraph(cyclic, "A");
		expect(graph.nodes).toHaveLength(2);
		expect(graph.edges).toHaveLength(2);
	});

	it("respects maxDepth in every direction", () => {
		const chain: RelationshipGraphPayload = {
			nodes: [node("T1"), node("T2"), node("T3"), node("T4")],
			edges: [edge("DependsOn", "T1", "T2"), edge("DependsOn", "T2", "T3"), edge("DependsOn", "T3", "T4")],
		};
		const graph = buildRelationshipSubgraph(chain, "T2", 1);
		const ids = graph.nodes.map((n) => n.id);
		expect(ids).toEqual(expect.arrayContaining(["T1", "T3"]));
		expect(ids).not.toContain("T4");
	});

	it("uses SUBGRAPH_MAX_DEPTH as the default bound", () => {
		const nodes = Array.from({ length: SUBGRAPH_MAX_DEPTH + 3 }, (_, i) => node(`X${i}`));
		const edges = nodes.slice(1).map((n, i) => edge("DependsOn", n.id, `X${i}`));
		const graph = buildRelationshipSubgraph({ nodes, edges }, `X${SUBGRAPH_MAX_DEPTH + 2}`);
		expect(graph.nodes.length).toBeLessThanOrEqual(SUBGRAPH_MAX_DEPTH + 1);
	});

	it("caps the node count at maxNodes, keeping the closest neighbors", () => {
		const nodes = [node("H"), ...Array.from({ length: 6 }, (_, i) => node(`N${i}`))];
		const edges = nodes.slice(1).map((n) => edge("DependsOn", "H", n.id));
		const graph = buildRelationshipSubgraph({ nodes, edges }, "H", SUBGRAPH_MAX_DEPTH, 3);
		expect(graph.nodes).toHaveLength(3);
		expect(graph.nodes.some((n) => n.isRoot)).toBe(true);
		expect(graph.edges).toHaveLength(2);
	});
});
