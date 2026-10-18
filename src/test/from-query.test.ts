import { describe, expect, it } from "bun:test";
import { parseCypherQueryBlock } from "../graph/block.ts";
import { parseQueryBlock } from "../sqlite/block.ts";
import { resolveFromQuery } from "../web/charts/from-query.ts";
import type { ChartQueryResult } from "../web/charts/types.ts";

const RESULT: ChartQueryResult = {
	columns: ["day", "cnt"],
	rows: [
		["Mon", 3],
		["Tue", 5],
	],
};

const registry = new Map<string, ChartQueryResult>([["q", RESULT]]);
const resolve = (id: string) => registry.get(id);

describe("parseQueryBlock id field (BACK-814)", () => {
	it("accepts an id on a sql block", () => {
		const parsed = parseQueryBlock(["id: my-query", "source: mydb", "sql: SELECT 1"].join("\n"));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.id).toBe("my-query");
	});

	it("accepts an id on a cypher block", () => {
		const parsed = parseCypherQueryBlock(["id: g", "source: default", "query: MATCH (n) RETURN n"].join("\n"));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.id).toBe("g");
	});

	it("leaves id undefined when absent", () => {
		const parsed = parseQueryBlock(["source: mydb", "sql: SELECT 1"].join("\n"));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.id).toBeUndefined();
	});
});

describe("resolveFromQuery (BACK-814)", () => {
	it("dataset form injects object rows as source", () => {
		const res = resolveFromQuery({ dataset: { fromQuery: "q" } }, resolve);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const option = res.option as { dataset: { source: unknown } };
		expect(option.dataset.source).toEqual([
			{ day: "Mon", cnt: 3 },
			{ day: "Tue", cnt: 5 },
		]);
	});

	it("series form injects the value column and synthesizes a category axis", () => {
		const res = resolveFromQuery(
			{ series: [{ type: "bar", fromQuery: "q", categoryField: "day", valueField: "cnt" }] },
			resolve,
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const option = res.option as {
			series: { data: unknown[]; fromQuery?: unknown }[];
			xAxis: { type: string; data: unknown[] };
		};
		expect(option.series[0]?.data).toEqual([3, 5]);
		expect(option.series[0]?.fromQuery).toBeUndefined();
		expect(option.xAxis).toEqual({ type: "category", data: ["Mon", "Tue"] });
	});

	it("pie series form builds name/value pairs and adds no axis", () => {
		const res = resolveFromQuery(
			{ series: [{ type: "pie", fromQuery: "q", categoryField: "day", valueField: "cnt" }] },
			resolve,
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const option = res.option as { series: { data: unknown[] }[]; xAxis?: unknown };
		expect(option.series[0]?.data).toEqual([
			{ name: "Mon", value: 3 },
			{ name: "Tue", value: 5 },
		]);
	});

	it("does not overwrite an explicit xAxis", () => {
		const res = resolveFromQuery(
			{
				xAxis: { type: "category", data: ["A", "B"] },
				series: [{ type: "bar", fromQuery: "q", categoryField: "day", valueField: "cnt" }],
			},
			resolve,
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect((res.option as { xAxis: { data: unknown[] } }).xAxis.data).toEqual(["A", "B"]);
	});

	it("leaves an option without fromQuery structurally unchanged", () => {
		const input = { title: { text: "x" }, series: [{ type: "bar", data: [1, 2] }] };
		const res = resolveFromQuery(input, resolve);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.option).toEqual(input);
	});

	it("fails with a message for an unknown id", () => {
		const res = resolveFromQuery({ dataset: { fromQuery: "nope" } }, resolve);
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.error).toContain("未找到查询 id: nope");
	});
});
