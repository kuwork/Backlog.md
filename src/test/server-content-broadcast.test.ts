import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

let testDir: string;
let core: Core;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

beforeEach(async () => {
	testDir = createUniqueTestDir("server-content-broadcast");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	// The wiki watcher only binds when the wiki directory exists, so create it before
	// the store initializes (the store starts on the first request).
	await mkdir(join(dirname(core.filesystem.docsDir), "wiki"), { recursive: true });
	await core.filesystem.saveConfig({
		projectName: "Server content broadcast",
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
		"content broadcast test WebSocket",
		2000,
	);
	socket.onmessage = (event) => {
		messages.push(String(event.data));
		if (process.env.CONTENT_DEBUG) console.log(`[+${Date.now() - debugStart}ms] WS:`, String(event.data));
	};
	return socket;
};

let debugStart = Date.now();

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

/** Reading the corpus is what starts the store and its folder watchers. */
const settleStore = async () => {
	const initial = await request("/api/tasks");
	expect(initial.ok).toBe(true);
	// Watcher binding is deferred until after the corpus load settles; on a busy
	// Windows filesystem that lands well after the corpus response, so give the
	// watchers room to attach before the test writes its files.
	await withTimeout(sleep(1500), "the store to settle", 4000);
};

describe("content-entity WebSocket publication", () => {
	it("publishes a document-scoped update for a docs file change", async () => {
		const messages: string[] = [];
		debugStart = Date.now();
		await openSocket(messages);
		await settleStore();
		messages.length = 0;
		const writeStart = Date.now();
		await writeFile(
			join(core.filesystem.docsDir, "doc-901 - Broadcast-Test.md"),
			[
				"---",
				"id: doc-901",
				"title: Broadcast Test",
				"type: other",
				"created_date: '2026-09-24'",
				"---",
				"",
				"Body",
				"",
			].join("\n"),
			"utf8",
		);

		await retry(
			async () => {
				if (!messages.includes("documents-updated"))
					throw new Error(`A docs file change was not published (${Date.now() - writeStart}ms since write)`);
			},
			40,
			250,
		);
		expect(messages).not.toContain("tasks-updated");
		expect(messages).not.toContain("milestones-updated");
	}, 20000);

	it("publishes a decision-scoped update for a decisions file change", async () => {
		const messages: string[] = [];
		await openSocket(messages);
		await settleStore();
		messages.length = 0;

		await writeFile(
			join(core.filesystem.decisionsDir, "decision-90 - Broadcast-Test.md"),
			[
				"---",
				"id: decision-90",
				"title: Broadcast Test",
				"date: '2026-09-24'",
				"status: proposed",
				"---",
				"",
				"## Context",
				"",
				"Body",
				"",
			].join("\n"),
			"utf8",
		);

		await retry(
			async () => {
				if (!messages.includes("decisions-updated")) throw new Error("A decisions file change was not published");
			},
			40,
			250,
		);
		expect(messages).not.toContain("tasks-updated");
	}, 20000);

	it("publishes a wiki-scoped update for a wiki page change", async () => {
		const messages: string[] = [];
		await openSocket(messages);
		await settleStore();
		messages.length = 0;

		await writeFile(
			join(dirname(core.filesystem.docsDir), "wiki", "broadcast-test.md"),
			["---", "title: Broadcast Test", "---", "", "Body", ""].join("\n"),
			"utf8",
		);

		await retry(
			async () => {
				if (!messages.includes("wikis-updated")) throw new Error("A wiki page change was not published");
			},
			40,
			250,
		);
		expect(messages).not.toContain("tasks-updated");
	}, 20000);

	it("delivers task and document messages independently in a mixed window", async () => {
		const messages: string[] = [];
		await openSocket(messages);
		await settleStore();
		messages.length = 0;

		// Both changes land inside the same 75ms debounce window: each scope must come
		// through as its own message, neither swallowing the other.
		await Promise.all([
			writeFile(
				join(core.filesystem.docsDir, "doc-902 - Mixed-Window.md"),
				[
					"---",
					"id: doc-902",
					"title: Mixed Window",
					"type: other",
					"created_date: '2026-09-24'",
					"---",
					"",
					"Body",
					"",
				].join("\n"),
				"utf8",
			),
			writeFile(
				join(core.filesystem.tasksDir, "task-901 - Mixed-Window.md"),
				[
					"---",
					"id: TASK-901",
					"title: Mixed Window",
					"status: To Do",
					"assignee: []",
					"created_date: '2026-09-24 10:00'",
					"labels: []",
					"dependencies: []",
					"ordinal: 2901",
					"---",
					"",
					"Body",
					"",
				].join("\n"),
				"utf8",
			),
		]);

		await retry(
			async () => {
				if (!messages.includes("tasks-updated")) throw new Error("The task scope was swallowed");
				if (!messages.includes("documents-updated")) throw new Error("The document scope was swallowed");
			},
			40,
			250,
		);
	}, 20000);
});
