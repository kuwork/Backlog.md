import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("queryTasks includeCompleted corpus widening", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("core-query-completed");
		await mkdir(TEST_DIR, { recursive: true });
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Completed Corpus Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function createTask(core: Core, id: string, title: string, status: string): Promise<void> {
		await core.createTask(
			{
				id,
				title,
				status,
				assignee: [],
				labels: [],
				dependencies: [],
				createdDate: "2026-09-18",
				rawContent: "",
			},
			false,
		);
	}

	async function setupActiveAndCompletedTasks(): Promise<void> {
		const writer = new Core(TEST_DIR);
		await createTask(writer, "task-1", "Completed Dep", "Done");
		await createTask(writer, "task-2", "Active Task", "To Do");
		expect(await writer.completeTask("task-1", false)).toBe(true);
	}

	it("keeps the default corpus active-only", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const tasks = await core.queryTasks();
		expect(tasks.map((task) => task.id)).not.toContain("TASK-1");
		expect(tasks.map((task) => task.id)).toContain("TASK-2");
	});

	it("widens the corpus with completed tasks only when asked", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const tasks = await core.queryTasks({ includeCompleted: true });
		const completed = tasks.find((task) => task.id === "TASK-1");
		expect(completed).toBeDefined();
		// The distinguishing marker consumers route on (AC#5).
		expect(completed?.source).toBe("completed");
		expect(tasks.map((task) => task.id)).toContain("TASK-2");
	});

	it("widens the no-query cross-branch path from the ContentStore corpus", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const tasks = await core.queryTasks({ includeCompleted: true, includeCrossBranch: true });
		expect(tasks.map((task) => task.id)).toContain("TASK-1");
	});

	it("widens the local path and keeps active records winning an id clash", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const tasks = await core.queryTasks({ includeCompleted: true, includeCrossBranch: false });
		const ids = tasks.map((task) => task.id);
		expect(ids).toContain("TASK-1");
		expect(ids).toContain("TASK-2");
		const completed = tasks.find((task) => task.id === "TASK-1");
		expect(completed?.source).toBe("completed");
	});

	it("lets fuzzy search reach completed tasks only when the corpus is widened", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const withoutCompleted = await core.queryTasks({ query: "completed dep" });
		expect(withoutCompleted.map((task) => task.id)).not.toContain("TASK-1");

		const withCompleted = await core.queryTasks({ query: "completed dep", includeCompleted: true });
		expect(withCompleted.map((task) => task.id)).toContain("TASK-1");
	});

	it("runs widened results through the same filter and limit pipeline", async () => {
		await setupActiveAndCompletedTasks();
		const core = new Core(TEST_DIR);

		const doneOnly = await core.queryTasks({ includeCompleted: true, filters: { status: "Done" } });
		expect(doneOnly.map((task) => task.id)).toEqual(["TASK-1"]);

		const limited = await core.queryTasks({ includeCompleted: true, limit: 1 });
		expect(limited).toHaveLength(1);
	});
});
