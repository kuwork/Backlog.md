import { describe, expect, it } from "bun:test";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { createRemarkWikilink } from "../web/utils/remarkWikilink";

function collectHtml(source: string, basePath: string): string[] {
	const processor = unified().use(remarkParse).use(createRemarkWikilink(basePath));
	const tree = processor.runSync(processor.parse(source));
	const html: string[] = [];
	visit(tree, "html", (node) => {
		html.push((node as { value: string }).value);
	});
	return html;
}

function renderHtml(source: string, basePath: string): string {
	return String(
		unified()
			.use(remarkParse)
			.use(createRemarkWikilink(basePath))
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypeRaw)
			.use(rehypeStringify)
			.processSync(source),
	);
}

describe("createRemarkWikilink (editor preview)", () => {
	it("turns a ranged wikilink into a /wiki/ anchor with the range", () => {
		const html = collectHtml("See [[concepts/asset-management:10-29]].", "concepts/auto-port.md");
		expect(html.length).toBe(1);
		expect(html[0]).toContain('href="/wiki/concepts/asset-management:10-29"');
		expect(html[0]).toContain('data-wikilink="true"');
	});

	it("turns a page-level wikilink into a /wiki/ anchor", () => {
		const html = collectHtml("See [[sources/back-514-auto-port]].", "concepts/auto-port.md");
		expect(html.length).toBe(1);
		expect(html[0]).toContain('href="/wiki/sources/back-514-auto-port"');
	});

	it("renders through rehype-raw as a real anchor element", () => {
		const out = renderHtml("Link [[sources/back-514-auto-port]] end.", "concepts/auto-port.md");
		expect(out).toContain('<a href="/wiki/sources/back-514-auto-port"');
		expect(out).toContain(">sources/back-514-auto-port</a>");
	});

	it("keeps an alias as the link text", () => {
		const out = renderHtml("[[sources/back-514-auto-port|Auto port]]", "concepts/auto-port.md");
		expect(out).toContain('<a href="/wiki/sources/back-514-auto-port"');
		expect(out).toContain(">Auto port</a>");
	});

	it("turns a media wikilink into an img", () => {
		const html = collectHtml("![[diagram.png]]", "concepts/auto-port.md");
		expect(html.length).toBe(1);
		expect(html[0]).toContain("<img");
		expect(html[0]).toContain("/assets/");
	});

	it("leaves plain text without wikilinks untouched", () => {
		const html = collectHtml("Just a normal paragraph with no links.", "concepts/auto-port.md");
		expect(html.length).toBe(0);
	});

	it("does not transform wikilinks inside inline code", () => {
		const html = collectHtml("Use `[[sources/back-514-auto-port]]` verbatim.", "concepts/auto-port.md");
		expect(html.length).toBe(0);
	});
});
