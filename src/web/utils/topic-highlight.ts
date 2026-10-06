import { refractor as allRefractor } from "refractor/lib/all.js";
import { refractor as commonRefractor } from "refractor/lib/common.js";

/**
 * The composer's syntax-highlight layer - the prism overlay MDEditor paints behind the textarea -
 * tokenizes any line-initial `#run` as an ATX heading, because its grammar (unlike CommonMark)
 * wants no space after the opening hashes. A just-closed `#topic#` therefore renders as a lone
 * colored hash followed by plain text, nothing like the chip the saved memo will show.
 *
 * Registering a higher-priority `topic` token (before `title`) retunes that layer to the memo topic
 * shape: the closed `#topic#` form - the same one `extractInlineTags` lifts into tags - plus the
 * still-open run when it reaches end of line, which is exactly the run the autocomplete menu is
 * offering to close. Real headings (`# `), six-hash headings, and mid-sentence text keep their
 * existing tokens; the token carries no styling of its own, so editors without the topic vocabulary
 * (`PasteAwareMDEditor` without `topicSuggestions`) are unaffected.
 *
 * rehype-prism-plus ships two refractor instances - `common` backs its named export, `all` backs
 * the default export the editor's overlay uses - so both get the patch. Idempotent: each grammar
 * receives the token only when it is missing.
 */
export function registerTopicHighlight(): void {
	for (const instance of [commonRefractor, allRefractor]) {
		const languages = instance.languages as unknown as {
			markdown?: Record<string, unknown>;
			insertBefore: (inside: string, before: string, insert: Record<string, unknown>) => unknown;
		};
		if (!languages.markdown || languages.markdown.topic) continue;
		languages.insertBefore("markdown", "title", {
			topic: {
				// Closed `#topic#`, or an open run up to end of line - what the caret is still typing.
				pattern: /#([^\s#`]+)#|#([^\s#`]+)$/m,
			},
		});
	}
}
