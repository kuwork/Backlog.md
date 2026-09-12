import { describe, expect, it } from "bun:test";
import type { DecisionSearchResult, DocumentSearchResult, TaskSearchResult, WikiSearchResult } from "../../types";
import {
	buildSearchRows,
	clampRestoreIndex,
	getIdMatchIndices,
	getSearchResultLink,
	getSearchResultMeta,
	getTitleMatchIndices,
	isModalSearchTarget,
	mergeHighlightRanges,
	parseSearchTypeParam,
	serializeSearchTypeParam,
} from "./search-results";

const makeTask = (id: string, title: string, extra: Partial<TaskSearchResult["task"]> = {}): TaskSearchResult => ({
	type: "task",
	score: 0.1,
	task: { id, title, status: "in-progress", priority: "high", ...extra } as TaskSearchResult["task"],
});

const makeDocument = (id: string, title: string): DocumentSearchResult => ({
	type: "document",
	score: 0.2,
	document: {
		id,
		title,
		type: "guide",
		createdDate: "2026-01-01",
		tags: ["guide"],
	} as DocumentSearchResult["document"],
});

const makeDecision = (id: string, title: string): DecisionSearchResult => ({
	type: "decision",
	score: 0.3,
	decision: {
		id,
		title,
		date: "2026-01-01",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
});

const makeWiki = (path: string, title: string): WikiSearchResult => ({
	type: "wiki",
	score: 0.4,
	wiki: { content: "", path, frontmatter: { title } },
});

describe("parseSearchTypeParam / serializeSearchTypeParam", () => {
	it("parses known types and defaults to all", () => {
		expect(parseSearchTypeParam("task")).toBe("task");
		expect(parseSearchTypeParam("doc")).toBe("document");
		expect(parseSearchTypeParam("document")).toBe("document");
		expect(parseSearchTypeParam("wiki")).toBe("wiki");
		expect(parseSearchTypeParam("decision")).toBe("decision");
		expect(parseSearchTypeParam(null)).toBe("all");
		expect(parseSearchTypeParam("bogus")).toBe("all");
	});

	it("round-trips every filter type", () => {
		for (const type of ["all", "task", "document", "wiki", "decision"] as const) {
			expect(parseSearchTypeParam(serializeSearchTypeParam(type))).toBe(type);
		}
		expect(serializeSearchTypeParam("document")).toBe("doc");
	});
});

describe("getSearchResultLink", () => {
	it("builds task detail link with stripped id and slug", () => {
		expect(getSearchResultLink(makeTask("back-624", "Spotlight Search!"))).toBe("/task/624/spotlight-search");
	});

	it("builds draft detail link for draft tasks", () => {
		expect(getSearchResultLink(makeTask("DRAFT-3", "Idea"))).toBe("/draft/3/idea");
	});

	it("builds documentation link with stripped id and slug", () => {
		expect(getSearchResultLink(makeDocument("doc-17", "Global Search!"))).toBe("/documentation/17/global-search");
	});

	it("builds decision link with stripped id and slug", () => {
		expect(getSearchResultLink(makeDecision("decision-9", "Use Router"))).toBe("/decisions/9/use-router");
	});

	it("builds wiki link with encoded path keeping the .md suffix", () => {
		expect(getSearchResultLink(makeWiki("concepts/foo bar.md", "Foo"))).toBe("/wiki/concepts/foo%20bar.md");
	});
});

describe("isModalSearchTarget", () => {
	it("treats tasks (including drafts) as modal overlay targets", () => {
		expect(isModalSearchTarget(makeTask("back-1", "T"))).toBe(true);
		expect(isModalSearchTarget(makeTask("DRAFT-1", "T"))).toBe(true);
	});

	it("treats document, decision and wiki results as full-page targets", () => {
		expect(isModalSearchTarget(makeDocument("doc-1", "D"))).toBe(false);
		expect(isModalSearchTarget(makeDecision("decision-1", "D"))).toBe(false);
		expect(isModalSearchTarget(makeWiki("w/a.md", "W"))).toBe(false);
	});
});

describe("getSearchResultMeta", () => {
	it("extracts task status and priority", () => {
		const meta = getSearchResultMeta(makeTask("back-1", "T"));
		expect(meta).toEqual({ id: "back-1", title: "T", status: "in-progress", priority: "high" });
	});

	it("extracts wiki title from frontmatter", () => {
		expect(getSearchResultMeta(makeWiki("wiki/a.md", "Hello")).title).toBe("Hello");
	});

	it("falls back to file name for wiki without frontmatter title", () => {
		const wiki = makeWiki("concepts/search.md", "x");
		wiki.wiki.frontmatter = {};
		expect(getSearchResultMeta(wiki).title).toBe("search");
	});
});

describe("getTitleMatchIndices", () => {
	it("prefers the title-key match", () => {
		const result = makeTask("back-1", "Global search dialog");
		result.matches = [
			{ key: "bodyText", indices: [[0, 3]] },
			{ key: "title", indices: [[0, 5]] },
		];
		expect(getTitleMatchIndices(result, "Global search dialog")).toEqual([[0, 5]]);
	});

	it("falls back to the fileName match and clips to title length", () => {
		const result = makeWiki("wiki/page.md", "Page");
		result.matches = [{ key: "fileName", indices: [[0, 20]] }];
		expect(getTitleMatchIndices(result, "Page")).toEqual([[0, 3]]);
	});

	it("returns empty when there are no usable matches", () => {
		const result = makeTask("back-1", "Title");
		expect(getTitleMatchIndices(result, "Title")).toEqual([]);
		result.matches = [{ key: "bodyText", indices: [[0, 2]] }];
		expect(getTitleMatchIndices(result, "Title")).toEqual([]);
	});
});

describe("getIdMatchIndices", () => {
	it("highlights the matched digits inside a task id", () => {
		const result = makeTask("BACK-411", "Some task");
		result.matches = [
			{ key: "id", indices: [[5, 7]] },
			{ key: "title", indices: [[0, 3]] },
		];
		expect(getIdMatchIndices(result, "BACK-411")).toEqual([[5, 7]]);
	});

	it("clips out-of-range ranges to the id length", () => {
		const result = makeTask("BACK-4", "Some task");
		result.matches = [{ key: "id", indices: [[5, 12]] }];
		expect(getIdMatchIndices(result, "BACK-4")).toEqual([[5, 5]]);
	});

	it("drops invalid ranges", () => {
		const result = makeTask("BACK-4", "Some task");
		result.matches = [
			{
				key: "id",
				indices: [
					[-1, 2],
					[3, 2],
					[10, 12],
				],
			},
		];
		expect(getIdMatchIndices(result, "BACK-4")).toEqual([]);
	});

	it("offsets wiki fileName matches to their position inside the full path", () => {
		const result = makeWiki("concepts/search-sequences.md", "Search Sequences");
		result.matches = [{ key: "fileName", indices: [[0, 5]], value: "search-sequences.md" }];
		expect(getIdMatchIndices(result, "concepts/search-sequences.md")).toEqual([[9, 14]]);
	});

	it("ignores fileName matches that are not a suffix of the id", () => {
		const result = makeWiki("concepts/other.md", "Other");
		result.matches = [{ key: "fileName", indices: [[0, 3]], value: "unrelated.md" }];
		expect(getIdMatchIndices(result, "concepts/other.md")).toEqual([]);
	});

	it("returns empty when there are no matches", () => {
		const result = makeTask("BACK-1", "T");
		expect(getIdMatchIndices(result, "BACK-1")).toEqual([]);
		result.matches = [{ key: "idVariants", indices: [[0, 2]] }];
		expect(getIdMatchIndices(result, "BACK-1")).toEqual([]);
	});
});

describe("mergeHighlightRanges", () => {
	it("merges overlapping and adjacent ranges", () => {
		expect(
			mergeHighlightRanges([
				[5, 7],
				[0, 2],
				[2, 4],
				[10, 12],
			]),
		).toEqual([
			[0, 7],
			[10, 12],
		]);
	});

	it("keeps disjoint ranges sorted", () => {
		expect(
			mergeHighlightRanges([
				[8, 9],
				[0, 1],
			]),
		).toEqual([
			[0, 1],
			[8, 9],
		]);
	});

	it("returns empty for empty input", () => {
		expect(mergeHighlightRanges([])).toEqual([]);
	});
});

describe("buildSearchRows", () => {
	it("groups by type in canonical order with counts, preserving within-group order", () => {
		const results = [
			makeDecision("decision-1", "D1"),
			makeTask("back-2", "T2"),
			makeTask("back-1", "T1"),
			makeWiki("w/a.md", "W1"),
			makeDocument("doc-1", "Doc1"),
		];
		const rows = buildSearchRows(results);
		expect(
			rows.map((row) => (row.kind === "header" ? `header:${row.type}:${row.count}` : `item:${row.result.type}`)),
		).toEqual([
			"header:task:2",
			"item:task",
			"item:task",
			"header:document:1",
			"item:document",
			"header:wiki:1",
			"item:wiki",
			"header:decision:1",
			"item:decision",
		]);
	});

	it("returns empty rows for empty results", () => {
		expect(buildSearchRows([])).toEqual([]);
	});

	it("marks headers expanded by default and collapsed when requested", () => {
		const results = [makeTask("back-1", "T1"), makeDocument("doc-1", "D1")];
		const expanded = buildSearchRows(results);
		expect(
			expanded.filter((row) => row.kind === "header").map((row) => (row.kind === "header" ? row.collapsed : null)),
		).toEqual([false, false]);
		const collapsed = buildSearchRows(results, new Set(["task"]));
		expect(
			collapsed.filter((row) => row.kind === "header").map((row) => (row.kind === "header" ? row.collapsed : null)),
		).toEqual([true, false]);
	});

	it("excludes item rows of collapsed groups so the next group header follows immediately", () => {
		const results = [
			makeTask("back-2", "T2"),
			makeTask("back-1", "T1"),
			makeWiki("w/a.md", "W1"),
			makeDocument("doc-1", "Doc1"),
		];
		const rows = buildSearchRows(results, new Set(["task"]));
		expect(
			rows.map((row) =>
				row.kind === "header" ? `header:${row.type}:${row.count}:${row.collapsed}` : `item:${row.result.type}`,
			),
		).toEqual(["header:task:2:true", "header:document:1:false", "item:document", "header:wiki:1:false", "item:wiki"]);
	});

	it("collapsing every group yields only header rows", () => {
		const results = [makeTask("back-1", "T1"), makeDocument("doc-1", "D1")];
		const rows = buildSearchRows(results, new Set(["task", "document"]));
		expect(rows.every((row) => row.kind === "header")).toBe(true);
		expect(rows).toHaveLength(2);
	});
});

describe("clampRestoreIndex", () => {
	it("accepts a valid index", () => {
		expect(clampRestoreIndex(3, 10)).toBe(3);
	});

	it("falls back to null when out of range or invalid", () => {
		expect(clampRestoreIndex(10, 10)).toBeNull();
		expect(clampRestoreIndex(25, 10)).toBeNull();
		expect(clampRestoreIndex(-1, 10)).toBeNull();
		expect(clampRestoreIndex("4", 10)).toBeNull();
		expect(clampRestoreIndex(undefined, 10)).toBeNull();
		expect(clampRestoreIndex(Number.NaN, 10)).toBeNull();
	});
});
