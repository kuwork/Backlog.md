import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Append Description via task edit --append-description", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-append-description");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Append Description Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// ignore
		}
	});

	it("appends to existing description with blank line separation", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Existing description",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Original description",
			},
			false,
		);

		const res =
			await $`bun ${CLI_PATH} task edit 1 --append-description "First addition" --append-description "Second addition"`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-1");
		expect(updated).not.toBeNull();
		expect(updated?.description).toBe("Original description\n\nFirst addition\n\nSecond addition");
	});

	it("creates a description when one is missing", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-2",
				title: "No description",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 2 --append-description "Added description"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-2");
		expect(updated).not.toBeNull();
		expect(updated?.description).toBe("Added description");
	});

	it("supports multi-line appended content via \\n escape sequences", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-3",
				title: "Multiline append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Initial",
			},
			false,
		);

		const multiline = "Line1\\nLine2\\n\\nPara2";
		const res = await $`bun ${CLI_PATH} task edit 3 --append-description ${multiline}`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-3");
		expect(updated).not.toBeNull();
		expect(updated?.description).toBe("Initial\n\nLine1\nLine2\n\nPara2");
	});

	it("allows combining --description (replace) with --append-description (append)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-4",
				title: "Mix flags",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Old",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 4 --description "Replace" --append-description "Append"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-4");
		expect(updated).not.toBeNull();
		expect(updated?.description).toBe("Replace\n\nAppend");
	});

	it("supports the --append-desc alias", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-5",
				title: "Alias test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Base",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 5 --append-desc "Via alias"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-5");
		expect(updated).not.toBeNull();
		expect(updated?.description).toBe("Base\n\nVia alias");
	});
});
