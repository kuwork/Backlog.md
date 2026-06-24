import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { MilestoneHandlers } from "../mcp/tools/milestones/handlers.ts";
import type { CallToolResult } from "../mcp/types.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const cliPath = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;
let cleanupDirs: string[];

function toolText(result: CallToolResult): string {
	return result.content
		.map((item) => (item.type === "text" ? item.text : ""))
		.filter(Boolean)
		.join("\n");
}

function normalizeRenamePaths(text: string): string {
	return text
		.trim()
		.replace(/Renamed milestone file: [^\n]+ -> [^\n]+/g, "Renamed milestone file: <source> -> <target>");
}

async function setupProject(dir: string, projectName: string): Promise<Core> {
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });
	await $`git init -b main`.cwd(dir).quiet();
	await $`git config user.name "Test User"`.cwd(dir).quiet();
	await $`git config user.email test@example.com`.cwd(dir).quiet();

	const core = new Core(dir);
	await initializeTestProject(core, projectName);
	return core;
}

describe("CLI milestone management", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-milestone-management");
		cleanupDirs = [TEST_DIR];
		await setupProject(TEST_DIR, "CLI Milestone Management Project");
	});

	afterEach(async () => {
		for (const dir of cleanupDirs) {
			await safeCleanup(dir);
		}
	});

	it("adds milestone files with descriptions and rejects duplicate aliases", async () => {
		const core = new Core(TEST_DIR);

		const add = await $`bun ${cliPath} milestone add "Release CLI" --description "Custom release scope"`
			.cwd(TEST_DIR)
			.quiet();

		expect(add.exitCode).toBe(0);
		expect(add.stdout.toString()).toContain('Created milestone "Release CLI" (m-0).');

		const milestones = await core.filesystem.listMilestones();
		expect(milestones).toHaveLength(1);
		expect(milestones[0]?.title).toBe("Release CLI");
		expect(milestones[0]?.description).toBe("Custom release scope");

		const duplicate = await $`bun ${cliPath} milestone add " release cli "`.cwd(TEST_DIR).quiet().nothrow();
		const duplicateOutput = duplicate.stdout.toString() + duplicate.stderr.toString();

		expect(duplicate.exitCode).toBe(1);
		expect(duplicateOutput).toContain(
			'Milestone alias conflict: "release cli" matches existing milestone "Release CLI" (m-0).',
		);
	});

	it("auto-commits added milestone files when autoCommit is enabled", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected test project config to exist");
		}
		config.autoCommit = true;
		await core.filesystem.saveConfig(config);
		await core.ensureConfigLoaded();

		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m "baseline"`.cwd(TEST_DIR).quiet();

		const add = await $`bun ${cliPath} milestone add "Committed Release"`.cwd(TEST_DIR).quiet();

		expect(add.exitCode).toBe(0);
		expect(add.stdout.toString()).toContain('Created milestone "Committed Release" (m-0).');
		expect((await core.git.getStatus()).trim()).toBe("");
		expect(await core.git.getLastCommitMessage()).toContain("backlog: Add milestone m-0");
	});

	it("edits milestone titles and updates local task references by default", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();
		await core.editTask("task-1", { milestone: "Release A" }, false);

		const edit = await $`bun ${cliPath} milestone edit "Release A" --title "Release Prime"`.cwd(TEST_DIR).quiet();

		expect(edit.exitCode).toBe(0);
		expect(edit.stdout.toString()).toContain('Renamed milestone "Release A" (m-0) → "Release Prime" (m-0).');
		expect(edit.stdout.toString()).toContain("Updated 1 local task: TASK-1");

		const task = await core.filesystem.loadTask("task-1");
		expect(task?.milestone).toBe("m-0");

		const milestones = await core.filesystem.listMilestones();
		expect(milestones[0]?.title).toBe("Release Prime");
	});

	it("supports disabling task updates during milestone title edit", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Legacy Release"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Legacy task" --milestone "Legacy Release" --plain`.cwd(TEST_DIR).quiet();
		await core.editTask("task-1", { milestone: "Legacy Release" }, false);

		const edit = await $`bun ${cliPath} milestone edit "Legacy Release" --title "Renamed Release" --no-update-tasks`
			.cwd(TEST_DIR)
			.quiet();

		expect(edit.exitCode).toBe(0);
		expect(edit.stdout.toString()).toContain("Skipped updating tasks (updateTasks=false).");

		const task = await core.filesystem.loadTask("task-1");
		expect(task?.milestone).toBe("Legacy Release");
	});

	it("edits milestone date fields without rewriting task references", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();

		const edit =
			await $`bun ${cliPath} milestone edit "Release A" --due-date 2026-06-15 --planned-start 2026-06-01 --planned-end 2026-06-10`
				.cwd(TEST_DIR)
				.quiet();

		expect(edit.exitCode).toBe(0);

		const milestone = (await core.filesystem.listMilestones())[0];
		expect(milestone?.title).toBe("Release A");
		expect(milestone?.dueDate).toBe("2026-06-15");
		expect(milestone?.plannedStart).toBe("2026-06-01");
		expect(milestone?.plannedEnd).toBe("2026-06-10");

		const task = await core.filesystem.loadTask("task-1");
		expect(task?.milestone).toBe("m-0");
	});

	it("edits milestone descriptions", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A" --description "Initial scope"`.cwd(TEST_DIR).quiet();

		const editDesc = await $`bun ${cliPath} milestone edit "Release A" --description "Updated scope"`
			.cwd(TEST_DIR)
			.quiet();
		expect(editDesc.exitCode).toBe(0);
		expect((await core.filesystem.listMilestones())[0]?.description).toBe("Updated scope");
	});

	it("clears milestone date fields when requested", async () => {
		const core = new Core(TEST_DIR);

		await core.filesystem.createMilestone("Release A", undefined, "2026-06-15", "2026-06-01", "2026-06-10");

		const edit =
			await $`bun ${cliPath} milestone edit "Release A" --clear-due-date --clear-planned-start --clear-planned-end`
				.cwd(TEST_DIR)
				.quiet();

		expect(edit.exitCode).toBe(0);

		const milestone = (await core.filesystem.listMilestones())[0];
		expect(milestone?.dueDate).toBeUndefined();
		expect(milestone?.plannedStart).toBeUndefined();
		expect(milestone?.plannedEnd).toBeUndefined();
	});

	it("rejects edit targets that collide with another milestone alias", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} milestone add "Release B"`.cwd(TEST_DIR).quiet();

		const conflict = await $`bun ${cliPath} milestone edit "Release A" --title "Release B"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		const output = conflict.stdout.toString() + conflict.stderr.toString();

		expect(conflict.exitCode).toBe(1);
		expect(output).toContain('Milestone alias conflict: "Release B" matches existing milestone "Release B" (m-1).');

		const milestones = await core.filesystem.listMilestones();
		expect(milestones.find((m) => m.id === "m-0")?.title).toBe("Release A");
	});

	it("removes milestones and clears matching task values by default", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();

		const clear = await $`bun ${cliPath} milestone remove "Release A"`.cwd(TEST_DIR).quiet();

		expect(clear.exitCode).toBe(0);
		expect(clear.stdout.toString()).toContain("Cleared milestone for 1 local task: TASK-1");
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBeUndefined();
	});

	it("removes milestones and keeps task values when requested", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Keep Value"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Keep Value" --plain`.cwd(TEST_DIR).quiet();

		const keep = await $`bun ${cliPath} milestone remove "Keep Value" --task-handling keep`.cwd(TEST_DIR).quiet();

		expect(keep.exitCode).toBe(0);
		expect(keep.stdout.toString()).toContain("Kept task milestone values unchanged (taskHandling=keep).");
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("m-0");
	});

	it("removes milestones and reassigns matching task values when requested", async () => {
		const core = new Core(TEST_DIR);

		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} milestone add "Release B"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task A" --milestone "Release A" --plain`.cwd(TEST_DIR).quiet();

		const reassign =
			await $`bun ${cliPath} milestone remove "Release A" --task-handling reassign --reassign-to "Release B"`
				.cwd(TEST_DIR)
				.quiet();

		expect(reassign.exitCode).toBe(0);
		expect(reassign.stdout.toString()).toContain('Removed milestone "Release A" (m-0).');
		expect(reassign.stdout.toString()).toContain('Reassigned 1 local task to "Release B" (m-1): TASK-1');
		expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("m-1");
	});

	it("validates remove task-handling flags and required reassign targets", async () => {
		await $`bun ${cliPath} milestone add "Release A"`.cwd(TEST_DIR).quiet();

		const invalid = await $`bun ${cliPath} milestone remove "Release A" --task-handling punt`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		const missingTarget = await $`bun ${cliPath} milestone remove "Release A" --task-handling reassign`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(invalid.exitCode).toBe(1);
		expect(invalid.stderr.toString()).toContain("Invalid task handling: punt. Valid values are: clear, keep, reassign");
		expect(missingTarget.exitCode).toBe(1);
		expect(missingTarget.stderr.toString()).toContain("reassignTo is required when taskHandling is reassign.");
	});

	it("documents milestone command schemas in help output", async () => {
		const helpByCommand = new Map([
			["list", await $`bun ${cliPath} milestone list --help`.cwd(TEST_DIR).text()],
			["add", await $`bun ${cliPath} milestone add --help`.cwd(TEST_DIR).text()],
			["edit", await $`bun ${cliPath} milestone edit --help`.cwd(TEST_DIR).text()],
			["remove", await $`bun ${cliPath} milestone remove --help`.cwd(TEST_DIR).text()],
			["archive", await $`bun ${cliPath} milestone archive --help`.cwd(TEST_DIR).text()],
		]);

		for (const [command, help] of helpByCommand) {
			expect(help).toContain("Input schema:");
			expect(help).toContain("Reads:");
			expect(help).toContain("Output:");
			expect(help).toContain("Examples:");
			if (command !== "list") {
				expect(help).toContain("Writes:");
			}
		}

		const editHelp = helpByCommand.get("edit") ?? "";
		expect(editHelp).toContain("due-date: Date (YYYY-MM-DD)");
		expect(editHelp).toContain("planned-start: Date (YYYY-MM-DD)");
		expect(editHelp).toContain("planned-end: Date (YYYY-MM-DD)");
		expect(editHelp).toContain("disable with --no-update-tasks");
		expect(editHelp).toContain("update-tasks: Boolean");
		expect(helpByCommand.get("remove")).toContain("task-handling: one of: clear, keep, reassign");
		expect(helpByCommand.get("remove")).toContain("reassign-to: Milestone ID or title");
	});

	it("matches MCP milestone handler output for shared mutation operations", async () => {
		const mcpDir = createUniqueTestDir("test-cli-milestone-mcp-parity");
		cleanupDirs.push(mcpDir);
		const mcpCore = await setupProject(mcpDir, "MCP Milestone Parity Project");
		const mcpHandlers = new MilestoneHandlers(mcpCore);

		const cliAdd = await $`bun ${cliPath} milestone add "Parity A"`.cwd(TEST_DIR).quiet();
		const mcpAdd = await mcpHandlers.addMilestone({ name: "Parity A" });
		expect(cliAdd.stdout.toString().trim()).toBe(toolText(mcpAdd).trim());

		const cliEdit = await $`bun ${cliPath} milestone edit "Parity A" --title "Parity B"`.cwd(TEST_DIR).quiet();
		const mcpEdit = await mcpHandlers.editMilestone({ from: "Parity A", to: "Parity B" });
		expect(normalizeRenamePaths(cliEdit.stdout.toString())).toBe(normalizeRenamePaths(toolText(mcpEdit)));

		const cliRemove = await $`bun ${cliPath} milestone remove "Parity B" --task-handling keep`.cwd(TEST_DIR).quiet();
		const mcpRemove = await mcpHandlers.removeMilestone({ name: "Parity B", taskHandling: "keep" });
		expect(cliRemove.stdout.toString().trim()).toBe(toolText(mcpRemove).trim());
	});
});
