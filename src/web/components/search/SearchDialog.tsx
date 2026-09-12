import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SearchResult, SearchResultType } from "../../../types";
import { apiClient } from "../../lib/api";
import { useI18n } from "../../hooks/useI18n";
import { Icons } from "../SideNavigation";
import {
	buildSearchRows,
	getIdMatchIndices,
	getSearchResultLink,
	getSearchResultMeta,
	getTitleMatchIndices,
	isModalSearchTarget,
	mergeHighlightRanges,
	parseSearchTypeParam,
	serializeSearchTypeParam,
	type SearchDialogLocationState,
	type SearchFilterType,
	type SearchRow,
} from "../../utils/search-results";
import { getPriorityBadgeColor, getStatusBadgeColor } from "../../utils/task-badge-colors";
import VirtualList, { type VirtualListHandle } from "./VirtualList";

const DESKTOP_ITEM_HEIGHT = 56;
const DESKTOP_HEADER_HEIGHT = 28;
const NARROW_ITEM_HEIGHT = 64;
const NARROW_HEADER_HEIGHT = 32;
const SCROLL_PERSIST_DEBOUNCE_MS = 300;
const SEARCH_DEBOUNCE_MS = 300;
const NARROW_MEDIA_QUERY = "(max-width: 639px)";

function buildSearchUrl(nextQ: string, nextType: SearchFilterType): string {
	const params = new URLSearchParams();
	if (nextQ !== "") params.set("q", nextQ);
	const serialized = serializeSearchTypeParam(nextType);
	if (nextType !== "all") params.set("type", serialized);
	const query = params.toString();
	return `/search${query === "" ? "" : `?${query}`}`;
}

const TYPE_ICON_COLORS: Record<SearchResultType, string> = {
	task: "text-purple-400",
	document: "text-green-400",
	decision: "text-stone-400",
	wiki: "text-blue-400",
};

const SearchTypeIcon: React.FC<{ type: SearchResultType | "all"; className?: string }> = ({ type, className = "w-4 h-4" }) => {
	// The sidebar SVGs carry their own hardcoded sizes (w-4/w-5); normalize them
	// to the requested box and center them so they sit mid-line in tabs and rows.
	const iconClass = `shrink-0 inline-flex items-center justify-center ${className} [&>svg]:w-full [&>svg]:h-full`;
	// Reuse the established sidebar search icons (same SVG components as SideNavigation)
	if (type === "document") return <span className={iconClass}><Icons.Document /></span>;
	if (type === "decision") return <span className={iconClass}><Icons.Decision /></span>;
	if (type === "wiki") return <span className={iconClass}><Icons.WikiPage /></span>;
	if (type === "task") return <span className={iconClass}><Icons.Tasks /></span>;
	return <span className={iconClass}><Icons.Search /></span>;
};

const HighlightedText: React.FC<{ text: string; indices: Array<[number, number]> }> = ({ text, indices }) => {
	const ranges = useMemo(() => mergeHighlightRanges(indices), [indices]);
	if (ranges.length === 0) return <>{text}</>;
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	for (const [i, [start, end]] of ranges.entries()) {
		if (start > cursor) parts.push(text.slice(cursor, start));
		parts.push(
			<mark key={i} className="bg-amber-400/25 text-amber-100 rounded-[2px]">
				{text.slice(start, end + 1)}
			</mark>,
		);
		cursor = end + 1;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
};

const SearchDialog: React.FC = () => {
	const { t } = useI18n();
	const location = useLocation();
	const navigate = useNavigate();
	const searchParams = new URLSearchParams(location.search);
	const q = searchParams.get("q") ?? "";
	const type = parseSearchTypeParam(searchParams.get("type"));
	const locationState = (location.state ?? null) as SearchDialogLocationState | null;

	const dialogRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<VirtualListHandle>(null);
	const visibleStartRef = useRef(0);
	const scrollPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const sequenceRef = useRef(0);

	const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_MEDIA_QUERY).matches);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [searchError, setSearchError] = useState(false);
	const [selectedRow, setSelectedRow] = useState(0);
	const [collapsedTypes, setCollapsedTypes] = useState<Set<SearchResultType>>(new Set());
	// Local input draft: keystrokes update this synchronously so the cursor
	// stays put; the URL only syncs after a debounce (navigating per keystroke
	// re-renders the controlled input and yanks the caret to the end).
	const [draft, setDraft] = useState(q);
	const draftRef = useRef(draft);
	draftRef.current = draft;
	const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [restoreIndex, setRestoreIndex] = useState<number | null>(() => {
		const saved = locationState?.visibleStartIndex;
		return typeof saved === "number" && Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : null;
	});

	// External URL changes (back/forward, shared link) take over the draft.
	useEffect(() => {
		setDraft(q);
		if (urlSyncTimerRef.current) {
			clearTimeout(urlSyncTimerRef.current);
			urlSyncTimerRef.current = null;
		}
	}, [q]);

	// Never navigate after the dialog is gone: a late URL sync would otherwise
	// replace whatever entry is current once the dialog has closed.
	useEffect(
		() => () => {
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		const mql = window.matchMedia(NARROW_MEDIA_QUERY);
		const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	const buildState = useCallback(
		(overrides: Partial<SearchDialogLocationState> = {}): SearchDialogLocationState => ({
			backgroundLocation: locationState?.backgroundLocation,
			q: draft,
			type: serializeSearchTypeParam(type),
			visibleStartIndex: visibleStartRef.current,
			...overrides,
		}),
		[locationState, draft, type],
	);

	// Refs so debounced callbacks always see the latest URL/state builders
	const stateBuilderRef = useRef(buildState);
	stateBuilderRef.current = buildState;
	const searchUrlRef = useRef(location.pathname + location.search);
	searchUrlRef.current = location.pathname + location.search;

	// Debounced search with a sequence counter so stale responses never overwrite newer ones
	useEffect(() => {
		const query = draft.trim();
		if (query === "") {
			sequenceRef.current++;
			setResults([]);
			setIsLoading(false);
			setSearchError(false);
			return;
		}
		let cancelled = false;
		const sequence = ++sequenceRef.current;
		setIsLoading(true);
		const timeout = setTimeout(async () => {
			try {
				const types = type === "all" ? undefined : [type];
				const nextResults = await apiClient.search({ query, types });
				if (!cancelled && sequenceRef.current === sequence) {
					setResults(nextResults);
					setSearchError(false);
				}
			} catch (error) {
				console.error("Global search failed:", error);
				if (!cancelled && sequenceRef.current === sequence) {
					setResults([]);
					setSearchError(true);
				}
			} finally {
				if (!cancelled && sequenceRef.current === sequence) {
					setIsLoading(false);
				}
			}
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [draft, type]);

	const rows = useMemo(() => buildSearchRows(results, collapsedTypes), [results, collapsedTypes]);
	const rowsRef = useRef(rows);
	rowsRef.current = rows;
	const items = useMemo(
		() => rows.flatMap((row, rowIndex) => (row.kind === "item" ? [{ rowIndex, result: row.result }] : [])),
		[rows],
	);
	// ordinal per row: index among item rows, for opening items
	const itemOrdinals = useMemo(() => {
		const ordinals = new Array<number | null>(rows.length).fill(null);
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item) ordinals[item.rowIndex] = i;
		}
		return ordinals;
	}, [rows.length, items]);
	const itemOrdinalsRef = useRef(itemOrdinals);
	itemOrdinalsRef.current = itemOrdinals;
	const itemsRef = useRef(items);
	itemsRef.current = items;

	const toggleGroup = useCallback((groupType: SearchResultType) => {
		setCollapsedTypes((prev) => {
			const next = new Set(prev);
			if (next.has(groupType)) {
				next.delete(groupType);
			} else {
				next.add(groupType);
			}
			return next;
		});
	}, []);

	// New result set: select the first item row
	useEffect(() => {
		const index = rows.findIndex((row) => row.kind === "item");
		setSelectedRow(index === -1 ? 0 : index);
	}, [results]);

	// Keep the selection valid when rows shrink (e.g. a group collapses)
	useEffect(() => {
		setSelectedRow((prev) => (prev < rows.length ? prev : Math.max(0, rows.length - 1)));
	}, [rows]);

	const resetKey = `${draft}|${type}`;
	const prevResetKeyRef = useRef(resetKey);
	useEffect(() => {
		if (prevResetKeyRef.current !== resetKey) {
			prevResetKeyRef.current = resetKey;
			setRestoreIndex(null);
			setCollapsedTypes(new Set());
		}
	}, [resetKey]);

	// Immediate URL sync (filter tab clicks, debounced-flush boundaries)
	const syncUrlTo = useCallback(
		(nextQ: string, nextType: SearchFilterType) => {
			if (urlSyncTimerRef.current) {
				clearTimeout(urlSyncTimerRef.current);
				urlSyncTimerRef.current = null;
			}
			navigate(buildSearchUrl(nextQ, nextType), {
				replace: true,
				state: stateBuilderRef.current({
					q: nextQ,
					type: serializeSearchTypeParam(nextType),
					visibleStartIndex: 0,
				}),
			});
			visibleStartRef.current = 0;
			searchUrlRef.current = buildSearchUrl(nextQ, nextType);
		},
		[navigate],
	);

	// Typing: debounce the URL sync so per-keystroke navigation never re-renders
	// the controlled input mid-edit (which used to reset the caret to the end).
	const queueUrlSync = useCallback(
		(nextQ: string, nextType: SearchFilterType) => {
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
			urlSyncTimerRef.current = setTimeout(() => syncUrlTo(nextQ, nextType), SEARCH_DEBOUNCE_MS);
		},
		[syncUrlTo],
	);

	const close = useCallback(() => navigate(-1), [navigate]);

	// Scroll-lock the underlying page while the dialog is open
	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, []);

	// Auto-focus the input on open; restore previous focus on close
	useEffect(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		inputRef.current?.focus();
		return () => {
			previous?.focus();
		};
	}, []);

	// Escape closes via history back (same as x button and mask click)
	useEffect(() => {
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				close();
			}
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [close]);

	// Minimal focus trap: keep Tab cycling inside the dialog
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const onTab = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const focusables = Array.from(dialog.querySelectorAll<HTMLElement>("input, button"));
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (!first || !last) return;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		dialog.addEventListener("keydown", onTab);
		return () => dialog.removeEventListener("keydown", onTab);
	}, []);

	useEffect(
		() => () => {
			if (scrollPersistTimerRef.current) {
				clearTimeout(scrollPersistTimerRef.current);
			}
		},
		[],
	);

	const handleVisibleStartChange = useCallback(
		(index: number) => {
			visibleStartRef.current = index;
			if (scrollPersistTimerRef.current) {
				clearTimeout(scrollPersistTimerRef.current);
			}
			scrollPersistTimerRef.current = setTimeout(() => {
				navigate(searchUrlRef.current, { replace: true, state: stateBuilderRef.current() });
			}, SCROLL_PERSIST_DEBOUNCE_MS);
		},
		[navigate],
	);

	const openItemAt = useCallback(
		(itemOrdinal: number, persist: boolean) => {
			const item = itemsRef.current[itemOrdinal];
			if (!item) return;
			if (persist) {
				// Flush any pending keyword URL sync so the /search entry holds the
				// latest query, then persist the live scroll position on it before
				// pushing the detail route.
				if (urlSyncTimerRef.current) {
					clearTimeout(urlSyncTimerRef.current);
					urlSyncTimerRef.current = null;
					navigate(buildSearchUrl(draftRef.current, type), {
						replace: true,
						state: stateBuilderRef.current({ visibleStartIndex: visibleStartRef.current }),
					});
				} else {
					navigate(searchUrlRef.current, {
						replace: true,
						state: stateBuilderRef.current({ visibleStartIndex: visibleStartRef.current }),
					});
				}
			} else if (urlSyncTimerRef.current) {
				clearTimeout(urlSyncTimerRef.current);
				urlSyncTimerRef.current = null;
				syncUrlTo(draftRef.current, type);
			}
			if (isModalSearchTarget(item.result)) {
				// Task/draft routes render as overlay modals: keep /search as the background
				// so closing the modal returns to the dialog with its state intact.
				navigate(getSearchResultLink(item.result), { state: { backgroundLocation: location } });
			} else {
				// Document/decision/wiki routes render as full pages: plain push, so the
				// route actually renders; browser back returns to the /search entry.
				navigate(getSearchResultLink(item.result));
			}
		},
		[navigate, location, type, syncUrlTo],
	);

	const moveSelection = useCallback(
		(delta: number) => {
			const currentRows = rowsRef.current;
			if (currentRows.length === 0) return;
			const next = Math.min(Math.max(selectedRow + delta, 0), currentRows.length - 1);
			setSelectedRow(next);
			listRef.current?.scrollRowIntoView(next);
		},
		[selectedRow],
	);

	// Enter/Space on a header toggles the group; on an item it opens the detail page
	const activateRow = useCallback(
		(rowIndex: number) => {
			const row = rowsRef.current[rowIndex];
			if (!row) return;
			if (row.kind === "header") {
				toggleGroup(row.type);
				return;
			}
			const ordinal = itemOrdinalsRef.current[rowIndex];
			if (ordinal !== null && ordinal !== undefined) {
				openItemAt(ordinal, true);
			}
		},
		[toggleGroup, openItemAt],
	);

	const handleDialogKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			moveSelection(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			moveSelection(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			activateRow(selectedRow);
		} else if (e.key === " " && !(e.target instanceof HTMLInputElement)) {
			const row = rowsRef.current[selectedRow];
			if (row?.kind === "header") {
				e.preventDefault();
				toggleGroup(row.type);
			}
		}
	};

	const FILTER_TABS: Array<{ type: SearchFilterType; label: string }> = [
		{ type: "all", label: t.searchDialog.filterAll },
		{ type: "task", label: t.searchDialog.filterTask },
		{ type: "document", label: t.searchDialog.filterDocument },
		{ type: "wiki", label: t.searchDialog.filterWiki },
		{ type: "decision", label: t.searchDialog.filterDecision },
	];

	const groupLabel = (rowType: SearchResultType): string => {
		if (rowType === "task") return t.searchDialog.filterTask;
		if (rowType === "document") return t.searchDialog.filterDocument;
		if (rowType === "wiki") return t.searchDialog.filterWiki;
		return t.searchDialog.filterDecision;
	};

	const itemHeight = isNarrow ? NARROW_ITEM_HEIGHT : DESKTOP_ITEM_HEIGHT;
	const headerHeight = isNarrow ? NARROW_HEADER_HEIGHT : DESKTOP_HEADER_HEIGHT;
	const hasQuery = draft.trim() !== "";

	const renderRow = (row: SearchRow, rowIndex: number) => {
		if (row.kind === "header") {
			return (
				<button
					type="button"
					onClick={() => toggleGroup(row.type)}
					aria-expanded={!row.collapsed}
					aria-label={row.collapsed ? t.searchDialog.expandGroup : t.searchDialog.collapseGroup}
					title={row.collapsed ? t.searchDialog.expandGroup : t.searchDialog.collapseGroup}
					className="w-full h-full flex items-center gap-1.5 px-4 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-200 transition-colors"
					style={{ height: headerHeight }}
				>
					<svg
						className={`w-3 h-3 shrink-0 transition-transform duration-150 ${row.collapsed ? "-rotate-90" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
					{groupLabel(row.type)}
					<span className="text-gray-600 dark:text-gray-500">{row.count}</span>
				</button>
			);
		}
		const meta = getSearchResultMeta(row.result);
		const highlight = getTitleMatchIndices(row.result, meta.title);
		const idHighlight = getIdMatchIndices(row.result, meta.id);
		const ordinal = itemOrdinals[rowIndex] ?? null;
		const isSelected = rowIndex === selectedRow;
		const rowBaseClass = isNarrow ? "w-full h-full flex items-start flex-col justify-center gap-1 px-4 py-2 text-left" : "w-full h-full flex items-center gap-3 px-4 text-left";
		const selectedClass = isSelected
			? "bg-gray-700/70 border-l-2 border-blue-400"
			: "border-l-2 border-transparent hover:bg-gray-700/40";

		const tags: React.ReactNode[] = [];
		if (meta.status) {
			tags.push(
				<span
					key="status"
					className={`inline-flex rounded-circle px-2 py-0.5 text-[11px] font-medium ${getStatusBadgeColor(meta.status)}`}
				>
					{meta.status}
				</span>,
			);
		}
		if (meta.priority) {
			tags.push(
				<span
					key="priority"
					className={`inline-flex rounded-circle px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeColor(meta.priority)}`}
				>
					{meta.priority}
				</span>,
			);
		}
		for (const tag of meta.tags?.slice(0, 2) ?? []) {
			tags.push(
				<span key={`tag-${tag}`} className="text-xs text-gray-400 dark:text-gray-500">
					{tag}
				</span>,
			);
		}

		return (
			<button
				type="button"
				onClick={() => {
					setSelectedRow(rowIndex);
					if (ordinal !== null) openItemAt(ordinal, false);
				}}
				className={`${rowBaseClass} ${selectedClass} transition-colors duration-100`}
			>
				{isNarrow ? (
					<>
						<span className="flex items-center gap-2 w-full min-w-0">
							<span className={TYPE_ICON_COLORS[row.type]}>
								<SearchTypeIcon type={row.type} />
							</span>
							<span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-100">
								<HighlightedText text={meta.title} indices={highlight} />
							</span>
						</span>
						<span className="flex items-center gap-2 w-full min-w-0 pl-6">
							<span className="min-w-0 truncate text-xs text-gray-400">
								<HighlightedText text={meta.id} indices={idHighlight} />
							</span>
							{tags.length > 0 && <span className="flex items-center gap-2 shrink-0">{tags}</span>}
						</span>
					</>
				) : (
					<>
						<span className={TYPE_ICON_COLORS[row.type]}>
							<SearchTypeIcon type={row.type} />
						</span>
						<span className="flex-1 min-w-0">
							<span className="block truncate text-sm font-medium text-gray-100">
								<HighlightedText text={meta.title} indices={highlight} />
							</span>
							<span className="block truncate text-xs text-gray-400">
								<HighlightedText text={meta.id} indices={idHighlight} />
							</span>
						</span>
						{tags.length > 0 && <span className="flex items-center gap-2 shrink-0">{tags}</span>}
					</>
				)}
			</button>
		);
	};

	return (
		<div className="fixed inset-0 z-50" role="presentation">
			{!isNarrow && (
				<div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={close} role="presentation" />
			)}
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={t.nav.search}
				onKeyDown={handleDialogKeyDown}
				className={
					isNarrow
						? "absolute inset-0 bg-gray-900 flex flex-col"
						: "absolute top-[12vh] left-1/2 -translate-x-1/2 w-[800px] max-w-[calc(100vw-2rem)] max-h-[75vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden"
				}
			>
				<div className={isNarrow ? "flex items-center gap-2 px-3 pt-3 shrink-0" : "flex items-center gap-2 px-4 pt-4 shrink-0"}>
					<input
						ref={inputRef}
						type="text"
						value={draft}
						onChange={(e) => {
							setDraft(e.target.value);
							queueUrlSync(e.target.value, type);
						}}
						placeholder={t.searchDialog.placeholder}
						aria-label={t.searchDialog.placeholder}
						className={`flex-1 min-w-0 bg-transparent text-gray-100 placeholder-gray-500 outline-none ${isNarrow ? "text-[32px]" : "text-[28px]"}`}
					/>
					<button
						type="button"
						onClick={close}
						aria-label={t.modal.closeAria}
						className="shrink-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded p-1 text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors duration-200"
					>
						×
					</button>
				</div>
				<div className={`flex items-center gap-1 overflow-x-auto shrink-0 ${isNarrow ? "px-3 pt-2" : "px-4 pt-2"}`}>
					{FILTER_TABS.map((tab) => {
						const isActive = type === tab.type;
						return (
							<button
								key={tab.type}
								type="button"
								aria-pressed={isActive}
								onClick={() => syncUrlTo(draft, tab.type)}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors duration-200 ${
									isActive
										? "bg-gray-700 text-gray-100"
										: "text-gray-400 hover:text-gray-200 hover:bg-gray-700/60"
								}`}
							>
								<SearchTypeIcon type={tab.type} className="w-3.5 h-3.5" />
								{tab.label}
							</button>
						);
					})}
				</div>
				<div className={`relative flex-1 min-h-0 flex flex-col overflow-hidden ${isNarrow ? "mt-2" : "mt-3"}`}>
					{isLoading && (
						<div className="absolute top-1 right-3 z-10 text-xs text-gray-500 bg-gray-900/80 rounded px-1.5 py-0.5">
							{t.nav.searching}
						</div>
					)}
					{!hasQuery ? (
						<div className="flex-1 flex items-center justify-center px-4 py-8 text-sm text-gray-500">{t.searchDialog.emptyHint}</div>
					) : isLoading && items.length === 0 ? (
						// Keep the empty-state height while the first results load so
						// the dialog doesn't collapse and jump when typing starts.
						<div className="flex-1 flex items-center justify-center px-4 py-8 text-sm invisible" aria-hidden="true">
							{t.searchDialog.emptyHint}
						</div>
					) : searchError ? (
						<div className="flex-1 flex items-center justify-center px-4 text-sm text-red-400">{t.nav.searchFailed}</div>
					) : items.length === 0 && !isLoading ? (
						<div className="flex-1 flex items-center justify-center px-4 text-sm text-gray-500">{t.nav.noSearchResults}</div>
					) : (
						<VirtualList
							ref={listRef}
							rows={rows}
							headerHeight={headerHeight}
							itemHeight={itemHeight}
							resetKey={resetKey}
							restoreIndex={restoreIndex}
							onRestoreHandled={() => setRestoreIndex(null)}
							onVisibleStartChange={handleVisibleStartChange}
						>
							{renderRow}
						</VirtualList>
					)}
				</div>
			</div>
		</div>
	);
};

export default SearchDialog;
