import type { Html, Parent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { buildWikilinkHtml, buildWikilinkMediaHtml } from "./wikiLinks";

// Mirrors the wikilink matcher used by prepareWikiMarkdown (wikiLinks.ts).
const WIKILINK_REGEX = /!?\[\[([\s\S]*?)\]\](\{[^{}]*\})?/g;

/**
 * Remark plugin that converts `[[...]]` and `![[...]]` wikilinks into raw HTML
 * anchors/images, reusing the exact builders MermaidMarkdown uses in view mode.
 * The editor preview runs through @uiw/react-markdown-preview, which enables
 * `rehype-raw` by default, so the emitted `<a>`/`<img>` nodes render as styled
 * links — matching the rendered (view) mode that runs prepareWikiMarkdown.
 *
 * This keeps wikilinks blue and clickable-shaped inside the editor's live
 * preview instead of showing the literal `[[...]]` text.
 */
export function createRemarkWikilink(basePath: string): Plugin<[], Root> {
	return () => (tree: Root) => {
		visit(tree, "text", (node: Text, index, parent: Parent | null) => {
			if (!parent || index === null || index === undefined) return;
			const value = node.value;
			if (!value.includes("[[")) return;

			const nodes: (Text | Html)[] = [];
			let last = 0;
			WIKILINK_REGEX.lastIndex = 0;
			let match: RegExpExecArray | null = WIKILINK_REGEX.exec(value);
			while (match !== null) {
				if (match.index > last) {
					nodes.push({ type: "text", value: value.slice(last, match.index) });
				}
				const isMedia = match[0].startsWith("!");
				const html = isMedia
					? buildWikilinkMediaHtml(match[1] ?? "", match[2], basePath)
					: buildWikilinkHtml(match[1] ?? "", match[2], basePath);
				nodes.push({ type: "html", value: html });
				last = match.index + match[0].length;
				match = WIKILINK_REGEX.exec(value);
			}
			if (last < value.length) {
				nodes.push({ type: "text", value: value.slice(last) });
			}

			parent.children.splice(index, 1, ...nodes);
			return [SKIP, index + nodes.length];
		});
	};
}
