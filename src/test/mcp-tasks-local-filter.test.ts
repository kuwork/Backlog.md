import { describe, expect, it } from "bun:test";
import type { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import type { Task } from "../types/index.ts";

const localTask: Task = {
	id: "task-1",
	title: "Local task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "local",
};

const remoteTask: Task = {
	id: "task-2",
	title: "Remote task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "remote",
};

const progressTask: Task = {
	id: "task-3",
	title: "Progress task",
	status: "In Progress",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "local",
};

const doneTask: Task = {
	id: "task-4",
	title: "Done task",
	status: "Done",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "local",
};

function textOf(result: { content?: unknown[] }): string {
	return (result.content ?? []).map((c) => (typeof c === "object" && c && "text" in c ? c.text : "")).join("\n");
}

describe("MCP task tools local filtering", () => {
	const mockConfig = { statuses: ["To Do", "In Progress", "Done"] };

	it("filters cross-branch tasks out of task_list", async () => {
		const handlers = new TaskHandlers({
			queryTasks: async () => [localTask, remoteTask],
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		const result = await handlers.listTasks({});
		const text = (result.content ?? [])
			.map((c) => (typeof c === "object" && c && "text" in c ? c.text : ""))
			.join("\n");

		expect(text).toContain("task-1 - Local task");
		expect(text).not.toContain("task-2 - Remote task");
	});

	it("filters cross-branch tasks out of task_search", async () => {
		const handlers = new TaskHandlers({
			loadTasks: async () => [localTask, remoteTask],
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		const result = await handlers.searchTasks({ query: "task" });
		const text = textOf(result);

		expect(text).toContain("task-1 - Local task");
		expect(text).not.toContain("task-2 - Remote task");
	});

	it("task_list passes multi-status and exclusion filters to queryTasks", async () => {
		const queryTasks = async () => [localTask, progressTask, doneTask];
		const spy = { calls: [] as Array<{ status?: unknown; statusExcluded?: unknown }> };
		const handlers = new TaskHandlers({
			queryTasks: async (options: { filters?: { status?: unknown; statusExcluded?: unknown } }) => {
				spy.calls.push({
					status: options?.filters?.status,
					statusExcluded: options?.filters?.statusExcluded,
				});
				return queryTasks();
			},
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		await handlers.listTasks({ status: ["To Do", "In Progress"] });
		expect(spy.calls.at(-1)?.status).toEqual(["To Do", "In Progress"]);

		await handlers.listTasks({ statusExcluded: "Done" });
		expect(spy.calls.at(-1)?.statusExcluded).toEqual("Done");

		await handlers.listTasks({ statusExcluded: ["Done", "To Do"] });
		expect(spy.calls.at(-1)?.statusExcluded).toEqual(["Done", "To Do"]);

		await handlers.listTasks({ status: "To Do", statusExcluded: ["Done"] });
		expect(spy.calls.at(-1)?.status).toBe("To Do");
		expect(spy.calls.at(-1)?.statusExcluded).toEqual(["Done"]);
	});

	it("task_search supports multi-status selection and exclusion", async () => {
		const handlers = new TaskHandlers({
			loadTasks: async () => [localTask, progressTask, doneTask],
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		const multi = await handlers.searchTasks({ query: "task", status: ["To Do", "In Progress"] });
		const multiText = textOf(multi);
		expect(multiText).toContain("task-1 - Local task");
		expect(multiText).toContain("task-3 - Progress task");
		expect(multiText).not.toContain("task-4 - Done task");

		const excluded = await handlers.searchTasks({ query: "task", statusExcluded: "Done" });
		const excludedText = textOf(excluded);
		expect(excludedText).toContain("task-1 - Local task");
		expect(excludedText).not.toContain("task-4 - Done task");
	});
});
