import { type RefObject, useEffect, useRef, useState } from "react";
import { collectSectionedTocItems, type TocItem, tocItemsEqual } from "../utils/toc";

/** Distance from the top of the scroll container where a heading counts as current. */
const ACTIVE_HEADING_OFFSET_PX = 96;

/**
 * Find the element that actually scrolls the given content: the content itself
 * when it is scrollable (modal bodies scroll their own container), otherwise the
 * nearest scrollable ancestor, or the window when the page itself scrolls.
 */
function findScrollContainer(element: HTMLElement | null): HTMLElement | Window {
	let current = element ?? null;
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
			const next = collectSectionedTocItems(root);
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
 * A clicked outline entry the scrollspy must honor until the reader actually
 * scrolls. Needed when the target cannot move — the scroller is already at its
 * end, so no scroll event fires and position rules alone would never select it.
 */
export interface TocActivePin {
	id: string | null;
	clear: () => void;
}

/**
 * Track which entry is currently on screen, using the shallowest heading above
 * the reading position. Returns null when the outline is empty. While `pin` is
 * set it wins over every position rule; the first real scroll event clears it.
 */
export function useActiveTocId(
	items: TocItem[],
	containerRef: RefObject<HTMLElement | null>,
	pin?: TocActivePin,
): string | null {
	const [activeId, setActiveId] = useState<string | null>(null);
	const pinRef = useRef(pin);
	pinRef.current = pin;
	const pinnedId = pin?.id ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: pinnedId intentionally re-runs the effect so a new pin is applied immediately
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
				// Inactive tabs share the active tab's position and are not visible;
				// only the selected one may own the reading position.
				if (heading.getAttribute("role") === "tab" && heading.getAttribute("aria-selected") !== "true") continue;
				if (heading.getBoundingClientRect().top - containerTop <= ACTIVE_HEADING_OFFSET_PX) {
					current = item.id;
					continue;
				}
				break;
			}
			// A scroller that reached its end can never pull the last entry across
			// the reading line, so the last rendered entry takes over as current.
			const scrollerElement = scroller === window ? document.documentElement : (scroller as HTMLElement);
			const scrollTop = scroller === window ? window.scrollY : scrollerElement.scrollTop;
			const { scrollHeight, clientHeight } = scrollerElement;
			if (scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 8) {
				for (let index = items.length - 1; index >= 0; index -= 1) {
					const item = items[index];
					const heading = item ? document.getElementById(item.id) : null;
					if (!item || !heading) continue;
					if (heading.getAttribute("role") === "tab" && heading.getAttribute("aria-selected") !== "true") continue;
					current = item.id;
					break;
				}
			}
			const pinnedId = pinRef.current?.id;
			if (pinnedId && document.getElementById(pinnedId)) current = pinnedId;
			setActiveId((previous) => (previous === current ? previous : current));
		};
		const scheduleUpdate = () => {
			if (frame === null) frame = requestAnimationFrame(update);
		};

		const handleScroll = () => {
			pinRef.current?.clear();
			scheduleUpdate();
		};

		scroller.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("resize", scheduleUpdate);
		update();

		return () => {
			scroller.removeEventListener("scroll", handleScroll);
			window.removeEventListener("resize", scheduleUpdate);
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [items, containerRef, pinnedId]);

	return activeId;
}
