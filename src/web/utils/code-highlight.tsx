import type { Nodes } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { refractor } from "refractor/lib/all.js";

/**
 * Tokenizes a snippet into the same coloured spans the reading view paints inside every fenced code
 * block, so a copy of a query shown outside the markdown flow still reads as code.
 *
 * The grammar is `refractor` - the Prism port `rehype-prism-plus` runs on the document before
 * `MermaidMarkdown` renders it - and the `all` build is the one the preview imports, so the tokens
 * this returns are the tokens a `sql` fence in a task body gets, down to the class names. Colour
 * itself is not applied here: `markdown.css` styles `.token.*` under `.wmde-markdown` with the
 * `--color-prettylights-syntax-*` variables, which means the snippet inherits the theme - light or
 * dark - of whatever is hosting it.
 *
 * Failure is silent on purpose. A statement is data the reader has to fix, not markup the app must
 * render, so an unknown grammar or a tokenizer throw returns the plain text instead of blanking the
 * panel.
 */
export function highlightCode(source: string, language: string): ReactNode {
	if (language.length === 0 || !refractor.registered(language)) return source;
	try {
		// One cast, not a conversion: refractor declares its own hast dialect, whose elements allow
		// `properties` to be missing. The tree it hands back is the same shape `toJsxRuntime` wants.
		const tree = refractor.highlight(source, language) as unknown as Nodes;
		return toJsxRuntime(tree, { Fragment, jsx, jsxs });
	} catch {
		return source;
	}
}
