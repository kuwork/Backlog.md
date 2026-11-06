import { refractor as allRefractor } from "refractor/lib/all.js";
import { refractor as commonRefractor } from "refractor/lib/common.js";

/**
 * The composer's syntax-highlight layer - the prism overlay MDEditor paints behind the textarea -
 * does not recognise wiki `[[...]]` links, so they render as plain text while editing. Registering a
 * `wikilink` token colourises them blue in the overlay, matching the rendered view. Mirrors
 * registerTopicHighlight. Idempotent: each grammar receives the token only when it is missing.
 */
export function registerWikilinkHighlight(): void {
	for (const instance of [commonRefractor, allRefractor]) {
		const languages = instance.languages as unknown as {
			markdown?: Record<string, unknown>;
			insertBefore: (inside: string, before: string, insert: Record<string, unknown>) => unknown;
		};
		if (!languages.markdown || languages.markdown.wikilink) continue;
		languages.insertBefore("markdown", "title", {
			wikilink: {
				// `[[page]]`, `[[page:10-29]]`, `[[page|alias]]`, `![[media.png]]` - no `]` or newline inside.
				pattern: /(!?)\[\[[^\]\n]*?\]\]/,
			},
		});
	}
}
