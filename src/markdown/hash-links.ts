import Slugger from "github-slugger";
import type { Heading, Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";

const HEADING_PREFIX_ID_REGEX = /^([A-Za-z]*\d+(?:\.[A-Za-z]*\d+)*)(?=\s*[:：.、]|\s+|$)/;

interface HeadingInfo {
	text: string;
	prefix: string | null;
	slug: string;
}

function extractText(node: unknown): string {
	if (typeof node !== "object" || node === null) return "";
	const n = node as { type?: string; value?: string; children?: unknown[] };
	if (n.type === "text" || n.type === "inlineCode") return n.value ?? "";
	if (Array.isArray(n.children)) return n.children.map(extractText).join("");
	return "";
}

function extractHeadingText(heading: Heading): string {
	return heading.children.map(extractText).join("");
}

function extractPrefix(text: string): string | null {
	const match = HEADING_PREFIX_ID_REGEX.exec(text);
	return match?.[1] ?? null;
}

function findHeadingForAnchor(anchor: string, linkText: string, headings: HeadingInfo[]): HeadingInfo | null {
	// Exact heading text match.
	let heading = headings.find((h) => h.text === anchor);
	if (heading) return heading;

	// Exact heading prefix match.
	heading = headings.find((h) => h.prefix === anchor);
	if (heading) return heading;

	// Anchor is a prefix of the heading text and starts with a section prefix (e.g. "A1:").
	const startsWithMatches = headings.filter((h) => h.text.startsWith(anchor) && extractPrefix(anchor) !== null);
	if (startsWithMatches.length > 0) {
		// Prefer the longest heading to disambiguate similar titles.
		startsWithMatches.sort((a, b) => b.text.length - a.text.length);
		const [first] = startsWithMatches;
		if (first) return first;
	}

	// Link text matches heading text or prefix.
	if (linkText) {
		heading = headings.find((h) => h.text === linkText);
		if (heading) return heading;
		heading = headings.find((h) => h.prefix === linkText);
		if (heading) return heading;
	}

	return null;
}

interface LinkReplacement {
	start: number;
	end: number;
	newUrl: string;
}

function collectLinkReplacements(tree: Root, headings: HeadingInfo[]): LinkReplacement[] {
	const replacements: LinkReplacement[] = [];

	function visit(node: unknown) {
		if (typeof node !== "object" || node === null) return;
		const n = node as {
			type?: string;
			url?: string;
			position?: { start?: { offset?: number }; end?: { offset?: number } };
			children?: unknown[];
		};
		if (
			n.type === "link" &&
			n.url?.startsWith("#") &&
			n.position?.start?.offset !== undefined &&
			n.position.end?.offset !== undefined
		) {
			const anchor = decodeURIComponent(n.url.slice(1));
			const linkText = extractText(n);
			const heading = findHeadingForAnchor(anchor, linkText, headings);
			if (heading && heading.slug !== anchor) {
				replacements.push({
					start: n.position.start.offset,
					end: n.position.end.offset,
					newUrl: `#${heading.slug}`,
				});
			}
		}
		if (Array.isArray(n.children)) {
			for (const child of n.children) visit(child);
		}
	}

	for (const child of tree.children) visit(child);
	return replacements;
}

function replaceLinkUrl(linkSource: string, newUrl: string): string {
	const markerIndex = linkSource.indexOf("](");
	if (markerIndex === -1) return linkSource;

	const urlStart = markerIndex + 2;
	const firstChar = linkSource[urlStart];
	if (firstChar === "<") {
		const closeIndex = linkSource.indexOf(">", urlStart + 1);
		if (closeIndex === -1) return linkSource;
		// github-slugger slugs never contain spaces, so drop the angle brackets.
		return linkSource.slice(0, urlStart) + newUrl + linkSource.slice(closeIndex + 1);
	}

	// Parenthesized URL: find the matching close parenthesis, respecting nesting.
	let depth = 1;
	let i = urlStart;
	while (i < linkSource.length) {
		if (linkSource[i] === "(") {
			depth++;
		} else if (linkSource[i] === ")") {
			depth--;
			if (depth === 0) break;
		}
		i++;
	}
	if (depth !== 0) return linkSource;
	return linkSource.slice(0, urlStart) + newUrl + linkSource.slice(i);
}

/**
 * Normalize in-document markdown hash links so that TOC entries written with
 * human-readable heading text or section prefixes are converted to the
 * github-slugger slug that the rendered heading will receive.
 *
 * Example:
 *   - [A1: Section Title](#A1: Section Title)
 *   ## A1: Section Title
 * becomes:
 *   - [A1: Section Title](#a1-section-title)
 *   ## A1: Section Title
 */
export function normalizeMarkdownHashLinks(content: string): string {
	const tree = unified().use(remarkParse).parse(content) as Root;
	const slugger = new Slugger();

	const headings: HeadingInfo[] = [];
	for (const node of tree.children) {
		if (node.type === "heading") {
			const text = extractHeadingText(node);
			const prefix = extractPrefix(text);
			const slug = slugger.slug(text);
			headings.push({ text, prefix, slug });
		}
	}

	const replacements = collectLinkReplacements(tree, headings);
	if (replacements.length === 0) return content;

	// Replace from end to start so earlier offsets remain valid.
	replacements.sort((a, b) => b.start - a.start);

	let result = content;
	for (const { start, end, newUrl } of replacements) {
		const linkSource = result.slice(start, end);
		const newLink = replaceLinkUrl(linkSource, newUrl);
		result = result.slice(0, start) + newLink + result.slice(end);
	}
	return result;
}
