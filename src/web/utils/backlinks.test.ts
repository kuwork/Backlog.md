import { describe, expect, it } from "bun:test";
import type { Decision, Document, Task } from "../../types";
import { buildBacklinkIndex, entityBacklinkKey, findBacklinks, stripCodeBlocks } from "./backlinks";
import { buildEntityIndex, scanEntityReferences } from "./task-id-links";

function task(id: string, body: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Title ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		rawContent: body,
		...overrides,
	} as Task;
}

function doc(id: string): Document {
	return {
		id,
		title: `Doc ${id}`,
		type: "other",
		createdDate: "2026-01-01",
		rawContent: `Body ${id}`,
	} as Document;
}

function decision(id: string): Decision {
	return {
		id,
		title: `Decision ${id}`,
		date: "2026-01-01",
		status: "accepted",
		context: "c",
		decision: "d",
		consequences: "c",
		rawContent: "body",
	} as Decision;
}

const docs = [doc("doc-1"), doc("doc-10"), doc("doc-11"), doc("doc-12")];
const decisions = [decision("decision-3")];

function indexFor(tasks: Task[]) {
	return buildEntityIndex({ tasks, docs, decisions });
}

describe("stripCodeBlocks", () => {
	it("drops fenced blocks, inline code and indented code", () => {
		const source = ["prose", "```", "doc-1 in a fence", "```", "    doc-12 indented", "inline `doc-1` here"].join("\n");
		const stripped = stripCodeBlocks(source);
		expect(stripped).toContain("prose");
		expect(stripped).not.toContain("in a fence");
		expect(stripped).not.toContain("indented");
		expect(stripped).not.toContain("doc-1");
	});

	it("leaves ordinary prose untouched", () => {
		expect(stripCodeBlocks("See doc-1 and decision-3")).toBe("See doc-1 and decision-3");
	});
});

describe("scanEntityReferences", () => {
	it("reports only references that resolve through the index", () => {
		const index = indexFor([]);
		const found = scanEntityReferences("doc-1 and decision-3 and doc-99", index);
		expect(found).toEqual([
			{ kind: "doc", id: "doc-1" },
			{ kind: "decision", id: "decision-3" },
		]);
	});

	it("reports each reference separately", () => {
		const index = indexFor([]);
		const found = scanEntityReferences("doc-1 and doc-12", index);
		expect(found.map((entry) => entry.id)).toEqual(["doc-1", "doc-12"]);
	});
});

describe("buildBacklinkIndex", () => {
	it("lists the tasks that mention a document", () => {
		const index = indexFor([task("BACK-1", "Documented in doc-1"), task("BACK-2", "unrelated")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-12")).toEqual([]);
	});

	it("ignores references inside code", () => {
		const index = indexFor([task("BACK-1", "```\ndoc-1\n```\nand `doc-1` inline")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1")).toEqual([]);
	});

	it("treats case, zero-padding and # prefixed variants as the same document", () => {
		const index = indexFor([
			task("BACK-1", "doc-1"),
			task("BACK-2", "DOC-01"),
			task("BACK-3", "#doc-1"),
			task("BACK-4", "doc-001"),
		]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1").map((entry) => entry.taskId)).toEqual([
			"BACK-1",
			"BACK-2",
			"BACK-3",
			"BACK-4",
		]);
	});

	it("counts a task once per entity and records the number of mentions", () => {
		const index = indexFor([task("BACK-1", "doc-12 here, doc-12 there, doc-12 everywhere")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		const entries = findBacklinks(backlinks, "doc", "doc-12");
		expect(entries).toHaveLength(1);
		expect(entries[0]?.occurrences).toBe(3);
	});

	it("sorts entries by task id, numerically rather than lexically", () => {
		const index = indexFor([task("BACK-10", "doc-1"), task("BACK-9", "doc-1"), task("BACK-2", "doc-1")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1").map((entry) => entry.taskId)).toEqual([
			"BACK-2",
			"BACK-9",
			"BACK-10",
		]);
	});

	it("indexes decisions as well", () => {
		const index = indexFor([task("BACK-1", "See decision-3 for the rationale")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "decision", "decision-3").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("falls back to the structured fields when a task carries no rawContent", () => {
		const withoutRaw = {
			id: "BACK-1",
			title: "Title",
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-01",
			labels: [],
			dependencies: [],
			description: "mentions doc-1",
			implementationNotes: "and decision-3",
		} as Task;
		const index = indexFor([withoutRaw]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "decision", "decision-3").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("keys are canonical, so a document id with padding resolves to the same bucket", () => {
		expect(entityBacklinkKey("doc", "DOC-001")).toBe(entityBacklinkKey("doc", "doc-1"));
	});

	it("finds backlinks from the documentation field, not just the body", () => {
		const index = indexFor([task("BACK-1", "unrelated body", { documentation: ["doc-12"] })]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-12").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("scans each documentation entry as its own reference source", () => {
		const index = indexFor([
			task("BACK-1", "body about doc-1", { documentation: ["src/guidelines/mcp/task-finalization.md", "doc-10"] }),
		]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-1").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-10").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("expands a body range into a backlink under every document in the span", () => {
		const index = indexFor([task("BACK-1", "covers doc-10~12")]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-10").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-11").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-12").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("expands a slash-list in the documentation field into several backlinks", () => {
		const index = indexFor([task("BACK-1", "unrelated", { documentation: ["doc-10/11/12"] })]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-10").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-11").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-12").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});

	it("expands a full-end-id range written in the documentation field", () => {
		const index = indexFor([task("BACK-1", "unrelated", { documentation: ["doc-10~doc-12"] })]);
		const backlinks = buildBacklinkIndex(index.tasks.values(), index);
		expect(findBacklinks(backlinks, "doc", "doc-10").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
		expect(findBacklinks(backlinks, "doc", "doc-12").map((entry) => entry.taskId)).toEqual(["BACK-1"]);
	});
});
