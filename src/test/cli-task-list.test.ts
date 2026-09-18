import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI task list --plain", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-task-list");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Task List Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function createTaskWithCriteria(core: Core, checkedCount: number): Promise<void> {
		const criteria = ["First criterion", "Second criterion", "Third criterion"];
		await core.createTask(
			{
				id: "task-1",
				title: "Task With Criteria",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				rawContent: "Task with acceptance criteria",
				acceptanceCriteriaItems: criteria.map((text, index) => ({
					index: index + 1,
					text,
					checked: index < checkedCount,
				})),
			},
			false,
		);
	}

	async function createTaskWithoutCriteria(core: Core): Promise<void> {
		await core.createTask(
			{
				id: "task-2",
				title: "Task Without Criteria",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				rawContent: "Task without acceptance criteria",
			},
			false,
		);
	}

	it("shows acceptance criteria progress only for tasks with criteria", async () => {
		const core = new Core(TEST_DIR);
		await createTaskWithCriteria(core, 1);
		await createTaskWithoutCriteria(core);

		const result = await $`bun ${cliPath} task list --plain`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-1 - Task With Criteria (ac: 1/3)");
		expect(out).toContain("TASK-2 - Task Without Criteria");
		expect(out).not.toContain("Task Without Criteria (ac:");
	});

	it("reports the same progress in the priority-sorted view", async () => {
		const core = new Core(TEST_DIR);
		await createTaskWithCriteria(core, 3);
		await createTaskWithoutCriteria(core);

		const result = await $`bun ${cliPath} task list --plain --sort priority`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-1 - Task With Criteria (To Do) (ac: 3/3)");
		expect(out).toContain("TASK-2 - Task Without Criteria (To Do)");
		expect(out).not.toContain("Task Without Criteria (To Do) (ac:");
	});
});
