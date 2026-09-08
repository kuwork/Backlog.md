import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { CommentsManager } from "../markdown/structured-sections.ts";
import type { Task } from "../types/index.ts";
import { createTaskSearchIndex } from "../utils/task-search.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
let TEST_DIR: string;

describe("Task comments", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-comments");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Task Comments Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR).catch(() => {});
	});

	it("persists ordered comments and preserves markdown headings inside comment bodies", async () => {
		const core = new Core(TEST_DIR);
		const task: Task = {
			id: "task-1",
			title: "Commented task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-05-31 10:00",
			labels: [],
			dependencies: [],
			description: "Task description",
			implementationNotes: "Progress note",
			comments: [
				{
					index: 1,
					author: "@lesserevil",
					createdDate: "2026-05-31 10:10",
					body: "First comment\n\n## Nested heading\n\nDetails remain inside the comment.",
				},
			],
			finalSummary: "Summary",
		};

		await core.createTask(task, false);
		const loaded = await core.filesystem.loadTask("task-1");

		expect(loaded?.comments).toEqual([
			{
				index: 1,
				author: "@lesserevil",
				createdDate: "2026-05-31 10:10",
				body: "First comment\n\n## Nested heading\n\nDetails remain inside the comment.",
			},
		]);

		const body = loaded?.rawContent ?? "";
		expect(body.indexOf("## Comments")).toBeGreaterThan(body.indexOf("## Implementation Notes"));
		expect(body.indexOf("## Final Summary")).toBeGreaterThan(body.indexOf("## Comments"));
		expect(CommentsManager.parseAllComments(body)[0]?.body).toContain("## Nested heading");
	});

	it("appends comments through the shared update path and preserves them on unrelated edits", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Append comments",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
			},
			false,
		);

		await core.updateTaskFromInput(
			"task-1",
			{
				appendComments: [{ body: "needle-comment body", author: "@reviewer", createdDate: "2026-05-31 10:30" }],
			},
			false,
		);
		await core.updateTaskFromInput("task-1", { title: "Renamed with comment" }, false);

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.title).toBe("Renamed with comment");
		expect(loaded?.comments).toEqual([
			{
				index: 1,
				author: "@reviewer",
				createdDate: "2026-05-31 10:30",
				body: "needle-comment body",
			},
		]);
		expect(loaded?.updatedDate).toBeDefined();

		const memoryMatches = createTaskSearchIndex([loaded as Task]).search({ query: "needle-comment" });
		expect(memoryMatches.map((task) => task.id)).toEqual(["TASK-1"]);

		const searchService = await core.getSearchService();
		const sharedMatches = searchService.search({ query: "needle-comment", types: ["task"] });
		expect(sharedMatches.map((result) => (result.type === "task" ? result.task.id : ""))).toContain("TASK-1");
		core.disposeSearchService();
		core.disposeContentStore();
	});

	it("keeps appended comments before final summary when notes are absent", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Summary-only task",
				status: "Done",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
				finalSummary: "Completed summary",
				definitionOfDoneItems: [{ index: 1, text: "Validated", checked: true }],
			},
			false,
		);

		await core.updateTaskFromInput("task-1", { appendComments: ["Review note"] }, false);

		const body = (await core.getTaskContent("task-1")) ?? "";
		expect(body.indexOf("## Comments")).toBeGreaterThan(body.indexOf("## Description"));
		expect(body.indexOf("## Final Summary")).toBeGreaterThan(body.indexOf("## Comments"));
	});

	it("keeps appended comments after Definition of Done when no final summary exists", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Definition-only task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
				definitionOfDoneItems: [{ index: 1, text: "Validated", checked: false }],
			},
			false,
		);

		await core.updateTaskFromInput("task-1", { appendComments: ["Review note"] }, false);

		const body = (await core.getTaskContent("task-1")) ?? "";
		expect(body.indexOf("## Comments")).toBeGreaterThan(body.indexOf("## Definition of Done"));
	});

	it("formats comments with compact delimiter blocks", () => {
		const updated = CommentsManager.updateContent("## Description\n\nTask description", [
			{ index: 1, author: "@reviewer", createdDate: "2026-05-31 10:45", body: "Review note" },
		]);
		const commentsSection = updated.slice(updated.indexOf("## Comments"));

		expect(updated).toContain("## Comments\n\n<!-- COMMENTS:BEGIN -->");
		expect(updated).not.toContain("## Comments\n\n\n<!-- COMMENTS:BEGIN -->");
		expect(commentsSection).toContain("author: @reviewer\ncreated: 2026-05-31 10:45\n---\nReview note\n---");
		expect(commentsSection).not.toContain("<!-- COMMENT:BEGIN -->");
		expect(commentsSection).not.toContain("index:");
	});

	it("parses compact delimiter comments", () => {
		const content = [
			"## Description",
			"",
			"Task description",
			"",
			"## Comments",
			"",
			"<!-- COMMENTS:BEGIN -->",
			"author: Alex",
			"created: 2026-06-07 21:21",
			"---",
			"test",
			"---",
			"",
			"author: Codex",
			"created: 2026-06-07 21:22",
			"---",
			"second comment",
			"---",
			"<!-- COMMENTS:END -->",
		].join("\n");

		expect(CommentsManager.parseAllComments(content)).toEqual([
			{ index: 1, author: "Alex", createdDate: "2026-06-07 21:21", body: "test" },
			{ index: 2, author: "Codex", createdDate: "2026-06-07 21:22", body: "second comment" },
		]);
	});

	it("ignores comment markers nested inside structured description examples", () => {
		const content = [
			"## Description",
			"",
			"<!-- SECTION:DESCRIPTION:BEGIN -->",
			"Example comment storage:",
			"```markdown",
			"## Comments",
			"<!-- COMMENTS:BEGIN -->",
			"<!-- COMMENT:BEGIN -->",
			"index: 1",
			"created: 2026-05-31 10:00",
			"",
			"Example-only comment",
			"<!-- COMMENT:END -->",
			"<!-- COMMENTS:END -->",
			"```",
			"<!-- SECTION:DESCRIPTION:END -->",
			"",
			"## Comments",
			"<!-- COMMENTS:BEGIN -->",
			"<!-- COMMENT:BEGIN -->",
			"index: 1",
			"author: @actual",
			"created: 2026-05-31 10:30",
			"",
			"Actual comment",
			"<!-- COMMENT:END -->",
			"<!-- COMMENTS:END -->",
		].join("\n");

		expect(CommentsManager.parseAllComments(content).map((comment) => comment.body)).toEqual(["Actual comment"]);

		const updated = CommentsManager.updateContent(content, [
			{ index: 1, author: "@actual", createdDate: "2026-05-31 10:30", body: "Actual comment" },
			{ index: 2, createdDate: "2026-05-31 10:45", body: "Follow-up" },
		]);
		expect(updated).toContain("Example-only comment");
		const updatedCommentsSection = updated.slice(updated.lastIndexOf("## Comments"));
		expect(updatedCommentsSection).toContain("---\nActual comment\n---");
		expect(updatedCommentsSection).not.toContain("<!-- COMMENT:BEGIN -->");
		expect(CommentsManager.parseAllComments(updated).map((comment) => comment.body)).toEqual([
			"Actual comment",
			"Follow-up",
		]);
	});

	it("preserves freeform comments and following unknown sections when adding structured comments", () => {
		const content = [
			"## Description",
			"",
			"Task description",
			"",
			"## Comments",
			"",
			"Existing freeform note.",
			"",
			"## Custom Details",
			"",
			"Keep this unknown section.",
		].join("\n");

		const updated = CommentsManager.updateContent(content, [
			{ index: 1, createdDate: "2026-05-31 10:45", body: "Structured follow-up" },
		]);

		expect(updated).toContain("Existing freeform note.");
		expect(updated).toContain("## Custom Details");
		expect(updated).toContain("Keep this unknown section.");
		expect(CommentsManager.parseAllComments(updated).map((comment) => comment.body)).toEqual(["Structured follow-up"]);
	});

	it("rejects reserved comment markers in comment authors", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Invalid author marker task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
			},
			false,
		);

		await expect(
			core.updateTaskFromInput(
				"task-1",
				{ appendComments: [{ body: "Valid body", author: "<!-- COMMENT:END -->" }] },
				false,
			),
		).rejects.toThrow("Comment author cannot contain Backlog comment markers.");

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
	});

	it("rejects standalone comment delimiters before persisting comments", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Invalid delimiter comment task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
			},
			false,
		);

		await expect(
			core.updateTaskFromInput("task-1", { appendComments: ["Valid line\n---\nInvalid delimiter"] }, false),
		).rejects.toThrow("Comment body cannot contain standalone '---' delimiter lines.");

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
	});

	it("appends and renders comments through CLI plain output", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI comment task"]}`.cwd(TEST_DIR).quiet().nothrow();
		expect(create.exitCode).toBe(0);

		const edit =
			await $`bun ${[CLI_PATH, "task", "edit", "1", "--comment", "CLI comment body", "--comment-author", "@cli", "--plain"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
		expect(edit.exitCode).toBe(0);

		const output = edit.stdout.toString();
		expect(output).toContain("Comments:");
		expect(output).toContain("#1 - @cli");
		expect(output).toContain("CLI comment body");

		const core = new Core(TEST_DIR);
		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments?.[0]?.author).toBe("@cli");
		expect(loaded?.comments?.[0]?.body).toBe("CLI comment body");
	});

	it("rejects reserved comment markers in CLI comments", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI invalid comment task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const edit = await $`bun ${[CLI_PATH, "task", "edit", "1", "--comment", "Invalid <!-- COMMENT:BEGIN --> marker"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(edit.exitCode).not.toBe(0);
		expect(`${edit.stderr}${edit.stdout}`).toContain("Comment body cannot contain Backlog comment markers.");

		const core = new Core(TEST_DIR);
		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
	});

	it("rejects standalone comment delimiters in CLI comments", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI invalid delimiter comment task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const edit = await $`bun ${[CLI_PATH, "task", "edit", "1", "--comment", "Invalid\\n---\\ndelimiter"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(edit.exitCode).not.toBe(0);
		expect(`${edit.stderr}${edit.stdout}`).toContain("Comment body cannot contain standalone '---' delimiter lines.");

		const core = new Core(TEST_DIR);
		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
	});

	it("removes a comment by index and renumbers the remaining comments", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Remove comment",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
			},
			false,
		);
		await core.updateTaskFromInput(
			"task-1",
			{
				appendComments: [
					{ body: "first comment", author: "@one", createdDate: "2026-05-31 10:10" },
					{ body: "second comment", author: "@two", createdDate: "2026-05-31 10:20" },
					{ body: "third comment", createdDate: "2026-05-31 10:30" },
				],
			},
			false,
		);

		await core.updateTaskFromInput("task-1", { removeComments: [2] }, false);

		const loaded = (await core.filesystem.loadTask("task-1")) as Task;
		expect(loaded.comments).toEqual([
			{ index: 1, author: "@one", createdDate: "2026-05-31 10:10", body: "first comment" },
			{ index: 2, createdDate: "2026-05-31 10:30", body: "third comment" },
		]);
		expect(loaded.description).toBe("Task description");
		expect(loaded.rawContent).toContain("## Comments");

		const matches = createTaskSearchIndex([loaded]).search({ query: "second" });
		expect(matches.map((task) => task.id)).toEqual([]);
	});

	it("removes multiple comments in one update", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Remove multiple comments",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
			},
			false,
		);
		await core.updateTaskFromInput(
			"task-1",
			{
				appendComments: [
					{ body: "alpha body", createdDate: "2026-05-31 10:10" },
					{ body: "beta body", createdDate: "2026-05-31 10:20" },
					{ body: "gamma body", createdDate: "2026-05-31 10:30" },
				],
			},
			false,
		);

		await core.updateTaskFromInput("task-1", { removeComments: [1, 3] }, false);

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments).toEqual([{ index: 1, createdDate: "2026-05-31 10:20", body: "beta body" }]);
	});

	it("clears all comments and strips the Comments section", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Clear comments",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
				comments: [{ index: 1, author: "@one", createdDate: "2026-05-31 10:10", body: "only comment" }],
			},
			false,
		);

		await core.updateTaskFromInput("task-1", { clearComments: true }, false);

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
		expect(loaded?.rawContent).not.toContain("## Comments");
		expect(loaded?.description).toBe("Task description");
	});

	it("rejects removing a comment index that does not exist", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Missing comment",
				status: "To Do",
				assignee: [],
				createdDate: "2026-05-31 10:00",
				labels: [],
				dependencies: [],
				description: "Task description",
				comments: [{ index: 1, createdDate: "2026-05-31 10:10", body: "only comment" }],
			},
			false,
		);

		await expect(core.updateTaskFromInput("task-1", { removeComments: [5] }, false)).rejects.toThrow(
			"Comment #5 not found.",
		);

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments).toEqual([{ index: 1, createdDate: "2026-05-31 10:10", body: "only comment" }]);
	});

	it("removes comments from legacy marker blocks", async () => {
		const core = new Core(TEST_DIR);
		const content = [
			"---",
			"id: task-1",
			"title: Legacy comments",
			"status: To Do",
			"created_date: 2026-05-31 10:00",
			"---",
			"",
			"## Description",
			"",
			"Task description",
			"",
			"## Comments",
			"",
			"<!-- COMMENTS:BEGIN -->",
			"",
			"<!-- COMMENT:BEGIN -->",
			"index: 1",
			"author: @one",
			"created: 2026-05-31 10:10",
			"",
			"Legacy first",
			"<!-- COMMENT:END -->",
			"",
			"<!-- COMMENT:BEGIN -->",
			"index: 2",
			"author: @two",
			"created: 2026-05-31 10:20",
			"",
			"Legacy second",
			"<!-- COMMENT:END -->",
			"",
			"<!-- COMMENTS:END -->",
			"",
		].join("\n");
		await Bun.write(join(TEST_DIR, "backlog", "tasks", "task-1 - Legacy.md"), content);

		const before = await core.filesystem.loadTask("task-1");
		expect(before?.comments?.map((comment) => comment.body)).toEqual(["Legacy first", "Legacy second"]);

		await core.updateTaskFromInput("task-1", { removeComments: [1] }, false);

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments).toEqual([
			{ index: 1, author: "@two", createdDate: "2026-05-31 10:20", body: "Legacy second" },
		]);
	});

	it("removes and clears comments through the CLI", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI remove comment task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const append = await $`bun ${[CLI_PATH, "task", "edit", "1", "--comment", "keep me", "--comment", "drop me"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(append.exitCode).toBe(0);

		const remove = await $`bun ${[CLI_PATH, "task", "edit", "1", "--remove-comment", "2", "--plain"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(remove.exitCode).toBe(0);
		expect(remove.stdout.toString()).toContain("keep me");
		expect(remove.stdout.toString()).not.toContain("drop me");

		const clear = await $`bun ${[CLI_PATH, "task", "edit", "1", "--clear-comments", "--plain"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(clear.exitCode).toBe(0);
		expect(clear.stdout.toString()).not.toContain("Comments:");

		const core = new Core(TEST_DIR);
		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments ?? []).toEqual([]);
		expect(loaded?.rawContent).not.toContain("## Comments");
	});

	it("rejects out-of-range CLI comment removal", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI missing comment task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const edit = await $`bun ${[CLI_PATH, "task", "edit", "1", "--remove-comment", "3"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(edit.exitCode).not.toBe(0);
		expect(`${edit.stderr}${edit.stdout}`).toContain("Comment #3 not found.");
	});

	it("supports comma-separated --remove-comment indexes", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI comma remove task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const append =
			await $`bun ${[CLI_PATH, "task", "edit", "1", "--comment", "first", "--comment", "second", "--comment", "third"]}`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
		expect(append.exitCode).toBe(0);

		const remove = await $`bun ${[CLI_PATH, "task", "edit", "1", "--remove-comment", "1,3", "--plain"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(remove.exitCode).toBe(0);
		expect(remove.stdout.toString()).not.toContain("first");
		expect(remove.stdout.toString()).toContain("second");
		expect(remove.stdout.toString()).not.toContain("third");

		const core = new Core(TEST_DIR);
		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded?.comments).toEqual([{ index: 1, createdDate: expect.any(String), body: "second" }]);
	});

	it("rejects combining --clear-comments with --comment or --remove-comment", async () => {
		const create = await $`bun ${[CLI_PATH, "task", "create", "CLI clear conflict task"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(create.exitCode).toBe(0);

		const withAppend = await $`bun ${[CLI_PATH, "task", "edit", "1", "--clear-comments", "--comment", "nope"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(withAppend.exitCode).not.toBe(0);
		expect(`${withAppend.stderr}${withAppend.stdout}`).toContain("Cannot combine --clear-comments");

		const withRemove = await $`bun ${[CLI_PATH, "task", "edit", "1", "--clear-comments", "--remove-comment", "1"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(withRemove.exitCode).not.toBe(0);
		expect(`${withRemove.stderr}${withRemove.stdout}`).toContain("Cannot combine --clear-comments");
	});
});
