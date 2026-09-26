import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptyParseReports, type ParseReports } from "../graph/cold-start";
import type { ParsedRecord } from "../graph/parser";
import { parseTaskFile } from "../graph/parser";
import { resolveRelations } from "../graph/relations";
import { scanWhitelistedDirs } from "../graph/scanner";
import type { GraphEdge, GraphKind } from "../graph/store";
import { lintKnowledgeCorpus } from "../graph/validation";

/**
 * Phase 3 (doc-15): knowledge files enter the same FileNode table, with the node type read from the
 * explicit frontmatter `file_type` - never from the folder - plus the three mechanical relation
 * tables (TaggedWith / SourcedFrom / LinksTo) and the lint classification on top of them.
 */

let root: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "backlog-knowledge-"));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

/** Frontmatter + body, so the tests state exactly which fields a file declares. */
function md(fields: Record<string, string | string[]>, body = ""): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${item}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push("---", "", body, "");
	return lines.join("\n");
}

function record(partial: Partial<ParsedRecord> & { filePath: string }): ParsedRecord {
	return {
		id: "",
		title: partial.filePath,
		kind: "wiki",
		status: "",
		updatedDate: "",
		parentTaskId: null,
		milestone: null,
		dependencies: [],
		labels: [],
		sourcePath: null,
		wikilinks: [],
		...partial,
	};
}

const edgeSet = (edges: GraphEdge[]) => edges.map((e) => `${e.type}:${e.from}->${e.to}`).sort();

describe("knowledge scan scope", () => {
	test("walks the knowledge directories recursively, leaving index.md and log.md out", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-scan3-"));
		try {
			const files: Record<string, string> = {
				"wiki/index.md": md({ title: "Catalog" }),
				"wiki/log.md": md({ title: "Log" }),
				"wiki/concepts/a.md": md({ file_type: "wiki" }),
				"wiki/sources/deep/b.md": md({ file_type: "wiki" }),
				"docs/guide/c.md": md({ file_type: "document" }),
				"decisions/d.md": md({ file_type: "decision" }),
				"tasks/back-1 - T.md": md({ id: "back-1", title: "T", status: "To Do" }),
			};
			for (const [relPath, content] of Object.entries(files)) {
				const abs = join(dir, "backlog", relPath);
				await mkdir(dirname(abs), { recursive: true });
				await writeFile(abs, content, "utf8");
			}
			const scanned = await scanWhitelistedDirs(dir);
			expect(scanned.map((f) => f.relPath)).toEqual([
				"decisions/d.md",
				"docs/guide/c.md",
				"tasks/back-1 - T.md",
				"wiki/concepts/a.md",
				"wiki/sources/deep/b.md",
			]);
			// The whitelisted directory decides the node type; a knowledge subfolder never does.
			const kindOf = (relPath: string) => scanned.find((f) => f.relPath === relPath)?.kind;
			expect(kindOf("tasks/back-1 - T.md")).toBe("task");
			expect(kindOf("docs/guide/c.md")).toBe("document");
			expect(kindOf("decisions/d.md")).toBe("decision");
			expect(kindOf("wiki/concepts/a.md")).toBe("wiki");
			expect(kindOf("wiki/sources/deep/b.md")).toBe("wiki"); // the subfolder does not change it
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("knowledge node types", () => {
	async function parse(relPath: string, content: string, kind: GraphKind) {
		const abs = join(root, relPath.replace(/\//g, "_"));
		await writeFile(abs, content, "utf8");
		return parseTaskFile(abs, relPath, kind);
	}

	test("the type comes from the whitelisted directory; frontmatter and subfolders never decide it", async () => {
		const cases: Array<[string, GraphKind, GraphKind]> = [
			["wiki/concepts/a.md", "wiki", "wiki"],
			// The subfolder is navigation only: a page under wiki/decisions/ is still a wiki node.
			["wiki/decisions/b.md", "wiki", "wiki"],
			["wiki/sources/deep/c.md", "wiki", "wiki"],
			["decisions/d.md", "decision", "decision"],
			["docs/BRDS/e.md", "document", "document"],
			["tasks/back-1 - T.md", "task", "task"],
		];
		for (const [relPath, kind, expected] of cases) {
			const parsed = await parse(relPath, md({ id: "back-1", title: "T" }), kind);
			expect(parsed.record?.kind).toBe(expected);
		}
	});

	test("frontmatter neither overrides nor creates a type", async () => {
		// `file_type` is not a Backlog field, and `type` is the document kind - neither is read.
		const parsed = await parse("wiki/concepts/x.md", md({ file_type: "document", type: "guide" }), "wiki");
		expect(parsed.record?.kind).toBe("wiki");
	});

	test("work files require an id; knowledge files have none to require", async () => {
		const work = await parse("tasks/back-1.md", md({ title: "No id" }), "task");
		expect(work.record).toBeUndefined();
		expect(work.warning).toContain("missing frontmatter id");
		const knowledge = await parse("wiki/concepts/i.md", md({ title: "No id either" }), "wiki");
		expect(knowledge.warning).toBeUndefined();
		expect(knowledge.record?.id).toBe("");
	});

	test("the deferred relations field is ignored without a warning", async () => {
		const parsed = await parse("wiki/concepts/j.md", md({ relations: "[{type: supports, target: x.md}]" }), "wiki");
		expect(parsed.warning).toBeUndefined();
		expect(parsed.record?.kind).toBe("wiki");
	});

	test("labels, source_path and body wikilinks are parsed (alias and heading stripped)", async () => {
		const parsed = await parse(
			"wiki/concepts/k.md",
			md(
				{ labels: ["concept", "topic/lint"], source_path: "backlog/tasks/back-1 - T.md" },
				"See [[concepts/wiki-lint]] and [[concepts/other|Alias]] and [[concepts/third#Section]].",
			),
			"wiki",
		);
		expect(parsed.record?.labels).toEqual(["concept", "topic/lint"]);
		expect(parsed.record?.sourcePath).toBe("backlog/tasks/back-1 - T.md");
		expect(parsed.record?.wikilinks).toEqual(["concepts/wiki-lint", "concepts/other", "concepts/third"]);
	});

	test("work files carry no wikilinks - only knowledge bodies are citation sources", async () => {
		const parsed = await parse("tasks/back-2.md", md({ id: "back-2", title: "T" }, "See [[concepts/a]]."), "task");
		expect(parsed.record?.wikilinks).toEqual([]);
	});
});

describe("phase-3 relations", () => {
	test("labels on knowledge files tag the graph; a task's own labels stay out", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/concepts/a.md", kind: "wiki", labels: ["concept", "topic/lint"] }),
			record({ filePath: "decisions/d.md", kind: "decision", labels: ["architecture"] }),
			// A task's `labels` are Backlog's task classification, a different vocabulary: it must not
			// put `bug` into the same Tag table the knowledge layer counts.
			record({ filePath: "tasks/back-1.md", kind: "task", id: "back-1", labels: ["bug"] }),
		]);
		expect(edgeSet(result.edges)).toEqual([
			"TaggedWith:decisions/d.md->architecture",
			"TaggedWith:wiki/concepts/a.md->concept",
			"TaggedWith:wiki/concepts/a.md->topic/lint",
		]);
		expect(result.tags).toEqual(["architecture", "concept", "topic/lint"]);
	});

	test("SourcedFrom resolves by path first, then by the id a renamed file still carries", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/sources/a.md", kind: "wiki", sourcePath: "backlog/tasks/back-1 - T.md" }),
			// The original was renamed: only the id in the old file name still matches.
			record({ filePath: "wiki/sources/b.md", kind: "wiki", sourcePath: "backlog/tasks/back-2 - Old-name.md" }),
			record({ filePath: "tasks/back-1 - T.md", kind: "task", id: "back-1" }),
			record({
				filePath: "tasks/back-2 - New-name.md",
				kind: "task",
				id: "back-2",
			}),
		]);
		expect(edgeSet(result.edges)).toEqual([
			"SourcedFrom:wiki/sources/a.md->tasks/back-1 - T.md",
			"SourcedFrom:wiki/sources/b.md->tasks/back-2 - New-name.md",
		]);
		expect(result.unresolvedSources).toEqual([]);
	});

	test("a corpus-internal source that resolves to nothing is a defect; an external original is informational", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/sources/a.md", kind: "wiki", sourcePath: "backlog/tasks/back-404 - Gone.md" }),
			record({ filePath: "wiki/sources/b.md", kind: "wiki", sourcePath: "src/file-system/operations.ts" }),
			record({ filePath: "wiki/sources/c.md", kind: "wiki", sourcePath: "backlog/docs/ + backlog/decisions/" }),
		]);
		expect(result.edges).toEqual([]);
		expect(result.unresolvedSources).toHaveLength(1);
		expect(result.unresolvedSources[0]).toContain("back-404");
		expect(result.informational).toHaveLength(2); // the external source and the prose value
	});

	test("an ambiguous id is fail-closed: no edge, and no silent first match", () => {
		const result = resolveRelations([
			// The recorded path no longer exists (the original was renamed), so resolution falls back
			// to the id the old file name carries - which two files now claim.
			record({ filePath: "wiki/sources/a.md", kind: "wiki", sourcePath: "backlog/tasks/back-9 - Old-name.md" }),
			record({ filePath: "tasks/back-9 - A.md", kind: "task", id: "back-9" }),
			record({ filePath: "completed/back-9 - A.md", kind: "task", id: "back-9" }),
		]);
		expect(result.edges).toEqual([]);
		expect(result.unresolvedSources[0]).toContain("2 records");
	});

	test("an exact path match wins over the id fallback, even when the id is ambiguous", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/sources/a.md", kind: "wiki", sourcePath: "backlog/tasks/back-9 - A.md" }),
			record({ filePath: "tasks/back-9 - A.md", kind: "task", id: "back-9" }),
			record({ filePath: "completed/back-9 - A.md", kind: "task", id: "back-9" }),
		]);
		expect(edgeSet(result.edges)).toEqual(["SourcedFrom:wiki/sources/a.md->tasks/back-9 - A.md"]);
	});

	test("LinksTo resolves against the wiki root and the page-relative form, alias taken by the path part", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/sources/a.md", kind: "wiki", wikilinks: ["concepts/wiki-lint"] }),
			// The page-relative form settled by BACK-482: written from wiki/sources/, `..` lands in wiki/.
			record({ filePath: "wiki/sources/b.md", kind: "wiki", wikilinks: ["../developer-notes/security-gotchas"] }),
			record({ filePath: "wiki/concepts/wiki-lint.md", kind: "wiki" }),
			record({ filePath: "wiki/developer-notes/security-gotchas.md", kind: "wiki" }),
		]);
		expect(edgeSet(result.edges)).toEqual([
			"LinksTo:wiki/sources/a.md->wiki/concepts/wiki-lint.md",
			"LinksTo:wiki/sources/b.md->wiki/developer-notes/security-gotchas.md",
		]);
		expect(result.unresolvedLinks).toEqual([]);
	});

	test("placeholders, embeds and out-of-whitelist targets are informational, not defects", () => {
		const result = resolveRelations([
			record({
				filePath: "wiki/overview.md",
				kind: "wiki",
				wikilinks: ["path/to/page", "assets/photo.png", "wiki_output/reports/x"],
			}),
			record({ filePath: "wiki/concepts/a.md", kind: "wiki", wikilinks: ["concepts/missing"] }),
		]);
		expect(result.edges).toEqual([]);
		expect(result.unresolvedLinks).toEqual([]);
		expect(result.informational).toHaveLength(4);
	});

	test("knowledge files carry no id, so they never join the duplicate-id pool", () => {
		const result = resolveRelations([
			record({ filePath: "wiki/concepts/a.md", kind: "wiki" }),
			record({ filePath: "wiki/concepts/b.md", kind: "wiki" }),
		]);
		expect(result.ambiguousIds).toEqual([]);
	});
});

describe("knowledge lint", () => {
	function reports(overrides: Partial<ParseReports> = {}): ParseReports {
		return { ...emptyParseReports(), ...overrides };
	}

	test("a broken corpus-internal reference is a defect; expected noise is not", () => {
		const lint = lintKnowledgeCorpus(
			reports({
				unresolvedSources: ["source_path 'backlog/tasks/back-404 - Gone.md' in 'wiki/c.md' ..."],
				unresolvedLinks: ["wikilink '[[concepts/x]]' in 'wiki/d.md' resolves to 2 pages ..."],
				informational: ["wikilink '[[path/to/page]]' in 'wiki/e.md': no such page"],
			}),
		);
		expect(lint.defects).toHaveLength(2);
		expect(lint.informational).toHaveLength(1);
		expect(lint.passed).toBe(false); // a broken corpus-internal reference is a real problem
	});

	test("a tree whose findings are all informational passes", () => {
		const lint = lintKnowledgeCorpus(reports({ informational: ["noise", "more noise"] }));
		expect(lint.passed).toBe(true);
		expect(lint.defects).toEqual([]);
	});
});
