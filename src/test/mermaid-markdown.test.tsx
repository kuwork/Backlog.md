import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";

const render = (source: string, props?: Partial<React.ComponentProps<typeof MermaidMarkdown>>) =>
	renderToString(
		<I18nProvider initialLocale="en">
			<ImageLightboxProvider>
				<MermaidMarkdown source={source} {...props} />
			</ImageLightboxProvider>
		</I18nProvider>,
	);

describe("MermaidMarkdown", () => {
	it("renders angle-bracket type strings without throwing", () => {
		const source =
			"Implemented contracts: getDishesByMenu(String menuId) -> Result<List<MenuItem>>";

		expect(() => render(source)).not.toThrow();

		const html = render(source);
		expect(html).toContain("Result&lt;List&lt;MenuItem&gt;&gt;");
	});

	it("keeps markdown rendering functional for normal content", () => {
		const source = "## Heading\n\nRegular **markdown** content.";
		const html = render(source);

		expect(html).toContain("Heading");
		expect(html).toContain("<strong>markdown</strong>");
	});

	it("preserves non-http autolinks and email autolinks", () => {
		const source = "Links: <ftp://example.com/file> and <foo@example.com>";
		const html = render(source);

		expect(html).toContain('href="ftp://example.com/file"');
		expect(html).toContain('href="mailto:foo@example.com"');
	});

	it("renders wikilinks when wikilinkBasePath is provided", () => {
		const source = "See [[concepts/demo|Demo page]].";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain(">Demo page</a>");
	});

	it("applies markdown-it-attrs to wikilinks", () => {
		const source = '[[concepts/demo|Demo]]{style="color: red;"}';
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain('style="color:red"');
	});

	it("renders inline code alias in wikilink", () => {
		const source = "[[concepts/demo|`code`]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain("<code>code</code>");
	});

	it("renders single-line fenced code alias in wikilink", () => {
		const source = "[[concepts/demo|```code```]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain("<code>code</code>");
	});

	it("renders bold, italic and strikethrough alias in wikilink", () => {
		const source = "[[concepts/demo|**bold** *italic* ~~strike~~]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain("<strong>bold</strong>");
		expect(html).toContain("<em>italic</em>");
		expect(html).toContain("<del>strike</del>");
	});

	it("renders inline HTML alias in wikilink", () => {
		const source = '[[concepts/demo|<span style="color: red;">red</span>]]';
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain('<span style="color:red">red</span>');
	});

	it("applies class attribute to wikilink without alias", () => {
		const source = "[[concepts/demo]]{.some-class}";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toMatch(/class="[^"]*some-class/);
	});

	it("does not transform wikilinks without wikilinkBasePath", () => {
		const source = "See [[concepts/demo]].";
		const html = render(source);

		expect(html).toContain("[[concepts/demo]]");
	});

	describe("local URL alias rendering", () => {
		const originalWindow = (globalThis as { window?: typeof window }).window;

		beforeEach(() => {
			(globalThis as { window?: typeof window }).window = {
				location: {
					href: "http://localhost:6420/wiki/index",
					origin: "http://localhost:6420",
				},
			} as typeof window;
		});

		afterEach(() => {
			(globalThis as { window?: typeof window }).window = originalWindow;
		});

		it("renders plain local wiki links as WIKI# alias", () => {
			const source = "See [custom text](/wiki/concepts/demo).";
			const html = render(source, { onWikiClick: () => {} });

			expect(html).toContain('href="/wiki/concepts/demo"');
			expect(html).toContain(">WIKI#concepts/demo</a>");
			expect(html).not.toContain(">custom text</a>");
		});

		it("still renders wikilinks with custom alias even when onWikiClick is provided", () => {
			const source = "See [[concepts/demo|Demo page]].";
			const html = render(source, { wikilinkBasePath: "index.md", onWikiClick: () => {} });

			expect(html).toContain('href="/wiki/concepts/demo"');
			expect(html).toContain(">Demo page</a>");
			expect(html).not.toContain(">WIKI#concepts/demo</a>");
		});
	});

	describe("media wikilinks", () => {
		it("renders image wikilink as img tag", () => {
			const source = "![[assets/photo.png|A photo]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('src="/assets/photo.png"');
			expect(html).toContain('alt="A photo"');
			expect(html).toContain("data-lightbox-img");
		});

		it("renders video wikilink as video tag", () => {
			const source = "![[assets/demo.mp4|Demo video]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('<video');
			expect(html).toContain('src="/assets/demo.mp4"');
			expect(html).toContain('controls');
		});

		it("renders audio wikilink as audio tag", () => {
			const source = "![[assets/demo.mp3]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('<audio');
			expect(html).toContain('src="/assets/demo.mp3"');
			expect(html).toContain('controls');
		});

		it("applies dimensions to image wikilink", () => {
			const source = "![[assets/photo.png|A photo|200x300]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('width="200"');
			expect(html).toContain('height="300"');
		});

		it("applies shorthand width to image wikilink", () => {
			const source = "![[assets/photo.png|A photo|200]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('width="200"');
			expect(html).not.toContain('height=');
		});

		it("applies shorthand width to video wikilink", () => {
			const source = "![[assets/demo.mp4|Demo video|200]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('src="/assets/demo.mp4"');
			expect(html).toContain('width="200"');
			expect(html).not.toContain('height=');
		});

		it("does not render media wikilinks without wikilinkBasePath", () => {
			const source = "![[assets/photo.png]]";
			const html = render(source);

			expect(html).toContain("![[assets/photo.png]]");
			expect(html).not.toContain('src="/assets/photo.png"');
		});
	});
});
