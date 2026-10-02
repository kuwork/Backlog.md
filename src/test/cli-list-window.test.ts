import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { createMemo } from "../core/memos.ts";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const cliPath = join(process.cwd(), "src", "cli.ts");

/** The lines a run printed, without the trailing newline. */
function lines(result: { stdout: Uint8Array | string }): string[] {
	return result.stdout.toString().trimEnd().split("\n");
}

/** The last line a run printed, where the window footer lives. */
function lastLine(result: { stdout: Uint8Array | string }): string {
	return lines(result).at(-1) ?? "";
}

/** The arguments of the command a footer sends the reader to, or none when the list was complete. */
function nextArgsOf(result: { stdout: Uint8Array | string }): string[] {
	const footer = lastLine(result);
	if (!footer.startsWith("Showing") || !footer.includes("Next: ")) return [];
	return (footer.split("Next: ")[1] ?? "").replace(/^backlog /, "").split(/\s+/);
}

describe("CLI list paging", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-list-window");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "List Window Test Project");
		for (const index of [1, 2, 3, 4, 5]) {
			await core.createTask(
				{
					id: `task-${index}`,
					title: `Windowed task ${index}`,
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-18",
					labels: [],
					dependencies: [],
					description: `Task number ${index} of the paging fixture.`,
				},
				false,
			);
		}
		for (const index of [1, 2, 3]) {
			await createMemo(TEST_DIR, `Memo body number ${index}.`, [], "2026-08-18");
		}
		// Three milestones carry a task each; two tasks stay without one, as the No Milestone header.
		const assigned: [number, string][] = [];
		for (const name of ["Alpha", "Beta", "Gamma"]) {
			const created = await core.filesystem.createMilestone(name);
			assigned.push([assigned.length + 1, created.id]);
		}
		for (const [index, milestone] of assigned) {
			const task = await core.filesystem.loadTask(`task-${index}`);
			if (task) await core.updateTask({ ...task, milestone }, false);
		}
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("cuts the list and names the command that prints the following items", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --max-count 2 --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Windowed task 1");
		expect(stdout).toContain("Windowed task 2");
		expect(stdout).not.toContain("Windowed task 3");
		expect(stdout.trimEnd().split("\n").at(-1)).toBe(
			"Showing 1-2 of 5 items. Next: backlog task list --status 'To Do' --max-count 2 --plain --skip 2",
		);
	});

	it("walks the whole list by following the printed Next command", async () => {
		const first = await $`bun ${cliPath} task list --max-count 2 --plain`.cwd(TEST_DIR).quiet();
		const secondArgs = nextArgsOf(first);
		expect(secondArgs).toContain("--skip");
		expect(secondArgs).toContain("2");

		const second = await $`bun ${cliPath} ${secondArgs}`.cwd(TEST_DIR).quiet();
		const secondOutput = second.stdout.toString();
		expect(secondOutput).toContain("Windowed task 3");
		expect(secondOutput).toContain("Windowed task 4");
		expect(secondOutput).not.toContain("Windowed task 5");

		const thirdArgs = nextArgsOf(second);
		const last = await $`bun ${cliPath} ${thirdArgs}`.cwd(TEST_DIR).quiet();

		expect(last.stdout.toString()).toContain("Windowed task 5");
		expect(lastLine(last)).toBe("Showing 5-5 of 5 items.");
	});

	it("prints no footer when the window lists everything", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --max-count 5 --plain`.cwd(TEST_DIR).quiet();

		expect(result.stdout.toString()).not.toContain("Showing");
	});

	it("prints a zero range when the skip lands past the end", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --skip 9 --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		expect(lines(result)).toEqual(["Showing 0 of 5 items."]);
	});

	it("prints only the number for --count, and rejects it with --json", async () => {
		const counted = await $`bun ${cliPath} task list --status "To Do" --count`.cwd(TEST_DIR).quiet();
		expect(counted.stdout.toString().trim()).toBe("5");

		const rejected = await $`bun ${cliPath} task list --status "To Do" --json --count`.cwd(TEST_DIR).nothrow().quiet();
		expect(rejected.exitCode).toBe(1);
		expect(rejected.stderr.toString()).toContain("--count cannot be combined with --json.");
	});

	it("rejects an invalid window value", async () => {
		const badMaxCount = await $`bun ${cliPath} task list --max-count 0 --plain`.cwd(TEST_DIR).nothrow().quiet();
		const badSkip = await $`bun ${cliPath} task list --skip -3 --plain`.cwd(TEST_DIR).nothrow().quiet();

		expect(badMaxCount.exitCode).toBe(1);
		expect(badMaxCount.stderr.toString()).toContain("--max-count must be a positive integer");
		expect(badSkip.exitCode).toBe(1);
		expect(badSkip.stderr.toString()).toContain("--skip must be a non-negative integer");
	});

	it("leaves --limit silent, without a footer", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --limit 2 --plain`.cwd(TEST_DIR).quiet();
		const stdout = result.stdout.toString();

		expect(stdout).toContain("Windowed task 1");
		expect(stdout).toContain("Windowed task 2");
		expect(stdout).not.toContain("Windowed task 3");
		expect(stdout).not.toContain("Showing");
	});

	it("adds total and nextSkip to a cut JSON envelope only", async () => {
		const cut = await $`bun ${cliPath} task list --status "To Do" --json --max-count 2`.cwd(TEST_DIR).quiet();
		const cutEnvelope = JSON.parse(cut.stdout.toString());

		expect(cutEnvelope.total).toBe(5);
		expect(cutEnvelope.nextSkip).toBe(2);
		expect(cutEnvelope.tasks).toHaveLength(2);

		const whole = await $`bun ${cliPath} task list --status "To Do" --json`.cwd(TEST_DIR).quiet();
		const wholeEnvelope = JSON.parse(whole.stdout.toString());

		expect(wholeEnvelope.tasks).toHaveLength(5);
		expect(Object.keys(wholeEnvelope)).not.toContain("total");
		expect(Object.keys(wholeEnvelope)).not.toContain("nextSkip");
	});

	it("pages search results and documents with the same options", async () => {
		const searched = await $`bun ${cliPath} search --type task --json --max-count 2`.cwd(TEST_DIR).quiet();
		expect(JSON.parse(searched.stdout.toString()).total).toBe(5);

		const listed = await $`bun ${cliPath} decision list --max-count 2 --plain`.cwd(TEST_DIR).quiet();
		expect(listed.exitCode).toBe(0);
	});

	it("pages memos with --skip and no longer accepts --cursor", async () => {
		const first = await $`bun ${cliPath} memo list --max-count 2 --plain`.cwd(TEST_DIR).quiet();
		expect(first.exitCode).toBe(0);
		expect(
			first.stdout
				.toString()
				.split("\n")
				.filter((line) => line.includes("\t")),
		).toHaveLength(2);
		expect(lastLine(first)).toBe("Showing 1-2 of 3 items. Next: backlog memo list --max-count 2 --plain --skip 2");

		const nextArgs = nextArgsOf(first);
		const second = await $`bun ${cliPath} ${nextArgs}`.cwd(TEST_DIR).quiet();
		// The windows join into the complete list: the following window holds the remaining memo.
		expect(second.stdout.toString()).toContain("Memo body number");
		expect(lastLine(second)).toBe("Showing 3-3 of 3 items.");

		const cursor = await $`bun ${cliPath} memo list --cursor 20260818-1`.cwd(TEST_DIR).nothrow().quiet();
		expect(cursor.exitCode).toBe(1);
		expect(cursor.stderr.toString()).toContain("unknown option '--cursor'");
	});

	it("counts the milestones, never the No Milestone tasks", async () => {
		const counted = await $`bun ${cliPath} milestone list --count`.cwd(TEST_DIR).quiet();

		expect(counted.stdout.toString().trim()).toBe("3");
	});

	it("hides the No Milestone lane by default, even under --limit", async () => {
		const result = await $`bun ${cliPath} milestone list --limit 2 --plain`.cwd(TEST_DIR).quiet();
		const stdout = result.stdout.toString();

		expect(result.exitCode).toBe(0);
		expect(stdout).not.toContain("## No Milestone");
		expect(stdout).toContain("## Alpha (1 tasks)");
		expect(stdout).toContain("## Beta (1 tasks)");
		expect(stdout).not.toContain("Gamma");
		expect(stdout).not.toContain("Windowed task 3");
		expect(stdout).not.toContain("Showing");
	});

	it("shows the No Milestone lane with --with-no-milestone, still no footer for --limit", async () => {
		const result = await $`bun ${cliPath} milestone list --limit 2 --with-no-milestone --plain`.cwd(TEST_DIR).quiet();
		const stdout = result.stdout.toString();

		expect(stdout).toContain("## No Milestone (2 tasks)");
		expect(stdout).toContain("## Alpha (1 tasks)");
		expect(stdout).toContain("## Beta (1 tasks)");
		expect(stdout).not.toContain("Gamma");
		expect(stdout).not.toContain("Showing");
	});

	it("hides the No Milestone lane by default under --max-count, and still paginates", async () => {
		const result = await $`bun ${cliPath} milestone list --max-count 2 --plain`.cwd(TEST_DIR).quiet();
		const stdout = result.stdout.toString();

		// The window counts milestones, so a default run lists two milestone sections and no header.
		expect(stdout.match(/^## /gm)).toHaveLength(2);
		expect(stdout).not.toContain("## No Milestone");
		expect(stdout).toContain("## Alpha (1 tasks)");
		expect(stdout).toContain("## Beta (1 tasks)");
		expect(stdout).not.toContain("## Gamma");
		expect(lastLine(result)).toBe(
			"Showing 1-2 of 3 items. Next: backlog milestone list --max-count 2 --plain --skip 2",
		);
	});

	it("includes the No Milestone lane under --max-count when --with-no-milestone is passed", async () => {
		const result = await $`bun ${cliPath} milestone list --max-count 2 --with-no-milestone --plain`
			.cwd(TEST_DIR)
			.quiet();
		const stdout = result.stdout.toString();

		expect(stdout.match(/^## /gm)).toHaveLength(3);
		expect(stdout).toContain("## No Milestone (2 tasks)");
		expect(stdout).toContain("## Alpha (1 tasks)");
		expect(stdout).toContain("## Beta (1 tasks)");
		expect(stdout).not.toContain("## Gamma");
		expect(lastLine(result)).toBe(
			"Showing 1-2 of 3 items. Next: backlog milestone list --max-count 2 --with-no-milestone --plain --skip 2",
		);
	});

	it("carries the No Milestone lane on every window when --with-no-milestone is set", async () => {
		const first = await $`bun ${cliPath} milestone list --max-count 2 --with-no-milestone --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(first.stdout.toString()).toContain("## No Milestone (2 tasks)");

		const nextArgs = nextArgsOf(first);
		const second = await $`bun ${cliPath} ${nextArgs}`.cwd(TEST_DIR).quiet();
		const secondOutput = second.stdout.toString();

		expect(secondOutput).toContain("## Gamma (1 tasks)");
		// The flag travels with the Next command, so the following window leads with the same header.
		expect(secondOutput).toContain("## No Milestone");
	});
});

describe("list paging guidance", () => {
	it("documents the four options in the shared quick reference", async () => {
		const overview = await Bun.file(join(process.cwd(), "src", "guidelines", "cli-instructions", "overview.md")).text();
		const section = overview.split("## List Paging Quick Reference")[1]?.split("\n## ")[0] ?? "";

		expect(section).not.toBe("");
		for (const option of ["--limit", "--max-count", "--skip", "--count"]) {
			expect(section).toContain(option);
		}
		expect(section).toContain("Showing <first>-<last> of <total> items. Next: <command>");
		expect(section).toContain("Showing 0 of <total> items.");
		expect(section).toContain("total` and `nextSkip`");
		// One runnable example per list family named in the acceptance criteria.
		expect(section).toContain("backlog task list");
		expect(section).toContain("backlog search");
		expect(section).toContain("backlog memo list");
	});
});
