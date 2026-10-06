import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Memo } from "../../core/memos.ts";
import { createMemo, listMemos, nextMemoId } from "../../core/memos.ts";
import { localDateTimeToStoredUtc } from "../../utils/date-utc.ts";
import type { ListPage } from "../../utils/list-page.ts";
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
	toggleTaskInMarkdown,
} from "./memos";

/** `createdDate` is stored UTC, so the default fixture is a local 2026-10-01 09:00. */
const makeMemo = (id: string, overrides: Partial<Memo> = {}): Memo => ({
	id,
	createdDate: localDateTimeToStoredUtc("2026-10-01 09:00"),
	tags: [],
	displayTitle: id,
	rawContent: id,
	path: `/repo/backlog/memos/${id}.md`,
	...overrides,
});

describe("appendMemoPage", () => {
	const pageA: ListPage<Memo> = {
		items: [makeMemo("20261001-2"), makeMemo("20261001-1")],
		total: 4,
		offset: 0,
		limit: 2,
		hasMore: true,
	};
	const pageB: ListPage<Memo> = {
		items: [makeMemo("20260930-2"), makeMemo("20260930-1")],
		total: 4,
		offset: 2,
		limit: 2,
		hasMore: false,
	};

	it("appends behind the rows already loaded", () => {
		const first = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		expect(first.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1"]);
		expect(first.hasMore).toBe(true);

		const second = appendMemoPage(first, pageB);
		expect(second.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1", "20260930-2", "20260930-1"]);
		expect(second.hasMore).toBe(false);
	});

	it("keeps the identity of already-loaded rows so scroll position survives", () => {
		const first: MemoFeedState = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		const second = appendMemoPage(first, pageB);
		for (const memo of first.memos) {
			expect(second.memos).toContain(memo);
		}
	});

	it("drops rows an overlapping offset window returns again instead of duplicating them", () => {
		const first = appendMemoPage(EMPTY_MEMO_FEED, pageA);
		const overlapping: ListPage<Memo> = {
			items: [makeMemo("20261001-1"), makeMemo("20260930-2")],
			total: 3,
			offset: 1,
			limit: 2,
			hasMore: false,
		};
		const second = appendMemoPage(first, overlapping);
		expect(second.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1", "20260930-2"]);
	});

	it("ends the list when the server reports hasMore false, even for a non-empty page", () => {
		const last = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-1")],
			total: 1,
			offset: 0,
			limit: 1,
			hasMore: false,
		});
		expect(last.hasMore).toBe(false);
	});
});

describe("feed mutations", () => {
	it("puts a captured memo first and ignores one already in the feed", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-1")],
			total: 1,
			offset: 0,
			limit: 1,
			hasMore: false,
		});
		const captured = makeMemo("20261001-2");
		expect(prependMemo(feed, captured).memos[0]).toBe(captured);
		expect(prependMemo(feed, feed.memos[0] as Memo)).toBe(feed);
	});

	it("replaces an edited memo in place", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-2"), makeMemo("20261001-1")],
			total: 2,
			offset: 0,
			limit: 2,
			hasMore: false,
		});
		const edited = makeMemo("20261001-1", { rawContent: "edited body" });
		const next = replaceMemo(feed, edited);
		expect(next.memos.map((memo) => memo.id)).toEqual(["20261001-2", "20261001-1"]);
		expect(next.memos[1]).toBe(edited);
	});

	it("removes a deleted memo without touching the rest", () => {
		const feed = appendMemoPage(EMPTY_MEMO_FEED, {
			items: [makeMemo("20261001-2"), makeMemo("20261001-1")],
			total: 3,
			offset: 0,
			limit: 2,
			hasMore: true,
		});
		const next = removeMemo(feed, "20261001-2");
		expect(next.memos.map((memo) => memo.id)).toEqual(["20261001-1"]);
		expect(next.hasMore).toBe(true);
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
		const memo = makeMemo("a", { createdDate: localDateTimeToStoredUtc("2026-10-01 09:00"), tags: ["idea"] });
		expect(memoCreatedOnDate(memo, "2026-10-01")).toBe(true);
		expect(memoCreatedOnDate(memo, null)).toBe(true);
		expect(memoCreatedOnDate(memo, "2026-10-02")).toBe(false);
		expect(memoMatchesFilters(memo, "2026-10-01", [])).toBe(true);
		expect(memoMatchesFilters(memo, "2026-10-01", ["meeting"])).toBe(false);
		expect(memoMatchesFilters(memo, "2026-10-02", [])).toBe(false);
	});

	it("reads the day off the memo's local time, not off the stored UTC date", () => {
		// 23:00 on the 1st is stored under the 2nd UTC on any machine west of Greenwich.
		const memo = makeMemo("a", { createdDate: localDateTimeToStoredUtc("2026-10-01 23:00") });
		expect(memoCreatedOnDate(memo, "2026-10-01")).toBe(true);

		// In UTC the stored date is the same day, so there is nothing to tell apart there. The
		// pinned-zone cases in test/memo-local-day-timezone.test.ts force the two apart.
		const storedDay = memo.createdDate.slice(0, 10);
		if (storedDay !== "2026-10-01") {
			expect(memoCreatedOnDate(memo, storedDay)).toBe(false);
		}
	});
});

describe("extractInlineTags", () => {
	it("lifts #topics# out of the body, once each", () => {
		expect(extractInlineTags("capture this #idea# and #Idea# again")).toEqual(["idea"]);
		expect(extractInlineTags("standup notes #meeting# #urgent#")).toEqual(["meeting", "urgent"]);
	});

	it("needs the closing hash, so a lone #tag is plain text", () => {
		expect(extractInlineTags("capture this #idea and #Idea again")).toEqual([]);
		expect(extractInlineTags("standup notes #meeting #urgent")).toEqual([]);
	});

	it("ignores markdown headings and code", () => {
		expect(extractInlineTags("# Heading\nbody")).toEqual([]);
		expect(extractInlineTags("npm install # not a tag")).toEqual([]);
	});

	it("leaves ordinary references alone - the reason the topic has to close", () => {
		expect(extractInlineTags("待办：审查 PR #268，关于依赖图的环检测逻辑")).toEqual([]);
		expect(extractInlineTags("fixed by issue #123 today")).toEqual([]);
	});

	it("lets a topic sit inside a sentence, Weibo style", () => {
		expect(extractInlineTags("今天#天气#真好")).toEqual(["天气"]);
		expect(extractInlineTags("ship(#release#)")).toEqual(["release"]);
	});
});

describe("back-dated creation", () => {
	const root = mkdtempSync(join(tmpdir(), "memo-backdate-"));
	/** The stored value a back-dated capture carries. An id is named for this value's UTC date. */
	const pinnedStored = "2024-02-03 10:00";

	it("allocates the id prefix from the pinned date, not today", async () => {
		const id = await nextMemoId(root, pinnedStored);
		expect(id).toBe("20240203-1");
	});

	it("writes the pinned createdDate and bumps updatedDate", async () => {
		const memo = await createMemo(root, "a past note", ["retro"], pinnedStored);
		expect(memo.id).toBe("20240203-1");
		expect(memo.createdDate).toBe(pinnedStored);
		expect(memo.tags).toEqual(["retro"]);
		expect(memo.updatedDate).not.toBe(pinnedStored);
	});

	it("falls back to now when the date is malformed", async () => {
		const memo = await createMemo(root, "no real date", [], "not-a-date");
		expect(memo.createdDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	it("a back-dated memo sorts under its own day, not today", async () => {
		const all = await listMemos(root);
		expect(all.length).toBeGreaterThan(0);
		expect(all[0]?.createdDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
		expect(all.some((memo) => memo.createdDate === pinnedStored)).toBe(true);
	});
});

describe("toggleTaskInMarkdown", () => {
	it("ticks the marker the rendered checkbox stands for", () => {
		const source = "- [ ] alpha\n- [ ] beta\n- [ ] gamma";
		expect(toggleTaskInMarkdown(source, 1)).toBe("- [ ] alpha\n- [x] beta\n- [ ] gamma");
	});

	it("unticks a checked marker, and accepts an uppercase X", () => {
		expect(toggleTaskInMarkdown("- [x] done\n- [X] also done", 0)).toBe("- [ ] done\n- [X] also done");
		expect(toggleTaskInMarkdown("- [x] done\n- [X] also done", 1)).toBe("- [x] done\n- [ ] also done");
	});

	it("keeps the indentation, spacing and trailing text of the line", () => {
		// The shape a pasted acceptance list arrives in: one leading space, two after the marker.
		expect(toggleTaskInMarkdown(" - [ ]  A valid prototype exists.", 0)).toBe(" - [x]  A valid prototype exists.");
	});

	it("does not count a marker inside a fenced code block", () => {
		const source = "```\n- [ ] in code\n```\n- [ ] real";
		expect(toggleTaskInMarkdown(source, 0)).toBe("```\n- [ ] in code\n```\n- [x] real");
	});

	it("counts ordered lists, nested items and blockquotes like the renderer does", () => {
		const source = "1. [ ] first\n   - [ ] nested\n> - [ ] quoted";
		expect(toggleTaskInMarkdown(source, 2)).toBe("1. [ ] first\n   - [ ] nested\n> - [x] quoted");
	});

	it("leaves the source untouched for an out-of-range index", () => {
		const source = "- [ ] only";
		expect(toggleTaskInMarkdown(source, 5)).toBe(source);
		expect(toggleTaskInMarkdown(source, -1)).toBe(source);
	});

	it("ignores a bare [ ] that is not a list item", () => {
		const source = "A [ ] bracket pair\n- [ ] real item";
		expect(toggleTaskInMarkdown(source, 0)).toBe("A [ ] bracket pair\n- [x] real item");
	});
});
