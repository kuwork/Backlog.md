import { describe, expect, it } from "bun:test";
import { coerceCypherCell, coerceCypherRows } from "../graph/coerce.ts";

describe("coerceCypherCell (doc-27 §5.4)", () => {
	it("passes scalars through untouched", () => {
		expect(coerceCypherCell("hello")).toBe("hello");
		expect(coerceCypherCell(42)).toBe(42);
		expect(coerceCypherCell(3.14)).toBe(3.14);
		expect(coerceCypherCell(true)).toBe(true);
		expect(coerceCypherCell(null)).toBe(null);
		expect(coerceCypherCell(undefined)).toBe(null);
	});

	it("coerces BigInt to a number while exactly representable, to a string after that", () => {
		expect(coerceCypherCell(7n)).toBe(7);
		expect(coerceCypherCell(2n ** 60n)).toBe(String(2n ** 60n));
	});

	it("serialises a node without its internal handle, keeping _label and properties", () => {
		const node = { _id: "1:7", _label: "Task", id: "BACK-1", title: "Write tests" };
		expect(coerceCypherCell(node)).toBe('{"_label":"Task","id":"BACK-1","title":"Write tests"}');
	});

	it("renders a relationship as (src)-[TYPE]->(dst) with no property bag", () => {
		const rel = { _src: "1:7", _dst: "2:3", _label: "BelongsToMilestone", since: 2026 };
		expect(coerceCypherCell(rel)).toBe("(1:7)-[BelongsToMilestone]->(2:3)");
	});

	it("renders a path as nodes and relationships alternating", () => {
		const path = {
			_nodes: [
				{ _id: "1:7", _label: "Task", id: "BACK-1" },
				{ _id: "2:3", _label: "Milestone", id: "m-1" },
				{ _id: "2:4", _label: "Milestone", id: "m-2" },
			],
			_rels: [
				{ _src: "1:7", _dst: "2:3", _label: "BelongsToMilestone" },
				{ _src: "2:3", _dst: "2:4", _label: "DependsOn" },
			],
		};
		expect(coerceCypherCell(path)).toBe(
			"(Task BACK-1)-[BelongsToMilestone]->(Milestone m-1)-[DependsOn]->(Milestone m-2)",
		);
	});

	it("falls back to the bare label for a path node with no id or path", () => {
		const path = {
			_nodes: [{ _id: "1:7", _label: "Tag" }],
			_rels: [],
		};
		expect(coerceCypherCell(path)).toBe("(Tag)");
	});

	it("serialises a list value as a JSON array of coerced cells", () => {
		expect(coerceCypherCell(["a", 1, null])).toBe('["a",1,null]');
	});
});

describe("coerceCypherRows", () => {
	it("maps every cell of every row, keeping row and column order", () => {
		const rows = [
			["BACK-1", { _id: "1:7", _label: "Task", id: "BACK-1" }],
			["BACK-2", null],
		];
		expect(coerceCypherRows(rows)).toEqual([
			["BACK-1", '{"_label":"Task","id":"BACK-1"}'],
			["BACK-2", null],
		]);
	});
});
