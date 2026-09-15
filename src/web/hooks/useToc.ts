import { type RefObject, useEffect, useState } from "react";
import { collectTocItems, type TocItem, tocItemsEqual } from "../utils/toc";

/** Distance from the top of the scroll container where a heading counts as current. */
const ACTIVE_HEADING_OFFSET_PX = 96;

/**
 * Find the element that actually scrolls the given content: the nearest ancestor
 * with a scrollable overflow, or the window when the page itself scrolls.
 */
function findScrollContainer(element: HTMLElement | null): HTMLElement | Window {
	let current = element?.parentElement ?? null;
	while (current) {
		const { overflowY } = window.getComputedStyle(current);
		if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return current;
		current = current.parentElement;
	}
	return window;
}

/**
 * Collect table-of-contents entries from the rendered markdown inside
 * `containerRef`, re-collecting whenever the content mutates (async fetch,
 * re-render after save, mermaid pass).
 */
export function useTocItems(containerRef: RefObject<HTMLElement | null>, contentKey?: unknown): TocItem[] {
	const [items, setItems] = useState<TocItem[]>([]);

	useEffect(() => {
		// `contentKey` is not read: it only forces a fresh collection when the
		// rendered source changes before the observer sees the mutation.
		void contentKey;
		const root = containerRef.current;
		if (!root) {
			setItems([]);
			return;
		}

		const refresh = () => {
			const next = collectTocItems(root);
			setItems((previous) => (tocItemsEqual(previous, next) ? previous : next));
		};

		refresh();
		const observer = new window.MutationObserver(refresh);
		observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] });
		return () => observer.disconnect();
	}, [containerRef, contentKey]);

	return items;
}

/**
 * Track which entry is currently on screen, using the shallowest heading above
 * the reading position. Returns null when the outline is empty.
 */
export function useActiveTocId(items: TocItem[], containerRef: RefObject<HTMLElement | null>): string | null {
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		const root = containerRef.current;
		if (!root || items.length === 0) {
			setActiveId(null);
			return;
		}

		const scroller = findScrollContainer(root);
		let frame: number | null = null;

		const update = () => {
			frame = null;
			const containerTop = scroller === window ? 0 : (scroller as HTMLElement).getBoundingClientRect().top;
			let current = items[0]?.id ?? null;
			for (const item of items) {
				const heading = document.getElementById(item.id);
				if (!heading) continue;
				if (heading.getBoundingClientRect().top - containerTop <= ACTIVE_HEADING_OFFSET_PX) {
					current = item.id;
					continue;
				}
				break;
			}
			setActiveId((previous) => (previous === current ? previous : current));
		};

		const scheduleUpdate = () => {
			if (frame === null) frame = requestAnimationFrame(update);
		};

		scroller.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("resize", scheduleUpdate);
		update();

		return () => {
			scroller.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [items, containerRef]);

	return activeId;
}
