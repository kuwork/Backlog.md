import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeDocument } from "../markdown/serializer.ts";
import type { Document } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

let core: Core;

function makeDocument(id: string, title: string, rawContent: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent,
	};
}

async function writeDocFile(relativePath: string, document: Document): Promise<void> {
	const filePath = join(core.filesystem.docsDir, ...relativePath.split("/"));
	await mkdir(join(filePath, ".."), { recursive: true });
	await Bun.write(filePath, serializeDocument(document));
}

describe("CLI doc view command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doc-view");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc View Project");

		await core.createDocument({
			id: "doc-1",
			title: "Architecture Overview",
			type: "guide",
			createdDate: "2026-07-04",
			rawContent: "Service topology and indexing architecture details.",
		});

		// Two files share frontmatter id doc-14 in different directories: the collision
		// that path and title-slug lookups must disambiguate.
		await writeDocFile("guide/doc-14 - Guide-Topic.md", makeDocument("doc-14", "Guide Topic", "Guide topic body."));
		await writeDocFile(
			"migration/doc-14 - Migration-Guide.md",
			makeDocument("doc-14", "Migration Guide", "Migration guide body."),
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("prints document content with --plain", async () => {
		const result = await $`bun ${cliPath} doc view doc-1 --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Architecture Overview");
		expect(stdout).toContain("Service topology and indexing architecture details.");
	});

	it("falls back to plain output without --plain when not attached to a TTY", async () => {
		const result = await $`bun ${cliPath} doc view doc-1`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Service topology and indexing architecture details.");
	});

	it("still fails closed when a bare ID matches several documents", async () => {
		const result = await $`bun ${[cliPath, "doc", "view", "14", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		const stderr = result.stderr.toString();
		expect(stderr).toContain("Document ID doc-14 is ambiguous; 2 files match:");
		expect(stderr).toContain("guide/doc-14 - Guide-Topic.md");
		expect(stderr).toContain("migration/doc-14 - Migration-Guide.md");
		expect(stderr).toContain("Hint: view one file directly without renaming:");
		expect(stderr).toContain("backlog doc view guide/doc-14");
		expect(stderr).toContain("backlog doc view migration/doc-14");
	});

	it("resolves a document by its docs-relative path stem", async () => {
		const result = await $`bun ${[cliPath, "doc", "view", "migration/doc-14", "--plain"]}`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Migration guide body.");
		expect(stdout).not.toContain("Guide topic body.");
	});

	it("resolves a document by its full docs-relative filename with extension", async () => {
		const result = await $`bun ${[cliPath, "doc", "view", "guide/doc-14 - Guide-Topic.md", "--plain"]}`
			.cwd(TEST_DIR)
			.quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Guide topic body.");
		expect(stdout).not.toContain("Migration guide body.");
	});

	it("resolves a document by its filename title slug regardless of case", async () => {
		for (const slug of ["Migration-Guide", "migration-guide"]) {
			const result = await $`bun ${[cliPath, "doc", "view", slug, "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();

			expect(result.exitCode).toBe(0);
			const stdout = result.stdout.toString();
			expect(stdout).toContain("Migration guide body.");
			expect(stdout).not.toContain("Guide topic body.");
		}
	});

	it("fails closed when a title slug matches several documents", async () => {
		await writeDocFile(
			"archive/doc-20 - Release-Notes.md",
			makeDocument("doc-20", "Release Notes", "Archive release notes body."),
		);
		await writeDocFile(
			"notes/doc-21 - Release-Notes.md",
			makeDocument("doc-21", "Release Notes", "Notes release notes body."),
		);

		const result = await $`bun ${[cliPath, "doc", "view", "Release-Notes", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		const stderr = result.stderr.toString();
		expect(stderr).toContain('Document reference "Release-Notes" is ambiguous; 2 files match:');
		expect(stderr).toContain("archive/doc-20 - Release-Notes.md");
		expect(stderr).toContain("notes/doc-21 - Release-Notes.md");
	});

	it("suggests full filenames when the path stem alone stays ambiguous", async () => {
		await writeDocFile("notes/doc-30 - Alpha-One.md", makeDocument("doc-30", "Alpha One", "Alpha one body."));
		await writeDocFile("notes/doc-30 - Beta-Two.md", makeDocument("doc-30", "Beta Two", "Beta two body."));

		const result = await $`bun ${[cliPath, "doc", "view", "30", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		const stderr = result.stderr.toString();
		expect(stderr).toContain("Document ID doc-30 is ambiguous; 2 files match:");
		expect(stderr).not.toContain("backlog doc view notes/doc-30\n");
		expect(stderr).toContain('backlog doc view "notes/doc-30 - Alpha-One"');
		expect(stderr).toContain('backlog doc view "notes/doc-30 - Beta-Two"');
	});

	it("reports an unknown reference without matching anything", async () => {
		const result = await $`bun ${[cliPath, "doc", "view", "no-such-doc", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(0);
		expect(result.stderr.toString()).toContain("Document no-such-doc not found.");
	});
});
