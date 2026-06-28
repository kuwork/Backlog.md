import { describe, expect, it } from "bun:test";
import { prepareWikiMarkdown, resolveWikiPath } from "../web/utils/wikiLinks.ts";

describe("resolveWikiPath", () => {
	it("resolves project-root-relative paths as-is", () => {
		expect(resolveWikiPath("concepts/demo.md", "sources/back-123")).toBe("sources/back-123");
	});

	it("resolves relative parent traversal", () => {
		expect(resolveWikiPath("concepts/demo.md", "../sources/back-123")).toBe("wiki/sources/back-123");
	});

	it("rejects absolute paths", () => {
		expect(resolveWikiPath("concepts/demo.md", "/absolute/path")).toBeNull();
	});

	it("returns null when traversal escapes project root", () => {
		expect(resolveWikiPath("concepts/demo.md", "../../../outside")).toBeNull();
	});
});

describe("prepareWikiMarkdown", () => {
	it("keeps plain wikilinks unchanged in text rendering path", () => {
		const result = prepareWikiMarkdown("See [[concepts/demo]] for details.", "index.md");
		expect(result).toContain("<a");
		expect(result).toContain('href="/wiki/concepts/demo"');
		expect(result).toContain('data-wikilink="true"');
		expect(result).toContain("concepts/demo");
	});

	it("supports alias separator", () => {
		const result = prepareWikiMarkdown("[[concepts/demo|Demo page]]", "index.md");
		expect(result).toContain('href="/wiki/concepts/demo"');
		expect(result).toContain(">Demo page</a>");
	});

	it("renders inline code in alias", () => {
		const result = prepareWikiMarkdown("[[concepts/demo|`code`]]", "index.md");
		expect(result).toContain("<code>code</code>");
	});

	it("renders single-line fenced code block in alias", () => {
		const result = prepareWikiMarkdown("[[concepts/demo|```code```]]", "index.md");
		expect(result).toContain("<code>code</code>");
	});

	it("renders bold, italic and strikethrough in alias", () => {
		const result = prepareWikiMarkdown("[[concepts/demo|**bold** *italic* ~~strike~~]]", "index.md");
		expect(result).toContain("<strong>bold</strong>");
		expect(result).toContain("<em>italic</em>");
		expect(result).toContain("<del>strike</del>");
	});

	it("preserves inline HTML in alias", () => {
		const result = prepareWikiMarkdown('[[concepts/demo|<span style="color: red;">red</span>]]', "index.md");
		expect(result).toContain('<span style="color: red;">red</span>');
	});

	it("applies markdown-it-attrs style attribute", () => {
		const result = prepareWikiMarkdown('[[concepts/demo|Demo]]{style="color: red;"}', "index.md");
		expect(result).toContain('style="color: red;"');
		expect(result).toContain('data-wikilink="true"');
	});

	it("applies markdown-it-attrs class attribute", () => {
		const result = prepareWikiMarkdown("[[concepts/demo|Demo]]{.some-class}", "index.md");
		expect(result).toContain('class="some-class"');
	});

	it("does not transform wikilinks inside inline code", () => {
		const result = prepareWikiMarkdown("Use `[[concepts/demo]]` syntax.", "index.md");
		expect(result).not.toContain('data-wikilink="true"');
		expect(result).toContain("[[concepts/demo]]");
	});

	it("does not transform wikilinks inside fenced code blocks", () => {
		const result = prepareWikiMarkdown("```\n[[concepts/demo]]\n```", "index.md");
		expect(result).not.toContain('data-wikilink="true"');
		expect(result).toContain("[[concepts/demo]]");
	});

	it("renders alias with bold prefix, middle content and suffix", () => {
		const result = prepareWikiMarkdown(
			"[[pages/integrations/bidirectional-links/demo|**bold prefix** middle content **bold suffix**]]",
			"index.md",
		);
		expect(result).toContain("<strong>bold prefix</strong>");
		expect(result).toContain("middle content");
		expect(result).toContain("<strong>bold suffix</strong>");
	});

	it("renders alias with italic prefix, middle content and suffix", () => {
		const result = prepareWikiMarkdown(
			"[[pages/integrations/bidirectional-links/demo|*italic prefix* middle content *italic suffix*]]",
			"index.md",
		);
		expect(result).toContain("<em>italic prefix</em>");
		expect(result).toContain("<em>italic suffix</em>");
	});

	it("renders alias with strikethrough prefix, middle content and suffix", () => {
		const result = prepareWikiMarkdown(
			"[[pages/integrations/bidirectional-links/demo|~~strikethrough prefix~~ middle content ~~strikethrough suffix~~]]",
			"index.md",
		);
		expect(result).toContain("<del>strikethrough prefix</del>");
		expect(result).toContain("<del>strikethrough suffix</del>");
	});

	it("renders alias with custom HTML and middle content", () => {
		const result = prepareWikiMarkdown(
			'[[pages/integrations/bidirectional-links/demo|<span style="color: red;">custom HTML</span> middle content <span style="color: blue;">custom HTML</span>]]',
			"index.md",
		);
		expect(result).toContain('<span style="color: red;">custom HTML</span>');
		expect(result).toContain("middle content");
		expect(result).toContain('<span style="color: blue;">custom HTML</span>');
	});

	it("applies attrs to wikilinks without alias", () => {
		const styleResult = prepareWikiMarkdown('[[demo-page]]{style="color: red;"}', "index.md");
		expect(styleResult).toContain('style="color: red;"');

		const classResult = prepareWikiMarkdown("[[demo-page]]{.some-class}", "index.md");
		expect(classResult).toContain('class="some-class"');
	});

	it("combines alias and attrs", () => {
		const result = prepareWikiMarkdown('[[concepts/demo|Demo]]{style="color: red;" .some-class}', "index.md");
		expect(result).toContain('style="color: red;"');
		expect(result).toContain('class="some-class"');
		expect(result).toContain(">Demo</a>");
	});

	it("renders unresolved wikilinks as deleted text", () => {
		const result = prepareWikiMarkdown("[[../../../etc/passwd|bad]]", "concepts/demo.md");
		expect(result).toContain("<del>bad</del>");
	});
});
