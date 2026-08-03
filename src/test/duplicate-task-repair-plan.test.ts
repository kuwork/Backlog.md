import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { previewDuplicateTaskIdRepair } from "../core/duplicate-task-repair.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

describe("previewDuplicateTaskIdRepair", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-repair-plan");
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

	it("returns empty plan when no duplicates exist", async () => {
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-1 - First.md"), "---\nid: task-1\n---\n# First");
		await writeFile(join(tasksDir, "task-2 - Second.md"), "---\nid: task-2\n---\n# Second");

		const plan = await previewDuplicateTaskIdRepair(core);
		expect(plan.groups).toEqual([]);
		expect(plan.changes).toEqual([]);
		expect(plan.repairable).toBe(false);
	});

	it("plans to rename zero-padding duplicate to next available ID", async () => {
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-1 - One.md"), "---\nid: task-1\n---\n# One");
		await writeFile(join(tasksDir, "task-01 - Zero One.md"), "---\nid: task-01\n---\n# Zero One");

		const plan = await previewDuplicateTaskIdRepair(core);
		expect(plan.groups).toHaveLength(1);
		expect(plan.changes).toHaveLength(1);
		expect(plan.repairable).toBe(true);

		const change = plan.changes[0];
		expect(change?.oldId).toBeOneOf(["TASK-01", "TASK-1"]);
		expect(change?.newId).toBe("TASK-2");
		expect(change?.targetPath).toContain("task-2 -");
	});

	it("blocks repair when filename and frontmatter ID disagree", async () => {
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-1 - Mismatch.md"), "---\nid: task-01\n---\n# Mismatch");
		await writeFile(join(tasksDir, "task-01 - Mismatch.md"), "---\nid: task-01\n---\n# Mismatch");

		const plan = await previewDuplicateTaskIdRepair(core);
		expect(plan.repairable).toBe(false);
		expect(plan.blockedReasons.length).toBeGreaterThan(0);
		expect(plan.blockedReasons.some((reason) => reason.includes("filename ID"))).toBe(true);
	});

	it("reports references in other markdown files", async () => {
		const tasksDir = core.filesystem.tasksDir;
		const docsDir = join(core.filesystem.backlogDir, "docs");
		await mkdir(docsDir, { recursive: true });
		await writeFile(join(tasksDir, "task-1 - One.md"), "---\nid: task-1\n---\n# One");
		await writeFile(join(tasksDir, "task-01 - Zero One.md"), "---\nid: task-01\n---\n# Zero One");
		await writeFile(join(docsDir, "doc-1 - Guide.md"), "See task-1 for details.");

		const plan = await previewDuplicateTaskIdRepair(core);
		expect(plan.references.length).toBeGreaterThan(0);
		expect(plan.references[0]?.ids.some((id) => id === "TASK-1" || id === "TASK-01")).toBe(true);
	});
});
