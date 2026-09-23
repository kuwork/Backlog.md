import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { taskIdsEqual } from "../utils/task-id.ts";
import { AmbiguousTaskIdError } from "../utils/task-path.ts";
import { initializeTestProject } from "./test-utils.ts";

describe("Vacated task ID reference cleanup", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-vacated-refs-test-"));

		// Initialize git repository first using the same pattern as other tests
		await $`git init -b main`.cwd(tempDir).quiet();
		await $`git config user.name "Test User"`.cwd(tempDir).quiet();
		await $`git config user.email test@example.com`.cwd(tempDir).quiet();

		const core = new Core(tempDir);
		await initializeTestProject(core, "test-project");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.warn(`Failed to clean up temp directory: ${error}`);
		}
	});

	const freshCore = () => new Core(tempDir);

	test("archiving cleans completed-corpus dependents so a reallocated ID cannot hijack them", async () => {
		const setup = freshCore();
		// The dependent must hold a lower number than the target, otherwise the
		// allocator never reissues the vacated ID.
		const { task: dependent } = await setup.createTaskFromInput({ title: "Dependent" }, false);
		const { task: target } = await setup.createTaskFromInput({ title: "Target" }, false);
		await freshCore().updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);
		await freshCore().updateTaskFromInput(dependent.id, { status: "Done" }, false);
		await freshCore().completeTask(dependent.id, false);

		const cleaned: string[] = [];
		const ok = await freshCore().archiveTask(target.id, false, {
			onVacatedIdCleanup: (ids) => {
				cleaned.push(...ids);
			},
		});
		expect(ok).toBe(true);
		expect(cleaned).toEqual([dependent.id]);

		// The completed record was rewritten in place: it no longer names the vacated ID.
		const completed = await freshCore().filesystem.listCompletedTasks();
		const record = completed.find((task) => taskIdsEqual(task.id, dependent.id));
		expect(record).toBeDefined();
		expect(record?.dependencies ?? []).not.toContain(target.id);

		// The freed slot is reused, and the surviving reference must not bind to the new task.
		const { task: successor } = await freshCore().createTaskFromInput({ title: "Successor" }, false);
		expect(taskIdsEqual(successor.id, target.id)).toBe(true);
	});

	test("archiving cleans active dependents and reports them", async () => {
		const setup = freshCore();
		const { task: target } = await setup.createTaskFromInput({ title: "Target" }, false);
		const { task: dependent } = await setup.createTaskFromInput(
			{ title: "Dependent", description: "Active dependent", dependencies: [target.id] },
			false,
		);

		const cleaned: string[] = [];
		const ok = await freshCore().archiveTask(target.id, false, {
			onVacatedIdCleanup: (ids) => {
				cleaned.push(...ids);
			},
		});
		expect(ok).toBe(true);
		expect(cleaned).toEqual([dependent.id]);

		const stillActive = await freshCore().filesystem.loadTask(dependent.id);
		expect(stillActive?.dependencies ?? []).not.toContain(target.id);
	});

	test("demoting cleans active and completed dependents and reports them", async () => {
		const setup = freshCore();
		const { task: target } = await setup.createTaskFromInput({ title: "Target" }, false);
		const { task: activeDependent } = await setup.createTaskFromInput(
			{ title: "Active dependent", description: "Stays active", dependencies: [target.id] },
			false,
		);
		const { task: doneDependent } = await setup.createTaskFromInput({ title: "Done dependent" }, false);
		await freshCore().updateTaskFromInput(doneDependent.id, { dependencies: [target.id] }, false);
		await freshCore().updateTaskFromInput(doneDependent.id, { status: "Done" }, false);
		await freshCore().completeTask(doneDependent.id, false);

		const cleaned: string[] = [];
		const newDraftId = await freshCore().demoteTask(target.id, false, {
			onVacatedIdCleanup: (ids) => {
				cleaned.push(...ids);
			},
		});
		expect(newDraftId).toBeTruthy();
		expect([...cleaned].sort()).toEqual([activeDependent.id, doneDependent.id].sort());

		const stillActive = await freshCore().filesystem.loadTask(activeDependent.id);
		expect(stillActive?.dependencies ?? []).not.toContain(target.id);
		const completed = await freshCore().filesystem.listCompletedTasks();
		const record = completed.find((task) => taskIdsEqual(task.id, doneDependent.id));
		expect(record?.dependencies ?? []).not.toContain(target.id);
	});

	test("demoting through the edit path cleans dependents too", async () => {
		const setup = freshCore();
		const { task: target } = await setup.createTaskFromInput({ title: "Target" }, false);
		const { task: dependent } = await setup.createTaskFromInput(
			{ title: "Dependent", description: "Edits the target to Draft", dependencies: [target.id] },
			false,
		);

		await freshCore().updateTaskFromInput(target.id, { status: "Draft" }, false);

		const stillActive = await freshCore().filesystem.loadTask(dependent.id);
		expect(stillActive?.dependencies ?? []).not.toContain(target.id);
	});

	test("completing a task never removes references to it", async () => {
		const setup = freshCore();
		const { task: target } = await setup.createTaskFromInput({ title: "Target" }, false);
		const { task: dependent } = await setup.createTaskFromInput(
			{ title: "Dependent", description: "Readiness needs the completed dependency", dependencies: [target.id] },
			false,
		);

		await freshCore().updateTaskFromInput(target.id, { status: "Done" }, false);
		await freshCore().completeTask(target.id, false);

		const stillActive = await freshCore().filesystem.loadTask(dependent.id);
		expect(stillActive?.dependencies ?? []).toContain(target.id);
	});

	test("local-only archive fails closed on ambiguous identities", async () => {
		const setup = freshCore();
		const { task: original } = await setup.createTaskFromInput({ title: "Original" }, false);
		writeFileSync(
			join(setup.filesystem.tasksDir, "task-1 - Second copy.md"),
			readFileSync(original.filePath as string, "utf8"),
		);

		await expect(freshCore().archiveTask(original.id, false, { includeCrossBranch: false })).rejects.toThrow(
			AmbiguousTaskIdError,
		);
	});

	test("local-only lifecycle resolution misses unknown targets without cross-branch loads", async () => {
		await expect(freshCore().archiveTask("task-99", false, { includeCrossBranch: false })).resolves.toBe(false);
		await expect(freshCore().completeTask("task-99", false, { includeCrossBranch: false })).resolves.toBe(false);
		await expect(freshCore().demoteTask("task-99", false, { includeCrossBranch: false })).resolves.toBeNull();
	});
});
