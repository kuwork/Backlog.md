import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTocTree, flattenTocTree, type TocItem, type TocNode, tocAncestorIds } from "../utils/toc";

/**
 * Outlines longer than this start with their deeper levels folded, so a
 * document with dozens of headings does not open as one long wall of entries.
 * Shallower entries stay open, keeping the first two levels visible.
 */
const LONG_OUTLINE_THRESHOLD = 20;

/** Depth at which a long outline folds: entries nested under the top level. */
const DEFAULT_COLLAPSED_DEPTH = 2;

/**
 * Shared folding state for outline viewers (the header TocButton and the modal
 * TocDrawer): nesting, default folding for long outlines, scrollspy-driven
 * unfolding of the active branch, and the fold/unfold-all master control.
 */
export function useTocTree(items: TocItem[], activeId: string | null) {
	/**
	 * Set while the reader asked for the whole outline to be folded. The
	 * scrollspy then follows the page without unfolding the current branch
	 * again, which would otherwise undo the instruction on the next scroll.
	 * Any other outline interaction hands control back to the scrollspy.
	 */
	const foldAllRef = useRef(false);

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

	const activeAncestors = useMemo(() => new Set(activeId ? tocAncestorIds(tree, activeId) : []), [tree, activeId]);

	/** Entries owning a subtree, i.e. everything the master control can fold. */
	const foldableIds = useMemo(
		() => [...nodesById.values()].filter((node) => node.children.length > 0).map((node) => node.id),
		[nodesById],
	);

	/** Whether any branch is folded right now, which decides the master control. */
	const anyCollapsed = foldableIds.some((id) => isCollapsed(id));

	// A new document starts from the defaults again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped
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

	const toggleFold = useCallback(
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
	const toggleAllFolds = useCallback(() => {
		const willFoldEverything = !anyCollapsed;
		foldAllRef.current = willFoldEverything;
		setFoldedOverrides((previous) => {
			const next = new Map(previous);
			for (const id of foldableIds) next.set(id, willFoldEverything);
			return next;
		});
	}, [anyCollapsed, foldableIds]);

	/** Hand fold control back to the scrollspy, e.g. after jumping to a heading. */
	const releaseFoldAll = useCallback(() => {
		foldAllRef.current = false;
	}, []);

	return {
		rows,
		activeAncestors,
		isCollapsed,
		toggleFold,
		toggleAllFolds,
		anyCollapsed,
		hasFoldable: foldableIds.length > 0,
		releaseFoldAll,
	};
}
