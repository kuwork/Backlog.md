import { describe, expect, it } from "bun:test";
import { parseDuckdbQueryBlock } from "../duckdb/block.ts";
import { CYPHER_BLOCK_LANG, parseCypherQueryBlock } from "../graph/block.ts";
import { parseQueryBlock, type QueryBlockStyle } from "../sqlite/block.ts";

describe("parseCypherQueryBlock (BACK-802)", () => {
	it("parses a block whose statement field is `query`", () => {
		const result = parseCypherQueryBlock(
			["source: tasks", "query: |", "  MATCH (t:Task)", "  RETURN t.id AS id", "  LIMIT 20"].join("\n"),
		);
		expect(result).toEqual({
			ok: true,
			block: {
				source: "tasks",
				sql: "MATCH (t:Task)\nRETURN t.id AS id\nLIMIT 20",
				view: "table",
				refresh: "manual",
				copyTo: undefined,
			},
		});
	});

	it("exposes the fence language id the markdown renderer dispatches on", () => {
		expect(CYPHER_BLOCK_LANG).toBe("cypher-query");
	});

	it("rejects a block missing the query field", () => {
		const result = parseCypherQueryBlock("source: tasks");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("query");
	});

	it("rejects the SQL statement field name - a cypher block has no `sql`", () => {
		const result = parseCypherQueryBlock(["source: tasks", "sql: |", "  SELECT 1"].join("\n"));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("未知字段");
	});

	it("rejects an unknown field rather than silently ignoring a typo", () => {
		const result = parseCypherQueryBlock(["source: tasks", "veiw: list", "query: RETURN 1"].join("\n"));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("未知字段");
	});

	it("accepts every text view plus graph, rejecting anything else", () => {
		for (const view of ["table", "list", "value", "graph"]) {
			const result = parseCypherQueryBlock(`source: tasks\nview: ${view}\nquery: RETURN 1`);
			expect(result.ok).toBe(true);
		}
		const bogus = parseCypherQueryBlock("source: tasks\nview: chart\nquery: RETURN 1");
		expect(bogus.ok).toBe(false);
		if (!bogus.ok) expect(bogus.error).toContain("table / list / value / graph");
	});

	it("keeps `view: graph` cypher-only: the shared SQL grammar still rejects it", () => {
		const result = parseQueryBlock("source: a.db\nview: graph\nsql: SELECT 1");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("table / list / value");
	});

	it("accepts refresh: auto (BACK-804) while the shared SQL grammar stays manual-only", () => {
		const auto = parseCypherQueryBlock("source: tasks\nrefresh: auto\nquery: RETURN 1");
		expect(auto).toEqual({
			ok: true,
			block: { source: "tasks", sql: "RETURN 1", view: "table", refresh: "auto", copyTo: undefined },
		});
		const sql = parseQueryBlock("source: a.db\nrefresh: auto\nsql: SELECT 1");
		expect(sql.ok).toBe(false);
		if (!sql.ok) expect(sql.error).toContain("manual");
	});
});

describe("query block style field (BACK-805)", () => {
	it("parses a single preset", () => {
		const result = parseQueryBlock("source: a.db\nstyle: compact\nsql: SELECT 1");
		expect(result).toEqual({
			ok: true,
			block: {
				source: "a.db",
				sql: "SELECT 1",
				view: "table",
				refresh: "manual",
				copyTo: undefined,
				style: ["compact"],
			},
		});
	});

	it("parses a space-separated multi-value combo, in the order written", () => {
		const result = parseQueryBlock("source: a.db\nstyle: compact   striped\nsql: SELECT 1");
		expect(result.ok && result.block.style).toEqual(["compact", "striped"]);
	});

	it("drops unknown tokens instead of rejecting the block, and dedupes repeats", () => {
		const mixed = parseQueryBlock("source: a.db\nstyle: compact bogus compact\nsql: SELECT 1");
		expect(mixed.ok && mixed.block.style).toEqual(["compact"]);
	});

	it("treats a fully invalid style as absent - the default look, no error", () => {
		const result = parseQueryBlock("source: a.db\nstyle: rainbow\nsql: SELECT 1");
		expect(result).toEqual({
			ok: true,
			block: { source: "a.db", sql: "SELECT 1", view: "table", refresh: "manual", copyTo: undefined, style: undefined },
		});
	});

	it("is absent when the block sets no style", () => {
		const result = parseQueryBlock("source: a.db\nsql: SELECT 1");
		expect(result.ok && result.block.style).toBeUndefined();
	});

	it("is accepted by all three engines with the same result", () => {
		const expected: QueryBlockStyle[] = ["borderless"];
		const sql = parseQueryBlock("source: a.db\nstyle: borderless\nsql: SELECT 1");
		expect(sql.ok && sql.block.style).toEqual(expected);
		const duckdb = parseDuckdbQueryBlock("source: a.duckdb\nstyle: borderless\nsql: SELECT 1");
		expect(duckdb.ok && duckdb.block.style).toEqual(expected);
		const cypher = parseCypherQueryBlock("source: tasks\nstyle: borderless\nquery: RETURN 1");
		expect(cypher.ok && cypher.block.style).toEqual(expected);
	});
});
