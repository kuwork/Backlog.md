import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { isLocalEditableTask, type Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const idsOf = (tasks: Task[]) => tasks.map((task) => task.id.toLowerCase());

/**
 * Store initialization funnels through Core.loadTasks (the ContentStore taskLoader),
 * so failing it trips any code path that touches the cross-branch corpus.
 */
function forbidCorpusLoad(core: Core): void {
	core.loadTasks = async () => {
		throw new Error("Cross-branch corpus load is forbidden on the local fast path");
	};
}

describe("queryTasks local fast path", () => {
	let TEST_DIR: string;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-query-local-fast-path");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const setup = new Core(TEST_DIR);
		await initializeTestProject(setup, "Local Fast Path Project");

		const config = await setup.filesystem.loadConfig();
		if (config) {
			config.remoteOperations = false;
			await setup.filesystem.saveConfig(config);
		}
		const baseInput = {
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2025-06-19",
			rawContent: "## Description\n\nFast path fixture",
		};
		await setup.createTask(
			{ ...baseInput, id: "task-1", title: "Alpha feature", status: "To Do", priority: "high" },
			false,
		);
		await setup.createTask({ ...baseInput, id: "task-2", title: "Beta feature", status: "To Do" }, false);
		await setup.createTask({ ...baseInput, id: "task-3", title: "Gamma wrap-up", status: "Done" }, false);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("resolves local tasks without loading the cross-branch corpus", async () => {
		const core = new Core(TEST_DIR);
		forbidCorpusLoad(core);

		const tasks = await core.queryTasks({ includeCrossBranch: false });
		expect(idsOf(tasks)).toEqual(["task-1", "task-2", "task-3"]);
	});

	it("runs free-text search over local tasks without loading the cross-branch corpus", async () => {
		const core = new Core(TEST_DIR);
		forbidCorpusLoad(core);

		const tasks = await core.queryTasks({ query: "Alpha", includeCrossBranch: false });
		expect(idsOf(tasks)).toEqual(["task-1"]);
	});

	it("applies status, priority, and limit identically on the fast path", async () => {
		const core = new Core(TEST_DIR);
		forbidCorpusLoad(core);

		const doneOnly = await core.queryTasks({ includeCrossBranch: false, filters: { status: "Done" } });
		expect(idsOf(doneOnly)).toEqual(["task-3"]);

		const highOnly = await core.queryTasks({ includeCrossBranch: false, filters: { priority: "high" } });
		expect(idsOf(highOnly)).toEqual(["task-1"]);

		const limited = await core.queryTasks({ includeCrossBranch: false, limit: 2 });
		expect(idsOf(limited)).toEqual(["task-1", "task-2"]);
	});

	it("keeps locally editable filtering semantics on the fast path", async () => {
		const core = new Core(TEST_DIR);
		forbidCorpusLoad(core);

		const tasks = await core.queryTasks({ includeCrossBranch: false });
		expect(tasks.every(isLocalEditableTask)).toBe(true);
	});

	it("matches the store-backed result set when both paths are available", async () => {
		const core = new Core(TEST_DIR);

		const fastPath = await core.queryTasks({ includeCrossBranch: false });
		const storePath = (await core.queryTasks()).filter(isLocalEditableTask);
		expect(idsOf(fastPath)).toEqual(idsOf(storePath));
	});

	it("still routes default-scope queries through the ContentStore", async () => {
		const core = new Core(TEST_DIR);
		forbidCorpusLoad(core);

		expect(core.queryTasks()).rejects.toThrow("Cross-branch corpus load is forbidden");
	});
});
