import { describe, expect, it } from "bun:test";
import type { CypherResult } from "../web/lib/api.ts";
import { cellDisplayText, graphFromCypherResult } from "../web/utils/cypher-graph.ts";

/**
 * The databases page draws a Cypher result as a graph (BACK-793). The transport keeps ryu's
 * internal handles (a node's `_id`, a relationship's `_src`/`_dst`), so the extraction's whole
 * job is joining them back together - whatever shape the user's RETURN clause produced.
 */

/** A result of one row with the given cells, as the server flattens them. */
function resultOf(rows: unknown[][]): CypherResult {
	return { columns: rows[0]?.map((_, index) => `c${index}`) ?? [], rows, nodeKeys: [], truncated: false };
}

/** A node value as ryu hands it over (serializeCypherValue keeps `_id` since BACK-793). */
function node(id: number, label: string, properties: Record<string, unknown> = {}) {
	return { _id: id, _label: label, ...properties };
}

/** A relationship value, endpoints by internal node id. */
function rel(src: number, dst: number, label: string) {
	return { _label: label, _src: src, _dst: dst };
}

describe("graphFromCypherResult", () => {
	it("joins a relationship to the two nodes of its row", () => {
		// MATCH (a:Person)-[r:KNOWS]->(b:Person) RETURN a, r, b
		const graph = graphFromCypherResult(
			resultOf([[node(0, "Person", { name: "Alice" }), rel(0, 1, "KNOWS"), node(1, "Person", { name: "Bob" })]]),
		);
		expect(graph.nodes.map((n) => n.caption)).toEqual(["Alice", "Bob"]);
		expect(graph.edges).toEqual([{ from: "0", to: "1", type: "KNOWS" }]);
		expect(graph.danglingEdges).toBe(0);
	});

	it("deduplicates a node that appears on many rows, and a repeated edge", () => {
		const graph = graphFromCypherResult(
			resultOf([
				[node(0, "Person", { name: "Alice" }), rel(0, 1, "KNOWS"), node(1, "Person", { name: "Bob" })],
				[node(1, "Person", { name: "Bob" }), rel(1, 0, "KNOWS"), node(0, "Person", { name: "Alice" })],
				[node(0, "Person", { name: "Alice" }), rel(0, 1, "KNOWS"), node(1, "Person", { name: "Bob" })],
			]),
		);
		expect(graph.nodes).toHaveLength(2);
		expect(graph.edges).toHaveLength(2); // 0->1 and 1->0 are different directions
		// The exact same edge on a third row adds nothing.
		const repeated = graphFromCypherResult(
			resultOf([
				[node(0, "Person", { name: "Alice" }), rel(0, 1, "KNOWS"), node(1, "Person", { name: "Bob" })],
				[node(0, "Person", { name: "Alice" }), rel(0, 1, "KNOWS"), node(1, "Person", { name: "Bob" })],
			]),
		);
		expect(repeated.edges).toHaveLength(1);
	});

	it("expands a path value to its node/relationship chain", () => {
		// MATCH p = (a)-[r]->(b) RETURN p
		const graph = graphFromCypherResult(
			resultOf([
				[
					{
						_nodes: [node(0, "Person", { name: "Alice" }), node(1, "Person", { name: "Bob" })],
						_rels: [rel(0, 1, "KNOWS")],
					},
				],
			]),
		);
		expect(graph.nodes.map((n) => n.caption)).toEqual(["Alice", "Bob"]);
		expect(graph.edges).toEqual([{ from: "0", to: "1", type: "KNOWS" }]);
	});

	it("recurses into lists (collect(n)) and keeps nodes-only results unconnected", () => {
		const graph = graphFromCypherResult(
			resultOf([
				[[node(0, "Person", { name: "Alice" }), node(1, "Person", { name: "Bob" })]],
				[[node(2, "Person", { name: "Carol" })]],
			]),
		);
		expect(graph.nodes).toHaveLength(3);
		expect(graph.edges).toEqual([]);
	});

	it("counts a relationship whose endpoints the result does not carry, and skips it", () => {
		// MATCH ()-[r:KNOWS]->() RETURN r LIMIT 5 - the endpoints were never returned.
		const graph = graphFromCypherResult(resultOf([[rel(7, 9, "KNOWS")]]));
		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
		expect(graph.danglingEdges).toBe(1);
	});

	it("comes back empty for a result with no node values", () => {
		expect(graphFromCypherResult(resultOf([[42]])).nodes).toEqual([]);
		expect(graphFromCypherResult(resultOf([["backlog/tasks/back-1.md"]])).nodes).toEqual([]);
		expect(graphFromCypherResult(resultOf([])).nodes).toEqual([]);
	});

	it("prefers a naming property for the caption, falling back through the list", () => {
		const byName = graphFromCypherResult(resultOf([[node(0, "Person", { name: "Alice", title: "T", key: "k" })]]));
		expect(byName.nodes[0]?.caption).toBe("Alice");
		const byKey = graphFromCypherResult(resultOf([[node(0, "Item", { key: "sku-1", id: "x" })]]));
		expect(byKey.nodes[0]?.caption).toBe("sku-1");
		const byLabel = graphFromCypherResult(resultOf([[node(0, "Thing")]]));
		expect(byLabel.nodes[0]?.caption).toBe("Thing");
		expect(byLabel.nodes[0]?.title).toBe("Thing");
	});

	it("falls back to a property fingerprint when a node carries no internal id", () => {
		const graph = graphFromCypherResult(
			resultOf([
				[{ _label: "Person", name: "Alice" }],
				[{ _label: "Person", name: "Alice" }],
				[{ _label: "Person", name: "Bob" }],
			]),
		);
		expect(graph.nodes).toHaveLength(2);
	});

	it("keeps the label and the untrimmed title beside the trimmed caption", () => {
		const long = "x".repeat(200);
		const graph = graphFromCypherResult(resultOf([[node(0, "Person", { name: long })]]));
		expect(graph.nodes[0]?.label).toBe("Person");
		expect(graph.nodes[0]?.title).toBe(long);
		expect(graph.nodes[0]?.caption.length).toBeLessThan(long.length);
		expect(graph.nodes[0]?.caption.endsWith("…")).toBe(true);
	});
});

describe("cellDisplayText", () => {
	it("hides the internal handles a table has no use for", () => {
		expect(cellDisplayText(node(3, "Person", { name: "Alice" }))).toBe('{"_label":"Person","name":"Alice"}');
		expect(cellDisplayText(rel(3, 4, "KNOWS"))).toBe('{"_label":"KNOWS"}');
	});

	it("keeps scalars as-is and lists verbatim", () => {
		expect(cellDisplayText("text")).toBe("text");
		expect(cellDisplayText(7)).toBe("7");
		expect(cellDisplayText(null)).toBe("");
		expect(cellDisplayText([1, "a"])).toBe('[1,"a"]');
	});
});
