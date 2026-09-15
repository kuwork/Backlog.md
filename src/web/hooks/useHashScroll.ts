import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToHashTarget } from "../utils/hash-target";

/**
 * How long to keep watching for the target heading before giving up. Content
 * arrives asynchronously (data fetch, markdown render, mermaid), so the heading
 * is rarely in the DOM at the moment the route first renders.
 */
const HASH_SCROLL_TIMEOUT_MS = 3000;

/**
 * Scroll to the heading referenced by the current location hash.
 *
 * Clicking an in-document link already handles this from the renderer. This hook
 * covers the case where the hash is present before the content exists, such as
 * reopening a link, sharing a URL, or a hard reload.
 */
export function useHashScroll(): void {
	const { hash } = useLocation();

	useEffect(() => {
		if (hash.length < 2) return;

		let observer: MutationObserver | null = null;
		let timer: ReturnType<typeof setTimeout> | null = null;

		const stop = () => {
			observer?.disconnect();
			observer = null;
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		};

		if (scrollToHashTarget(hash)) return;

		observer = new window.MutationObserver(() => {
			if (scrollToHashTarget(hash)) stop();
		});
		timer = setTimeout(stop, HASH_SCROLL_TIMEOUT_MS);
		observer.observe(document.body, { childList: true, subtree: true });

		return stop;
	}, [hash]);
}
