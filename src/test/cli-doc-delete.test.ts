import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeDocument } from "../markdown/serializer.ts";
import type { Document } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

const cliPath = join(process.cwd(), "src", "cli.ts");

function makeDocument(id: string, title: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent: `${title} body`,
	};
}

async function writeDocFile(relativePath: string, document: Document): Promise<void> {
	const filePath = join(core.filesystem.docsDir, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(filePath, serializeDocument(document));
}

describe("CLI doc delete command", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doc-delete");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Delete Project");
		await core.createDocument({
			id: "doc-1",
			title: "Architecture Overview",
			type: "guide",
			createdDate: "2026-07-04",
			rawContent: "Service topology details.",
		});

		await writeDocFile("guide/doc-14 - Guide-Topic.md", makeDocument("doc-14", "Guide Topic"));
		await writeDocFile("migration/doc-14 - Migration-Guide.md", makeDocument("doc-14", "Migration Guide"));
		await writeDocFile("guides/setup/doc-20 - Setup.md", makeDocument("doc-20", "Setup"));
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("deletes a document by id", async () => {
		const result = await $`bun ${cliPath} doc delete doc-1`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Deleted document doc-1");
		const documents = await core.filesystem.listDocuments();
		expect(documents.some((document) => document.id === "doc-1")).toBe(false);
	});

	it("reports a missing document with a non-zero exit code", async () => {
		const result = await $`bun ${cliPath} doc delete no-such-doc`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Document no-such-doc not found.");
	});

	it("reports an ambiguous id with delete hints", async () => {
		const result = await $`bun ${[cliPath, "doc", "delete", "14"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Hint: delete one file directly without renaming:");
		expect(result.stderr.toString()).toContain("backlog doc delete");
	});

	it("deletes a folder and every file beneath it", async () => {
		const result = await $`bun ${cliPath} doc folder delete guides`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Deleted docs folder guides");
		expect(existsSync(join(core.filesystem.docsDir, "guides"))).toBe(false);
		const documents = await core.filesystem.listDocuments();
		expect(documents.some((document) => document.id === "doc-20")).toBe(false);
	});

	it("rejects a folder path that traverses outside docs", async () => {
		const result = await $`bun ${[cliPath, "doc", "folder", "delete", "../decisions"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot delete docs folder ../decisions");
	});

	it("refuses to delete the docs root", async () => {
		const result = await $`bun ${[cliPath, "doc", "folder", "delete", "."]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot delete docs folder .");
		expect(existsSync(core.filesystem.docsDir)).toBe(true);
	});

	it("reports a missing folder with a non-zero exit code", async () => {
		const result = await $`bun ${cliPath} doc folder delete absent`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Docs folder absent not found or not a deletable folder.");
	});
});
