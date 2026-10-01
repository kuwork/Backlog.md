import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Memo } from "../../core/memos.ts";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient } from "../lib/api";
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
} from "../utils/memos";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import { encodeWikiPath } from "../utils/urlHelpers";
import MermaidMarkdown from "./MermaidMarkdown";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import StoredDate from "./StoredDate";

/**
 * The two faces of this page. Only the feed is rendered today: the calendar mode is the next
 * increment, but `view` and `selectedDate` already live here so it can slot in without a rewrite.
 */
export type MemosView = "feed" | "calendar";

/**
 * The technical half of a failure: every banner keeps its localized headline and shows this beside
 * it when the server said anything, so a failed write never reads as a generic message.
 */
function errorDetail(error: unknown): string | null {
	return error instanceof Error && error.message ? error.message : null;
}

/** A localized headline, or the server's message when it said anything useful. */
function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}

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

interface MemoCardProps {
	memo: Memo;
	onUpdate: (id: string, content: string, tags: string[]) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

/** One memo in the feed: stored date, markdown body through the shared renderer, read-only tags. */
export function MemoCard({ memo, onUpdate, onDelete }: MemoCardProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(memo.rawContent);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<{ title: string; detail: string | null } | null>(null);
	const busy = isSaving || isDeleting;

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
			setError({ title: t.memos.updateFailed, detail: errorDetail(err) });
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
			setError({ title: t.memos.deleteFailed, detail: errorDetail(err) });
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<article
			data-testid="memo-card"
			data-memo-id={memo.id}
			className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4 transition-colors duration-200"
		>
			<div className="flex items-center justify-between gap-3 mb-2">
				<StoredDate value={memo.createdDate} className="text-xs text-gray-500 dark:text-gray-400" />
				{!isEditing && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleStartEdit}
							disabled={busy}
							aria-label={t.memos.editMemo}
							className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							{t.common.edit}
						</button>
						<button
							type="button"
							onClick={() => void handleDelete()}
							disabled={busy}
							aria-label={t.memos.confirmDelete}
							className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
						>
							{isDeleting ? t.common.removing : t.common.delete}
						</button>
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
				<div className="prose prose-sm !max-w-none w-full" data-color-mode={theme}>
					<MermaidMarkdown
						source={memo.rawContent}
						wikilinkBasePath="index.md"
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

			{memo.tags.length > 0 && (
				<div className="flex flex-wrap gap-1.5 mt-3">
					{memo.tags.map((tag) => (
						<span
							key={tag}
							data-testid="memo-tag"
							className="px-2 py-0.5 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
						>
							#{tag}
						</span>
					))}
				</div>
			)}

			{error && <ErrorBanner title={error.title} detail={error.detail} />}
		</article>
	);
}

function viewFromParam(value: string | null): MemosView {
	return value === "calendar" ? "calendar" : "feed";
}

export default function MemosPage() {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [searchParams, setSearchParams] = useSearchParams();
	const viewParam = searchParams.get("view");
	const dateParam = searchParams.get("date");

	const [view, setView] = useState<MemosView>(() => viewFromParam(viewParam));
	const [selectedDate, setSelectedDate] = useState<string | null>(() => dateParam || null);
	const [activeTags, setActiveTags] = useState<string[]>([]);

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

	useEffect(() => {
		cursorRef.current = feed.nextCursor;
	}, [feed.nextCursor]);

	// Deep links win: `/memos?view=calendar` (and `?date=YYYY-MM-DD`, which global search emits for
	// memo hits) drive the mode and the day filter from the outside as well as from the toggle.
	useEffect(() => {
		setView((current) => {
			const next = viewFromParam(viewParam);
			return current === next ? current : next;
		});
	}, [viewParam]);

	useEffect(() => {
		setSelectedDate((current) => {
			const next = dateParam || null;
			return current === next ? current : next;
		});
	}, [dateParam]);

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
				setLoadError(errorMessage(error, t.memos.loadFailed));
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
			if (requestId === feedRequestRef.current) setAppendError(errorMessage(error, t.memos.loadMoreFailed));
		} finally {
			loadingMoreRef.current = false;
			if (requestId === feedRequestRef.current) setLoadingMore(false);
		}
	}, [selectedDate, t.memos.loadMoreFailed]);

	const hasMore = feed.nextCursor !== null;

	// The page itself does not scroll - <main> does - so the viewport root is the right observer
	// root, and the margin starts the next fetch before the sentinel is actually on screen.
	useEffect(() => {
		if (view !== "feed" || initialLoading || loadingMore || !hasMore) return;
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
	}, [view, initialLoading, loadingMore, hasMore, loadMore]);

	const toggleTag = (tag: string) => {
		setActiveTags((current) =>
			current.some((item) => item.toLowerCase() === tag.toLowerCase())
				? current.filter((item) => item.toLowerCase() !== tag.toLowerCase())
				: [...current, tag],
		);
	};

	const selectView = useCallback(
		(next: MemosView) => {
			setView(next);
			const nextParams = new URLSearchParams(searchParams);
			if (next === "calendar") nextParams.set("view", "calendar");
			else nextParams.delete("view");
			setSearchParams(nextParams, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	const clearSelectedDate = useCallback(() => {
		setSelectedDate(null);
		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("date");
		setSearchParams(nextParams, { replace: true });
	}, [searchParams, setSearchParams]);

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
			const memo = await apiClient.createMemo(saveContent, extractInlineTags(saveContent));
			// Feed first, then clear: a failed clear would leave the note visible twice.
			if (memoMatchesFilters(memo, selectedDate, activeTags)) {
				setFeed((current) => prependMemo(current, memo));
			}
			setDraft("");
		} catch (error) {
			setComposerError(errorDetail(error));
		} finally {
			setIsSaving(false);
		}
	}, [activeTags, draft, isSaving, selectedDate]);

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

	const handleDelete = useCallback(async (id: string) => {
		await apiClient.deleteMemo(id);
		setFeed((current) => removeMemo(current, id));
	}, []);

	const visibleMemos = useMemo(() => filterMemosByTags(feed.memos, activeTags), [feed.memos, activeTags]);
	const availableTags = useMemo(() => collectMemoTags(feed.memos), [feed.memos]);

	return (
		<div className="page-shell transition-colors duration-200">
			<div className="mx-auto max-w-3xl flex flex-col gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.memos.title}</h1>
					<div
						role="tablist"
						aria-label={t.memos.title}
						className="mt-3 inline-flex rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5"
					>
						{(["feed", "calendar"] as MemosView[]).map((option) => (
							<button
								key={option}
								type="button"
								role="tab"
								aria-selected={view === option}
								onClick={() => selectView(option)}
								className={`px-3 py-1.5 text-sm rounded transition-colors ${
									view === option
										? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium shadow-sm"
										: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
								}`}
							>
								{option === "feed" ? t.memos.feed : t.memos.calendar}
							</button>
						))}
					</div>
				</div>

				{/* The capture box stays mounted in both modes: any view has to accept a new note. */}
				<section
					aria-label={t.memos.composerPlaceholder}
					className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3"
				>
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
						<button
							type="button"
							onClick={() => void handleCapture()}
							disabled={isSaving || draft.trim().length === 0}
							className="shrink-0 px-3 py-1.5 text-sm rounded bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isSaving ? t.common.saving : t.common.save}
						</button>
					</div>
				</section>

				{composerError && <ErrorBanner title={t.memos.saveFailed} detail={composerError} />}

				{view === "calendar" ? (
					<section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-6 text-sm text-gray-600 dark:text-gray-300">
						{t.memos.calendarPlaceholder}
					</section>
				) : (
					<>
						{(selectedDate || availableTags.length > 0) && (
							<div className="flex flex-wrap items-center gap-2">
								{selectedDate && (
									<span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
										<span>{selectedDate}</span>
										<button
											type="button"
											onClick={clearSelectedDate}
											aria-label={t.memos.clearDate}
											className="hover:text-blue-900 dark:hover:text-blue-100"
										>
											✕
										</button>
									</span>
								)}
								{availableTags.map((tag) => {
									const isActive = activeTags.some((item) => item.toLowerCase() === tag.toLowerCase());
									return (
										<button
											key={tag}
											type="button"
											onClick={() => toggleTag(tag)}
											aria-pressed={isActive}
											className={`px-2 py-1 text-xs rounded-full border transition-colors ${
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
										className="px-2 py-1 text-xs rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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
							<ErrorBanner
								title={t.memos.loadFailed}
								detail={loadError}
								onRetry={() => void loadFirstPage(selectedDate)}
							/>
						) : visibleMemos.length === 0 ? (
							<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
								{feed.memos.length === 0 ? t.memos.empty : t.memos.emptyFiltered}
							</p>
						) : (
							<div className="flex flex-col gap-3">
								{visibleMemos.map((memo) => (
									<MemoCard key={memo.id} memo={memo} onUpdate={handleUpdate} onDelete={handleDelete} />
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
					</>
				)}
			</div>
		</div>
	);
}
