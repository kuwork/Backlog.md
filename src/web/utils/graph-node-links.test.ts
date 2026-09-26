import { describe, expect, it } from "bun:test";
import type { GraphNodeDto } from "../lib/api.ts";
import { knowledgeNodeHref } from "./graph-node-links";

const node = (overrides: Partial<GraphNodeDto> & { id: string }): GraphNodeDto => ({
	title: "",
	kind: "wiki",
	status: "",
	filePath: "wiki/x.md",
	...overrides,
});

describe("knowledge node links", () => {
	it("addresses a wiki page by its path below backlog/wiki/", () => {
		expect(knowledgeNodeHref(node({ id: "wiki/concepts/wiki-lint.md", filePath: "wiki/concepts/wiki-lint.md" }))).toBe(
			"/wiki/concepts/wiki-lint.md",
		);
	});

	it("URL-encodes a wiki path segment by segment", () => {
		expect(knowledgeNodeHref(node({ id: "wiki/decisions/诊断.md", filePath: "wiki/decisions/诊断.md" }))).toBe(
			`/wiki/decisions/${encodeURIComponent("诊断")}.md`,
		);
	});

	it("addresses documents and decisions by their frontmatter id", () => {
		expect(
			knowledgeNodeHref(
				node({
					id: "doc-14",
					kind: "document",
					filePath: "docs/BRDS/doc-14 - Kuzu-任务图谱.md",
				}),
			),
		).toBe("/documentation/doc-14");
		expect(
			knowledgeNodeHref(
				node({ id: "decision-1", kind: "decision", filePath: "decisions/decision-1 - Use-Tailwind.md" }),
			),
		).toBe("/decisions/decision-1");
	});

	it("opens nothing for a knowledge page that has no id to resolve", () => {
		// A folder readme carries no frontmatter id, so its payload id is still a path.
		expect(knowledgeNodeHref(node({ id: "decisions/readme.md", kind: "decision" }))).toBeNull();
		expect(knowledgeNodeHref(node({ id: "docs/readme.md", kind: "document" }))).toBeNull();
	});

	it("opens nothing for a tag or a work node", () => {
		expect(knowledgeNodeHref(node({ id: "tag:bug", kind: "tag", filePath: "" }))).toBeNull();
		expect(knowledgeNodeHref(node({ id: "BACK-1", kind: "task", filePath: "tasks/back-1 - X.md" }))).toBeNull();
		expect(knowledgeNodeHref(node({ id: "draft-2", kind: "draft" }))).toBeNull();
		expect(knowledgeNodeHref(node({ id: "m-1", kind: "milestone" }))).toBeNull();
	});
});
