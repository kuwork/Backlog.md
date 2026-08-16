import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

async function runCli(args: string[], cwd = TEST_DIR) {
	return await $`bun ${[CLI_PATH, ...args]}`.cwd(cwd).nothrow().quiet();
}

describe("CLI JSON output", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-json-output");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "JSON Output Test");
		await core.createTask(
			{
				id: "task-1",
				title: "JSON task",
				status: "In Progress",
				priority: "high",
				assignee: ["@alex"],
				reporter: "@sam",
				createdDate: "2026-07-14 09:30",
				updatedDate: "2026-07-14 10:45",
				labels: ["cli", "json"],
				milestone: "m-1",
				dependencies: ["TASK-2"],
				references: ["https://example.com/issue"],
				documentation: ["doc-1"],
				modifiedFiles: ["src/cli.ts"],
				description: "Machine-readable output",
				implementationPlan: "1. Add formatter",
				implementationNotes: "Formatter added",
				finalSummary: "Ready for review",
				acceptanceCriteriaItems: [{ index: 1, text: "Produces JSON", checked: true }],
				definitionOfDoneItems: [{ index: 1, text: "Tests pass", checked: false }],
				comments: [{ index: 1, body: "Keep this stable", createdDate: "2026-07-14 11:00", author: "@alex" }],
				ordinal: 1000,
				dueDate: "2026-07-20",
				plannedStart: "2026-07-15",
				plannedEnd: "2026-07-18",
				rawContent: "internal markdown",
				onStatusChange: "echo secret",
			},
			false,
		);

		await core.filesystem.saveDocument({
			id: "doc-1",
			title: "JSON guide",
			type: "guide",
			createdDate: "2026-07-13",
			updatedDate: "2026-07-14 08:00",
			rawContent: "JSON task documentation",
			tags: ["cli"],
			path: "guides/json.md",
		});

		await core.filesystem.saveDecision({
			id: "decision-1",
			title: "Use stable JSON",
			date: "2026-07-12",
			status: "accepted",
			context: "JSON task consumers need stability",
			decision: "Publish curated fields",
			consequences: "Version the contract",
			rawContent: "JSON task decision",
		});
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("returns a compact versioned task-list envelope", async () => {
		const result = await runCli(["task", "list", "--json"]);
		expect(result.exitCode).toBe(0);
		expect(result.stderr.toString()).toBe("");
		expect(result.stdout.toString().endsWith("\n")).toBe(true);

		const output = JSON.parse(result.stdout.toString());
		expect(output).toEqual({
			schemaVersion: 1,
			kind: "task-list",
			tasks: [
				{
					id: "TASK-1",
					title: "JSON task",
					status: "In Progress",
					priority: "high",
					assignees: ["@alex"],
					reporter: "@sam",
					labels: ["cli", "json"],
					milestone: "m-1",
					parentTaskId: null,
					ordinal: 1000,
					createdAt: "2026-07-14T09:30:00Z",
					updatedAt: "2026-07-14T10:45:00Z",
					dueDate: "2026-07-20",
					plannedStart: "2026-07-15",
					plannedEnd: "2026-07-18",
					actualStart: null,
					actualEnd: null,
				},
			],
		});
		expect(result.stdout.toString()).not.toContain("rawContent");
		expect(result.stdout.toString()).not.toContain("onStatusChange");
	});

	it("returns curated task details for view and shorthand", async () => {
		for (const args of [
			["task", "view", "1", "--json"],
			["task", "1", "--json"],
		]) {
			const result = await runCli(args);
			expect(result.exitCode).toBe(0);
			const output = JSON.parse(result.stdout.toString());
			expect(output.schemaVersion).toBe(1);
			expect(output.kind).toBe("task-view");
			expect(output.task.path).toMatch(/^backlog\/tasks\/task-1 - JSON-task\.md$/);
			expect(output.task.description).toBe("Machine-readable output");
			expect(output.task.dependencies).toEqual(["TASK-2"]);
			expect(output.task.acceptanceCriteria).toEqual([{ index: 1, text: "Produces JSON", checked: true }]);
			expect(output.task.definitionOfDone).toEqual([{ index: 1, text: "Tests pass", checked: false }]);
			expect(output.task.comments).toEqual([
				{
					index: 1,
					body: "Keep this stable",
					createdAt: "2026-07-14T11:00:00Z",
					author: "@alex",
				},
			]);
			expect(output.task.subtasks).toEqual([]);
			expect(output.task.finalSummary).toBe("Ready for review");
			expect(output.task.rawContent).toBeUndefined();
			expect(output.task.filePath).toBeUndefined();
		}
	});

	it("serializes an absent description as null and preserves Markdown verbatim", async () => {
		const withoutDescription = await runCli(["task", "create", "No description", "--plain"]);
		expect(withoutDescription.exitCode).toBe(0);
		const withMarkdown = await runCli([
			"task",
			"create",
			"Markdown description",
			"--description",
			"First line\\n\\n- item with `code`",
			"--plain",
		]);
		expect(withMarkdown.exitCode).toBe(0);

		const absent = await runCli(["task", "view", "2", "--json"]);
		expect(absent.exitCode).toBe(0);
		expect(JSON.parse(absent.stdout.toString()).task.description).toBeNull();

		const markdown = await runCli(["task", "view", "3", "--json"]);
		expect(markdown.exitCode).toBe(0);
		expect(JSON.parse(markdown.stdout.toString()).task.description).toBe("First line\n\n- item with `code`");
	});

	it("preserves heterogeneous search rank and omits scores", async () => {
		// "JSON" matches all three entities within the score threshold (0.45);
		// a more specific query like "JSON task" would drop the decision, which
		// is the intended score-filtered behavior shared with the web UI.
		const result = await runCli(["search", "JSON", "--json"]);
		expect(result.exitCode).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.schemaVersion).toBe(1);
		expect(output.kind).toBe("search");
		expect(output.results.map((entry: { type: string }) => entry.type)).toEqual(["document", "task", "decision"]);
		expect(output.results[0].data).toEqual({
			id: "doc-1",
			title: "JSON guide",
			type: "guide",
			path: "backlog/docs/doc-1 - JSON-guide.md",
			tags: ["cli"],
			createdAt: "2026-07-13",
			updatedAt: "2026-07-14T08:00:00Z",
		});
		expect(output.results[1].data.id).toBe("TASK-1");
		expect(output.results[1].data.dueDate).toBe("2026-07-20");
		expect(output.results[2].data).toEqual({
			id: "decision-1",
			title: "Use stable JSON",
			status: "accepted",
			date: "2026-07-12",
		});
	});

	it("keeps JSON stdout clean and rejects conflicting output modes", async () => {
		const result = await runCli(["task", "list", "--json", "--plain"]);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain("--json cannot be combined with --plain.");
		expect(result.stdout.toString()).toBe("");
	});

	it("returns a versioned document-list envelope for doc list", async () => {
		const result = await runCli(["doc", "list", "--json"]);
		expect(result.exitCode).toBe(0);
		expect(result.stderr.toString()).toBe("");

		const output = JSON.parse(result.stdout.toString());
		expect(output.schemaVersion).toBe(1);
		expect(output.kind).toBe("document-list");
		expect(output.documents).toEqual([
			{
				id: "doc-1",
				title: "JSON guide",
				type: "guide",
				path: "backlog/docs/doc-1 - JSON-guide.md",
				tags: ["cli"],
				createdAt: "2026-07-13",
				updatedAt: "2026-07-14T08:00:00Z",
			},
		]);
	});

	it("rejects --json on non-read task subcommands", async () => {
		const result = await runCli(["task", "create", "Should fail", "--json"]);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain("unknown option '--json'");
	});
});
