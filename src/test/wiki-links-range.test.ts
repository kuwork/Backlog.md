import { describe, expect, it } from "bun:test";
import { prepareWikiMarkdown } from "../web/utils/wikiLinks.ts";

const WIKI_BASE = "concepts/auto-port.md";

describe("BACK-837 wikilink line-range", () => {
	it("preserves a trailing :N-M range on a wikilink to a sibling page", () => {
		const out = prepareWikiMarkdown("[[asset-management.md:10-29]]", WIKI_BASE);
		expect(out).toContain('href="/wiki/asset-management.md:10-29"');
		expect(out).toContain('data-wikilink="true"');
	});

	it("preserves the range with an alias", () => {
		const out = prepareWikiMarkdown("[[asset-management.md:10-29|see section]]", WIKI_BASE);
		expect(out).toContain('href="/wiki/asset-management.md:10-29"');
		expect(out).toContain("see section");
	});

	it("resolves a sub-directory wikilink range against the wiki base", () => {
		const out = prepareWikiMarkdown("[[concepts/shared/note:3-7]]", WIKI_BASE);
		expect(out).toContain('href="/wiki/concepts/shared/note:3-7"');
	});

	it("leaves a wikilink without a range unchanged in shape", () => {
		const out = prepareWikiMarkdown("[[asset-management]]", WIKI_BASE);
		expect(out).toContain('href="/wiki/asset-management"');
		expect(out).not.toContain(":");
	});
});
