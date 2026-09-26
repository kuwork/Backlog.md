import type { GraphNodeDto } from "../lib/api.ts";

/**
 * How a graph node is named on screen - the shared rule of every graph view.
 *
 * The label is what a reader recognises a node by, which is not the same thing as its identity:
 * a work file's identity and label are both its code name (BACK-123), while a knowledge page's
 * identity is its file path (doc-15 §2.1) and its label is the frontmatter title. Tag nodes are
 * labelled by the tag itself.
 *
 * Captions must fit a plate of a fixed budget, and they are multi-language: a CJK glyph is about
 * twice as wide as a Latin one at the caption font size, so the trim is done by estimated width
 * rather than by character count - otherwise a Chinese title would overrun its plate while an
 * English one left most of it empty. The full string stays available on hover.
 */

/** Widest caption text drawn under a node, in pixels. */
export const CAPTION_BUDGET = 120;
/** Estimated advance width of one Latin character at the caption font size. */
export const CAPTION_CHAR_WIDTH = 6.1;
/** Estimated advance width of one CJK character at the caption font size. */
export const CJK_CHAR_WIDTH = 11;
/** Horizontal padding added to a plate, in pixels. */
export const CAPTION_PAD = 14;

/** CJK ranges, plus the ellipsis - it renders wide, so it is measured as one. */
const CJK_PATTERN = /[\u2026\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;

/** Estimated rendered width of a caption's text. */
export function captionTextWidth(caption: string): number {
	let width = 0;
	for (const char of caption) width += CJK_PATTERN.test(char) ? CJK_CHAR_WIDTH : CAPTION_CHAR_WIDTH;
	return width;
}

/** Plate width for a caption: the estimated text plus its padding. */
export function captionPlateWidth(caption: string): number {
	return captionTextWidth(caption) + CAPTION_PAD;
}

/** The ellipsis appended to a trimmed caption; it renders about as wide as a CJK glyph. */
const ELLIPSIS = "…";
const ELLIPSIS_WIDTH = CJK_CHAR_WIDTH;

/** Trim a caption to the plate budget by estimated width, not by character count. */
export function truncateCaption(text: string): string {
	if (captionTextWidth(text) <= CAPTION_BUDGET) return text;
	const chars = [...text];
	let width = 0;
	for (let index = 0; index < chars.length; index += 1) {
		const char = chars[index] as string;
		width += CJK_PATTERN.test(char) ? CJK_CHAR_WIDTH : CAPTION_CHAR_WIDTH;
		// Only a caption that has to be trimmed pays for the ellipsis.
		if (width + ELLIPSIS_WIDTH > CAPTION_BUDGET) return `${chars.slice(0, index).join("")}${ELLIPSIS}`;
	}
	return text;
}

/** The file name behind a payload id (a knowledge node's id is its file path). */
export function fileStem(id: string): string {
	const slash = id.lastIndexOf("/");
	return (slash === -1 ? id : id.slice(slash + 1)).replace(/\.md$/, "");
}

/**
 * The caption under a node.
 * - work file -> its code name (BACK-123);
 * - knowledge page (wiki / decision / document) -> the frontmatter title, falling back to the file
 *   name when a page declares none;
 * - tag -> the tag name, without the `tag:` prefix the payload uses to keep tag ids from colliding
 *   with task ids.
 */
export function captionFor(node: Pick<GraphNodeDto, "id" | "title" | "kind">): string {
	if (node.kind === "tag") return node.id.replace(/^tag:/, "");
	if (node.kind === "wiki" || node.kind === "decision" || node.kind === "document") {
		const title = node.title.trim();
		return truncateCaption(title.length > 0 ? title : fileStem(node.id));
	}
	return node.id;
}
