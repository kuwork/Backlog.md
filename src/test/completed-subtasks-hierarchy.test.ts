import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { mergeCompletedIntoActive } from "../utils/task-corpus.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

// Cross-branch setup and CLI spawns are the slow part here, not the assertions.
setDefaultTimeout(60_000);

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
	id,
	title: `Task ${id}`,
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

let TEST_DIR: string;
let core: Core;

describe("completed subtasks stay visible to their parent", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-completed-subtasks");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Completed Subtasks Test");
		await core.createTask(makeTask("TASK-1", { title: "Parent" }), false);
		await core.createTask(
			makeTask("TASK-1.1", { title: "Completed child", status: "Done", parentTaskId: "TASK-1" }),
			false,
		);
		await core.createTask(makeTask("TASK-1.2", { title: "Live child", parentTaskId: "TASK-1" }), false);
		await core.completeTask("TASK-1.1");
	});

	afterEach(async () => {
		core.disposeContentStore();
		await safeCleanup(TEST_DIR);
	});

	it("lists the completed child alongside the active one", async () => {
		expect((await core.filesystem.listTasks()).map((task) => task.id)).toEqual(["TASK-1", "TASK-1.2"]);

		const task = await core.getTaskWithSubtasks("TASK-1");
		expect(task?.subtasks).toEqual(["TASK-1.1", "TASK-1.2"]);
		expect(task?.subtaskSummaries?.map((summary) => summary.title)).toEqual(["Completed child", "Live child"]);
	});

	it("shows the completed child through the CLI plain and JSON views", async () => {
		const plain = await $`bun ${CLI_PATH} task view 1 --plain`.cwd(TEST_DIR).quiet();
		expect(plain.exitCode).toBe(0);

		const output = plain.stdout.toString();
		expect(output).toContain("Subtasks (2):");
		expect(output).toContain("TASK-1.1 - Completed child");
		expect(output).toContain("TASK-1.2 - Live child");

		const json = await $`bun ${CLI_PATH} task view 1 --json`.cwd(TEST_DIR).quiet();
		expect(json.exitCode).toBe(0);

		const payload = JSON.parse(json.stdout.toString()) as { task: { subtasks: Array<{ id: string }> } };
		expect(payload.task.subtasks.map((subtask) => subtask.id)).toEqual(["TASK-1.1", "TASK-1.2"]);
	});

	it("widens a corpus without letting a completed record shadow a live one", () => {
		const active = [makeTask("TASK-2", { title: "Live", filePath: "tasks/task-2.md" })];
		const completed = [makeTask("TASK-2", { title: "Completed", status: "Done" })];

		const merged = mergeCompletedIntoActive(active, completed);
		expect(merged.map((task) => task.title)).toEqual(["Live"]);

		const widened = mergeCompletedIntoActive([], completed);
		expect(widened.map((task) => task.title)).toEqual(["Completed"]);
		expect(widened[0]?.source).toBe("completed");
	});
});
