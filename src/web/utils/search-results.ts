import type {
	DecisionSearchResult,
	DocumentSearchResult,
	SearchResult,
	SearchResultType,
	TaskSearchResult,
	WikiSearchResult,
} from "../../types";
import { stripAnyPrefix } from "../../utils/prefix-config";
import { encodeWikiPath, sanitizeUrlTitle } from "./urlHelpers";

export type SearchFilterType = "all" | SearchResultType;

export interface SearchDialogLocationState {
	backgroundLocation?: unknown;
	q?: string;
	type?: string;
	completed?: boolean;
	visibleStartIndex?: number;
}

export type SearchRow =
	| { kind: "header"; type: SearchResultType; count: number; collapsed: boolean }
	| { kind: "item"; type: SearchResultType; result: SearchResult };

export interface SearchResultMeta {
	id: string;
	title: string;
	status?: string;
	priority?: "high" | "medium" | "low";
	/** True when the task result came from the completed corpus (source "completed"). */
	completed?: boolean;
	tags?: string[];
}

const TYPE_ORDER: SearchResultType[] = ["task", "document", "wiki", "decision"];

export function parseSearchTypeParam(raw: string | null | undefined): SearchFilterType {
	switch (raw) {
		case "task":
			return "task";
		case "document":
		case "doc":
			return "document";
		case "decision":
			return "decision";
		case "wiki":
			return "wiki";
		default:
			return "all";
	}
}

export function serializeSearchTypeParam(type: SearchFilterType): string {
	return type === "document" ? "doc" : type;
}

export function getSearchResultLink(result: SearchResult): string {
	if (result.type === "document") {
		const doc = (result as DocumentSearchResult).document;
		return `/documentation/${stripAnyPrefix(doc.id)}/${sanitizeUrlTitle(doc.title)}`;
	}
	if (result.type === "decision") {
		const dec = (result as DecisionSearchResult).decision;
		return `/decisions/${stripAnyPrefix(dec.id)}/${sanitizeUrlTitle(dec.title)}`;
	}
	if (result.type === "wiki") {
		return `/wiki/${encodeWikiPath((result as WikiSearchResult).wiki.path)}`;
	}
	const task = (result as TaskSearchResult).task;
	const base = task.id.startsWith("DRAFT-") ? "draft" : "task";
	return `/${base}/${stripAnyPrefix(task.id)}/${sanitizeUrlTitle(task.title)}`;
}

/**
 * Task results (including drafts) open in an overlay modal route, so their
 * navigation must carry the current location as `backgroundLocation` for App
 * to render the modal over it. Document/decision/wiki targets are full-page
 * routes and must navigate plainly — attaching a backgroundLocation would pin
 * `Routes` to the background location and the page would never render.
 */
export function isModalSearchTarget(result: SearchResult): boolean {
	return result.type === "task";
}

export function getSearchResultMeta(result: SearchResult): SearchResultMeta {
	if (result.type === "document") {
		const doc = (result as DocumentSearchResult).document;
		return { id: doc.id, title: doc.title, tags: doc.tags };
	}
	if (result.type === "decision") {
		const dec = (result as DecisionSearchResult).decision;
		return { id: dec.id, title: dec.title, status: dec.status };
	}
	if (result.type === "wiki") {
		const wiki = (result as WikiSearchResult).wiki;
		const title =
			typeof wiki.frontmatter.title === "string"
				? wiki.frontmatter.title
				: (wiki.path.replace(/\.md$/i, "").split("/").pop() ?? wiki.path);
		return { id: wiki.path, title };
	}
	const task = (result as TaskSearchResult).task;
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		completed: task.source === "completed",
	};
}

/**
 * Returns the server-provided match ranges (Fuse [start, end] inclusive) for the
 * result title, clipped to the displayed title length. Empty when nothing matched.
 */
export function getTitleMatchIndices(result: SearchResult, title: string): Array<[number, number]> {
	const matches = result.matches;
	if (!matches || title.length === 0) return [];
	const titleMatch = matches.find((m) => m.key === "title") ?? matches.find((m) => m.key === "fileName");
	if (!titleMatch) return [];
	return titleMatch.indices
		.filter(([start, end]) => start >= 0 && end >= start && start < title.length)
		.map(([start, end]) => [start, Math.min(end, title.length - 1)] as [number, number]);
}

/**
 * Merges overlapping/adjacent inclusive ranges and returns sorted, non-overlapping ranges.
 */
export function mergeHighlightRanges(indices: Array<[number, number]>): Array<[number, number]> {
	const sorted = [...indices].sort((a, b) => a[0] - b[0]);
	const merged: Array<[number, number]> = [];
	for (const [start, end] of sorted) {
		const last = merged[merged.length - 1];
		if (last && start <= last[1] + 1) {
			last[1] = Math.max(last[1], end);
		} else {
			merged.push([start, end]);
		}
	}
	return merged;
}

/**
 * Returns the server-provided match ranges (Fuse [start, end] inclusive) for the
 * resource ID, clipped to the displayed id length. Task/doc/decision ids match on
 * the "id" key directly; wiki ids are full paths, so "fileName" matches (which
 * refer to the file name only) are offset to their position inside the path.
 * Empty when nothing matched.
 */
export function getIdMatchIndices(result: SearchResult, id: string): Array<[number, number]> {
	const matches = result.matches;
	if (!matches || id.length === 0) return [];
	const ranges: Array<[number, number]> = [];
	for (const match of matches) {
		if (match.key === "id") {
			for (const [start, end] of match.indices) {
				if (start >= 0 && end >= start && start < id.length) {
					ranges.push([start, Math.min(end, id.length - 1)]);
				}
			}
		} else if (
			match.key === "fileName" &&
			typeof match.value === "string" &&
			match.value !== "" &&
			id.endsWith(match.value)
		) {
			const offset = id.length - match.value.length;
			for (const [start, end] of match.indices) {
				const shiftedStart = start + offset;
				const shiftedEnd = end + offset;
				if (shiftedStart >= 0 && shiftedEnd >= shiftedStart && shiftedStart < id.length) {
					ranges.push([shiftedStart, Math.min(shiftedEnd, id.length - 1)]);
				}
			}
		}
	}
	return ranges;
}

/**
 * Flattens results into grouped virtual-list rows: one header row per type
 * (in canonical order task/document/wiki/decision) followed by its items,
 * preserving the server relevance order within each group. Types present in
 * `collapsedTypes` emit only their header row, so collapsing a group hides
 * its items from the flat virtual row list.
 */
export function buildSearchRows(results: SearchResult[], collapsedTypes?: ReadonlySet<SearchResultType>): SearchRow[] {
	const byType = new Map<SearchResultType, SearchResult[]>();
	for (const type of TYPE_ORDER) {
		byType.set(type, []);
	}
	for (const result of results) {
		byType.get(result.type)?.push(result);
	}
	const rows: SearchRow[] = [];
	for (const type of TYPE_ORDER) {
		const items = byType.get(type) ?? [];
		if (items.length === 0) continue;
		const collapsed = collapsedTypes?.has(type) ?? false;
		rows.push({ kind: "header", type, count: items.length, collapsed });
		if (collapsed) continue;
		for (const result of items) {
			rows.push({ kind: "item", type, result });
		}
	}
	return rows;
}

/**
 * Returns the row index to restore on re-entry, or null when the saved index
 * is missing/out of range (caller falls back to the top of the list).
 */
export function clampRestoreIndex(saved: unknown, rowCount: number): number | null {
	if (typeof saved !== "number" || !Number.isFinite(saved) || saved < 0) return null;
	const index = Math.floor(saved);
	return index < rowCount ? index : null;
}
