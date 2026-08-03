import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import {
	applyDuplicateTaskIdRepair,
	commitDuplicateTaskIdRepair,
	previewDuplicateTaskIdRepair,
	rollbackDuplicateTaskIdRepair,
} from "../core/duplicate-task-repair.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

describe("applyDuplicateTaskIdRepair", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-repair-apply");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// ignore
		}
	});

	it("renames duplicate file and updates frontmatter id", async () => {
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-1 - One.md"), "---\nid: task-1\n---\n# One");
		await writeFile(join(tasksDir, "task-01 - Zero One.md"), "---\nid: task-01\n---\n# Zero One");

		const plan = await previewDuplicateTaskIdRepair(core);
		expect(plan.repairable).toBe(true);

		const result = await applyDuplicateTaskIdRepair(core, plan);
		expect(result.repairedFiles).toBe(1);

		const remaining = await previewDuplicateTaskIdRepair(core);
		expect(remaining.groups).toHaveLength(0);

		// Original file should be renamed to new id
		const newFile = Bun.file(join(tasksDir, "task-2 - Zero One.md"));
		expect(await newFile.exists()).toBe(true);
		const newContent = await newFile.text();
		expect(newContent).toContain("id: TASK-2");
	});

	it("retains backup after repair and allows rollback", async () => {
		const tasksDir = core.filesystem.tasksDir;
		const originalPath = join(tasksDir, "task-01 - Zero One.md");
		await writeFile(join(tasksDir, "task-1 - One.md"), "---\nid: task-1\n---\n# One");
		await writeFile(originalPath, "---\nid: task-01\n---\n# Zero One");

		const plan = await previewDuplicateTaskIdRepair(core);
		await applyDuplicateTaskIdRepair(core, plan);

		const rollbackResult = await rollbackDuplicateTaskIdRepair(core);
		expect(rollbackResult.restored.length).toBeGreaterThan(0);
		expect(await Bun.file(originalPath).exists()).toBe(true);

		const revertedContent = await Bun.file(originalPath).text();
		expect(revertedContent).toContain("id: task-01");
	});

	it("removes backups on commit", async () => {
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-1 - One.md"), "---\nid: task-1\n---\n# One");
		await writeFile(join(tasksDir, "task-01 - Zero One.md"), "---\nid: task-01\n---\n# Zero One");

		const plan = await previewDuplicateTaskIdRepair(core);
		await applyDuplicateTaskIdRepair(core, plan);

		const commitResult = await commitDuplicateTaskIdRepair(core);
		expect(commitResult.removedBackups.length).toBeGreaterThan(0);
	});
});
