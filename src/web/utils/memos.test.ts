import { describe, expect, it } from "bun:test";
import type { Memo } from "../../core/memos.ts";
import {
	appendMemoPage,
	collectMemoTags,
	EMPTY_MEMO_FEED,
	extractInlineTags,
	filterMemosByTags,
	type MemoFeedState,
	memoCreatedOnDate,
	memoMatchesFilters,
	prependMemo,
	removeMemo,
	replaceMemo,
} from "./memos";

const makeMemo = (id: string, overrides: Partial<Memo> = {}): Memo => ({
	id,
	createdDate: "2026-10-01 09:00",
	tags: [],
	displayTitle: id,
	rawContent: id,
	path: `/repo/backlog/memos/${id}.md`,
	...overrides,
});

describe("appendMemoPage", () => {
	const pageA = { items: [makeMemo("20261001-2"), makeMemo("20261001-1")], nextCursor: "20261001-1" };
	const pageB = { items: [makeMemo("20260930-2"), makeMemo("20260930-1")], nextCursor: "20260930-1" };

	it("appends behind the rows already loaded", () => {
		const first = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		expect(first.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1"]);
		expect(first.nextCursor).toBe("20261001-1");

		const second = appendMemoPage(first, pageB);
		expect(second.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1", "20260930-2", "20260930-1"]);
		expect(second.nextCursor).toBe("20260930-1");
	});

	it("keeps the identity of already-loaded rows so scroll position survives", () => {
		const first: MemoFeedState = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		const second = appendMemoPage(first, pageB);
		for (const memo of first.memos) {
			expect(second.memos).toContain(memo);
		}
	});

	it("drops rows that overlap across cursors instead of duplicating them", () => {
		const first = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		const overlapping = { items: [makeMemo("20261001-1"), makeMemo("20260930-2")], nextCursor: null };
		const second = appendMemoPage(first, overlapping);
		expect(second.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1", "20260930-2"]);
	});

	it("ends the list when the server reports a null cursor, even for a non-empty page", () => {
		const last = appendMemoPage(EMPTY_MEMO_FEED, { items: [makeMemo("20261001-1")], nextCursor: null });
		expect(last.nextCursor).toBeNull();
	});
});

describe("feed mutations", () => {
	it("puts a captured memo first and ignores one already in the feed", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, { items: [makeMemo("20261001-1")], nextCursor: null });
		const captured = makeMemo("20261001-2");
		expect(prependMemo(feed, captured).memos[0]).toBe(captured);
		expect(prependMemo(feed, feed.memos[0] as Memo)).toBe(feed);
	});

	it("replaces an edited memo in place", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-2"), makeMemo("20261001-1")],
			nextCursor: null,
		});
		const edited = makeMemo("20261001-1", { rawContent: "edited body" });
		const next = replaceMemo(feed, edited);
		expect(next.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1"]);
		expect(next.memos[1]).toBe(edited);
	});

	it("removes a deleted memo without touching the rest", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-2"), makeMemo("20261001-1")],
			nextCursor: "20261001-1",
		});
		const next = removeMemo(feed, "20261001-2");
		expect(next.memos.map((memo) => memo.id)).toEqual(["20261001-1"]);
		expect(next.nextCursor).toBe("20261001-1");
	});
});

describe("tag helpers", () => {
	const memos = [
		makeMemo("a", { tags: ["idea", "Bug"] }),
		makeMemo("b", { tags: ["meeting"] }),
		makeMemo("c", { tags: ["bug"] }),
	];

	it("collects unique tags case-insensitively and sorted", () => {
		expect(collectMemoTags(memos)).toEqual(["Bug", "idea", "meeting"]);
	});

	it("keeps everything when no tag is selected and narrows to any-of otherwise", () => {
		expect(filterMemosByTags(memos, []).map((memo) => memo.id)).toEqual(["a", "b", "c"]);
		expect(filterMemosByTags(memos, ["bug"]).map((memo) => memo.id)).toEqual(["a", "c"]);
		expect(filterMemosByTags(memos, ["meeting"]).map((memo) => memo.id)).toEqual(["b"]);
	});

	it("keeps a memo only when it matches both the day and the tag filter", () => {
		const memo = makeMemo("a", { createdDate: "2026-10-01 09:00", tags: ["idea"] });
		expect(memoCreatedOnDate(memo, "2026-10-01")).toBe(true);
		expect(memoCreatedOnDate(memo, null)).toBe(true);
		expect(memoCreatedOnDate(memo, "2026-10-02")).toBe(false);
		expect(memoMatchesFilters(memo, "2026-10-01", [])).toBe(true);
		expect(memoMatchesFilters(memo, "2026-10-01", ["meeting"])).toBe(false);
		expect(memoMatchesFilters(memo, "2026-10-02", [])).toBe(false);
	});
});

describe("extractInlineTags", () => {
	it("lifts #tokens out of the body, once each", () => {
		expect(extractInlineTags("capture this #idea and #Idea again")).toEqual(["idea"]);
		expect(extractInlineTags("standup notes #meeting #urgent")).toEqual(["meeting", "urgent"]);
	});

	it("ignores markdown headings and code", () => {
		expect(extractInlineTags("# Heading\nbody")).toEqual([]);
		expect(extractInlineTags("npm install # not a tag")).toEqual([]);
	});
});
