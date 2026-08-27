import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
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

async function fetchRaw(path: string, init?: RequestInit): Promise<Response> {
	return await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
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

describe("BacklogServer complete endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-complete");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Complete",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});
		await core.createTask(makeTask({ id: "task-1", title: "Complete Me" }), false);

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

	it("moves the task file to completed and removes it from active tasks", async () => {
		const result = await fetchJson<{ success: boolean }>("/api/tasks/task-1/complete", {
			method: "POST",
		});
		expect(result.success).toBe(true);

		const activeTasks = await core.filesystem.listTasks();
		expect(activeTasks.map((task) => task.id)).toEqual([]);

		const completedTasks = await core.filesystem.listCompletedTasks();
		expect(completedTasks.map((task) => task.id)).toEqual(["TASK-1"]);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const completedDir = join(TEST_DIR, "backlog", "completed");
		expect(await Bun.file(join(tasksDir, "task-1 - Complete-Me.md")).exists()).toBe(false);
		expect(await Bun.file(join(completedDir, "task-1 - Complete-Me.md")).exists()).toBe(true);
	});

	it("returns 404 when the task does not exist", async () => {
		const response = await fetchRaw("/api/tasks/task-99/complete", {
			method: "POST",
		});
		expect(response.status).toBe(404);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBeDefined();
	});
});
