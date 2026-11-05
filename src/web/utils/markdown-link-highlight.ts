import { refractor as allRefractor } from "refractor/lib/all.js";
import { refractor as commonRefractor } from "refractor/lib/common.js";

/**
 * Standard Markdown links whose destination holds a space are painted as plain text by the
 * composer's prism overlay, because the built-in markdown grammar only recognises space-free
 * destinations. Two forms are covered:
 *   - `[label](<path with space.md:10-20>)` - the CommonMark-legal pointy-bracket destination;
 *   - `[label](path with space.md:10-20)`  - a bare-space destination, which this app's render-time
 *     join pass heals into a percent-encoded link (see processMarkdownLocalPaths).
 * Registering an `mdlink` token colours both blue in the overlay, matching the rendered view.
 * Mirrors registerTopicHighlight. Idempotent: each grammar gets the token only once.
 */
export function registerMarkdownLinkHighlight(): void {
	for (const instance of [commonRefractor, allRefractor]) {
		const languages = instance.languages as unknown as {
			markdown?: Record<string, unknown>;
			insertBefore: (inside: string, before: string, insert: Record<string, unknown>) => unknown;
		};
		if (!languages.markdown || languages.markdown.mdlink) continue;
		languages.insertBefore("markdown", "title", {
			mdlink: {
				// `[label](<...>)` / `![alt](<...>)`, or a destination containing a space. Space-free
				// links stay with the built-in grammar so their existing tokenisation is unchanged.
				pattern: /(!?\[[^\]]*\])\((?:<[^>]+>|[^)]*\s[^)]*)\)/,
			},
		});
	}
}
