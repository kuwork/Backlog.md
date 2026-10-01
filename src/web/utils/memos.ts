import type { Memo } from "../../core/memos.ts";

/**
 * Pure helpers shared by the memos feed (`/memos`). They are kept out of the component so the
 * pagination append — the one piece of state arithmetic that can silently drop or duplicate rows —
 * is testable on its own.
 */

/** Rows requested per page. Mirrors MEMO_PAGE_SIZE in core/memos.ts. */
export const MEMO_FEED_PAGE_SIZE = 30;

export interface MemoFeedState {
	/** Every page loaded so far, newest first. */
	memos: Memo[];
	/** Where the next page starts, or null once the last page is loaded. */
	nextCursor: string | null;
}

export const EMPTY_MEMO_FEED: MemoFeedState = { memos: [], nextCursor: null };

export function tagsToLower(tags: string[]): string[] {
	return tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
}

/**
 * Append one page behind the rows already loaded: existing rows keep their identity and position
 * (so the browser keeps the scroll offset) and a row that overlaps across cursors is dropped
 * instead of rendered twice. `nextCursor` always comes from the newest page: a server that reports
 * `null` ends the list even when the page itself was not empty.
 */
export function appendMemoPage(
	state: MemoFeedState,
	page: { items: Memo[]; nextCursor: string | null },
): MemoFeedState {
	const nextCursor = page.nextCursor ?? null;
	const seen = new Set(state.memos.map((memo) => memo.id));
	const appended = page.items.filter((memo) => !seen.has(memo.id));
	if (appended.length === 0) {
		return state.nextCursor === nextCursor ? state : { memos: state.memos, nextCursor };
	}
	return { memos: [...state.memos, ...appended], nextCursor };
}

/** Put a just-captured memo at the top of the feed, ignoring ids the feed already carries. */
export function prependMemo(state: MemoFeedState, memo: Memo): MemoFeedState {
	if (state.memos.some((existing) => existing.id === memo.id)) return state;
	return { memos: [memo, ...state.memos], nextCursor: state.nextCursor };
}

/** Replace an edited memo in place, keeping its position in the feed. */
export function replaceMemo(state: MemoFeedState, memo: Memo): MemoFeedState {
	return {
		memos: state.memos.map((existing) => (existing.id === memo.id ? memo : existing)),
		nextCursor: state.nextCursor,
	};
}

/** Remove a deleted memo without touching the rest of the loaded pages. */
export function removeMemo(state: MemoFeedState, id: string): MemoFeedState {
	return {
		memos: state.memos.filter((memo) => memo.id !== id),
		nextCursor: state.nextCursor,
	};
}

/** Unique tags across the loaded memos, first-seen casing preserved, sorted case-insensitively. */
export function collectMemoTags(memos: Memo[]): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const memo of memos) {
		for (const tag of memo.tags ?? []) {
			const normalized = tag.trim().toLowerCase();
			if (normalized.length === 0 || seen.has(normalized)) continue;
			seen.add(normalized);
			ordered.push(tag.trim());
		}
	}
	return ordered.sort((left, right) => {
		const result = left.toLowerCase().localeCompare(right.toLowerCase());
		return result !== 0 ? result : left.localeCompare(right);
	});
}

/** Empty selection keeps everything; otherwise a memo matching any selected tag survives. */
export function filterMemosByTags(memos: Memo[], selectedTags: string[]): Memo[] {
	const selected = new Set(tagsToLower(selectedTags));
	if (selected.size === 0) return memos;
	return memos.filter((memo) => tagsToLower(memo.tags ?? []).some((tag) => selected.has(tag)));
}

export function memoCreatedOnDate(memo: Memo, date: string | null | undefined): boolean {
	if (!date) return true;
	return memo.createdDate.slice(0, 10) === date;
}

/** Whether a freshly captured memo belongs in the feed as currently filtered. */
export function memoMatchesFilters(memo: Memo, date: string | null, selectedTags: string[]): boolean {
	return memoCreatedOnDate(memo, date) && filterMemosByTags([memo], selectedTags).length > 0;
}

/**
 * A GFM task-list marker: an optional blockquote prefix, a bullet or ordered list marker, then
 * `[ ]`, `[x]` or `[X]`. Only list items produce a checkbox, so a bare `[ ]` in a paragraph is not
 * one — the same rule the renderer follows.
 */
const TASK_MARKER_PATTERN = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;
const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

/**
 * Flip the nth task-list checkbox, counting in the same document order the rendered checkboxes
 * appear. Fenced code blocks are skipped: their `- [ ]` is shown as code and never becomes a
 * checkbox, so counting it would shift every later index. An out-of-range index returns the source
 * untouched, which makes a stale click after an edit a no-op instead of a corruption.
 */
export function toggleTaskInMarkdown(source: string, index: number): string {
	if (index < 0) return source;
	const lines = source.split("\n");
	let seen = 0;
	let fenceChar: string | null = null;

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] ?? "";
		const fenceMarker = FENCE_PATTERN.exec(line)?.[1]?.[0];
		if (fenceMarker) {
			if (fenceChar === null) fenceChar = fenceMarker;
			else if (fenceMarker === fenceChar) fenceChar = null;
			continue;
		}
		if (fenceChar !== null) continue;

		const marker = TASK_MARKER_PATTERN.exec(line);
		if (!marker) continue;
		if (seen !== index) {
			seen += 1;
			continue;
		}
		const [matched, before = "", state = " ", bracket = "]"] = marker;
		const flipped = state === " " ? "x" : " ";
		lines[i] = `${before}${flipped}${bracket}${line.slice(matched?.length ?? 0)}`;
		return lines.join("\n");
	}
	return source;
}

/**
 * `#tag` tokens typed in the composer body. The body is stored verbatim — tags are the same words
 * lifted into the searchable `tags` field — and a `# heading` (space after the hash) is not a tag.
 */
export function extractInlineTags(content: string): string[] {
	const tags: string[] = [];
	const seen = new Set<string>();
	const pattern = /(^|[\s(])#([^\s#`]+)/g;
	for (const match of content.matchAll(pattern)) {
		const tag = match[2]?.trim();
		if (!tag) continue;
		const normalized = tag.toLowerCase();
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		tags.push(tag);
	}
	return tags;
}
