import { describe, expect, it } from "bun:test";
import type { McpServer } from "../mcp/server.ts";
import { TaskHandlers, type TaskListArgs, type TaskSearchArgs } from "../mcp/tools/tasks/handlers.ts";
import type { Task } from "../types/index.ts";

const activeTask: Task = {
	id: "task-2",
	title: "Active Task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-09-18",
	labels: [],
	dependencies: [],
	source: "local",
};

const completedTask: Task = {
	id: "task-1",
	title: "Completed Dep",
	status: "Done",
	assignee: [],
	createdDate: "2026-09-18",
	labels: [],
	dependencies: [],
	source: "completed",
};

const mockConfig = { statuses: ["To Do", "In Progress", "Done"] };

function textOf(result: { content?: unknown[] }): string {
	return (result.content ?? []).map((c) => (typeof c === "object" && c && "text" in c ? c.text : "")).join("\n");
}

describe("MCP completed corpus widening", () => {
	it("task_list passes the completed flag through to queryTasks", async () => {
		const seen: Array<{ includeCompleted?: boolean } | undefined> = [];
		const handlers = new TaskHandlers({
			queryTasks: async (options?: { includeCompleted?: boolean }) => {
				seen.push(options);
				return [activeTask];
			},
			filesystem: { loadConfig: async () => mockConfig },
		} as unknown as McpServer);

		const args: TaskListArgs = { completed: true };
		await handlers.listTasks(args);
		expect(seen[0]?.includeCompleted).toBe(true);

		await handlers.listTasks({});
		expect(seen[1]?.includeCompleted).toBe(false);
	});

	it("task_list renders completed rows when the corpus is widened", async () => {
		const handlers = new TaskHandlers({
			queryTasks: async () => [activeTask, completedTask],
			filesystem: { loadConfig: async () => mockConfig },
		} as unknown as McpServer);

		const result = await handlers.listTasks({ completed: true });
		const text = textOf(result);
		expect(text).toContain("task-1 - Completed Dep");
		expect(text).toContain("task-2 - Active Task");
	});

	it("task_search excludes completed tasks by default and includes them on demand", async () => {
		const seen: boolean[] = [];
		const handlers = new TaskHandlers({
			loadWorkingCopyTasks: async (includeCompleted?: boolean) => {
				seen.push(includeCompleted === true);
				return includeCompleted ? [activeTask, completedTask] : [activeTask];
			},
			filesystem: { loadConfig: async () => mockConfig },
		} as unknown as McpServer);

		const withoutFlag = await handlers.searchTasks({ query: "completed dep" } as TaskSearchArgs);
		expect(seen[0]).toBe(false);
		expect(textOf(withoutFlag)).not.toContain("task-1 - Completed Dep");

		const withFlag = await handlers.searchTasks({ query: "completed dep", completed: true } as TaskSearchArgs);
		expect(seen[1]).toBe(true);
		expect(textOf(withFlag)).toContain("task-1 - Completed Dep");
	});
});
