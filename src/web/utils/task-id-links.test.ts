import { describe, expect, it } from "bun:test";
import type { Decision, Document, Task } from "../../types";
import {
	buildEntityIndex,
	createEntityLinkPlugin,
	type EntityIndex,
	parseMultiIdToken,
	resolveEntityRangeToken,
	scanEntityReferences,
} from "./task-id-links";

function task(id: string, title: string): Task {
	return { id, title } as unknown as Task;
}

function doc(id: string, title: string): Document {
	return { id, title } as unknown as Document;
}

function decision(id: string, title: string): Decision {
	return { id, title } as unknown as Decision;
}

function rangeIndex(): EntityIndex {
	// Range BACK-715~747: only endpoints + one gap exercises enumeration with missing middles.
	const tasks: Task[] = [
		task("BACK-715", "Start"),
		task("BACK-720", "Middle"),
		task("BACK-747", "End"),
		task("doc-9", "Doc nine"), // wrong kind, for mixed-kind guards
	];
	const docs: Document[] = [doc("DOC-001", "Guide"), doc("DOC-002", "Reference")];
	const decisions: Decision[] = [decision("DECISION-3", "Call")];
	return buildEntityIndex({ tasks, docs, decisions });
}

describe("parseMultiIdToken", () => {
	it("parses an inclusive range", () => {
		expect(parseMultiIdToken("BACK-715~747")).toEqual({
			prefix: "BACK",
			type: "range",
			start: "715",
			end: "747",
		});
	});

	it("parses a slash-list of arbitrary length", () => {
		expect(parseMultiIdToken("BACK-743/744/745")).toEqual({
			prefix: "BACK",
			type: "list",
			bodies: ["743", "744", "745"],
		});
	});

	it("returns null for a plain single ID", () => {
		expect(parseMultiIdToken("BACK-715")).toBeNull();
	});

	it("returns null for prose that merely contains a tilde", () => {
		expect(parseMultiIdToken("v1~2")).toBeNull();
	});

	it("rejects a trailing period as part of the token", () => {
		expect(parseMultiIdToken("BACK-715~747.")).toBeNull();
	});
});

describe("resolveEntityRangeToken", () => {
	it("lists only the locally-present IDs in a range, omitting absent ones", () => {
		const resolved = resolveEntityRangeToken(rangeIndex(), "BACK-715~747");
		expect(resolved?.kind).toBe("task");
		// Only the three loaded tasks in the span appear; absent IDs are excluded.
		expect(resolved?.entries.map((e) => e.id)).toEqual(["BACK-715", "BACK-720", "BACK-747"]);
		expect(resolved?.entries.every((e) => e.title !== null)).toBe(true);
	});

	it("fails closed when no ID in the range exists locally", () => {
		// Prefix DOC anchored to doc kind, but the task-kind endpoints are absent -> plain text.
		expect(resolveEntityRangeToken(rangeIndex(), "BACK-900~905")).toBeNull();
	});

	it("requires both range endpoints to resolve to the same kind", () => {
		// 999/1000 do not exist -> fail-closed.
		expect(resolveEntityRangeToken(rangeIndex(), "BACK-999~1000")).toBeNull();
		// doc-9 exists but is a task-shaped token -> endpoint resolves to task kind mismatch? doc-9 is a doc id but prefix BACK -> not a task.
		expect(resolveEntityRangeToken(rangeIndex(), "BACK-9~10")).toBeNull();
	});

	it("rejects a descending range", () => {
		expect(resolveEntityRangeToken(rangeIndex(), "BACK-747~715")).toBeNull();
	});

	it("resolves a slash-list when every ID resolves to the same kind", () => {
		const resolved = resolveEntityRangeToken(rangeIndex(), "BACK-715/720/747");
		expect(resolved?.kind).toBe("task");
		expect(resolved?.entries.map((e) => e.id)).toEqual(["BACK-715", "BACK-720", "BACK-747"]);
	});

	it("fails closed when a slash-list entry is unknown", () => {
		expect(resolveEntityRangeToken(rangeIndex(), "BACK-715/999")).toBeNull();
	});

	it("fails closed when a slash-list mixes kinds", () => {
		// DOC-001/DOC-002 are docs, but the prefix DOC anchors doc kind.
		const resolvedDocs = resolveEntityRangeToken(rangeIndex(), "DOC-001/002");
		expect(resolvedDocs?.kind).toBe("doc");
		expect(resolvedDocs?.entries.map((e) => e.id)).toEqual(["DOC-001", "DOC-002"]);
		// Mixing a task id into a doc list is rejected.
		expect(resolveEntityRangeToken(rangeIndex(), "DOC-001/BACK-715")).toBeNull();
	});

	it("canonicalizes zero-padding and case", () => {
		const idx = buildEntityIndex({ tasks: [task("BACK-7", "Seven"), task("BACK-8", "Eight"), task("BACK-9", "Nine")] });
		const resolved = resolveEntityRangeToken(idx, "back-007~009");
		expect(resolved?.kind).toBe("task");
		expect(resolved?.entries.map((e) => e.id)).toEqual(["BACK-7", "BACK-8", "BACK-9"]);
	});

	it("covers decisions and drafts", () => {
		const idx = buildEntityIndex({
			decisions: [decision("DECISION-1", "A"), decision("DECISION-2", "B")],
			drafts: [task("DRAFT-10", "D10"), task("DRAFT-11", "D11")],
		});
		expect(resolveEntityRangeToken(idx, "DECISION-1~2")?.kind).toBe("decision");
		expect(resolveEntityRangeToken(idx, "DRAFT-10/11")?.kind).toBe("draft");
	});
});

describe("createEntityLinkPlugin multi-ID", () => {
	type TextNode = { type: "text"; value: string };
	type LinkNode = { type: "link"; url: string; children: TextNode[] };
	type ParaNode = { type: "paragraph"; children: (TextNode | LinkNode)[] };

	function runPlugin(value: string): ParaNode {
		const index = rangeIndex();
		const transform = createEntityLinkPlugin(index);
		const tree = {
			type: "root",
			children: [{ type: "paragraph", children: [{ type: "text", value }] }],
		} as unknown as Parameters<ReturnType<ReturnType<typeof createEntityLinkPlugin>>>[0];
		transform()(tree as never);
		const para = (tree as { children: ParaNode[] }).children[0];
		if (!para) throw new Error("expected a paragraph node");
		return para;
	}

	it("collapses a range into a single entity-range link node", () => {
		const paragraph = runPlugin("see BACK-715~747 now");
		const children = paragraph.children;
		expect(children.map((c) => c.type)).toEqual(["text", "link", "text"]);
		expect((children[1] as LinkNode).url).toBe("entity-range:task:BACK-715~747");
		expect((children[1] as LinkNode).children[0]?.value).toBe("BACK-715~747");
	});

	it("collapses a slash-list into a single entity-range link node", () => {
		const paragraph = runPlugin("refs BACK-715/720/747");
		expect((paragraph.children[1] as LinkNode).url).toBe("entity-range:task:BACK-715/720/747");
	});

	it("leaves an unresolvable range as plain text (fail-closed)", () => {
		const paragraph = runPlugin("BACK-999~1000");
		// No link node produced; the token stays a single text node.
		expect(paragraph.children).toHaveLength(1);
		expect(paragraph.children[0]?.type).toBe("text");
	});

	it("does not link inside an existing markdown link", () => {
		const index = rangeIndex();
		const transform = createEntityLinkPlugin(index);
		const tree = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "link",
							url: "https://example.com",
							children: [{ type: "text", value: "BACK-715~747 inside" }],
						},
					],
				},
			],
		};
		transform()(tree as never);
		const paragraph = (tree as { children: { children: { type: string }[] }[] }).children[0];
		if (!paragraph) throw new Error("expected a paragraph node");
		expect(paragraph.children[0]?.type).toBe("link");
	});
});

describe("scanEntityReferences multi-ID", () => {
	const docIndex = buildEntityIndex({
		docs: [doc("doc-10", "Ten"), doc("doc-11", "Eleven"), doc("doc-12", "Twelve")],
	});

	it("expands a numeric-end range into one reference per entity", () => {
		const found = scanEntityReferences("doc-10~12", docIndex);
		expect(found.map((entry) => entry.id)).toEqual(["doc-10", "doc-11", "doc-12"]);
	});

	it("expands a full-end-id range into one reference per entity", () => {
		const found = scanEntityReferences("doc-10~doc-12", docIndex);
		expect(found.map((entry) => entry.id)).toEqual(["doc-10", "doc-11", "doc-12"]);
	});

	it("expands a slash-list into one reference per entry", () => {
		const found = scanEntityReferences("doc-10/11/12", docIndex);
		expect(found.map((entry) => entry.id)).toEqual(["doc-10", "doc-11", "doc-12"]);
	});

	it("still reports single IDs unchanged", () => {
		const found = scanEntityReferences("doc-10 and doc-12", docIndex);
		expect(found.map((entry) => entry.id)).toEqual(["doc-10", "doc-12"]);
	});

	it("fails closed on a range whose endpoints do not both resolve", () => {
		// Only doc-10 exists; the span is not enumerated, so no reference leaks.
		const sparse = buildEntityIndex({ docs: [doc("doc-10", "Ten")] });
		expect(scanEntityReferences("doc-10~12", sparse)).toEqual([{ kind: "doc", id: "doc-10" }]);
	});
});
