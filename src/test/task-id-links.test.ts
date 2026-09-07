import { describe, expect, it } from "bun:test";
import type { Decision, Document, Task } from "../types/index.ts";
import {
	buildEntityIndex,
	createEntityLinkPlugin,
	type EntityIndex,
	entityHref,
	queryEntityPrefix,
	queryWikiPathPrefix,
	resolveEntityReference,
} from "../web/utils/task-id-links.ts";

const taskFixtures = (...ids: string[]): Task[] =>
	ids.map((id) => ({
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-24",
		labels: [],
		dependencies: [],
	}));

const docFixtures = (...ids: string[]): Document[] =>
	ids.map((id) => ({
		id,
		title: `Doc ${id}`,
		type: "guide",
		createdDate: "2026-07-24",
		rawContent: "",
	}));

const decisionFixtures = (...ids: string[]): Decision[] =>
	ids.map((id) => ({
		id,
		title: `Decision ${id}`,
		date: "2026-07-24",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	}));

type TestNode = {
	type: string;
	value?: string;
	url?: string;
	identifier?: string;
	children?: TestNode[];
};

const textNode = (value: string): TestNode => ({ type: "text", value });
const paragraph = (...children: TestNode[]): TestNode => ({ type: "paragraph", children });
const root = (...children: TestNode[]): TestNode => ({ type: "root", children });

function linkify(index: EntityIndex, source: string): TestNode {
	const tree = root(paragraph(textNode(source)));
	createEntityLinkPlugin(index)()(tree);
	return tree;
}

/** Extract [text, url] pairs for every link node produced by the plugin. */
function linksIn(tree: TestNode): Array<{ text: string; url: string }> {
	const found: Array<{ text: string; url: string }> = [];
	const walk = (node: TestNode) => {
		if (node.type === "link") {
			found.push({ text: node.children?.[0]?.value ?? "", url: node.url ?? "" });
		}
		for (const child of node.children ?? []) walk(child);
	};
	walk(tree);
	return found;
}

describe("buildEntityIndex", () => {
	it("drops canonical collisions as ambiguous (fail-closed)", () => {
		const index = buildEntityIndex({ tasks: taskFixtures("BACK-1", "BACK-01", "BACK-2") });

		expect(resolveEntityReference(index, "task", "BACK-1")).toBeUndefined();
		expect(resolveEntityReference(index, "task", "BACK-01")).toBeUndefined();
		expect(resolveEntityReference(index, "task", "BACK-2")?.id).toBe("BACK-2");
	});

	it("resolves case and zero-padding variants to the canonical entity", () => {
		const index = buildEntityIndex({ tasks: taskFixtures("BACK-10") });

		expect(resolveEntityReference(index, "task", "back-010")?.id).toBe("BACK-10");
		expect(resolveEntityReference(index, "task", "Back-10")?.id).toBe("BACK-10");
	});

	it("indexes docs, decisions and drafts independently from tasks", () => {
		const index = buildEntityIndex({
			tasks: taskFixtures("BACK-9"),
			docs: docFixtures("doc-9"),
			decisions: decisionFixtures("decision-1"),
			drafts: taskFixtures("draft-104"),
		});

		expect(resolveEntityReference(index, "task", "BACK-9")?.id).toBe("BACK-9");
		expect(resolveEntityReference(index, "doc", "doc-9")?.id).toBe("doc-9");
		expect(resolveEntityReference(index, "doc", "DOC-09")?.id).toBe("doc-9");
		expect(resolveEntityReference(index, "decision", "decision-1")?.id).toBe("decision-1");
		expect(resolveEntityReference(index, "draft", "DRAFT-104")?.id).toBe("draft-104");
		expect(resolveEntityReference(index, "draft", "draft-104")?.id).toBe("draft-104");
		// A task lookup does not see doc/decision/draft IDs and vice versa.
		expect(resolveEntityReference(index, "task", "doc-9")).toBeUndefined();
		expect(resolveEntityReference(index, "doc", "BACK-9")).toBeUndefined();
	});

	it("drops ambiguous docs and drafts the same way as tasks", () => {
		const index = buildEntityIndex({
			docs: docFixtures("doc-1", "doc-01"),
			drafts: taskFixtures("draft-2", "draft-02"),
		});

		expect(resolveEntityReference(index, "doc", "doc-1")).toBeUndefined();
		expect(resolveEntityReference(index, "draft", "draft-2")).toBeUndefined();
	});
});

describe("queryEntityPrefix", () => {
	it("matches numeric prefixes zero-padding-aware and returns ascending IDs", () => {
		const index = buildEntityIndex({
			tasks: taskFixtures("BACK-1", "BACK-14", "BACK-010", "BACK-0012", "BACK-2"),
		});

		expect(queryEntityPrefix(index, "task", "BACK-1")).toEqual(["BACK-1", "BACK-10", "BACK-12", "BACK-14"]);
	});

	it("treats a zero-padded query like its unpadded form", () => {
		const index = buildEntityIndex({
			tasks: taskFixtures("BACK-1", "BACK-14", "BACK-010", "BACK-0012", "BACK-2"),
		});

		expect(queryEntityPrefix(index, "task", "BACK-01")).toEqual(["BACK-1", "BACK-10", "BACK-12", "BACK-14"]);
		expect(queryEntityPrefix(index, "task", "back-001")).toEqual(["BACK-1", "BACK-10", "BACK-12", "BACK-14"]);
	});

	it("caps hits at five, in ascending order", () => {
		const index = buildEntityIndex({
			tasks: taskFixtures("BACK-1", "BACK-3", "BACK-2", "BACK-5", "BACK-4", "BACK-6"),
		});

		expect(queryEntityPrefix(index, "task", "BACK-")).toEqual(["BACK-1", "BACK-2", "BACK-3", "BACK-4", "BACK-5"]);
	});

	it("queries each entity kind in isolation", () => {
		const index = buildEntityIndex({
			tasks: taskFixtures("BACK-10"),
			docs: docFixtures("doc-1", "doc-10", "doc-2"),
			decisions: decisionFixtures("decision-10"),
			drafts: taskFixtures("draft-10"),
		});

		expect(queryEntityPrefix(index, "doc", "doc-1")).toEqual(["DOC-1", "DOC-10"]);
		expect(queryEntityPrefix(index, "task", "doc-1")).toEqual([]);
		expect(queryEntityPrefix(index, "task", "BACK-1")).toEqual(["BACK-10"]);
		expect(queryEntityPrefix(index, "decision", "decision-1")).toEqual(["DECISION-10"]);
		expect(queryEntityPrefix(index, "draft", "draft-1")).toEqual(["DRAFT-10"]);
	});

	it("returns an empty list for an empty or prefix-less query", () => {
		const index = buildEntityIndex({ tasks: taskFixtures("BACK-1") });

		expect(queryEntityPrefix(index, "task", "")).toEqual([]);
		expect(queryEntityPrefix(index, "task", "   ")).toEqual([]);
	});
});

describe("queryWikiPathPrefix", () => {
	it("matches by plain lexicographic prefix in dictionary order", () => {
		const wikiPaths = ["patterns/cross-surface", "concepts/demo", "concepts/deep-dive", "index"];

		expect(queryWikiPathPrefix(wikiPaths, "concepts/")).toEqual(["concepts/deep-dive", "concepts/demo"]);
		expect(queryWikiPathPrefix(wikiPaths, "p")).toEqual(["patterns/cross-surface"]);
	});

	it("caps hits at five in dictionary order", () => {
		const wikiPaths = ["a/e", "a/d", "a/c", "a/b", "a/a", "a/f"];

		expect(queryWikiPathPrefix(wikiPaths, "a/")).toEqual(["a/a", "a/b", "a/c", "a/d", "a/e"]);
	});

	it("returns an empty list for empty queries or misses", () => {
		expect(queryWikiPathPrefix(["index"], "")).toEqual([]);
		expect(queryWikiPathPrefix(["index"], "zzz")).toEqual([]);
	});
});

describe("entityHref", () => {
	it("uses the singular route family for every entity kind", () => {
		expect(entityHref("task", "BACK-123")).toBe("/task/123");
		expect(entityHref("doc", "doc-9")).toBe("/documentation/9");
		expect(entityHref("decision", "decision-1")).toBe("/decisions/1");
		expect(entityHref("draft", "draft-104")).toBe("/draft/104");
	});

	it("strips the prefix but keeps the numeric body's zero-padding", () => {
		expect(entityHref("task", "BACK-506")).toBe("/task/506");
		expect(entityHref("doc", "DOC-001")).toBe("/documentation/001");
		expect(entityHref("task", "506")).toBe("/task/506");
	});
});

describe("createEntityLinkPlugin", () => {
	const knownIndex = () =>
		buildEntityIndex({
			tasks: taskFixtures("BACK-123", "BACK-1", "TASK-100"),
			docs: docFixtures("doc-9"),
			decisions: decisionFixtures("decision-1"),
			drafts: taskFixtures("draft-104"),
		});

	it("links bare IDs of every entity kind to their singular routes", () => {
		const tree = linkify(knownIndex(), "See BACK-123, doc-9, decision-1 and DRAFT-104.");

		expect(linksIn(tree)).toEqual([
			{ text: "BACK-123", url: "/task/123" },
			{ text: "doc-9", url: "/documentation/9" },
			{ text: "decision-1", url: "/decisions/1" },
			{ text: "DRAFT-104", url: "/draft/104" },
		]);
	});

	it("resolves case and zero-padding variants to the canonical href", () => {
		const tree = linkify(knownIndex(), "See back-0123.");

		expect(linksIn(tree)).toEqual([{ text: "back-0123", url: "/task/123" }]);
	});

	it("leaves inline code and fenced code structurally untouched", () => {
		const tree = root(
			paragraph({ type: "inlineCode", value: "BACK-123" }),
			{ type: "code", value: "backlog task view BACK-123" },
			paragraph(textNode("Then BACK-123.")),
		);

		createEntityLinkPlugin(knownIndex())()(tree);

		expect(linksIn(tree)).toEqual([{ text: "BACK-123", url: "/task/123" }]);
	});

	it("keeps IDs inside existing links and definitions untouched", () => {
		const tree = root(
			paragraph({
				type: "link",
				url: "/task/BACK-123?view=detail",
				children: [textNode("BACK-123")],
			}),
			{
				type: "linkReference",
				identifier: "ref",
				children: [textNode("BACK-123")],
			},
		);
		const before = JSON.stringify(tree);

		createEntityLinkPlugin(knownIndex())()(tree);

		expect(JSON.stringify(tree)).toBe(before);
	});

	it("rejects tails of longer identifiers and file extensions", () => {
		const tree = linkify(knownIndex(), "Branch my-task-100, file BACK-1.md, path backlog/tasks/BACK-123.");

		expect(linksIn(tree)).toEqual([]);
	});

	it("rejects tokens that merely look like IDs", () => {
		const tree = linkify(knownIndex(), "Encoding UTF-8, dates in ISO-8601, release v1.2.3.");

		expect(linksIn(tree)).toEqual([]);
	});

	it("leaves unknown IDs plain", () => {
		const tree = linkify(knownIndex(), "Unknown reference BACK-9999 stays plain.");

		expect(linksIn(tree)).toEqual([]);
	});

	it("leaves ambiguous IDs plain", () => {
		const index = buildEntityIndex({ tasks: taskFixtures("BACK-1", "BACK-01", "BACK-2") });
		const tree = linkify(index, "Ambiguous BACK-1 and unambiguous BACK-2.");

		expect(linksIn(tree)).toEqual([{ text: "BACK-2", url: "/task/2" }]);
	});

	it("does not linkify anything when the index is empty", () => {
		const tree = linkify(buildEntityIndex({}), "BACK-123 and doc-9 stay plain.");

		expect(linksIn(tree)).toEqual([]);
	});

	it("does not linkify bare wiki paths on the render side", () => {
		const index = buildEntityIndex({ wikiPaths: ["patterns/cross-surface"] });
		const tree = linkify(index, "See patterns/cross-surface for details.");

		expect(linksIn(tree)).toEqual([]);
	});

	it("does not linkify IDs embedded in non-ASCII identifiers", () => {
		const tree = linkify(knownIndex(), "Tokens caféBACK-123 and BACK-123ä stay plain.");

		expect(linksIn(tree)).toEqual([]);
	});
});
