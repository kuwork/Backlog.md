import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Memo } from "../../core/memos.ts";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { parseStoredUtcDate, storedUtcHoverTitle } from "../utils/date-display";
import { extractInlineTags, toggleTaskInMarkdown } from "../utils/memos";
import { encodeWikiPath } from "../utils/urlHelpers";
import MermaidMarkdown from "./MermaidMarkdown";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";

export function ErrorBanner({
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
export function formatDayLabel(day: string, locale: string): string {
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

export interface MemoCardProps {
	memo: Memo;
	onUpdate: (id: string, content: string, tags: string[]) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	/** Move the memo to the archive folder; the owner reloads the feed. */
	onArchive: (id: string) => Promise<void>;
	/** Toggle the feed's tag filter - the body's `#tag` chips and the card's tag row share it. */
	onTagClick: (tag: string) => void;
}

/** One memo in the feed: relative date, markdown body, read-only tags, inline edit/delete. */
export function MemoCard({ memo, onUpdate, onDelete, onArchive, onTagClick }: MemoCardProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(memo.rawContent);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);
	const [error, setError] = useState<{ title: string; detail: string | null } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [idCopied, setIdCopied] = useState(false);
	const busy = isSaving || isDeleting || isArchiving;
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
	 * Archiving moves the file rather than destroying it, so unlike delete it asks nothing: the
	 * note leaves the feed and the move is reversible. Only a failed call has to be reported.
	 */
	const handleArchive = async () => {
		if (busy) return;
		setIsArchiving(true);
		setError(null);
		try {
			await onArchive(memo.id);
		} catch (err) {
			setError({ title: t.memos.archiveFailed, detail: err instanceof Error ? err.message : null });
		} finally {
			setIsArchiving(false);
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

	/**
	 * Copies the memo id. The transient "copied" label lives on the menu item itself, so the
	 * menu stays open for a beat and then closes once the confirmation has been seen.
	 */
	const handleCopyId = async () => {
		try {
			await navigator.clipboard.writeText(memo.id);
		} catch {
			// The Clipboard API needs a secure context; fall back to a hidden textarea.
			const textarea = document.createElement("textarea");
			textarea.value = memo.id;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand("copy");
			textarea.remove();
		}
		setIdCopied(true);
	};

	useEffect(() => {
		if (!idCopied) return;
		const timer = setTimeout(() => {
			setIdCopied(false);
			setMenuOpen(false);
		}, 1200);
		return () => clearTimeout(timer);
	}, [idCopied]);

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
									onClick={() => void handleCopyId()}
									className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								>
									{idCopied ? t.memos.copied : t.memos.copyId}
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setMenuOpen(false);
										void handleArchive();
									}}
									className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								>
									{t.memos.archive}
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
						onTaskClick={(taskId) => navigate(`/task/${taskId}`, { state: { backgroundLocation: location } })}
						onDraftClick={(draftId) => navigate(`/draft/${draftId}`, { state: { backgroundLocation: location } })}
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
