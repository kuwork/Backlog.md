import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch, retry, safeCleanup } from "./test-utils.ts";

installCloseConnectionFetch();
setDefaultTimeout(60_000);

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

async function fetchTasks(path: string): Promise<Task[]> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`);
	expect(response.ok).toBe(true);
	return response.json();
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

describe("BacklogServer task list hierarchy", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-hierarchy");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Hierarchy",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});
		await core.createTask(makeTask("TASK-1", { title: "Parent" }), false);
		await core.createTask(
			makeTask("TASK-1.1", { title: "Completed child", status: "Done", parentTaskId: "TASK-1" }),
			false,
		);
		await core.createTask(makeTask("TASK-1.2", { title: "Live child", parentTaskId: "TASK-1" }), false);
		await core.completeTask("TASK-1.1");

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

	it("keeps the default child lookup active-only", async () => {
		const children = await fetchTasks("/api/tasks?parent=TASK-1");
		expect(children.map((task) => task.id)).toEqual(["TASK-1.2"]);
	});

	it("reaches a completed child when completed is requested", async () => {
		const children = await fetchTasks("/api/tasks?parent=TASK-1&completed=true");
		// The widened corpus appends the completed tail rather than re-sorting, so assert membership.
		expect(children.map((task) => task.id).sort()).toEqual(["TASK-1.1", "TASK-1.2"]);
		expect(children.find((task) => task.id === "TASK-1.1")?.source).toBe("completed");
	});
});
