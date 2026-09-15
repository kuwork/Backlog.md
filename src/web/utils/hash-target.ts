/** Matches a section prefix such as "A1", "3.2", or "12" at the start of a heading. */
export const HEADING_PREFIX_ID_REGEX = /^([A-Za-z]*\d+(?:\.[A-Za-z]*\d+)*)(?=\s*[:：.、]|\s+|$)/;

function decodeHashTarget(value: string): string {
	// Decode percent-encoded anchors, e.g. <#A1: Section Title> renders as #A1:%20Section%20Title.
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * Resolve an in-document hash anchor (the part after "#") to the heading element
 * it points at. Accepts github-slugger slugs, section prefixes, and full
 * human-readable heading titles so hand-written anchors keep working.
 */
export function findHeadingByHashTarget(target: string): HTMLElement | null {
	const decodedTarget = decodeHashTarget(target);

	// Exact ID match covers github-slugger slugs and prefix ids.
	const byId = document.getElementById(decodedTarget);
	if (byId && /^h[1-6]$/i.test(byId.tagName)) return byId;

	// Fallback: human-friendly anchors using the original heading prefix or title.
	const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
	for (const heading of headings) {
		const element = heading as HTMLElement;
		if (element.getAttribute("data-heading-prefix") === decodedTarget) return element;
		if (element.getAttribute("data-heading-text") === decodedTarget) return element;
	}

	// If the anchor starts with a section prefix (e.g. "A1:"), treat it as a heading-text
	// prefix so that full-heading-title anchors written with angle brackets still resolve.
	if (HEADING_PREFIX_ID_REGEX.test(decodedTarget)) {
		let bestMatch: HTMLElement | null = null;
		let bestMatchLength = 0;
		for (const heading of headings) {
			const element = heading as HTMLElement;
			const text = element.getAttribute("data-heading-text");
			if (text?.startsWith(decodedTarget) && text.length > bestMatchLength) {
				bestMatch = element;
				bestMatchLength = text.length;
			}
		}
		if (bestMatch) return bestMatch;
	}

	return null;
}

/** Scroll a heading into view, tolerating environments without scrollIntoView. */
export function scrollToHeading(heading: HTMLElement): void {
	if (typeof heading.scrollIntoView === "function") {
		heading.scrollIntoView({ behavior: "smooth" });
	}
}

/**
 * Resolve a location hash (e.g. "#a1-section-title") and scroll its heading into
 * view. Returns false while the heading is not in the DOM yet, so callers can
 * retry once asynchronous content has rendered.
 */
export function scrollToHashTarget(hash: string): boolean {
	const target = hash.startsWith("#") ? hash.slice(1) : hash;
	if (!target) return false;
	const heading = findHeadingByHashTarget(target);
	if (!heading) return false;
	scrollToHeading(heading);
	return true;
}

/**
 * Scroll to an in-document target and reflect it in the URL. Shared by markdown
 * anchor links and the table of contents so both behave identically. Returns
 * false when no heading matches, leaving the caller free to fall back.
 */
export function activateHashTarget(target: string): boolean {
	if (!target) return false;
	const heading = findHeadingByHashTarget(target);
	if (!heading) return false;
	scrollToHeading(heading);
	if (typeof window !== "undefined") {
		const { pathname, search } = window.location;
		window.history.pushState(null, "", `${pathname}${search}#${target}`);
	}
	return true;
}
