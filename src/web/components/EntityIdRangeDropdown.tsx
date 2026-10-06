import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stripAnyPrefix } from "../../utils/prefix-config";
import { type EntityKind, type EntityRangeEntry, entityHref } from "../utils/task-id-links";

/**
 * Reads the active theme from `<html class="dark">` — the global theme signal every
 * surface paints from. Unlike the React ThemeContext, this is always available, even
 * inside portalled popovers rendered from views that do not mount a ThemeProvider
 * (e.g. task detail modals). Tracks live class changes so toggling the theme re-colours
 * an open dropdown.
 */
function useIsDark(): boolean {
	const [isDark, setIsDark] = useState(() =>
		typeof document === "undefined" ? false : document.documentElement.classList.contains("dark"),
	);
	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const sync = () => setIsDark(root.classList.contains("dark"));
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);
	return isDark;
}

/** Gap kept between the popover and the viewport edge when clamping. */
const EDGE_MARGIN = 8;

interface Props {
	kind: EntityKind;
	token: string;
	entries: EntityRangeEntry[];
	onTaskClick?: (taskId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDraftClick?: (draftId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDocClick?: (docId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	onDecisionClick?: (decisionId: string, range?: { lineStart?: number; lineEnd?: number }) => void;
	/** Returns false when navigation should be aborted (e.g. unsaved edits). Defaults to allowing. */
	confirmNavigation?: () => boolean;
	className?: string;
}

interface Coords {
	top: number;
	left: number;
	/** Minimum width — a sane floor, not tied to the trigger (the trigger may be mid-line). */
	width: number;
	/** Maximum width — the full room available on the longer side of the trigger. */
	maxWidth: number;
	triggerTop: number;
	/** Trigger width, so the clamp pass can flip the menu to the trigger's left edge. */
	triggerWidth: number;
}

/**
 * Renders a multi-ID token (range or slash-list, e.g. `BACK-715~747`) as a single
 * clickable trigger. Clicking opens a scrollable dropdown that lists each resolved
 * entity as a navigable link; the entry count is unrestricted (a 33-item range stays
 * usable). The popover is portalled to `document.body` with `position: fixed` and a
 * high z-index so it is never clipped by the markdown container's overflow or stacked
 * under sibling surfaces. Keyboard-accessible (Arrow/Enter/Esc, outside-click closes).
 * Width is flexible: it fills the available horizontal space when the window is wide,
 * and only clamps to stay inside the viewport (shifting left / flipping up) when cramped.
 * Every entry navigates within the current view (SPA when a handler exists, otherwise a
 * same-tab, same-origin route navigation) — it never opens a new tab.
 */
export default function EntityIdRangeDropdown({
	kind,
	token,
	entries,
	onTaskClick,
	onDraftClick,
	onDocClick,
	onDecisionClick,
	confirmNavigation,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const [coords, setCoords] = useState<Coords | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const popoverRef = useRef<HTMLDivElement | null>(null);
	const confirm = confirmNavigation ?? (() => true);

	// Theme is read from the document root's `.dark` class — the single source of truth
	// shared by every surface (memo cards, task modals, docs), including portalled
	// popovers. The React ThemeContext is not mounted on every surface, so reading the
	// DOM class keeps the palette correct everywhere instead of falling back to light.
	const isDark = useIsDark();
	const popoverClass = `entity-id-range-popover absolute z-[9999] max-h-64 overflow-y-auto rounded-lg border p-1 ${
		isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
	}`;
	const rowClass = (activeRow: boolean) =>
		`block rounded-md px-2.5 py-1.5 text-[13px] no-underline ${
			activeRow
				? isDark
					? "bg-gray-700 text-gray-100"
					: "bg-gray-100 text-gray-900"
				: isDark
					? "text-gray-100 hover:bg-gray-700"
					: "text-gray-900 hover:bg-gray-100"
		}`;

	const place = useCallback(() => {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (!rect) return;
		// Let the popover size to its own content, but give it the full width of the row rather
		// than only the little space to the right of the trigger: a token near the right edge
		// would otherwise squeeze the menu into a sliver. The max spans the larger side, and the
		// post-render clamp pass flips the menu open to the left when there is more room there.
		const minWidth = 200;
		const roomRight = window.innerWidth - rect.left - EDGE_MARGIN;
		const roomLeft = rect.right - EDGE_MARGIN;
		const maxWidth = Math.max(minWidth, Math.min(window.innerWidth - 2 * EDGE_MARGIN, Math.max(roomRight, roomLeft)));
		setCoords({
			top: rect.bottom + 4,
			left: rect.left,
			width: minWidth,
			maxWidth,
			triggerTop: rect.top,
			triggerWidth: rect.width,
		});
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		place();
	}, [open, place]);

	// Once the popover is rendered, keep it inside the viewport. When it would overflow the
	// right edge, first try opening it to the left of the trigger (there is more room there
	// near the right margin); only clamp against the right edge if the left side is not wide
	// enough either. Flip above the trigger when it would overflow the bottom.
	useLayoutEffect(() => {
		if (!open || !coords) return;
		const pop = popoverRef.current;
		if (!pop) return;
		const rect = pop.getBoundingClientRect();
		const margin = EDGE_MARGIN;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let { top, left } = coords;
		if (left + rect.width > vw - margin) {
			const flippedLeft = left - rect.width - coords.triggerWidth;
			if (flippedLeft >= margin) {
				left = flippedLeft;
			} else {
				left = Math.max(margin, vw - margin - rect.width);
			}
		}
		if (left < margin) left = margin;
		if (top + rect.height > vh - margin) {
			top = coords.triggerTop - rect.height - 4;
			if (top < margin) top = margin;
		}
		if (top !== coords.top || left !== coords.left) {
			setCoords((c) => (c ? { ...c, top, left } : c));
		}
	}, [open, coords]);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: globalThis.MouseEvent) => {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if (popoverRef.current?.contains(target)) return;
			setOpen(false);
		};
		// Close on resize only: a fixed-position menu no longer tracks its trigger after a reflow.
		// Deliberately NOT on scroll — the menu is portalled to <body>, so a wheel event over the
		// menu targets the page and would otherwise close it the instant the user scrolls the list.
		const onResize = () => setOpen(false);
		document.addEventListener("mousedown", onPointerDown);
		window.addEventListener("resize", onResize);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			window.removeEventListener("resize", onResize);
		};
	}, [open]);

	const handlerFor = (entry: EntityRangeEntry): ((id: string) => void) | null => {
		const body = stripAnyPrefix(entry.id);
		if (kind === "task" && onTaskClick) return () => onTaskClick(body);
		if (kind === "draft" && onDraftClick) return () => onDraftClick(body);
		if (kind === "doc" && onDocClick) return () => onDocClick(body);
		if (kind === "decision" && onDecisionClick) return () => onDecisionClick(body);
		return null;
	};

	const activate = (entry: EntityRangeEntry) => {
		const handler = handlerFor(entry);
		if (!handler) return;
		if (!confirm()) {
			setOpen(false);
			return;
		}
		handler(stripAnyPrefix(entry.id));
		setOpen(false);
	};

	const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			setActive(0);
			setOpen(true);
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	};

	const onListKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((i) => Math.min(i + 1, entries.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			const entry = entries[active];
			if (entry) activate(entry);
		} else if (event.key === "Escape") {
			event.preventDefault();
			setOpen(false);
		}
	};

	const combinedClassName = ["text-blue-600 dark:text-blue-400 hover:underline cursor-pointer", className]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className={combinedClassName}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => {
					setActive(0);
					setOpen((o) => !o);
				}}
				onKeyDown={onTriggerKeyDown}
			>
				{token}
			</button>
			{open && coords
				? createPortal(
						<div
							ref={popoverRef}
							role="menu"
							className={popoverClass}
							style={{
								top: coords.top,
								left: coords.left,
								minWidth: coords.width,
								maxWidth: coords.maxWidth,
								width: "auto",
							}}
						>
							{entries.map((entry, index) => (
								<a
									key={entry.id}
									role="menuitem"
									href={entityHref(kind, entry.id)}
									onKeyDown={onListKeyDown}
									onMouseEnter={() => setActive(index)}
									onClick={(event: MouseEvent<HTMLAnchorElement>) => {
										const handler = handlerFor(entry);
										if (handler) {
											// In-app handler available: navigate inside the current view (SPA).
											event.preventDefault();
											activate(entry);
											return;
										}
										// No in-app handler: let the anchor perform its native same-tab,
										// same-origin navigation to the route. Never open a new tab.
									}}
									className={rowClass(index === active)}
								>
									<span className="font-semibold whitespace-nowrap">{entry.id}</span>
									{entry.title ? <span className="opacity-70"> · {entry.title}</span> : null}
								</a>
							))}
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
