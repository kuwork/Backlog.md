import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI document content newline handling", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-doc-content-newlines");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Content Newlines Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("should interpret \\n escape sequences as newlines when updating document content", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Original",
			},
			false,
		);

		const content = "First line\\nSecond line";
		await $`bun ${CLI_PATH} doc update doc-1 --content ${content}`.cwd(TEST_DIR).quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.rawContent).toBe("First line\nSecond line");
	});

	it("should interpret \\n\\n escape sequences as paragraph breaks when updating document content", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Original",
			},
			false,
		);

		const content = "First paragraph\\n\\nSecond paragraph";
		await $`bun ${CLI_PATH} doc update doc-1 --content ${content}`.cwd(TEST_DIR).quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.rawContent).toBe("First paragraph\n\nSecond paragraph");
	});

	it("should preserve omitted document content when updating other fields", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Keep\nthis\ncontent",
			},
			false,
		);

		await $`bun ${CLI_PATH} doc update doc-1 --title "Updated Guide"`.cwd(TEST_DIR).quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.title).toBe("Updated Guide");
		expect(updated?.rawContent).toBe("Keep\nthis\ncontent");
	});

	it("should append a block to existing document content", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Original content",
			},
			false,
		);

		const content = "Appended section";
		await $`bun ${CLI_PATH} doc update doc-1 --append-content ${content}`.cwd(TEST_DIR).quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.rawContent).toBe("Original content\n\nAppended section");
	});

	it("should append multiple blocks and interpret \\n escape sequences", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Original content",
			},
			false,
		);

		const first = "First append\\nwith newline";
		const second = "Second append";
		await $`bun ${CLI_PATH} doc update doc-1 --append-content ${first} --append-content ${second}`
			.cwd(TEST_DIR)
			.quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.rawContent).toBe("Original content\n\nFirst append\nwith newline\n\nSecond append");
	});

	it("should append after replacement content when both --content and --append-content are provided", async () => {
		const core = new Core(TEST_DIR);
		await core.createDocument(
			{
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-07-04",
				rawContent: "Original content",
			},
			false,
		);

		const content = "Replacement";
		const append = "Appended";
		await $`bun ${CLI_PATH} doc update doc-1 --content ${content} --append-content ${append}`.cwd(TEST_DIR).quiet();

		const docs = await core.filesystem.listDocuments();
		const updated = docs.find((doc) => doc.id === "doc-1");
		expect(updated?.rawContent).toBe("Replacement\n\nAppended");
	});
});
