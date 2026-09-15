import { type RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTocRegistry } from "../contexts/TocContext";
import { useI18n } from "../hooks/useI18n";
import { useActiveTocId } from "../hooks/useToc";
import { activateHashTarget } from "../utils/hash-target";
import { buildTocTree, flattenTocTree, type TocNode, tocAncestorIds, type TocItem, type TocRow } from "../utils/toc";

/** Stable empties so the scrollspy hooks keep the same identity while closed. */
const NO_ITEMS: TocItem[] = [];
const NO_CONTAINER: RefObject<HTMLElement | null> = { current: null };

const LIST_ICON_PATH = "M4 6h16M4 12h10M4 18h7";
const CHEVRON_ICON_PATH = "M9 5l7 7-7 7";

/**
 * Outlines longer than this start with their deeper levels folded, so a
 * document with dozens of headings does not open as one long wall of entries.
 * Shallower entries stay open, keeping the first two levels visible.
 */
const LONG_OUTLINE_THRESHOLD = 20;

/** Depth at which a long outline folds: entries nested under the top level. */
const DEFAULT_COLLAPSED_DEPTH = 2;

function TocRows({
	rows,
	activeId,
	activeAncestors,
	isCollapsed,
	onSelect,
	onToggle,
}: {
	rows: TocRow[];
	activeId: string | null;
	activeAncestors: Set<string>;
	isCollapsed: (id: string) => boolean;
	onSelect: (id: string) => void;
	onToggle: (id: string) => void;
}) {
	const { t } = useI18n();

	return (
		<ul className="space-y-0.5">
			{rows.map(({ item, hasChildren }) => {
				const isActive = item.id === activeId;
				const isFolded = hasChildren && isCollapsed(item.id);
				// A folded branch holding the current section still gets the accent,
				// so the reader can tell where they are without opening everything.
				const holdsActive = !isActive && activeAncestors.has(item.id);
				return (
					<li key={item.id} data-toc-level={item.level} style={{ paddingLeft: 12 + (item.level - 1) * 12 }}>
						<div className="flex items-stretch">
							{hasChildren ? (
								<button
									type="button"
									aria-expanded={!isFolded}
									aria-label={`${isFolded ? t.toc.expand : t.toc.collapse} — ${item.text}`}
									onClick={() => onToggle(item.id)}
									className="flex w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors duration-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:text-gray-500 dark:hover:text-gray-200"
								>
									<svg
										className={`h-3.5 w-3.5 transition-transform duration-200 ${isFolded ? "" : "rotate-90"}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={CHEVRON_ICON_PATH} />
									</svg>
								</button>
							) : (
								<span className="w-5 shrink-0" aria-hidden="true" />
							)}
							<a
								href={`#${item.id}`}
								aria-current={isActive ? "true" : undefined}
								title={item.text}
								onClick={(event) => {
									event.preventDefault();
									onSelect(item.id);
								}}
								className={`block min-w-0 flex-1 truncate border-l-2 py-1 pr-2 text-sm transition-colors duration-200 ${
									isActive
										? "border-blue-500 font-medium text-blue-600 dark:border-blue-400 dark:text-blue-400"
										: holdsActive
											? "border-transparent text-blue-600 dark:text-blue-400"
											: "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
								}`}
							>
								{item.text}
							</a>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * Header outline trigger, sitting next to the theme toggle. It only appears on
 * read-only pages that published headings, and opens the outline as a floating
 * panel over the content instead of taking a permanent column next to it.
 *
 * Entries nest by heading level and every entry that owns a subtree can be
 * folded away, which keeps long documents navigable.
 */
export default function TocButton() {
	const { t } = useI18n();
	const { registration } = useTocRegistry();
	const { items, containerRef } = registration;
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	/**
	 * Set while the reader asked for the whole outline to be folded. The
	 * scrollspy then follows the page without unfolding the current branch
	 * again, which would otherwise undo the instruction on the next scroll.
	 * Any other outline interaction hands control back to the scrollspy.
	 */
	const foldAllRef = useRef(false);

	// The scrollspy only has to follow the page while the panel is visible.
	const activeId = useActiveTocId(isOpen ? items : NO_ITEMS, containerRef ?? NO_CONTAINER);

	const tree = useMemo(() => buildTocTree(items), [items]);
	// Fold overrides are kept per entry id; everything else falls back to the
	// default for the current outline length.
	const [foldedOverrides, setFoldedOverrides] = useState<Map<string, boolean>>(() => new Map());

	const nodesById = useMemo(() => {
		const index = new Map<string, TocNode>();
		const walk = (list: TocNode[]) => {
			for (const node of list) {
				index.set(node.id, node);
				walk(node.children);
			}
		};
		walk(tree);
		return index;
	}, [tree]);

	const isLongOutline = items.length > LONG_OUTLINE_THRESHOLD;

	const defaultFolded = useCallback(
		(id: string) => {
			const node = nodesById.get(id);
			if (!node || node.children.length === 0) return false;
			return isLongOutline && node.level >= DEFAULT_COLLAPSED_DEPTH;
		},
		[nodesById, isLongOutline],
	);

	const isCollapsed = useCallback(
		(id: string) => foldedOverrides.get(id) ?? defaultFolded(id),
		[foldedOverrides, defaultFolded],
	);

	const rows = useMemo(() => flattenTocTree(tree, isCollapsed), [tree, isCollapsed]);

	const activeAncestors = useMemo(
		() => new Set(activeId ? tocAncestorIds(tree, activeId) : []),
		[tree, activeId],
	);

	/** Entries owning a subtree, i.e. everything the master control can fold. */
	const foldableIds = useMemo(
		() =>
			[...nodesById.values()]
				.filter((node) => node.children.length > 0)
				.map((node) => node.id),
		[nodesById],
	);

	/** Whether any branch is folded right now, which decides the master control. */
	const anyCollapsed = foldableIds.some((id) => isCollapsed(id));

	// A new document starts from the defaults again.
	useEffect(() => {
		foldAllRef.current = false;
		setFoldedOverrides(new Map());
	}, [items]);

	// The current section must stay reachable: open its branch back up whenever
	// the reading position moves into a folded subtree, unless the reader folded
	// the whole outline on purpose.
	useEffect(() => {
		if (foldAllRef.current) return;
		if (activeAncestors.size === 0) return;
		setFoldedOverrides((previous) => {
			const isFoldedSomewhere = [...activeAncestors].some((id) => previous.get(id) ?? defaultFolded(id));
			if (!isFoldedSomewhere) return previous;
			const next = new Map(previous);
			for (const id of activeAncestors) next.set(id, false);
			return next;
		});
	}, [activeAncestors, defaultFolded]);

	const handleToggle = useCallback(
		(id: string) => {
			foldAllRef.current = false;
			setFoldedOverrides((previous) => {
				const next = new Map(previous);
				next.set(id, !(previous.get(id) ?? defaultFolded(id)));
				return next;
			});
		},
		[defaultFolded],
	);

	/**
	 * Master control: an outline with something folded unfolds completely, an
	 * outline that is fully open folds back to its top level.
	 */
	const handleToggleAll = useCallback(() => {
		const willFoldEverything = !anyCollapsed;
		foldAllRef.current = willFoldEverything;
		setFoldedOverrides((previous) => {
			const next = new Map(previous);
			for (const id of foldableIds) next.set(id, willFoldEverything);
			return next;
		});
	}, [anyCollapsed, foldableIds]);

	const handleSelect = useCallback((id: string) => {
		foldAllRef.current = false;
		activateHashTarget(id);
		setIsOpen(false);
	}, []);

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
						{foldableIds.length > 0 && (
							<button
								type="button"
								onClick={handleToggleAll}
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
							onToggle={handleToggle}
						/>
					</div>
				</nav>
			)}
		</div>
	);
}
