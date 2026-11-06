import { refractor as allRefractor } from "refractor/lib/all.js";
import { refractor as commonRefractor } from "refractor/lib/common.js";

/**
 * Standard Markdown links that the composer's prism overlay paints as plain text, turned blue by
 * an `mdlink` token so editing matches the rendered view:
 *   - `[]` / `![]` - the built-in grammar emits no link token at all for an empty label;
 *   - `[label](<path with space.md:10-20>)` - the CommonMark-legal pointy-bracket destination;
 *   - `[label](path with space.md:10-20)`  - a bare-space destination, which this app's render-time
 *     join pass heals into a percent-encoded link (see processMarkdownLocalPaths).
 * Space-free destinations with a non-empty label stay with the built-in grammar.
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
				// Empty labels are never tokenised by the built-in grammar, so they need their own
				// branch regardless of the destination. Non-empty labels only need covering when the
				// destination holds a space or uses pointy brackets.
				pattern: /!?\[\]\([^)]+\)|!?\[[^\]]+\]\((?:<[^>]+>|[^)]*\s[^)]*)\)/,
			},
		});
	}
}
