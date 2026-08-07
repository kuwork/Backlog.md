import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI exclude-status and multi-status filtering", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-exclude-status");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Exclude Status Project");

		await core.createTask(
			{
				id: "task-1",
				title: "Todo visible",
				status: "To Do",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "visible work",
				rawContent: "visible work",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-2",
				title: "Progress visible",
				status: "In Progress",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "visible work",
				rawContent: "visible work",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-3",
				title: "Done hidden",
				status: "Done",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "done work",
				rawContent: "done work",
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function runCli(args: string[]): Promise<string> {
		const result = await $`bun ${cliPath} ${args}`.cwd(TEST_DIR).quiet().nothrow();
		return result.stdout.toString();
	}

	it("excludes a single status via --exclude-status", async () => {
		const output = await runCli(["task", "list", "--exclude-status", "Done", "--plain"]);
		expect(output).toContain("Todo visible");
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
	});

	it("excludes multiple statuses via comma-separated --exclude-status", async () => {
		const output = await runCli(["task", "list", "--exclude-status", "Done,To Do", "--plain"]);
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
		expect(output).not.toContain("Todo visible");
	});

	it("excludes multiple statuses via repeated --exclude-status", async () => {
		const output = await runCli([
			"task",
			"list",
			"--exclude-status",
			"Done",
			"--exclude-status",
			"In Progress",
			"--plain",
		]);
		expect(output).toContain("Todo visible");
		expect(output).not.toContain("Done hidden");
		expect(output).not.toContain("Progress visible");
	});

	it("is case-insensitive for excluded statuses", async () => {
		const output = await runCli(["task", "list", "--exclude-status", "done", "--plain"]);
		expect(output).not.toContain("Done hidden");
		expect(output).toContain("Todo visible");
	});

	it("selects multiple statuses via --status comma-separated values", async () => {
		const output = await runCli(["task", "list", "--status", "To Do,In Progress", "--plain"]);
		expect(output).toContain("Todo visible");
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
	});

	it("selects multiple statuses via repeated --status flags", async () => {
		const output = await runCli(["task", "list", "--status", "To Do", "--status", "In Progress", "--plain"]);
		expect(output).toContain("Todo visible");
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
	});

	it("combines multi-status selection with exclusion", async () => {
		const output = await runCli([
			"task",
			"list",
			"--status",
			"To Do,In Progress,Done",
			"--exclude-status",
			"Done",
			"--plain",
		]);
		expect(output).toContain("Todo visible");
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
	});

	it("rejects invalid excluded statuses", async () => {
		const result = await $`bun ${cliPath} task list --exclude-status "Bogus" --plain`.cwd(TEST_DIR).quiet().nothrow();
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("Invalid --exclude-status");
		expect(result.exitCode).not.toBe(0);
	});

	it("excludes statuses in search results", async () => {
		const output = await runCli(["search", "work", "--exclude-status", "Done", "--plain"]);
		expect(output).toContain("Todo visible");
		expect(output).toContain("Progress visible");
		expect(output).not.toContain("Done hidden");
	});
});
