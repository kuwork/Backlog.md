import { describe, expect, it } from "bun:test";
import { normalizeMarkdownHashLinks } from "../markdown/hash-links.ts";

describe("normalizeMarkdownHashLinks", () => {
	it("converts prefix anchors to github-slugger slugs", () => {
		const source = "## A1: Section Title\n\n[Jump to A1](#A1)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[Jump to A1](#a1-section-title)");
		expect(result).toContain("## A1: Section Title");
	});

	it("keeps already-normalized github-slugger anchors unchanged", () => {
		const source = "## A1: Section Title\n\n[Jump to A1](#a1-section-title)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toBe(source);
	});

	it("converts full-title anchors to github-slugger slugs", () => {
		const source = "# Summary\n\n[Go to summary](#Summary)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[Go to summary](#summary)");
	});

	it("converts numeric prefix anchors to github-slugger slugs", () => {
		const source = "# 1.1 Section Title\n\n[Jump to 1.1](#1.1)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[Jump to 1.1](#11-section-title)");
	});

	it("does not change external links or local file links", () => {
		const source = "[External](https://example.com)\n\n[File](path/to/file.md)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toBe(source);
	});

	it("deduplicates identical headings when generating slugs", () => {
		const source = "# 1.1 Task\n\n# 1.1 Task\n\n[First](#1.1) [Second](#11-task-1)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[First](#11-task)");
		expect(result).toContain("[Second](#11-task-1)");
	});

	it("handles Chinese headings with prefixes", () => {
		const source = "# A1：BACK-355 任务类型字段（父任务 + 6 子任务）\n\n[Jump](#A1)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[Jump](#a1back-355-任务类型字段父任务--6-子任务)");
		expect(result).toContain("# A1：BACK-355 任务类型字段（父任务 + 6 子任务）");
	});

	it("converts angle-bracket full-title anchors to plain github-slugger slugs", () => {
		const source = "# A1: Section Title (details)\n\n[A1: Section Title](<#A1: Section Title (details)>)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toContain("[A1: Section Title](#a1-section-title-details)");
		expect(result).not.toContain("<#a1-section-title");
		expect(result).toContain("# A1: Section Title (details)");
	});

	it("leaves content without matching headings unchanged", () => {
		const source = "[Unknown](#unknown-anchor)";
		const result = normalizeMarkdownHashLinks(source);

		expect(result).toBe(source);
	});
});
