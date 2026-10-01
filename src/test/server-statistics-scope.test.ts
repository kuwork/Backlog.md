import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { StatusesConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch, retry, safeCleanup } from "./test-utils.ts";

installCloseConnectionFetch();

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

interface StatisticsBody {
	totalTasks: number;
	completedTasks: number;
	statusCounts: Record<string, number>;
	projectHealth: { averageCompletionMinutes: number; completionSampleCount: number };
}

async function statistics(query = ""): Promise<StatisticsBody> {
	const response = await fetch(`http://127.0.0.1:${serverPort}/api/statistics${query}`);
	if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
	return (await response.json()) as StatisticsBody;
}

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		title: "Task",
		status: "Todo",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

/**
 * A machine whose completion status is not literally "Done", with a dropped status alongside it.
 * A hardcoded status name would report zero completions here.
 */
const CUSTOM_MACHINE: StatusesConfig = [
	{ name: "Todo", category: "active" },
	{ name: "Shipped", category: "done", exit: "complete" },
	{ name: "Dropped", category: "dropped", exit: "archive" },
];

describe("BacklogServer statistics scope", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-statistics");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Statistics Scope",
			statuses: CUSTOM_MACHINE,
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		// Two active records: a completion and a drop.
		await core.createTask(
			makeTask({
				id: "task-1",
				title: "Active shipped",
				status: "Shipped",
				actualStart: "2026-05-01 10:00",
				actualEnd: "2026-05-01 10:30",
			}),
		);
		await core.createTask(makeTask({ id: "task-2", title: "Active dropped", status: "Dropped" }));

		// One more completion, then moved into the completed folder.
		await core.createTask(
			makeTask({
				id: "task-3",
				title: "Archived shipped",
				status: "Shipped",
				actualStart: "2026-04-01 09:00",
				actualEnd: "2026-04-01 09:15",
			}),
		);
		await core.completeTask("task-3");

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		await retry(async () => {
			const response = await fetch(`http://127.0.0.1:${serverPort}/api/config`);
			if (!response.ok) throw new Error("server not ready");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("excludes the completed folder by default and includes it on request", async () => {
		const activeOnly = await statistics();
		const widened = await statistics("?completed=true");

		expect(activeOnly.totalTasks).toBe(2);
		expect(widened.totalTasks).toBe(3);
		expect(widened.totalTasks - activeOnly.totalTasks).toBe(1);
	});

	it("counts the configured completion status rather than a status literally named Done", async () => {
		const activeOnly = await statistics();

		expect(activeOnly.completedTasks).toBe(1);
		// The dropped record is terminal but is not a completion.
		expect(activeOnly.statusCounts.Dropped).toBe(1);
		expect(activeOnly.statusCounts.Shipped).toBe(1);
	});

	it("serves plain status names as keys on the cold path", async () => {
		// The very first request after a restart is the one that used to stringify status objects.
		const body = await statistics();

		expect(Object.keys(body.statusCounts)).not.toContain("[object Object]");
		expect(Object.keys(body.statusCounts).sort()).toEqual(["Dropped", "Shipped", "Todo"]);
	});

	it("reports a completion mean whose sample is exactly the completed tasks", async () => {
		const activeOnly = await statistics();

		expect(activeOnly.projectHealth.completionSampleCount).toBe(activeOnly.completedTasks);
		expect(activeOnly.projectHealth.averageCompletionMinutes).toBeGreaterThanOrEqual(0);
	});

	it("keeps the two scopes in separate cache entries", async () => {
		const firstDefault = await statistics();
		const widened = await statistics("?completed=true");
		const secondDefault = await statistics();
		const secondWidened = await statistics("?completed=true");

		// Reading the widened scope must not have replaced the default body, and vice versa.
		expect(secondDefault.totalTasks).toBe(firstDefault.totalTasks);
		expect(secondDefault.completedTasks).toBe(firstDefault.completedTasks);
		expect(secondWidened.totalTasks).toBe(widened.totalTasks);
		expect(secondWidened.completedTasks).toBe(widened.completedTasks);
		expect(secondDefault.totalTasks).not.toBe(secondWidened.totalTasks);
	});

	it("treats any value other than completed=true as the default scope", async () => {
		const explicitFalse = await statistics("?completed=false");
		const empty = await statistics("?completed=");

		expect(explicitFalse.totalTasks).toBe(2);
		expect(empty.totalTasks).toBe(2);
	});
});
