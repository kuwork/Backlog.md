import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { normalizeStatusSet, statusMatchesSet } from "../utils/status-filter.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

describe("normalizeStatusSet", () => {
	it("lowercases and trims each status", () => {
		expect([...normalizeStatusSet(["To Do", "  DONE "])]).toEqual(["to do", "done"]);
	});

	it("accepts a single status string", () => {
		expect([...normalizeStatusSet("In Progress")]).toEqual(["in progress"]);
	});

	it("drops blank entries and deduplicates case-insensitively", () => {
		const set = normalizeStatusSet(["To Do", "", "   ", "TO DO"]);
		expect(set.size).toBe(1);
		expect(set.has("to do")).toBe(true);
	});

	it("returns an empty set for missing values", () => {
		expect(normalizeStatusSet(undefined).size).toBe(0);
	});
});

describe("statusMatchesSet", () => {
	it("matches task statuses case-insensitively", () => {
		const wanted = normalizeStatusSet(["to do", "done"]);
		expect(statusMatchesSet(wanted, "To Do")).toBe(true);
		expect(statusMatchesSet(wanted, "DONE")).toBe(true);
		expect(statusMatchesSet(wanted, "In Progress")).toBe(false);
	});

	it("treats missing task statuses as no match", () => {
		const wanted = normalizeStatusSet(["done"]);
		expect(statusMatchesSet(wanted, undefined)).toBe(false);
		expect(statusMatchesSet(wanted, null)).toBe(false);
	});

	it("matches nothing when the selection is empty", () => {
		const wanted = normalizeStatusSet([]);
		expect(statusMatchesSet(wanted, "Done")).toBe(false);
	});
});

const tasks: Task[] = [
	{
		id: "task-1",
		title: "Todo work",
		status: "To Do",
		assignee: [],
		labels: [],
		createdDate: "2025-01-01",
		dependencies: [],
	},
	{
		id: "task-2",
		title: "Active work",
		status: "In Progress",
		assignee: [],
		labels: [],
		createdDate: "2025-01-01",
		dependencies: [],
	},
	{
		id: "task-3",
		title: "Finished work",
		status: "Done",
		assignee: [],
		labels: [],
		createdDate: "2025-01-01",
		dependencies: [],
	},
];

const ids = (filtered: Task[]): string[] => filtered.map((task) => task.id);

describe("applyTaskFilters status filtering", () => {
	it("matches any of several statuses", () => {
		expect(ids(applyTaskFilters(tasks, { status: ["To Do", "In Progress"] }))).toEqual(["task-1", "task-2"]);
	});

	it("accepts a single status as before", () => {
		expect(ids(applyTaskFilters(tasks, { status: "Done" }))).toEqual(["task-3"]);
	});

	it("is case-insensitive across several statuses", () => {
		expect(ids(applyTaskFilters(tasks, { status: ["to do", "DONE"] }))).toEqual(["task-1", "task-3"]);
	});

	it("trims the selected statuses like the list paths do", () => {
		expect(ids(applyTaskFilters(tasks, { status: "  To Do  " }))).toEqual(["task-1"]);
		expect(ids(applyTaskFilters(tasks, { status: [" To Do ", "Done "] }))).toEqual(["task-1", "task-3"]);
	});

	it("leaves the list untouched when the selection has no usable status", () => {
		// An empty selection means "no status filter", not "match nothing" - the list paths skip the
		// filter in this case, so the search path has to as well.
		expect(ids(applyTaskFilters(tasks, { status: [""] }))).toEqual(["task-1", "task-2", "task-3"]);
		expect(ids(applyTaskFilters(tasks, { status: ["", "   "] }))).toEqual(["task-1", "task-2", "task-3"]);
		expect(ids(applyTaskFilters(tasks, { status: [] }))).toEqual(["task-1", "task-2", "task-3"]);
	});

	it("filters out every task for a status that is not in the corpus", () => {
		expect(ids(applyTaskFilters(tasks, { status: "Blocked" }))).toEqual([]);
	});

	it("combines a multi-status selection with an exclude list", () => {
		expect(
			ids(applyTaskFilters(tasks, { status: ["To Do", "In Progress", "Done"], statusExcluded: ["Done"] })),
		).toEqual(["task-1", "task-2"]);
	});

	it("applies the same normalization to the exclude list", () => {
		expect(ids(applyTaskFilters(tasks, { statusExcluded: ["  done  "] }))).toEqual(["task-1", "task-2"]);
		expect(ids(applyTaskFilters(tasks, { statusExcluded: [""] }))).toEqual(["task-1", "task-2", "task-3"]);
	});
});
