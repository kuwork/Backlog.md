import { describe, expect, it } from "bun:test";
import { prepareWikiMarkdown, resolveMediaPath, resolveWikiPath } from "../web/utils/wikiLinks.ts";

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

describe("resolveMediaPath", () => {
	it("treats non-relative paths as project-root-relative", () => {
		expect(resolveMediaPath("concepts/demo.md", "assets/photo.png")).toBe("assets/photo.png");
	});

	it("resolves dot-relative paths against the current page directory", () => {
		expect(resolveMediaPath("concepts/demo.md", "./photo.png")).toBe("wiki/concepts/photo.png");
	});

	it("resolves parent traversal to escape wiki subdirectory", () => {
		expect(resolveMediaPath("concepts/demo.md", "../../assets/photo.png")).toBe("assets/photo.png");
	});

	it("resolves parent traversal within wiki for sibling assets", () => {
		expect(resolveMediaPath("concepts/demo.md", "../assets/photo.png")).toBe("wiki/assets/photo.png");
	});

	it("rejects absolute paths", () => {
		expect(resolveMediaPath("concepts/demo.md", "/etc/passwd")).toBeNull();
	});

	it("returns null when traversal escapes project root", () => {
		expect(resolveMediaPath("concepts/demo.md", "../../../outside.png")).toBeNull();
	});
});

describe("prepareWikiMarkdown media wikilinks", () => {
	it("renders image wikilink as img tag", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png]]", "index.md");
		expect(result).toContain("<img");
		expect(result).toContain('src="/assets/photo.png"');
		expect(result).toContain('data-wikilink-media="true"');
		expect(result).toContain('alt=""');
	});

	it("renders image wikilink with custom alt text", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo]]", "index.md");
		expect(result).toContain('src="/assets/photo.png"');
		expect(result).toContain('alt="A photo"');
	});

	it("renders image wikilink with dimensions", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo|200x300]]", "index.md");
		expect(result).toContain('width="200"');
		expect(result).toContain('height="300"');
		expect(result).toContain("max-width: 100%;");
	});

	it("renders image wikilink with width only", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo|200x0]]", "index.md");
		expect(result).toContain('width="200"');
		expect(result).not.toContain("height=");
	});

	it("renders image wikilink with shorthand width", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo|200]]", "index.md");
		expect(result).toContain('width="200"');
		expect(result).not.toContain("height=");
	});

	it("renders image wikilink with shorthand width and no alt", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|200]]", "index.md");
		expect(result).toContain('width="200"');
		expect(result).toContain('alt=""');
	});

	it("renders image wikilink with height only", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo|0x200]]", "index.md");
		expect(result).not.toContain("width=");
		expect(result).toContain('height="200"');
	});

	it("renders video wikilink as video tag", () => {
		const result = prepareWikiMarkdown("![[assets/demo.mp4|Demo video]]", "index.md");
		expect(result).toContain("<video");
		expect(result).toContain('src="/assets/demo.mp4"');
		expect(result).toContain("controls");
		expect(result).toContain(">Demo video</a>");
	});

	it("renders video wikilink with shorthand width", () => {
		const result = prepareWikiMarkdown("![[assets/demo.mp4|Demo video|200]]", "index.md");
		expect(result).toContain('src="/assets/demo.mp4"');
		expect(result).toContain('width="200"');
		expect(result).not.toContain("height=");
	});

	it("renders audio wikilink as audio tag", () => {
		const result = prepareWikiMarkdown("![[assets/demo.mp3]]", "index.md");
		expect(result).toContain("<audio");
		expect(result).toContain('src="/assets/demo.mp3"');
		expect(result).toContain("controls");
	});

	it("resolves relative media paths against the current page", () => {
		const result = prepareWikiMarkdown("![[../../assets/photo.png]]", "concepts/demo.md");
		expect(result).toContain('src="/assets/photo.png"');
	});

	it("renders unresolved media wikilinks as deleted text", () => {
		const result = prepareWikiMarkdown("![[../../../outside.png|bad]]", "concepts/demo.md");
		expect(result).toContain("<del>bad</del>");
	});

	it("does not transform media wikilinks inside inline code", () => {
		const result = prepareWikiMarkdown("Use `![[assets/photo.png]]` syntax.", "index.md");
		expect(result).not.toContain("data-wikilink-media");
		expect(result).toContain("![[assets/photo.png]]");
	});

	it("does not transform media wikilinks inside fenced code blocks", () => {
		const result = prepareWikiMarkdown("```\n![[assets/photo.png]]\n```", "index.md");
		expect(result).not.toContain("data-wikilink-media");
		expect(result).toContain("![[assets/photo.png]]");
	});

	it("supports markdown-it-attrs on media wikilinks", () => {
		const result = prepareWikiMarkdown("![[assets/photo.png|A photo]]{.rounded}", "index.md");
		expect(result).toContain('class="rounded"');
		expect(result).toContain('data-wikilink-media="true"');
	});

	it("encodes media paths with special characters", () => {
		const result = prepareWikiMarkdown("![[assets/一片 狗尾草.jpg]]", "index.md");
		expect(result).toContain('src="/assets/%E4%B8%80%E7%89%87%20%E7%8B%97%E5%B0%BE%E8%8D%89.jpg"');
	});
});
