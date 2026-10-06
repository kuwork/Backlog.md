import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { buildTaskUpdateInput } from "../utils/task-edit-builder.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

setDefaultTimeout(60_000);

describe("re-parent an existing task (core)", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("reparent-core");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		const core = new Core(testDir);
		await initializeTestProject(core, "Reparent Core");
		await core.createTaskFromInput({ title: "Parent" }, false);
		await core.createTaskFromInput({ title: "Child" }, false);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	async function parentOf(taskId: string): Promise<string | undefined> {
		const core = new Core(testDir);
		const task = await core.filesystem.loadTask(taskId);
		return task?.parentTaskId;
	}

	it("sets parent_task_id and normalizes a bare-number parent", async () => {
		const core = new Core(testDir);
		await core.updateTaskFromInput("task-2", { parentTaskId: "1" }, false);
		expect(await parentOf("task-2")).toBe("TASK-1");
	});

	it("clears parent_task_id with null", async () => {
		const core = new Core(testDir);
		await core.updateTaskFromInput("task-2", { parentTaskId: "task-1" }, false);
		await core.updateTaskFromInput("task-2", { parentTaskId: null }, false);
		expect(await parentOf("task-2")).toBeUndefined();
	});

	it("leaves the parent untouched when parentTaskId is absent", async () => {
		const core = new Core(testDir);
		await core.updateTaskFromInput("task-2", { parentTaskId: "task-1" }, false);
		await core.updateTaskFromInput("task-2", { title: "Renamed" }, false);
		expect(await parentOf("task-2")).toBe("TASK-1");
	});

	it("rejects an unknown parent", async () => {
		const core = new Core(testDir);
		await expect(core.updateTaskFromInput("task-2", { parentTaskId: "task-999" }, false)).rejects.toThrow(
			/Parent task not found: task-999/,
		);
	});

	it("rejects a task as its own parent", async () => {
		const core = new Core(testDir);
		await expect(core.updateTaskFromInput("task-2", { parentTaskId: "task-2" }, false)).rejects.toThrow(
			/cannot be its own parent/,
		);
	});

	it("rejects a parent that would close a cycle", async () => {
		const core = new Core(testDir);
		await core.updateTaskFromInput("task-2", { parentTaskId: "task-1" }, false);
		await expect(core.updateTaskFromInput("task-1", { parentTaskId: "task-2" }, false)).rejects.toThrow(
			/would create a cycle/,
		);
	});
});

describe("re-parent via the CLI (--parent / --clear-parent)", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		testDir = createUniqueTestDir("reparent-cli");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		const core = new Core(testDir);
		await initializeTestProject(core, "Reparent CLI");
		await core.createTaskFromInput({ title: "Parent" }, false);
		await core.createTaskFromInput({ title: "Child" }, false);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	async function runCli(args: string[]): Promise<{ exitCode: number; stderr: string }> {
		const result = await $`bun ${cliPath} ${args}`.cwd(testDir).quiet().nothrow();
		return { exitCode: result.exitCode, stderr: result.stderr.toString() };
	}

	async function parentOf(taskId: string): Promise<string | undefined> {
		const core = new Core(testDir);
		const task = await core.filesystem.loadTask(taskId);
		return task?.parentTaskId;
	}

	it("sets and clears the parent, and refuses conflicting flags", async () => {
		const set = await runCli(["task", "edit", "task-2", "--parent", "task-1"]);
		expect(set.exitCode).toBe(0);
		expect(await parentOf("task-2")).toBe("TASK-1");

		const clear = await runCli(["task", "edit", "task-2", "--clear-parent"]);
		expect(clear.exitCode).toBe(0);
		expect(await parentOf("task-2")).toBeUndefined();

		const conflict = await runCli(["task", "edit", "task-2", "--parent", "task-1", "--clear-parent"]);
		expect(conflict.exitCode).not.toBe(0);
		expect(conflict.stderr).toMatch(/Cannot use --parent and --clear-parent together/);
	}, 30_000);
});

describe("buildTaskUpdateInput parent mapping", () => {
	it("leaves parentTaskId untouched when absent", () => {
		expect("parentTaskId" in buildTaskUpdateInput({})).toBe(false);
	});

	it("trims a string parent", () => {
		expect(buildTaskUpdateInput({ parentTaskId: "  task-2  " }).parentTaskId).toBe("task-2");
	});

	it("treats an empty string as a clear", () => {
		expect(buildTaskUpdateInput({ parentTaskId: "" }).parentTaskId).toBeNull();
	});

	it("passes null through as a clear", () => {
		expect(buildTaskUpdateInput({ parentTaskId: null }).parentTaskId).toBeNull();
	});
});
