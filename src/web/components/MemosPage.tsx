import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Memo } from "../../core/memos.ts";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
import { parseStoredUtcDate, storedUtcHoverTitle } from "../utils/date-display";
import {
	appendMemoPage,
	collectMemoTags,
	EMPTY_MEMO_FEED,
	extractInlineTags,
	filterMemosByTags,
	MEMO_FEED_PAGE_SIZE,
	type MemoFeedState,
	memoMatchesFilters,
	prependMemo,
	removeMemo,
	replaceMemo,
	toggleTaskInMarkdown,
} from "../utils/memos";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import { encodeWikiPath } from "../utils/urlHelpers";
import MermaidMarkdown from "./MermaidMarkdown";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";

/**
 * One composer, one selectedDate. The calendar is a popover hung off the composer's calendar
 * button: picking a day filters the feed to it and parks a closable date chip on the composer.
 */

function ErrorBanner({
	title,
	detail,
	onRetry,
	retryLabel,
}: {
	title: string;
	detail?: string | null;
	onRetry?: () => void;
	retryLabel?: string;
}) {
	const { t } = useI18n();
	return (
		<div
			role="alert"
			className="flex flex-wrap items-center justify-between gap-2 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md px-3 py-2 text-sm"
		>
			<span>
				<span className="font-medium">{title}</span>
				{detail && <span className="ml-2 text-red-600/80 dark:text-red-300/80">{detail}</span>}
			</span>
			{onRetry && (
				<button
					type="button"
					onClick={onRetry}
					className="shrink-0 px-2 py-1 rounded border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
				>
					{retryLabel ?? t.common.retry}
				</button>
			)}
		</div>
	);
}

/** A small inline calendar glyph for the composer's calendar button. */
function CalendarIcon() {
	return (
		<svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
			<rect x="3" y="5" width="18" height="16" rx="2" />
			<path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
		</svg>
	);
}

/** A vertical three-dot glyph for the memo card's actions menu. */
function KebabIcon() {
	return (
		<svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
			<circle cx="12" cy="5" r="1.7" />
			<circle cx="12" cy="12" r="1.7" />
			<circle cx="12" cy="19" r="1.7" />
		</svg>
	);
}

/** `YYYY-MM-DD` rendered for the current app locale, e.g. 2026年10月1日. */
function formatDayLabel(day: string, locale: string): string {
	const [year, month, date] = day.split("-").map((part) => Number.parseInt(part, 10));
	if (!year || !month || !date) return day;
	return new Date(year, month - 1, date).toLocaleDateString(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/** A `now` that advances on a timer, so a relative label never freezes at its first value. */
function useRelativeNow(intervalMs = 30000): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}

/**
 * The card's timestamp, in three elapsed-time buckets: under 15 minutes the minutes ("N min ago"),
 * under an hour "Today", and beyond that the concrete stored time. The first minute reads
 * "1 min ago" rather than a "just now" label, so it keeps advancing instead of sitting still.
 */
function MemoTimestamp({ value }: { value: string }) {
	const { t, locale } = useI18n();
	const now = useRelativeNow();
	const className = "text-xs text-gray-500 dark:text-gray-400";
	const trimmed = value.trim();

	// A plain date - the calendar's picked day, like a due date - is shown for the app locale
	// as-is, never pushed through a UTC conversion that would land it on the previous day.
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return <span className={className}>{formatDayLabel(trimmed, locale)}</span>;
	}

	const parsed = parseStoredUtcDate(value);
	if (!parsed) return <span className={className}>{value}</span>;

	const diffMinutes = Math.floor((now.getTime() - parsed.getTime()) / 60000);
	if (diffMinutes >= 0 && diffMinutes < 15) {
		const minutes = Math.max(1, diffMinutes);
		return (
			<span className={className} title={storedUtcHoverTitle(value)}>
				{t.memos.minutesAgo.replace("{n}", String(minutes))}
			</span>
		);
	}
	if (diffMinutes >= 0 && diffMinutes < 60) {
		return (
			<span className={className} title={storedUtcHoverTitle(value)}>
				{t.memos.today}
			</span>
		);
	}

	// Older than the "Today" bucket: the concrete stored time, localized for the APP locale (not
	// the browser's), so an English UI never shows a Chinese-formatted timestamp.
	return (
		<span className={className} title={storedUtcHoverTitle(value)}>
			{parsed.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
		</span>
	);
}

interface MemoCardProps {
	memo: Memo;
	onUpdate: (id: string, content: string, tags: string[]) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	/** Toggle the feed's tag filter - the body's `#tag` chips and the card's tag row share it. */
	onTagClick: (tag: string) => void;
}

/** One memo in the feed: relative date, markdown body, read-only tags, inline edit/delete. */
export function MemoCard({ memo, onUpdate, onDelete, onTagClick }: MemoCardProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(memo.rawContent);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<{ title: string; detail: string | null } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const busy = isSaving || isDeleting;
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	// The callback is read through a ref so the listener below can depend only on `isEditing`:
	// the page re-renders on every keystroke in the composer, and re-attaching per render is waste.
	const tagClickRef = useRef(onTagClick);
	useEffect(() => {
		tagClickRef.current = onTagClick;
	}, [onTagClick]);

	const handleStartEdit = () => {
		setDraft(memo.rawContent);
		setError(null);
		setIsEditing(true);
	};

	const handleSave = async () => {
		if (busy) return;
		setIsSaving(true);
		setError(null);
		try {
			await onUpdate(memo.id, draft, extractInlineTags(draft));
			setIsEditing(false);
		} catch (err) {
			setError({ title: t.memos.updateFailed, detail: err instanceof Error ? err.message : null });
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (busy) return;
		if (!window.confirm(t.memos.confirmDelete)) return;
		setIsDeleting(true);
		setError(null);
		try {
			await onDelete(memo.id);
		} catch (err) {
			setError({ title: t.memos.deleteFailed, detail: err instanceof Error ? err.message : null });
		} finally {
			setIsDeleting(false);
		}
	};

	/**
	 * A rendered `- [ ]` checkbox is a view of the body, so ticking it rewrites the marker and
	 * saves the whole memo through the same path the editor uses. The server round-trip is what
	 * moves the tick: the input stays controlled by `memo.rawContent`, so a failed save simply
	 * leaves the checkbox where it was.
	 */
	const handleToggleTask = async (index: number) => {
		const next = toggleTaskInMarkdown(memo.rawContent, index);
		if (next === memo.rawContent) return;
		setError(null);
		try {
			await onUpdate(memo.id, next, extractInlineTags(next));
		} catch (err) {
			setError({ title: t.memos.updateFailed, detail: err instanceof Error ? err.message : null });
		}
	};

	// The actions menu closes on an outside click or Escape, like the page's calendar popover.
	useEffect(() => {
		if (!menuOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				menuButtonRef.current &&
				!menuButtonRef.current.contains(target) &&
				menuRef.current &&
				!menuRef.current.contains(target)
			) {
				setMenuOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [menuOpen]);

	/**
	 * The body's `#tag` chips are markdown the renderer owns, so React never sees them - their
	 * events arrive at the wrapper, which delegates. A native listener rather than `onClick` keeps
	 * a handler off a passive container (React's a11y lint rightly flags that) and lets the chips
	 * answer Enter and Space, since they carry `role="button"`.
	 */
	useEffect(() => {
		// While editing there is no rendered body to delegate from, and the effect re-runs when the
		// editor hands the body back, which is also when `bodyRef` points at a fresh node.
		if (isEditing) return;
		const node = bodyRef.current;
		if (!node) return;
		const activate = (event: Event) => {
			const chip = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-memo-tag]");
			const tag = chip?.dataset.memoTag;
			if (!tag) return;
			if (event.type === "keydown") {
				const { key } = event as KeyboardEvent;
				if (key !== "Enter" && key !== " ") return;
				event.preventDefault();
			}
			tagClickRef.current(tag);
		};
		node.addEventListener("click", activate);
		node.addEventListener("keydown", activate);
		return () => {
			node.removeEventListener("click", activate);
			node.removeEventListener("keydown", activate);
		};
		// `isEditing` re-attaches after the body is swapped back in from the editor.
	}, [isEditing]);

	return (
		<article
			data-testid="memo-card"
			data-memo-id={memo.id}
			className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm dark:shadow-none transition-colors duration-200"
		>
			<div className="flex items-center justify-between gap-3 mb-2">
				<MemoTimestamp value={memo.createdDate} />
				{!isEditing && (
					<div className="relative">
						<button
							type="button"
							ref={menuButtonRef}
							onClick={() => setMenuOpen((open) => !open)}
							disabled={busy}
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							aria-label={t.memos.moreActions}
							className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							<KebabIcon />
						</button>
						{menuOpen && (
							<div
								ref={menuRef}
								role="menu"
								className="absolute right-0 top-full mt-1 z-20 min-w-[7rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
							>
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setMenuOpen(false);
										handleStartEdit();
									}}
									className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								>
									{t.common.edit}
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setMenuOpen(false);
										void handleDelete();
									}}
									className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
								>
									{isDeleting ? t.common.removing : t.common.delete}
								</button>
							</div>
						)}
					</div>
				)}
			</div>

			{isEditing ? (
				<div className="h-56">
					<PasteAwareMDEditor
						value={draft}
						onChange={(value) => setDraft(value ?? "")}
						preview="edit"
						height="100%"
						hideToolbar={true}
						data-color-mode={theme}
						textareaProps={{
							onKeyDown: (event) => {
								if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
									event.preventDefault();
									void handleSave();
								}
							},
						}}
					/>
				</div>
			) : (
				/* `memo-body` carries the note-prose typography (see source.css) - the renderer's own
				   GitHub-document defaults are far too loud inside a card. */
				<div className="memo-body w-full" data-color-mode={theme} ref={bodyRef}>
					<MermaidMarkdown
						source={memo.rawContent}
						wikilinkBasePath="index.md"
						inlineTagChips={true}
						onToggleTask={(index) => void handleToggleTask(index)}
						onTaskClick={(taskId) => navigate(`/task/${taskId}`)}
						onDraftClick={(draftId) => navigate(`/draft/${draftId}`)}
						onDocClick={(docId) => navigate(`/documentation/${docId}`)}
						onDecisionClick={(decisionId) => navigate(`/decisions/${decisionId}`)}
						onWikiClick={(wikiPath) => navigate(`/wiki/${encodeWikiPath(wikiPath)}`)}
					/>
				</div>
			)}

			{isEditing && (
				<div className="flex items-center justify-end gap-2 mt-3">
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						disabled={isSaving}
						className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{t.common.cancel}
					</button>
					<button
						type="button"
						onClick={() => void handleSave()}
						disabled={isSaving}
						className="px-3 py-1.5 text-xs rounded bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
					>
						{isSaving ? t.common.saving : t.memos.saveChanges}
					</button>
				</div>
			)}

			{error && <ErrorBanner title={error.title} detail={error.detail} />}
		</article>
	);
}

const pad = (value: number): string => String(value).padStart(2, "0");

function todayString(): string {
	const now = new Date();
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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

	// Request epochs: anything in flight from a previous date filter must not land on the current
	// list, so every reload bumps the epoch and stale responses are dropped.
	const feedRequestRef = useRef(0);
	const cursorRef = useRef<string | null>(null);
	const loadingMoreRef = useRef(false);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
	const calendarMenuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		cursorRef.current = feed.nextCursor;
	}, [feed.nextCursor]);

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
				setFeed({ memos: page.items, nextCursor: page.nextCursor });
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

	const loadMore = useCallback(async () => {
		if (loadingMoreRef.current) return;
		const cursor = cursorRef.current;
		if (!cursor) return;
		const requestId = feedRequestRef.current;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		setAppendError(null);
		try {
			const page = await apiClient.fetchMemosPage({
				limit: MEMO_FEED_PAGE_SIZE,
				cursor,
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
	}, [selectedDate, t.memos.loadMoreFailed]);

	const hasMore = feed.nextCursor !== null;

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
			let cursor: string | null = null;
			const target = feed.memos.length;
			const collected: Memo[] = [];
			do {
				const page = await apiClient.fetchMemosPage({
					limit: MEMO_FEED_PAGE_SIZE,
					cursor: cursor ?? undefined,
					date: selectedDate ?? undefined,
				});
				collected.push(...page.items);
				cursor = page.nextCursor;
				if (collected.length >= target) break;
			} while (cursor);
			if (requestId !== feedRequestRef.current) return;
			setFeed({ memos: collected, nextCursor: cursor });
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
		nextParams.delete("view");
		setSearchParams(nextParams, { replace: true });
	}, [searchParams, setSearchParams]);

	// Picking a day filters the feed to it (the single composer then captures into that date) and
	// dismisses the popover.
	const handlePickDay = useCallback(
		(day: string) => {
			setSelectedDate(day);
			const nextParams = new URLSearchParams(searchParams);
			nextParams.set("date", day);
			nextParams.delete("view");
			setSearchParams(nextParams, { replace: true });
			setCalendarOpen(false);
		},
		[searchParams, setSearchParams],
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
			// naturally. The stored value keeps the picked date, so it groups under that day.
			const createdDate = selectedDate ? `${selectedDate} ${new Date().toISOString().slice(11, 16)}` : undefined;
			const memo = await apiClient.createMemo(saveContent, extractInlineTags(saveContent), createdDate);
			if (memoMatchesFilters(memo, selectedDate, activeTags)) {
				setFeed((current) => prependMemo(current, memo));
			}
			const day = memo.createdDate.slice(0, 10);
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
	}, []);

	const handleDelete = useCallback(
		async (id: string) => {
			const day = feed.memos.find((memo) => memo.id === id)?.createdDate.slice(0, 10);
			await apiClient.deleteMemo(id);
			setFeed((current) => removeMemo(current, id));
			if (day) {
				setCalendarCounts((current) => ({ ...current, [day]: Math.max(0, (current[day] ?? 1) - 1) }));
			}
		},
		[feed.memos],
	);

	const visibleMemos = useMemo(() => filterMemosByTags(feed.memos, activeTags), [feed.memos, activeTags]);
	const availableTags = useMemo(() => collectMemoTags(feed.memos), [feed.memos]);

	return (
		<div className="page-shell transition-colors duration-200">
			<div className="mx-auto max-w-3xl flex flex-col gap-4">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.memos.title}</h1>

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

				{composerError && <ErrorBanner title={t.memos.saveFailed} detail={composerError} />}

				{availableTags.length > 0 && (
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

				{initialLoading ? (
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
								onTagClick={toggleTag}
							/>
						))}
					</div>
				)}

				{!initialLoading && !loadError && visibleMemos.length > 0 && (
					<div ref={sentinelRef} data-testid="memos-sentinel" className="h-px" />
				)}

				{loadingMore && (
					<p role="status" className="text-center text-sm text-gray-500 dark:text-gray-400">
						{t.memos.loadingMore}
					</p>
				)}
				{appendError && <ErrorBanner title={appendError} onRetry={() => void loadMore()} />}
				{!hasMore && !initialLoading && visibleMemos.length > 0 && !loadingMore && (
					<p className="text-center text-xs text-gray-500 dark:text-gray-400">{t.memos.endOfList}</p>
				)}
			</div>
		</div>
	);
}
