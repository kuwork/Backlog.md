import { type RefObject, useCallback, useMemo, useState } from "react";
import { useI18n } from "../hooks/useI18n";
import { useActiveTocId, useTocItems } from "../hooks/useToc";
import { useTocTree } from "../hooks/useTocTree";
import type { TocItem } from "../utils/toc";
import TocRows from "./TocRows";

/** Stable empty so the scrollspy hook keeps the same identity while closed. */
const NO_ITEMS: TocItem[] = [];

const LIST_ICON_PATH = "M4 6h16M4 12h10M4 18h7";

/**
 * Modal outline drawer. A bookmark tab protrudes from the middle of the modal
 * panel's left edge; clicking it hides the tab and opens a floating outline
 * panel docked to the panel's left, as tall as the panel itself. The modal
 * never resizes, so the content does not jump. Closing the panel brings the
 * bookmark back. Headings are collected locally from the modal content (not
 * via TocContext, whose single slot belongs to full pages), and hidden
 * entirely when the content has none.
 */
export default function TocDrawer({
	containerRef,
	contentKey,
}: {
	containerRef: RefObject<HTMLElement | null>;
	contentKey?: unknown;
}) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const items = useTocItems(containerRef, contentKey);
	// A clicked entry stays selected until the reader scrolls; without this, a
	// target that is already on screen (or cannot scroll further) could never
	// become the active entry.
	const [pinnedId, setPinnedId] = useState<string | null>(null);
	const clearPin = useCallback(() => setPinnedId(null), []);
	const activePin = useMemo(() => ({ id: pinnedId, clear: clearPin }), [pinnedId, clearPin]);
	const activeId = useActiveTocId(isOpen ? items : NO_ITEMS, containerRef, activePin);
	const { rows, activeAncestors, isCollapsed, toggleFold, toggleAllFolds, anyCollapsed, hasFoldable, releaseFoldAll } =
		useTocTree(items, activeId);

	const handleSelect = useCallback(
		(id: string) => {
			releaseFoldAll();
			const heading = document.getElementById(id);
			if (!heading) return;
			setPinnedId(id);
			// Entries that point at a tab (references/documentation/modified files)
			// switch to that tab, not just scroll to it.
			if (heading.getAttribute("role") === "tab") heading.click();
			if (typeof heading.scrollIntoView === "function") {
				heading.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		},
		[releaseFoldAll],
	);

	if (items.length === 0) return null;

	return (
		<>
			{!isOpen && (
				<button
					type="button"
					aria-label={t.toc.title}
					title={t.toc.title}
					onClick={() => setIsOpen(true)}
					className="absolute left-0 top-1/2 z-20 flex -translate-x-full -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-md border border-r-0 border-gray-200 bg-white px-1 py-2.5 text-gray-500 shadow-md transition-colors duration-200 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
				>
					<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LIST_ICON_PATH} />
					</svg>
					<span className="text-xs font-medium [writing-mode:vertical-rl]">{t.toc.title}</span>
				</button>
			)}

			{isOpen && (
				<nav
					aria-label={t.toc.title}
					className="absolute bottom-0 left-2 top-0 z-20 flex w-72 max-w-[calc(100vw-8rem)] flex-col rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800 sm:right-full sm:left-auto sm:mr-2"
				>
					<div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							{t.toc.title}
						</p>
						<div className="flex items-center gap-1">
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
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								aria-label={t.modal.closeAria}
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xl leading-none text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
							>
								×
							</button>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto p-2">
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
		</>
	);
}
