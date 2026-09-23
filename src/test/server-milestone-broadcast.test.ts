import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

let testDir: string;
let core: Core;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

beforeEach(async () => {
	testDir = createUniqueTestDir("server-milestone-broadcast");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server milestone broadcast",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	server = new BacklogServer(testDir);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	await retry(async () => {
		const response = await request("/api/status");
		if (!response.ok) throw new Error("Server is not ready");
	});
});

afterEach(async () => {
	socket?.close();
	socket = null;
	await server?.stop();
	server = null;
	await safeCleanup(testDir);
});

const openSocket = async (messages: string[]) => {
	socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			if (!socket) return reject(new Error("WebSocket was not created"));
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("WebSocket failed to open"));
		}),
		"milestone broadcast test WebSocket",
		2000,
	);
	socket.onmessage = (event) => messages.push(String(event.data));
};

/**
 * Every request opens its own connection. Bun 1.3.14 on Windows answers only the first request of a
 * keep-alive connection with a route: the second goes to the fallback (404) even though the path is
 * the same one that just matched. A real client - curl and the browser included - is unaffected, and
 * on a healthy runtime this only gives up connection reuse.
 */
const request = (path: string, init: RequestInit = {}) =>
	fetch(`http://127.0.0.1:${serverPort}${path}`, {
		...init,
		headers: { ...(init.headers as Record<string, string> | undefined), Connection: "close" },
	});

describe("data change WebSocket publication", () => {
	it("publishes a milestone-scoped update for milestone mutations", async () => {
		const messages: string[] = [];
		await openSocket(messages);

		const createResponse = await request("/api/milestones", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Launch" }),
		});
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as { id: string };
		await retry(
			async () => {
				if (!messages.includes("milestones-updated")) throw new Error("Milestone creation was not published");
			},
			40,
			250,
		);

		messages.length = 0;
		const archiveResponse = await request(`/api/milestones/${encodeURIComponent(created.id)}/archive`, {
			method: "POST",
		});
		expect(archiveResponse.status).toBe(200);
		await retry(
			async () => {
				if (!messages.includes("milestones-updated")) throw new Error("Milestone archive was not published");
			},
			40,
			250,
		);
	});

	it("keeps a task file change on the task message", async () => {
		const messages: string[] = [];
		await openSocket(messages);

		// Reading the corpus is what starts the store and its folder watcher; a file that arrives
		// before that is picked up by the first scan, not by an event.
		const initial = await request("/api/tasks");
		expect(initial.ok).toBe(true);
		await withTimeout(sleep(300), "the store to settle", 2000);
		messages.length = 0;

		// A file arriving in the tasks folder is a store event, so it must not widen the message: the
		// client answers the milestone one with a bigger scope, and paying for it here would undo the
		// point of scoping.
		await writeFile(
			join(core.filesystem.tasksDir, "task-2 - Written-by-hand.md"),
			[
				"---",
				"id: TASK-2",
				"title: Written by hand",
				"status: To Do",
				"assignee: []",
				"created_date: '2026-09-01 10:00'",
				"labels: []",
				"dependencies: []",
				"ordinal: 2000",
				"---",
				"",
				"Body",
				"",
			].join("\n"),
			"utf8",
		);

		await retry(
			async () => {
				if (!messages.includes("tasks-updated")) throw new Error("A task file change was not published");
			},
			40,
			250,
		);
		expect(messages).not.toContain("milestones-updated");
	});
});
