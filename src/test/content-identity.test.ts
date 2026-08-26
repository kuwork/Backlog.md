import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { parseMarkdown } from "../markdown/parser.ts";
import { serializeDecision, serializeDocument } from "../markdown/serializer.ts";
import type { Decision, Document } from "../types/index.ts";
import { findDecisionById } from "../utils/decision-id.ts";
import { documentIdsEqual } from "../utils/document-id.ts";
import { AmbiguousIdError } from "../utils/entity-id.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

function makeDocument(id: string, title: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent: `${title} body`,
	};
}

function makeDecision(id: string, title: string): Decision {
	return {
		id,
		title,
		date: "2026-08-01 00:00",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	};
}

async function writeDocument(relativePath: string, document: Document): Promise<string> {
	const filePath = join(core.filesystem.docsDir, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(filePath, serializeDocument(document));
	return filePath;
}

async function writeDecision(filename: string, decision: Decision): Promise<string> {
	const filePath = join(core.filesystem.decisionsDir, filename);
	await mkdir(core.filesystem.decisionsDir, { recursive: true });
	await Bun.write(filePath, serializeDecision(decision));
	return filePath;
}

// gray-matter rejects an unterminated flow collection, so these files cannot be parsed at all.
function malformedFrontmatter(id: string): string {
	return `---\nid: ${id}\ntitle: [unterminated\n---\n\n${id} body\n`;
}

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("content-identity");
	await mkdir(TEST_DIR, { recursive: true });
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Content identity");
});

afterEach(async () => {
	core.disposeSearchService();
	core.disposeContentStore();
	await safeCleanup(TEST_DIR);
});

describe("blank entity IDs", () => {
	it("never match another ID, including another blank one", () => {
		expect(documentIdsEqual("", "")).toBe(false);
		expect(documentIdsEqual("doc-", "")).toBe(false);

		const blankDecisions = [
			{ id: "", title: "A", path: "decision-A.md" },
			{ id: "", title: "B", path: "decision-B.md" },
		];
		expect(findDecisionById(blankDecisions, "")).toBeNull();
		expect(findDecisionById(blankDecisions, "decision-")).toBeNull();
	});
});

describe("equivalent padded IDs", () => {
	it("resolve to one canonical key", () => {
		expect(documentIdsEqual("doc-7", "doc-0007")).toBe(true);
		expect(documentIdsEqual("DOC-7", "doc-0007")).toBe(true);
	});
});

describe("ambiguous lookups fail closed", () => {
	it("documents throw and name every candidate relative path", async () => {
		await writeDocument("doc-1 - Alpha.md", makeDocument("doc-1", "Alpha"));
		await writeDocument("nested/doc-01 - Beta.md", makeDocument("doc-01", "Beta"));

		let thrown: unknown = null;
		try {
			await core.getDocument("doc-01");
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(AmbiguousIdError);
		const message = (thrown as AmbiguousIdError).message;
		expect(message).toContain("Document ID doc-01 is ambiguous");
		expect(message).toContain("doc-1 - Alpha.md");
		expect(message).toContain("nested/doc-01 - Beta.md");
		expect((thrown as AmbiguousIdError).candidates).toHaveLength(2);
	});

	it("decisions throw and name every candidate file", async () => {
		await writeDecision("decision-1 - Alpha.md", makeDecision("decision-1", "Alpha"));
		await writeDecision("decision-001 - Beta.md", makeDecision("decision-001", "Beta"));

		let thrown: unknown = null;
		try {
			await core.filesystem.loadDecision("decision-001");
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(AmbiguousIdError);
		const message = (thrown as AmbiguousIdError).message;
		expect(message).toContain("Decision ID decision-001 is ambiguous");
		expect(message).toContain("decision-1 - Alpha.md");
		expect(message).toContain("decision-001 - Beta.md");
	});

	it("unique IDs still resolve through padded or prefixed forms", async () => {
		await writeDocument("doc-7 - Solo.md", makeDocument("doc-7", "Solo"));
		await writeDecision("decision-07 - Solo.md", makeDecision("decision-07", "Solo"));

		const doc = await core.getDocument("0007");
		expect(doc?.id).toBe("doc-7");
		const decision = await core.filesystem.loadDecision("7");
		expect(decision?.id).toBe("decision-07");
	});
});

describe("listDecisions", () => {
	it("attaches backlog-relative paths to every entry", async () => {
		await writeDecision("decision-2 - Second.md", makeDecision("decision-2", "Second"));
		const decisions = await core.filesystem.listDecisions();
		expect(decisions.map((entry) => entry.path)).toContain("decision-2 - Second.md");
	});

	it("skips a malformed file instead of hiding every decision", async () => {
		await writeDecision("decision-3 - Good.md", makeDecision("decision-3", "Good"));
		await Bun.write(join(core.filesystem.decisionsDir, "decision-4 - Bad.md"), malformedFrontmatter("decision-4"));

		const decisions = await core.filesystem.listDecisions();
		expect(decisions.map((entry) => entry.id)).toEqual(["decision-3"]);
	});

	it("collects malformed files through the unreadable out-param", async () => {
		await writeDecision("decision-5 - Good.md", makeDecision("decision-5", "Good"));
		await Bun.write(join(core.filesystem.decisionsDir, "decision-6 - Bad.md"), malformedFrontmatter("decision-6"));

		const unreadable: string[] = [];
		const decisions = await core.filesystem.listDecisions(unreadable);
		expect(decisions.map((entry) => entry.id)).toEqual(["decision-5"]);
		expect(unreadable).toEqual(["decision-6 - Bad.md"]);
	});
});

describe("gray-matter cache poisoning", () => {
	it("malformed frontmatter fails on every parse, not only the first", () => {
		const content = malformedFrontmatter("doc-9");
		expect(() => parseMarkdown(content)).toThrow();
		expect(() => parseMarkdown(content)).toThrow();
	});
});
