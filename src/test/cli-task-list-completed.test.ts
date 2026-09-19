import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --completed corpus widening", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-completed");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Completed Flag Project");
		await createTask(core, "task-1", "Completed Dep", "Done");
		await createTask(core, "task-2", "Active Task", "To Do");
		expect(await core.completeTask("task-1", false)).toBe(true);
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

	it("keeps task list output active-only without the flag", async () => {
		const result = await $`bun ${cliPath} task list --plain`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-2 - Active Task");
		expect(out).not.toContain("TASK-1 - Completed Dep");
	});

	it("includes completed tasks in task list with --completed", async () => {
		const result = await $`bun ${cliPath} task list --plain --completed`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-1 - Completed Dep");
		expect(out).toContain("TASK-2 - Active Task");
	});

	it("applies status filters to widened results", async () => {
		const result = await $`bun ${cliPath} task list --plain --completed --status "To Do"`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-2 - Active Task");
		expect(out).not.toContain("TASK-1 - Completed Dep");
	});

	it("marks completed rows in --json output with source completed", async () => {
		const result = await $`bun ${cliPath} task list --json --completed`.cwd(TEST_DIR).quiet();
		const json = JSON.parse(result.stdout.toString());
		const rows = json.tasks as Array<{ id: string; source?: string }>;
		const completed = rows.find((task) => task.id === "TASK-1");
		expect(completed).toBeDefined();
		expect(completed?.source).toBe("completed");
	});

	it("reaches completed tasks from backlog search only with --completed", async () => {
		const withoutFlag = await $`bun ${cliPath} search "completed dep" --type task --plain`.cwd(TEST_DIR).quiet();
		expect(withoutFlag.stdout.toString()).not.toContain("TASK-1 - Completed Dep");

		const withFlag = await $`bun ${cliPath} search "completed dep" --type task --plain --completed`
			.cwd(TEST_DIR)
			.quiet();
		const out = withFlag.stdout.toString();
		expect(out).toContain("TASK-1 - Completed Dep");
		expect(out).not.toContain("TASK-2 - Active Task");
	});
});
