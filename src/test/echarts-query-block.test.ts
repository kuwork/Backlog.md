import { describe, expect, it } from "bun:test";
import { parseCypherQueryBlock } from "../graph/block.ts";
import { parseQueryBlock } from "../sqlite/block.ts";
import { buildEchartsOption, type EchartsQueryResult } from "../web/charts/echarts-query.ts";

const RESULT: EchartsQueryResult = {
	columns: ["day", "cnt"],
	rows: [
		["Mon", 3],
		["Tue", 5],
	],
};

describe("parseQueryBlock view: echarts (BACK-813)", () => {
	it("accepts view: echarts with a chart block scalar", () => {
		const raw = [
			"source: mydb",
			"sql: SELECT day, cnt FROM tasks GROUP BY day",
			"view: echarts",
			"chart: |",
			"  {",
			'    "type": "bar",',
			'    "categoryField": "day",',
			'    "valueField": "cnt"',
			"  }",
		].join("\n");

		const parsed = parseQueryBlock(raw);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.view).toBe("echarts");
		expect(parsed.block.chart).toContain('"type": "bar"');
	});

	it("accepts an inline chart JSON", () => {
		const raw = [
			"source: mydb",
			"sql: SELECT 1",
			"view: echarts",
			'chart: {"type":"line","categoryField":"day","valueField":"cnt"}',
		].join("\n");

		const parsed = parseQueryBlock(raw);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.chart).toBe('{"type":"line","categoryField":"day","valueField":"cnt"}');
	});

	it("still fails closed on an unknown field", () => {
		const parsed = parseQueryBlock(["source: mydb", "sql: SELECT 1", "nope: x"].join("\n"));
		expect(parsed.ok).toBe(false);
	});

	it("cypher accepts view: echarts", () => {
		const raw = ["source: default", "query: |", "  MATCH (n) RETURN n.x AS x, n.y AS y", "view: echarts"].join("\n");

		const parsed = parseCypherQueryBlock(raw);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.view).toBe("echarts");
	});
});

describe("buildEchartsOption simple mapping form", () => {
	it("builds a category/value bar chart", () => {
		const option = buildEchartsOption(
			JSON.stringify({ type: "bar", categoryField: "day", valueField: "cnt", title: "Daily" }),
			RESULT,
		) as Record<string, unknown> & {
			xAxis: { type: string; data: unknown[] };
			series: { type: string; data: unknown[] }[];
			title: { text: string };
		};

		expect(option.xAxis.type).toBe("category");
		expect(option.xAxis.data).toEqual(["Mon", "Tue"]);
		expect(option.series[0]?.type).toBe("bar");
		expect(option.series[0]?.data).toEqual([3, 5]);
		expect(option.title.text).toBe("Daily");
	});

	it("builds a pie chart from name/value pairs", () => {
		const option = buildEchartsOption(
			JSON.stringify({ type: "pie", categoryField: "day", valueField: "cnt" }),
			RESULT,
		) as { series: { type: string; data: { name: unknown; value: unknown }[] }[] };

		expect(option.series[0]?.type).toBe("pie");
		expect(option.series[0]?.data).toEqual([
			{ name: "Mon", value: 3 },
			{ name: "Tue", value: 5 },
		]);
	});

	it("throws when a required field is missing", () => {
		expect(() => buildEchartsOption(JSON.stringify({ type: "bar" }), RESULT)).toThrow();
	});
});

describe("buildEchartsOption advanced form (@result placeholders)", () => {
	it("substitutes @result:<column> with that column's values", () => {
		const option = buildEchartsOption(
			JSON.stringify({
				option: {
					xAxis: { type: "category", data: "@result:day" },
					series: [{ type: "bar", data: "@result:cnt" }],
				},
			}),
			RESULT,
		) as { xAxis: { data: unknown[] }; series: { data: unknown[] }[] };

		expect(option.xAxis.data).toEqual(["Mon", "Tue"]);
		expect(option.series[0]?.data).toEqual([3, 5]);
	});

	it("substitutes @result with object rows for dataset.source", () => {
		const option = buildEchartsOption(JSON.stringify({ option: { dataset: { source: "@result" } } }), RESULT) as {
			dataset: { source: unknown };
		};

		expect(option.dataset.source).toEqual([
			{ day: "Mon", cnt: 3 },
			{ day: "Tue", cnt: 5 },
		]);
	});

	it("leaves literal strings alone and yields empty data for an unknown column", () => {
		const option = buildEchartsOption(
			JSON.stringify({ option: { title: { text: "literal" }, series: [{ data: "@result:nope" }] } }),
			RESULT,
		) as { title: { text: string }; series: { data: unknown[] }[] };

		expect(option.title.text).toBe("literal");
		expect(option.series[0]?.data).toEqual([]);
	});

	it("throws on invalid JSON", () => {
		expect(() => buildEchartsOption("{not json", RESULT)).toThrow();
	});
});
