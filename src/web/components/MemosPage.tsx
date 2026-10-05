import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Memo } from "../../core/memos.ts";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import {
	dateTimeLocalToStoredUtc,
	formatLocalDateKey,
	formatLocalTimeStamp,
	localDateKeyFromStoredUtc,
} from "../utils/date-display";
import {
	appendMemoPage,
	collectMemoTags,
	EMPTY_MEMO_FEED,
	extractInlineTags,
	filterMemosByTags,
	MEMO_FEED_PAGE_SIZE,
	type MemoFeedState,
	memoCreatedOnDate,
	memoMatchesFilters,
	prependMemo,
	removeMemo,
	replaceMemo,
} from "../utils/memos";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import MemoBoard from "./MemoBoard";
import { ErrorBanner, formatDayLabel, MemoCard } from "./MemoCard";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";

export { MemoCard };

/**
 * One composer, one selectedDate. The calendar is a popover hung off the composer's calendar
 * button: picking a day filters the feed to it and parks a closable date chip on the composer.
 */

/** A small inline calendar glyph for the composer's calendar button. */
function CalendarIcon() {
	return (
		<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
		</svg>
	);
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** The machine's own day, which is the day the grid highlights and the feed filters on. */
function todayString(): string {
	return formatLocalDateKey(new Date());
}

interface MonthCell {
	day: number | null;
	key: string;
}

/** Six weeks of day numbers (plus leading/trailing nulls) so the grid is always rectangular. */
function buildMonthMatrix(year: number, month: number): MonthCell[] {
	const first = new Date(year, month - 1, 1);
	const startWeekday = first.getDay();
	const daysInMonth = new Date(year, month, 0).getDate();
	const cells: MonthCell[] = [];
	for (let i = 0; i < startWeekday; i++) cells.push({ day: null, key: `pad-${year}-${month}-${i}` });
	for (let day = 1; day <= daysInMonth; day++) {
		cells.push({ day, key: `${year}-${pad(month)}-${pad(day)}` });
	}
	while (cells.length % 7 !== 0) cells.push({ day: null, key: `tail-${year}-${month}-${cells.length}` });
	return cells;
}

/** Intensity buckets over the month's max count; blue shades that survive dark mode. */
function countClass(count: number, max: number): string {
	if (count <= 0) return "bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300";
	const ratio = max > 0 ? count / max : 0;
	if (ratio >= 0.66) return "bg-blue-200 dark:bg-blue-700/70 text-blue-900 dark:text-blue-50";
	if (ratio >= 0.33) return "bg-blue-100 dark:bg-blue-700/40 text-blue-900 dark:text-blue-100";
	return "bg-blue-50 dark:bg-blue-700/20 text-blue-800 dark:text-blue-200";
}

/** Memo-density dot in a day cell: one memo green, two to five blue, six or more red. */
function dotClass(count: number): string {
	if (count <= 1) return "bg-green-500 dark:bg-green-400";
	if (count <= 5) return "bg-blue-500 dark:bg-blue-400";
	return "bg-red-500 dark:bg-red-400";
}

function weekdayHeadings(locale: string): string[] {
	const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
	return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2023, 0, 1 + index)));
}

interface CalendarGridProps {
	year: number;
	month: number;
	counts: Record<string, number>;
	selectedDay: string | null;
	today: string;
	onSelectDay: (day: string) => void;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
}

function CalendarGrid({
	year,
	month,
	counts,
	selectedDay,
	today,
	onSelectDay,
	onPrevMonth,
	onNextMonth,
	onToday,
}: CalendarGridProps) {
	const { t, locale } = useI18n();
	const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);
	const max = useMemo(() => Object.values(counts).reduce((acc, value) => Math.max(acc, value), 0), [counts]);
	const monthTitle = useMemo(
		() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)),
		[year, month, locale],
	);
	const headings = useMemo(() => weekdayHeadings(locale), [locale]);

	return (
		<section
			aria-label={t.memos.calendar}
			className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4"
		>
			<div className="flex items-center justify-between gap-2 mb-4">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onPrevMonth}
						aria-label={t.memos.prevMonth}
						className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						<svg
							aria-hidden="true"
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<button
						type="button"
						onClick={onNextMonth}
						aria-label={t.memos.nextMonth}
						className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						<svg
							aria-hidden="true"
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>
				<h2 className="min-w-0 flex-1 text-center whitespace-nowrap text-base font-semibold text-gray-900 dark:text-white">
					{monthTitle}
				</h2>
				<button
					type="button"
					onClick={onToday}
					className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				>
					{t.memos.today}
				</button>
			</div>

			<div className="grid grid-cols-7 gap-1 mb-1">
				{headings.map((heading) => (
					<div key={heading} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
						{heading}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7 gap-1">
				{cells.map((cell) => {
					if (cell.day === null) {
						return <div key={cell.key} className="aspect-square" />;
					}
					const date = cell.key;
					const count = counts[date] ?? 0;
					const isToday = date === today;
					const isSelected = date === selectedDay;
					return (
						<button
							key={date}
							type="button"
							data-testid="calendar-day"
							data-date={date}
							aria-pressed={isSelected}
							aria-label={`${date}: ${count} ${t.memos.title}`}
							onClick={() => onSelectDay(date)}
							className={`relative aspect-square flex items-center justify-center rounded text-sm border transition-colors ${countClass(
								count,
								max,
							)} ${
								isSelected
									? "ring-2 ring-blue-500 dark:ring-blue-400"
									: "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
							} ${isToday ? "font-bold underline" : ""}`}
						>
							<span>{cell.day}</span>
							{count > 0 && (
								<span
									aria-hidden="true"
									data-testid="calendar-dot"
									className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${dotClass(count)}`}
								/>
							)}
						</button>
					);
				})}
			</div>
		</section>
	);
}

export default function MemosPage() {
	const { t, locale } = useI18n();
	const { theme } = useTheme();
	const [searchParams, setSearchParams] = useSearchParams();
	const viewParam = searchParams.get("view");
	const dateParam = searchParams.get("date");

	const [selectedDate, setSelectedDate] = useState<string | null>(() => dateParam || null);
	const [activeTags, setActiveTags] = useState<string[]>([]);
	const [calendarOpen, setCalendarOpen] = useState<boolean>(() => viewParam === "calendar");

	const today = useMemo(() => todayString(), []);
	const [calendarYear, setCalendarYear] = useState<number>(() => {
		if (dateParam) {
			const parts = dateParam.split("-");
			if (parts.length >= 2 && Number(parts[0])) return Number(parts[0]);
		}
		return new Date().getFullYear();
	});
	const [calendarMonth, setCalendarMonth] = useState<number>(() => {
		if (dateParam) {
			const parts = dateParam.split("-");
			if (parts.length >= 2 && Number(parts[1])) return Number(parts[1]);
		}
		return new Date().getMonth() + 1;
	});
	const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({});

	const [feed, setFeed] = useState<MemoFeedState>(EMPTY_MEMO_FEED);
	const [initialLoading, setInitialLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [appendError, setAppendError] = useState<string | null>(null);

	const [draft, setDraft] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [composerError, setComposerError] = useState<string | null>(null);

	// The pinboard view (`?view=board`) shows every memo at once, so it keeps its own
	// exhaustively-loaded list instead of sharing the feed's paginated window.
	const boardView = viewParam === "board";
	const [boardMemos, setBoardMemos] = useState<Memo[]>([]);
	const [boardLoading, setBoardLoading] = useState(false);
	const [boardError, setBoardError] = useState<string | null>(null);
	const boardRequestRef = useRef(0);

	// Request epochs: anything in flight from a previous date filter must not land on the current
	// list, so every reload bumps the epoch and stale responses are dropped.
	const feedRequestRef = useRef(0);
	const offsetRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
	const calendarMenuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		offsetRef.current = feed.memos.length;
	}, [feed.memos.length]);

	// Deep links win: `?date=YYYY-MM-DD` (which global search emits for memo hits) drives the day
	// filter from the outside. `?view=calendar` only decides whether the popover starts open.
	useEffect(() => {
		setSelectedDate((current) => {
			const next = dateParam || null;
			return current === next ? current : next;
		});
		if (dateParam) {
			const parts = dateParam.split("-");
			if (parts.length >= 2 && Number(parts[0]) && Number(parts[1])) {
				setCalendarYear(Number(parts[0]));
				setCalendarMonth(Number(parts[1]));
			}
		}
	}, [dateParam]);

	// The calendar popover closes on an outside click or on Escape, like the label dropdown.
	useEffect(() => {
		if (!calendarOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				calendarButtonRef.current &&
				calendarMenuRef.current &&
				!calendarButtonRef.current.contains(target) &&
				!calendarMenuRef.current.contains(target)
			) {
				setCalendarOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setCalendarOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [calendarOpen]);

	const loadFirstPage = useCallback(
		async (date: string | null) => {
			const requestId = ++feedRequestRef.current;
			setFeed(EMPTY_MEMO_FEED);
			setLoadError(null);
			setAppendError(null);
			setInitialLoading(true);
			try {
				const page = await apiClient.fetchMemosPage({ limit: MEMO_FEED_PAGE_SIZE, date: date ?? undefined });
				if (requestId !== feedRequestRef.current) return;
				setFeed({ memos: page.items, hasMore: page.hasMore });
			} catch (error) {
				if (requestId !== feedRequestRef.current) return;
				setLoadError(error instanceof Error && error.message ? error.message : t.memos.loadFailed);
			} finally {
				if (requestId === feedRequestRef.current) setInitialLoading(false);
			}
		},
		[t.memos.loadFailed],
	);

	useEffect(() => {
		void loadFirstPage(selectedDate);
	}, [selectedDate, loadFirstPage]);

	const hasMore = feed.hasMore;

	const loadMore = useCallback(async () => {
		if (loadingMoreRef.current) return;
		if (!hasMore) return;
		const requestId = feedRequestRef.current;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		setAppendError(null);
		try {
			const page = await apiClient.fetchMemosPage({
				limit: MEMO_FEED_PAGE_SIZE,
				offset: offsetRef.current,
				date: selectedDate ?? undefined,
			});
			if (requestId !== feedRequestRef.current) return;
			setFeed((current) => appendMemoPage(current, page));
		} catch (error) {
			if (requestId === feedRequestRef.current) {
				setAppendError(error instanceof Error && error.message ? error.message : t.memos.loadMoreFailed);
			}
		} finally {
			loadingMoreRef.current = false;
			if (requestId === feedRequestRef.current) setLoadingMore(false);
		}
	}, [selectedDate, hasMore, t.memos.loadMoreFailed]);

	// The page itself does not scroll - <main> does - so the viewport root is the right observer
	// root, and the margin starts the next fetch before the sentinel is actually on screen.
	useEffect(() => {
		if (initialLoading || loadingMore || !hasMore) return;
		const sentinel = sentinelRef.current;
		if (!sentinel || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore();
			},
			{ rootMargin: "240px 0px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [initialLoading, loadingMore, hasMore, loadMore]);

	const loadCalendar = useCallback(async (year: number, month: number) => {
		try {
			setCalendarCounts(await apiClient.fetchMemoCalendar(year, month));
		} catch {
			// A calendar fetch is best-effort; an empty grid is a graceful fallback.
		}
	}, []);

	useEffect(() => {
		void loadCalendar(calendarYear, calendarMonth);
	}, [calendarYear, calendarMonth, loadCalendar]);

	/**
	 * Live refresh triggered by the server's `memos-updated` broadcast (an API write or an
	 * out-of-band file edit). It re-pulls the window the user is already looking at and drops it
	 * into place, so the selected date and the scroll position are preserved - no return to page
	 * one, no full reload.
	 */
	const refreshInPlace = useCallback(async () => {
		// The popover calendar is not always on screen, but its counts must stay honest.
		void loadCalendar(calendarYear, calendarMonth);
		const requestId = ++feedRequestRef.current;
		try {
			const target = feed.memos.length;
			const collected: Memo[] = [];
			let offset = 0;
			let more = false;
			do {
				const page = await apiClient.fetchMemosPage({
					limit: MEMO_FEED_PAGE_SIZE,
					offset,
					date: selectedDate ?? undefined,
				});
				collected.push(...page.items);
				offset += page.items.length;
				more = page.hasMore;
				if (page.items.length === 0) break;
				if (collected.length >= target) break;
			} while (more);
			if (requestId !== feedRequestRef.current) return;
			setFeed({ memos: collected, hasMore: more });
			setLoadError(null);
		} catch (error) {
			// A background refresh is not something the user asked for, so a failure must not blank
			// the list (which would reset the view) or break the websocket - keep the loaded pages
			// and swallow it, logging only.
			console.warn("Failed to refresh memos after a memos-updated broadcast:", error);
		}
	}, [calendarYear, calendarMonth, feed.memos.length, loadCalendar, selectedDate]);

	useEffect(() => {
		const onUpdated = () => void refreshInPlace();
		window.addEventListener("memos-updated", onUpdated);
		return () => window.removeEventListener("memos-updated", onUpdated);
	}, [refreshInPlace]);

	const loadBoard = useCallback(async () => {
		const requestId = ++boardRequestRef.current;
		setBoardLoading(true);
		setBoardError(null);
		try {
			const collected: Memo[] = [];
			let offset = 0;
			let more = true;
			while (more) {
				const page = await apiClient.fetchMemosPage({ limit: 100, offset });
				collected.push(...page.items);
				offset += page.items.length;
				more = page.hasMore && page.items.length > 0;
			}
			if (requestId !== boardRequestRef.current) return;
			setBoardMemos(collected);
		} catch (error) {
			if (requestId === boardRequestRef.current) {
				setBoardError(error instanceof Error && error.message ? error.message : t.memos.loadFailed);
			}
		} finally {
			if (requestId === boardRequestRef.current) setBoardLoading(false);
		}
	}, [t.memos.loadFailed]);

	useEffect(() => {
		if (boardView) void loadBoard();
	}, [boardView, loadBoard]);

	useEffect(() => {
		if (!boardView) return;
		const onUpdated = () => void loadBoard();
		window.addEventListener("memos-updated", onUpdated);
		return () => window.removeEventListener("memos-updated", onUpdated);
	}, [boardView, loadBoard]);

	const setBoardView = useCallback(
		(board: boolean) => {
			const nextParams = new URLSearchParams(searchParams);
			if (board) nextParams.set("view", "board");
			else nextParams.delete("view");
			setSearchParams(nextParams, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	const goMonth = useCallback(
		(delta: number) => {
			setCalendarMonth((current) => {
				let month = current + delta;
				let year = calendarYear;
				if (month < 1) {
					month = 12;
					year -= 1;
				} else if (month > 12) {
					month = 1;
					year += 1;
				}
				setCalendarYear(year);
				return month;
			});
		},
		[calendarYear],
	);

	const toggleTag = (tag: string) => {
		setActiveTags((current) =>
			current.some((item) => item.toLowerCase() === tag.toLowerCase())
				? current.filter((item) => item.toLowerCase() !== tag.toLowerCase())
				: [...current, tag],
		);
	};

	const clearSelectedDate = useCallback(() => {
		setSelectedDate(null);
		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("date");
		// `view` doubles as the board/list switch, so only drop it when it held the calendar deep link.
		if (viewParam !== "board") nextParams.delete("view");
		setSearchParams(nextParams, { replace: true });
	}, [searchParams, setSearchParams, viewParam]);

	// Picking a day filters the feed to it (the single composer then captures into that date) and
	// dismisses the popover.
	const handlePickDay = useCallback(
		(day: string) => {
			setSelectedDate(day);
			const nextParams = new URLSearchParams(searchParams);
			nextParams.set("date", day);
			if (viewParam !== "board") nextParams.delete("view");
			setSearchParams(nextParams, { replace: true });
			setCalendarOpen(false);
		},
		[searchParams, setSearchParams, viewParam],
	);

	const handleToday = useCallback(() => {
		const now = new Date();
		setCalendarYear(now.getFullYear());
		setCalendarMonth(now.getMonth() + 1);
	}, []);

	const handleCapture = useCallback(async () => {
		const content = draft.trim();
		if (!content || isSaving) return;
		setIsSaving(true);
		setComposerError(null);
		try {
			// Promote pasted temp images to the permanent assets dir before saving,
			// and keep the rewritten text in the composer so a failed save retries cleanly.
			let saveContent = content;
			const tempUrls = extractTempImageUrls(saveContent);
			if (tempUrls.length > 0) {
				const mapping = await apiClient.promoteAssets(tempUrls);
				saveContent = replaceTempImageUrls(saveContent, mapping);
				setDraft(saveContent);
			}
			// A date chip pins the capture to that day; the time stays "now" so the card reads
			// naturally. The chip holds a LOCAL day, so the time-of-day has to come from the local
			// clock too, and the pair is converted to the UTC shape the backend stores - pinning a
			// local day to a UTC clock time would store an instant the calendar never shows.
			const createdDate = selectedDate
				? dateTimeLocalToStoredUtc(`${selectedDate} ${formatLocalTimeStamp()}`)
				: undefined;
			const memo = await apiClient.createMemo(saveContent, extractInlineTags(saveContent), createdDate);
			if (memoMatchesFilters(memo, selectedDate, activeTags)) {
				setFeed((current) => prependMemo(current, memo));
			}
			// The grid's buckets are local days, so the optimistic bump has to land on one.
			const day = localDateKeyFromStoredUtc(memo.createdDate);
			setCalendarCounts((current) => ({ ...current, [day]: (current[day] ?? 0) + 1 }));
			setDraft("");
		} catch (error) {
			setComposerError(error instanceof Error && error.message ? error.message : t.memos.saveFailed);
		} finally {
			setIsSaving(false);
		}
	}, [activeTags, draft, isSaving, selectedDate, t.memos.saveFailed]);

	const handleUpdate = useCallback(async (id: string, content: string, tags: string[]) => {
		let saveContent = content;
		const tempUrls = extractTempImageUrls(saveContent);
		if (tempUrls.length > 0) {
			const mapping = await apiClient.promoteAssets(tempUrls);
			saveContent = replaceTempImageUrls(saveContent, mapping);
		}
		const memo = await apiClient.updateMemo(id, { content: saveContent, tags });
		setFeed((current) => replaceMemo(current, memo));
		setBoardMemos((current) => current.map((existing) => (existing.id === id ? memo : existing)));
	}, []);

	/**
	 * Drop a memo the server has just removed (deleted or archived) from every local view: the
	 * feed, the board and the calendar bucket of the local day it was shown under.
	 */
	const dropMemoFromView = useCallback(
		(id: string) => {
			const target = feed.memos.find((memo) => memo.id === id) ?? boardMemos.find((memo) => memo.id === id);
			// The grid's buckets are local days, so decrement the day the memo was actually shown under.
			const day = target ? localDateKeyFromStoredUtc(target.createdDate) : undefined;
			setFeed((current) => removeMemo(current, id));
			setBoardMemos((current) => current.filter((memo) => memo.id !== id));
			if (day) {
				setCalendarCounts((current) => ({ ...current, [day]: Math.max(0, (current[day] ?? 1) - 1) }));
			}
		},
		[feed.memos, boardMemos],
	);

	const handleDelete = useCallback(
		async (id: string) => {
			await apiClient.deleteMemo(id);
			dropMemoFromView(id);
		},
		[dropMemoFromView],
	);

	const handleArchive = useCallback(
		async (id: string) => {
			await apiClient.archiveMemo(id);
			dropMemoFromView(id);
		},
		[dropMemoFromView],
	);

	const visibleMemos = useMemo(() => filterMemosByTags(feed.memos, activeTags), [feed.memos, activeTags]);
	const availableTags = useMemo(() => collectMemoTags(feed.memos), [feed.memos]);
	const boardVisibleMemos = useMemo(
		() => filterMemosByTags(boardMemos, activeTags).filter((memo) => memoCreatedOnDate(memo, selectedDate)),
		[boardMemos, activeTags, selectedDate],
	);

	return (
		<div className={`page-shell transition-colors duration-200 ${boardView ? "h-full overflow-hidden" : ""}`}>
			<div className={`mx-auto flex flex-col gap-4 ${boardView ? "h-full max-w-none" : "max-w-3xl"}`}>
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.memos.title}</h1>
					<div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
						<button
							type="button"
							aria-pressed={!boardView}
							onClick={() => setBoardView(false)}
							className={`px-3 py-1.5 text-xs transition-colors ${
								!boardView
									? "bg-blue-500 dark:bg-blue-600 text-white"
									: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
							}`}
						>
							{t.memos.viewList}
						</button>
						<button
							type="button"
							aria-pressed={boardView}
							onClick={() => setBoardView(true)}
							className={`px-3 py-1.5 text-xs transition-colors ${
								boardView
									? "bg-blue-500 dark:bg-blue-600 text-white"
									: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
							}`}
						>
							{t.memos.viewBoard}
						</button>
					</div>
				</div>

				{!boardView && (
					<section
						aria-label={t.memos.composerPlaceholder}
						className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3"
					>
						{selectedDate && (
							<div className="mb-2">
								<span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
									<CalendarIcon />
									<span>{formatDayLabel(selectedDate, locale)}</span>
									<button
										type="button"
										onClick={clearSelectedDate}
										aria-label={t.memos.clearDate}
										className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/60"
									>
										✕
									</button>
								</span>
							</div>
						)}
						<div className="h-40">
							<PasteAwareMDEditor
								value={draft}
								onChange={(value) => setDraft(value ?? "")}
								preview="edit"
								height="100%"
								hideToolbar={true}
								data-color-mode={theme}
								textareaProps={{
									placeholder: t.memos.composerPlaceholder,
									onKeyDown: (event) => {
										if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
											event.preventDefault();
											void handleCapture();
										}
									},
								}}
							/>
						</div>
						<div className="flex items-center justify-between gap-3 mt-3">
							<p className="text-xs text-gray-500 dark:text-gray-400">{t.memos.composerHint}</p>
							<div className="flex items-center gap-2">
								<div className="relative">
									<button
										type="button"
										ref={calendarButtonRef}
										onClick={() => setCalendarOpen((open) => !open)}
										aria-expanded={calendarOpen}
										aria-controls="memos-calendar-popover"
										aria-label={t.memos.calendarIcon}
										className={`p-2 rounded border transition-colors ${
											selectedDate
												? "border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
												: "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										}`}
									>
										<CalendarIcon />
									</button>
									{calendarOpen && (
										<div
											id="memos-calendar-popover"
											ref={calendarMenuRef}
											className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-md shadow-lg"
										>
											<CalendarGrid
												year={calendarYear}
												month={calendarMonth}
												counts={calendarCounts}
												selectedDay={selectedDate}
												today={today}
												onSelectDay={handlePickDay}
												onPrevMonth={() => goMonth(-1)}
												onNextMonth={() => goMonth(1)}
												onToday={handleToday}
											/>
										</div>
									)}
								</div>
								<button
									type="button"
									onClick={() => void handleCapture()}
									disabled={isSaving || draft.trim().length === 0}
									className="shrink-0 px-3 py-1.5 text-sm rounded bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{isSaving ? t.common.saving : t.common.save}
								</button>
							</div>
						</div>
					</section>
				)}

				{!boardView && composerError && <ErrorBanner title={t.memos.saveFailed} detail={composerError} />}

				{!boardView && availableTags.length > 0 && (
					<div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
						{availableTags.map((tag) => {
							const isActive = activeTags.some((item) => item.toLowerCase() === tag.toLowerCase());
							return (
								<button
									key={tag}
									type="button"
									onClick={() => toggleTag(tag)}
									aria-pressed={isActive}
									className={`shrink-0 whitespace-nowrap px-2 py-1 text-xs rounded-full border transition-colors ${
										isActive
											? "bg-blue-500 dark:bg-blue-600 border-blue-500 dark:border-blue-600 text-white"
											: "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
									}`}
								>
									#{tag}
								</button>
							);
						})}
						{activeTags.length > 0 && (
							<button
								type="button"
								onClick={() => setActiveTags([])}
								className="shrink-0 whitespace-nowrap px-2 py-1 text-xs rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
							>
								{t.memos.clearTags}
							</button>
						)}
					</div>
				)}

				{boardView ? (
					<div className="flex-1 min-h-0 flex flex-col">
						{boardLoading ? (
							<p role="status" className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
								{t.memos.loading}
							</p>
						) : boardError ? (
							<ErrorBanner title={t.memos.loadFailed} detail={boardError} onRetry={() => void loadBoard()} />
						) : (
							<MemoBoard
								memos={boardVisibleMemos}
								onUpdate={handleUpdate}
								onDelete={handleDelete}
								onArchive={handleArchive}
								onTagClick={toggleTag}
							/>
						)}
					</div>
				) : initialLoading ? (
					<p role="status" className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
						{t.memos.loading}
					</p>
				) : loadError ? (
					<ErrorBanner title={t.memos.loadFailed} detail={loadError} onRetry={() => void loadFirstPage(selectedDate)} />
				) : visibleMemos.length === 0 ? (
					<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
						{feed.memos.length === 0 ? (selectedDate ? t.memos.noMemosThisDay : t.memos.empty) : t.memos.emptyFiltered}
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{visibleMemos.map((memo) => (
							<MemoCard
								key={memo.id}
								memo={memo}
								onUpdate={handleUpdate}
								onDelete={handleDelete}
								onArchive={handleArchive}
								onTagClick={toggleTag}
							/>
						))}
					</div>
				)}

				{!boardView && !initialLoading && !loadError && visibleMemos.length > 0 && (
					<div ref={sentinelRef} data-testid="memos-sentinel" className="h-px" />
				)}

				{!boardView && loadingMore && (
					<p role="status" className="text-center text-sm text-gray-500 dark:text-gray-400">
						{t.memos.loadingMore}
					</p>
				)}
				{!boardView && appendError && <ErrorBanner title={appendError} onRetry={() => void loadMore()} />}
				{!boardView && !hasMore && !initialLoading && visibleMemos.length > 0 && !loadingMore && (
					<p className="text-center text-xs text-gray-500 dark:text-gray-400">{t.memos.endOfList}</p>
				)}
			</div>
		</div>
	);
}
