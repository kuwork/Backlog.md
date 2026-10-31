import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveQueryBlockStatement } from "../query-block/save.ts";
import { parseQueryBlock } from "../sqlite/block.ts";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "qb-save-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function writeDoc(relPath: string, body: string): Promise<void> {
	const abs = join(root, relPath);
	await mkdir(join(abs, ".."), { recursive: true });
	await writeFile(abs, body, "utf8");
}

async function readDoc(relPath: string): Promise<string> {
	return readFile(join(root, relPath), "utf8");
}

const BLOCK = "source: backlog/db.sqlite\nview: table\nsql: |\n  SELECT 1";
const DOC = `# Title\n\n\`\`\`sqlite-query\n${BLOCK}\n\`\`\`\n\nprose\n`;

const INLINE_BLOCK = "source: backlog/db.sqlite\nsql: SELECT 1";
const INLINE_DOC = `# Title\n\n\`\`\`sqlite-query\n${INLINE_BLOCK}\n\`\`\`\n`;

describe("saveQueryBlockStatement", () => {
	test("replaces the statement inside a block scalar", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(true);
		const text = await readDoc("doc.md");
		expect(text).toContain("  SELECT 2");
		expect(text).not.toContain("SELECT 1");
		// The fence and the fields around the statement are untouched.
		expect(text).toContain("```sqlite-query");
		expect(text).toContain("source: backlog/db.sqlite");
		expect(text).toContain("view: table");
	});

	test("keeps a multi-line statement indented under the block scalar", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT a\nFROM t\nWHERE a > 1",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("sql: |\n  SELECT a\n  FROM t\n  WHERE a > 1\n```");
	});

	test("returns the rewritten block so the caller can save again", async () => {
		await writeDoc("doc.md", DOC);
		const first = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const second = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: first.block,
			statement: "SELECT 3",
		});
		expect(second.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("  SELECT 3");
	});

	// The renderer hands the body over with a trailing newline that `remark-parse` does not carry
	// (mdast-util-to-hast appends one). Taken literally it is part of the body, which pushes the
	// closing fence onto the last statement line and silently breaks the fence.
	test("keeps the closing fence on its own line when the body carries a trailing newline", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: `${BLOCK}\n`,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(true);
		const text = await readDoc("doc.md");
		expect(text).toContain("  SELECT 2\n```");
		expect(text).not.toContain('"SELECT 2"```');
	});

	test("keeps the fence intact for a multi-line statement behind a trailing newline", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: `${BLOCK}\n`,
			statement: "SELECT a\nFROM t",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("sql: |\n  SELECT a\n  FROM t\n```");
	});

	test("leaves a saved block that still parses and is still fenced", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: `${BLOCK}\n`,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(true);
		const text = await readDoc("doc.md");
		const body = /```sqlite-query\n([\s\S]*?)\n```/.exec(text)?.[1] ?? "";
		expect(body).not.toBe("");
		const parsed = parseQueryBlock(body);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.sql).toBe("SELECT 2");
	});

	test("keeps an inline statement inline", async () => {
		await writeDoc("doc.md", INLINE_DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: INLINE_BLOCK,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("sql: SELECT 2\n```");
	});

	test("turns an inline statement into a block scalar when it gains lines", async () => {
		await writeDoc("doc.md", INLINE_DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: INLINE_BLOCK,
			statement: "SELECT a\nFROM t",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("sql: |\n  SELECT a\n  FROM t\n```");
	});

	test("edits the Cypher explorer's query field", async () => {
		const block = "source: main\nsource_type: db\nquery: MATCH (n) RETURN n";
		await writeDoc("doc.md", `\`\`\`cypher-query\n${block}\n\`\`\`\n`);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block,
			statement: "MATCH (n) RETURN count(n)",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toContain("query: MATCH (n) RETURN count(n)");
	});

	test("leaves the file alone when the statement did not change", async () => {
		await writeDoc("doc.md", DOC);
		const before = await readDoc("doc.md");
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT 1\n",
		});
		expect(result.ok).toBe(true);
		expect(await readDoc("doc.md")).toBe(before);
	});

	test("refuses an empty statement", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "   \n",
		});
		expect(result).toEqual({ ok: false, error: "The statement is empty." });
	});

	test("refuses a non-Markdown file", async () => {
		await writeDoc("notes.txt", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "notes.txt",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(result).toEqual({ ok: false, error: "Only Markdown files can hold query blocks." });
	});

	test("refuses a path that escapes the project", async () => {
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "../outside.md",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(false);
	});

	test("refuses when the block is gone", async () => {
		await writeDoc("doc.md", DOC);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: "source: backlog/db.sqlite\nsql: SELECT 99",
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(false);
	});

	test("refuses an ambiguous block", async () => {
		await writeDoc("doc.md", `${DOC}\n${DOC}`);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(false);
	});

	test("refuses a look-alike block that is not fenced", async () => {
		await writeDoc("doc.md", `${BLOCK}\n`);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block: BLOCK,
			statement: "SELECT 2",
		});
		expect(result.ok).toBe(false);
	});

	test("refuses a block without a statement field", async () => {
		const block = "source: backlog/db.sqlite\nview: table";
		await writeDoc("doc.md", `\`\`\`sqlite-query\n${block}\n\`\`\`\n`);
		const result = await saveQueryBlockStatement({
			projectRoot: root,
			filePath: "doc.md",
			block,
			statement: "SELECT 2",
		});
		expect(result).toEqual({ ok: false, error: "The block has no sql / query field to edit." });
	});
});
