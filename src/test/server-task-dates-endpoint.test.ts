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

describe("BacklogServer task date endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-task-dates");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Task Dates",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await core.createTask(
			makeTask({
				id: "task-1",
				title: "Date Clear Test Task",
				status: "To Do",
				dueDate: "2026-07-15",
				plannedStart: "2026-07-01",
				plannedEnd: "2026-07-10",
				actualStart: "2026-07-01 09:00",
				actualEnd: "2026-07-05 18:00",
			}),
			false,
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<unknown>("/api/tasks");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("clears all task date fields via PUT /api/tasks/:id with empty strings", async () => {
		const before = await fetchJson<Task>("/api/task/task-1");
		expect(before.dueDate).toBe("2026-07-15");
		expect(before.plannedStart).toBe("2026-07-01");
		expect(before.plannedEnd).toBe("2026-07-10");
		expect(before.actualStart).toBe("2026-07-01 09:00");
		expect(before.actualEnd).toBe("2026-07-05 18:00");

		const updated = await fetchJson<Task>("/api/tasks/task-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				dueDate: "",
				plannedStart: "",
				plannedEnd: "",
				actualStart: "",
				actualEnd: "",
			}),
		});

		expect(updated.dueDate).toBeUndefined();
		expect(updated.plannedStart).toBeUndefined();
		expect(updated.plannedEnd).toBeUndefined();
		expect(updated.actualStart).toBeUndefined();
		expect(updated.actualEnd).toBeUndefined();

		const loaded = await core.filesystem.loadTask("task-1");
		expect(loaded).not.toBeNull();
		expect(loaded?.dueDate).toBeUndefined();
		expect(loaded?.plannedStart).toBeUndefined();
		expect(loaded?.plannedEnd).toBeUndefined();
		expect(loaded?.actualStart).toBeUndefined();
		expect(loaded?.actualEnd).toBeUndefined();
	});

	it("preserves other date fields when clearing a single date field", async () => {
		const updated = await fetchJson<Task>("/api/tasks/task-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				actualStart: "",
			}),
		});

		expect(updated.actualStart).toBeUndefined();
		expect(updated.dueDate).toBe("2026-07-15");
		expect(updated.plannedStart).toBe("2026-07-01");
		expect(updated.plannedEnd).toBe("2026-07-10");
		expect(updated.actualEnd).toBe("2026-07-05 18:00");
	});
});
