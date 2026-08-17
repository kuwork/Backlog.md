import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		title: "Task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

describe("BacklogServer reorder publication", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-reorder");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Reorder",
			statuses: ["To Do", "Review", "Closed"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});
		await core.createTask(makeTask({ id: "task-1", title: "First" }), false);
		await core.createTask(makeTask({ id: "task-2", title: "Second" }), false);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;
		await retry(async () => {
			const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks`);
			if (!response.ok) throw new Error(`not ready: ${response.status}`);
		});
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		await safeCleanup(TEST_DIR);
	});

	it("returns changedTasks alongside the moved task", async () => {
		const result = await fetchJson<{ success: boolean; task: Task; changedTasks: Task[] }>("/api/tasks/reorder", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ taskId: "task-2", targetStatus: "To Do", orderedTaskIds: ["task-2", "task-1"] }),
		});

		expect(result.success).toBe(true);
		expect(result.task.id).toBe("TASK-2");
		expect(Array.isArray(result.changedTasks)).toBe(true);
		expect(result.changedTasks.length).toBeGreaterThanOrEqual(1);
		const ids = result.changedTasks.map((task) => task.id.toLowerCase());
		expect(ids).toContain("task-2");
	});
});
