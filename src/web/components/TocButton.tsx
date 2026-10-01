import { type RefObject, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTocRegistry } from "../contexts/TocContext";
import { useI18n } from "../hooks/useI18n";
import { useActiveTocId } from "../hooks/useToc";
import { useTocTree } from "../hooks/useTocTree";
import { activateHashTarget } from "../utils/hash-target";
import type { TocItem } from "../utils/toc";
import TocRows from "./TocRows";

/** Stable empties so the scrollspy hooks keep the same identity while closed. */
const NO_ITEMS: TocItem[] = [];
const NO_CONTAINER: RefObject<HTMLElement | null> = { current: null };

const LIST_ICON_PATH = "M4 6h16M4 12h10M4 18h7";

/**
 * Header outline trigger, sitting next to the theme toggle. It only appears on
 * read-only pages that published headings, and opens the outline as a floating
 * panel over the content instead of taking a permanent column next to it.
 */
export default function TocButton() {
	const { t } = useI18n();
	const { registration } = useTocRegistry();
	const { items, containerRef } = registration;
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	// The scrollspy only has to follow the page while the panel is visible.
	const activeId = useActiveTocId(isOpen ? items : NO_ITEMS, containerRef ?? NO_CONTAINER);

	const { rows, activeAncestors, isCollapsed, toggleFold, toggleAllFolds, anyCollapsed, hasFoldable, releaseFoldAll } =
		useTocTree(items, activeId);

	const handleSelect = useCallback(
		(id: string) => {
			releaseFoldAll();
			activateHashTarget(id);
			setIsOpen(false);
		},
		[releaseFoldAll],
	);

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: MouseEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsOpen(false);
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	if (items.length === 0) return null;

	return (
		<div ref={wrapperRef} className="relative">
			<button
				type="button"
				aria-label={t.toc.title}
				aria-haspopup="true"
				aria-expanded={isOpen}
				aria-controls={panelId}
				title={t.toc.title}
				onClick={() => setIsOpen((open) => !open)}
				className={`p-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 dark:focus:ring-stone-400 dark:focus:ring-offset-gray-900 ${
					isOpen ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"
				}`}
			>
				<svg
					className="w-5 h-5 text-gray-600 dark:text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LIST_ICON_PATH} />
				</svg>
			</button>

			{isOpen && (
				<nav
					id={panelId}
					aria-label={t.toc.title}
					className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
				>
					<div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							{t.toc.title}
						</p>
						{hasFoldable && (
							<button
								type="button"
								onClick={toggleAllFolds}
								title={anyCollapsed ? t.toc.expandAll : t.toc.collapseAll}
								className="shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
							>
								{anyCollapsed ? t.toc.expandAll : t.toc.collapseAll}
							</button>
						)}
					</div>
					<div className="max-h-[70vh] overflow-y-auto p-2">
						<TocRows
							rows={rows}
							activeId={activeId}
							activeAncestors={activeAncestors}
							isCollapsed={isCollapsed}
							onSelect={handleSelect}
							onToggle={toggleFold}
						/>
					</div>
				</nav>
			)}
		</div>
	);
}
