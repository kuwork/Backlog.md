import { describe, expect, it } from "bun:test";
import { selectListPage } from "./list-page.ts";

describe("selectListPage", () => {
	const items = Array.from({ length: 10 }, (_, i) => i + 1);

	it("returns the whole list with limit 0 default", () => {
		const page = selectListPage(items);
		expect(page).toEqual({ items, total: 10, offset: 0, limit: 0, hasMore: false });
	});

	it("slices with limit and reports hasMore when more remain", () => {
		const page = selectListPage(items, { limit: 3 });
		expect(page.items).toEqual([1, 2, 3]);
		expect(page.total).toBe(10);
		expect(page.offset).toBe(0);
		expect(page.limit).toBe(3);
		expect(page.hasMore).toBe(true);
	});

	it("applies offset before limit", () => {
		const page = selectListPage(items, { offset: 2, limit: 3 });
		expect(page.items).toEqual([3, 4, 5]);
		expect(page.offset).toBe(2);
		expect(page.limit).toBe(3);
		expect(page.hasMore).toBe(true);
	});

	it("reports hasMore false at the end of the list", () => {
		const page = selectListPage(items, { offset: 8, limit: 3 });
		expect(page.items).toEqual([9, 10]);
		expect(page.hasMore).toBe(false);
	});

	it("clamps a negative offset to zero", () => {
		const page = selectListPage(items, { offset: -5, limit: 2 });
		expect(page.offset).toBe(0);
		expect(page.items).toEqual([1, 2]);
	});

	it("returns an empty window for an offset beyond the list", () => {
		const page = selectListPage(items, { offset: 100, limit: 5 });
		expect(page.items).toEqual([]);
		expect(page.hasMore).toBe(false);
		expect(page.offset).toBe(100);
	});

	it("treats limit 0 as no limit (full list, no hasMore)", () => {
		const page = selectListPage(items, { limit: 0 });
		expect(page.items).toEqual(items);
		expect(page.hasMore).toBe(false);
		expect(page.limit).toBe(0);
	});

	it("treats a limit larger than the list as the whole list", () => {
		const page = selectListPage(items, { limit: 50 });
		expect(page.items).toEqual(items);
		expect(page.hasMore).toBe(false);
		expect(page.limit).toBe(50);
	});

	it("returns an empty page for an empty list", () => {
		const page = selectListPage([], { limit: 5 });
		expect(page).toEqual({ items: [], total: 0, offset: 0, limit: 5, hasMore: false });
	});
});
