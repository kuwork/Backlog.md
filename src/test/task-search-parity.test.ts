import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { ContentStore } from "../core/content-store.ts";
import { SearchService } from "../core/search-service.ts";
import { FileSystem } from "../file-system/operations.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";
import { applyTaskFilters, buildTaskSearchBodyText, createTaskSearchIndex } from "../utils/task-search.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * The local one-shot index (`task list --search`, the TUI views, the MCP adapter) and the
 * cross-branch SearchService (`backlog search`, the web API) must agree on what a query matches
 * and on what a filter means. These tests pin that agreement.
 */

const labelledTask: Task = {
	id: "task-1",
	title: "Rework the exporter",
	status: "To Do",
	assignee: ["@morgan"],
	reporter: "@morgan",
	createdDate: "2026-01-05 09:00",
	labels: ["backend", "infrastructure"],
	dependencies: [],
	rawContent: "## Description\nNothing here mentions the label or the assignee.",
	description: "Nothing here mentions the label or the assignee.",
};

const otherTask: Task = {
	id: "task-2",
	title: "Polish the sidebar",
	status: "To Do",
	assignee: ["@riley"],
	reporter: "@riley",
	createdDate: "2026-01-05 09:00",
	labels: ["backend"],
	dependencies: [],
	rawContent: "## Description\nUnrelated body text.",
	description: "Unrelated body text.",
};

const tasks = [labelledTask, otherTask];

function taskIds(results: Task[]): string[] {
	return results.map((task) => task.id).sort();
}

describe("task search corpus", () => {
	it("puts labels and assignees in the searchable text", () => {
		const bodyText = buildTaskSearchBodyText(labelledTask);
		expect(bodyText).toContain("infrastructure");
		expect(bodyText).toContain("@morgan");
	});
});

describe("cross-surface search parity", () => {
	let TEST_DIR: string;
	let filesystem: FileSystem;
	let store: ContentStore;
	let search: SearchService;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("task-search-parity");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		for (const task of tasks) {
			await filesystem.saveTask(task);
		}
		store = new ContentStore(filesystem);
		search = new SearchService(store);
		await search.ensureInitialized();
	});

	afterEach(async () => {
		search?.dispose();
		store?.dispose();
		await safeCleanup(TEST_DIR);
	});

	// The corpus canonicalizes IDs to the configured prefix casing; compare case-insensitively so
	// the pin holds no matter which side uppercases.
	const searchServiceTaskIds = (query: string): string[] =>
		search
			.search({ query, types: ["task"] })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id.toLowerCase())
			.sort();

	it("finds a task by a label it carries through both surfaces", () => {
		const localMatches = taskIds(createTaskSearchIndex(tasks).search({ query: "infrastructure" }));

		expect(localMatches).toEqual(["task-1"]);
		expect(searchServiceTaskIds("infrastructure")).toEqual(["task-1"]);
	});

	it("finds a task by its assignee through both surfaces", () => {
		const localMatches = taskIds(createTaskSearchIndex(tasks).search({ query: "morgan" }));

		expect(localMatches).toEqual(["task-1"]);
		expect(searchServiceTaskIds("morgan")).toEqual(["task-1"]);
	});

	it("agrees on a label filter applied without a query", () => {
		const localMatches = taskIds(applyTaskFilters(tasks, { labels: ["backend"] }));
		const serviceMatches = search
			.search({ types: ["task"], filters: { labels: ["backend"] } })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id.toLowerCase())
			.sort();

		expect(localMatches).toEqual(["task-1", "task-2"]);
		expect(serviceMatches).toEqual(["task-1", "task-2"]);
	});

	it("agrees on an assignee filter applied without a query", () => {
		const localMatches = taskIds(applyTaskFilters(tasks, { assignee: "@MORGAN" }));
		const serviceMatches = search
			.search({ types: ["task"], filters: { assignee: "@MORGAN" } })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id.toLowerCase())
			.sort();

		expect(localMatches).toEqual(["task-1"]);
		expect(serviceMatches).toEqual(["task-1"]);
	});

	it("applies the same labelMatch semantics with and without a query", () => {
		const bothLabels = ["backend", "infrastructure"];

		expect(taskIds(applyTaskFilters(tasks, { labels: bothLabels, labelMatch: "all" }))).toEqual(["task-1"]);
		expect(taskIds(applyTaskFilters(tasks, { labels: bothLabels, labelMatch: "any" }))).toEqual(["task-1", "task-2"]);

		const withQuery = { query: "the", labels: bothLabels } as const;
		expect(taskIds(applyTaskFilters(tasks, { ...withQuery, labelMatch: "all" }))).toEqual(["task-1"]);
		expect(taskIds(applyTaskFilters(tasks, { ...withQuery, labelMatch: "any" }))).toEqual(["task-1", "task-2"]);
	});
});

describe("labelMatch semantics", () => {
	it("defaults to matching any selected label", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["backend", "infrastructure"] }))).toEqual(["task-1", "task-2"]);
	});

	it("requires every label when the caller asks for all", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["backend", "infrastructure"], labelMatch: "all" }))).toEqual([
			"task-1",
		]);
	});

	it("matches labels case-insensitively in both modes", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["BACKEND"] }))).toEqual(["task-1", "task-2"]);
		expect(taskIds(applyTaskFilters(tasks, { labels: ["BackEnd", "INFRASTRUCTURE"], labelMatch: "all" }))).toEqual([
			"task-1",
		]);
	});
});

/**
 * Filters reach the shared predicate through several different call sites, and an argument dropped
 * at any one of them is invisible to a test that only exercises the predicate directly. These tests
 * drive the real CLI and MCP surfaces so the wiring itself is pinned.
 */
describe("filter wiring across surfaces", () => {
	const cliPath = getTestCliPath();
	let testDir: string;
	let core: Core;
	let mcpServer: McpServer;

	beforeEach(async () => {
		testDir = createUniqueTestDir("task-search-wiring");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Filter Wiring");

		await core.createTaskFromInput(
			{ title: "Wiring both labels", status: "To Do", labels: ["backend", "infrastructure"] },
			false,
		);
		await core.createTaskFromInput({ title: "Wiring one label", status: "To Do", labels: ["backend"] }, false);
		await core.createTaskFromInput({ title: "Wiring no labels", status: "To Do" }, false);

		mcpServer = new McpServer(testDir, "Test instructions");
		const mcpConfig = await mcpServer.filesystem.loadConfig();
		if (!mcpConfig) throw new Error("Expected MCP test config");
		registerTaskTools(mcpServer, mcpConfig);
	});

	afterEach(async () => {
		await mcpServer.stop();
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	const mcpTaskList = async (args: Record<string, unknown>): Promise<string> => {
		const result = await mcpServer.testInterface.callTool({ params: { name: "task_list", arguments: args } });
		const content = result.content as Array<{ text?: string }> | undefined;
		return content?.[0]?.text ?? "";
	};

	it("requires every label through the MCP task_list labels argument", async () => {
		const bothLabels = await mcpTaskList({ labels: ["backend", "infrastructure"] });
		expect(bothLabels).toContain("Wiring both labels");
		expect(bothLabels).not.toContain("Wiring one label");
		expect(bothLabels).not.toContain("Wiring no labels");

		const oneLabel = await mcpTaskList({ labels: ["backend"] });
		expect(oneLabel).toContain("Wiring both labels");
		expect(oneLabel).toContain("Wiring one label");
	});

	it("matches MCP labels case-insensitively like every other surface", async () => {
		const upper = await mcpTaskList({ labels: ["BACKEND", "INFRASTRUCTURE"] });
		expect(upper).toContain("Wiring both labels");
		expect(upper).not.toContain("Wiring one label");
	});

	it("matches draft labels case-insensitively through the MCP draft path", async () => {
		await core.filesystem.saveDraft({
			id: "draft-1",
			title: "Wiring draft label",
			status: "Draft",
			assignee: [],
			labels: ["Backend"],
			dependencies: [],
			createdDate: "2026-01-05 09:00",
			rawContent: "# draft-1 - Wiring draft label",
		});
		const out = await mcpTaskList({ status: "draft", labels: ["backend"] });
		expect(out).toContain("Wiring draft label");
	});

	it("requires every label through the CLI task list --labels flag", async () => {
		const both = await $`bun ${cliPath} task list --labels backend,infrastructure --plain`.cwd(testDir).quiet();
		expect(both.exitCode).toBe(0);
		expect(both.stdout.toString()).toContain("Wiring both labels");
		expect(both.stdout.toString()).not.toContain("Wiring one label");

		const single = await $`bun ${cliPath} task list --labels backend --plain`.cwd(testDir).quiet();
		expect(single.exitCode).toBe(0);
		expect(single.stdout.toString()).toContain("Wiring both labels");
		expect(single.stdout.toString()).toContain("Wiring one label");
	});

	it("keeps the wiki corpus searchable by file name and by content", async () => {
		const wikiDir = join(testDir, "backlog", "wiki");
		await mkdir(wikiDir, { recursive: true });
		// The file name deliberately matches neither the title nor the body, so only the fileName
		// search key can answer the first query.
		await writeFile(
			join(wikiDir, "needle-filename-xyz.md"),
			"---\ntitle: Calendar Notes\n---\n\n# Calendar Notes\n\nbody text here\n",
		);

		// A fresh core re-reads the corpus from disk so the new page is indexed.
		const freshCore = new Core(testDir);
		const freshSearch = await freshCore.getSearchService();
		try {
			const byFileName = freshSearch.search({ query: "needle-filename-xyz", types: ["wiki"] });
			expect(byFileName.some((result) => result.type === "wiki")).toBe(true);
			// The path-based id also contains the file name, so presence alone is not proof; the
			// reported match must come from the dedicated fileName key this surface adds.
			expect(
				byFileName.some(
					(result) => result.type === "wiki" && result.matches?.some((match) => match.key === "fileName"),
				),
			).toBe(true);
			const byContent = freshSearch.search({ query: "body text here", types: ["wiki"] });
			expect(byContent.some((result) => result.type === "wiki")).toBe(true);
		} finally {
			freshCore.disposeSearchService();
			freshCore.disposeContentStore();
		}
	});
});
