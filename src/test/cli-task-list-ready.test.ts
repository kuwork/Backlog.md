import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI task list --ready", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-task-list-ready");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Ready Filter Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function createTask(
		core: Core,
		input: {
			id: string;
			title: string;
			status: string;
			dependencies?: string[];
			assignee?: string[];
			priority?: "high" | "medium" | "low";
		},
	): Promise<void> {
		await core.createTask(
			{
				id: input.id,
				title: input.title,
				status: input.status,
				assignee: input.assignee ?? [],
				labels: [],
				dependencies: input.dependencies ?? [],
				createdDate: "2026-07-24",
				rawContent: "",
				...(input.priority ? { priority: input.priority } : {}),
			},
			false,
		);
	}

	it("should filter tasks by readiness using --ready and --ready --json", async () => {
		const core = new Core(TEST_DIR);

		await createTask(core, { id: "task-1", title: "Done Dep", status: "Done" });
		await createTask(core, { id: "task-2", title: "In Progress Dep", status: "In Progress" });
		await createTask(core, { id: "task-3", title: "Blocked Task", status: "To Do", dependencies: ["task-2"] });
		await createTask(core, { id: "task-4", title: "Ready Task", status: "To Do", dependencies: ["task-1"] });

		const plainResult = await $`bun ${cliPath} task list --plain --ready`.cwd(TEST_DIR).quiet();
		const plainOut = plainResult.stdout.toString();
		expect(plainOut).toContain("TASK-4 - Ready Task");
		expect(plainOut).toContain("TASK-2 - In Progress Dep");
		expect(plainOut).not.toContain("TASK-3 - Blocked Task");

		const jsonResult = await $`bun ${cliPath} task list --json --ready`.cwd(TEST_DIR).quiet();
		const json = JSON.parse(jsonResult.stdout.toString());
		const readyIds = json.tasks.map((t: { id: string }) => t.id);
		expect(readyIds).toContain("TASK-4");
		expect(readyIds).toContain("TASK-2");
		expect(readyIds).not.toContain("TASK-3");
		expect(readyIds).not.toContain("TASK-1");

		// Readiness must resolve against the whole graph, not the tasks left after --status.
		const scopedResult = await $`bun ${cliPath} task list --plain --ready --status "To Do"`.cwd(TEST_DIR).quiet();
		const scopedOut = scopedResult.stdout.toString();
		expect(scopedOut).toContain("TASK-4 - Ready Task");
		expect(scopedOut).not.toContain("TASK-3 - Blocked Task");
	});

	it("should resolve --ready dependencies that were completed and moved out of the active corpus", async () => {
		const core = new Core(TEST_DIR);

		await createTask(core, { id: "task-1", title: "Completed Dep", status: "Done" });
		await createTask(core, { id: "task-2", title: "Depends On Completed", status: "To Do", dependencies: ["task-1"] });
		await createTask(core, {
			id: "task-3",
			title: "Depends On Nothing Known",
			status: "To Do",
			dependencies: ["task-404"],
		});
		expect(await core.completeTask("task-1", false)).toBe(true);

		const result = await $`bun ${cliPath} task list --plain --ready`.cwd(TEST_DIR).quiet();
		const out = result.stdout.toString();
		expect(out).toContain("TASK-2 - Depends On Completed");
		// An unresolvable dependency fails closed instead of being treated as satisfied.
		expect(out).not.toContain("TASK-3 - Depends On Nothing Known");
	});

	it("should keep --ready verdicts correct when display filters hide the dependencies", async () => {
		const core = new Core(TEST_DIR);

		await createTask(core, {
			id: "task-1",
			title: "Someone Elses Blocker",
			status: "In Progress",
			assignee: ["@other"],
		});
		await createTask(core, {
			id: "task-2",
			title: "Someone Elses Finished Work",
			status: "Done",
			assignee: ["@other"],
		});
		await createTask(core, {
			id: "task-3",
			title: "Mine Blocked",
			status: "To Do",
			dependencies: ["task-1"],
			assignee: ["@me"],
		});
		await createTask(core, {
			id: "task-4",
			title: "Mine Ready",
			status: "To Do",
			dependencies: ["task-2"],
			assignee: ["@me"],
		});

		// Both dependencies belong to @other, so --assignee @me removes them from the listing.
		// Readiness must still resolve them instead of calling them unknown.
		const assigneeResult = await $`bun ${cliPath} task list --plain --ready --assignee @me`.cwd(TEST_DIR).quiet();
		const assigneeOut = assigneeResult.stdout.toString();
		expect(assigneeOut).toContain("TASK-4 - Mine Ready");
		expect(assigneeOut).not.toContain("TASK-3 - Mine Blocked");
		expect(assigneeOut).not.toContain("TASK-1 - Someone Elses Blocker");

		const unassignedResult = await $`bun ${cliPath} task list --plain --ready --unassigned`.cwd(TEST_DIR).quiet();
		expect(unassignedResult.stdout.toString()).toContain("No tasks found.");
	});
});
