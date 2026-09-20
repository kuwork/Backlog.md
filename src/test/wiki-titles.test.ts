import { describe, expect, it } from "bun:test";
import type { WikiPage, WikiTreeNode } from "../types/index.ts";
import { wikiPageTitle, withWikiPageTitles } from "../utils/wiki-titles.ts";

const page = (path: string, frontmatter: Record<string, unknown> = {}): WikiPage => ({
	path,
	content: "",
	frontmatter,
});

/** Deliberately unsorted, with a folder, a nested level, and a page the corpus does not know. */
const tree = (): WikiTreeNode[] => [
	{
		name: "guides",
		path: "guides",
		type: "directory",
		children: [
			{ name: "setup.md", path: "guides/setup.md", type: "file" },
			{ name: "missing.md", path: "guides/missing.md", type: "file" },
		],
	},
	{ name: "index.md", path: "index.md", type: "file" },
];

describe("wikiPageTitle", () => {
	it("prefers the frontmatter title over the file name", () => {
		expect(wikiPageTitle(page("concepts/auto-port.md", { title: "自动端口选择" }))).toBe("自动端口选择");
	});

	it("falls back to the file name without the extension or directory", () => {
		expect(wikiPageTitle(page("concepts/auto-port.md"))).toBe("auto-port");
	});

	it("falls back when the title is blank or not a string", () => {
		expect(wikiPageTitle(page("log.md", { title: "   " }))).toBe("log");
		expect(wikiPageTitle(page("log.md", { title: 7 }))).toBe("log");
	});
});

describe("withWikiPageTitles", () => {
	it("titles files on every level and leaves the corpus alone otherwise", () => {
		const titled = withWikiPageTitles(tree(), [
			page("index.md", { title: "Wiki Content Catalog" }),
			page("guides/setup.md", { title: "Setup" }),
		]);

		expect(titled.find((node) => node.name === "index.md")?.title).toBe("Wiki Content Catalog");
		const guides = titled.find((node) => node.name === "guides");
		expect(guides?.title).toBeUndefined();
		expect(guides?.children?.find((node) => node.name === "setup.md")?.title).toBe("Setup");
		// A page missing from the corpus keeps the file-name fallback the client applies.
		expect(guides?.children?.find((node) => node.name === "missing.md")?.title).toBeUndefined();
	});

	it("never mutates the tree it is given", () => {
		const input = tree();
		const snapshot = JSON.stringify(input);

		withWikiPageTitles(input, [page("index.md", { title: "Wiki Content Catalog" })]);

		expect(JSON.stringify(input)).toBe(snapshot);
		expect(input.find((node) => node.name === "index.md")?.title).toBeUndefined();
	});

	it("does not title a folder that happens to share a page path", () => {
		const titled = withWikiPageTitles(tree(), [page("guides", { title: "Should not be used" })]);

		expect(titled.find((node) => node.name === "guides")?.title).toBeUndefined();
	});

	it("returns the tree untouched when the corpus is empty", () => {
		const input = tree();
		expect(withWikiPageTitles(input, [])).toBe(input);
	});
});
