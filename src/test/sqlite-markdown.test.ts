import { describe, expect, test } from "bun:test";
import { cellToMarkdown, resultToMarkdownTable } from "../sqlite/markdown.ts";

const result = (columns: string[], rows: (string | number | boolean | null)[][]) => ({ columns, rows });

describe("resultToMarkdownTable", () => {
	test("builds a GFM table with a header and a delimiter row", () => {
		const markdown = resultToMarkdownTable(result(["id", "name"], [[1, "Alice"]]));

		expect(markdown).toBe(["| id | name |", "| --- | --- |", "| 1 | Alice |"].join("\n"));
	});

	test("escapes pipes in column names and cells so they do not open a column", () => {
		const markdown = resultToMarkdownTable(result(["a|b"], [["x|y"]]));

		expect(markdown).toContain("| a\\|b |");
		expect(markdown).toContain("| x\\|y |");
	});

	test("collapses embedded newlines into <br> so a row stays one line", () => {
		const markdown = resultToMarkdownTable(result(["note"], [["first\nsecond\r\nthird"]]));

		expect(markdown.split("\n")).toHaveLength(3);
		expect(markdown).toContain("| first<br>second<br>third |");
	});

	test("turns tabs into a single space", () => {
		expect(resultToMarkdownTable(result(["note"], [["a\tb"]]))).toContain("| a b |");
	});

	test("renders NULL as an empty cell rather than the string NULL", () => {
		expect(resultToMarkdownTable(result(["name"], [[null]]))).toContain("|  |");
	});

	test("prints booleans and numbers in their plain string form", () => {
		expect(resultToMarkdownTable(result(["ok", "n"], [[true, 3.5]]))).toContain("| true | 3.5 |");
	});

	test("keeps the header for a result with columns but no rows", () => {
		expect(resultToMarkdownTable(result(["id", "name"], []))).toBe("| id | name |\n| --- | --- |");
	});

	test("returns nothing when there are no columns either", () => {
		expect(resultToMarkdownTable(result([], []))).toBe("");
	});
});

describe("cellToMarkdown", () => {
	test("copies NULL as an empty string", () => {
		expect(cellToMarkdown(null)).toBe("");
	});

	test("copies a scalar without table furniture", () => {
		expect(cellToMarkdown(42)).toBe("42");
		expect(cellToMarkdown("Alice")).toBe("Alice");
	});

	test("still escapes a scalar that would break the line it lands on", () => {
		expect(cellToMarkdown("a|b\nc")).toBe("a\\|b<br>c");
	});
});
