import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

/**
 * Memos live outside the ContentStore, so their live-sync is bespoke: the API write path pushes a
 * memos-updated broadcast itself, and a dedicated fs.watch on `backlog/memos/` covers edits made by
 * any other tool. Both paths are exercised here against a real server and a real WebSocket.
 */

let testDir: string;
let core: Core;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

const memoRoot = () => join(testDir, "backlog", "memos");

beforeEach(async () => {
	testDir = createUniqueTestDir("server-memo-broadcast");
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	// The memo watcher binds only when the directory exists; memos are normally created on the
	// first write, so a fresh project needs it seeded before the services initialize.
	await mkdir(memoRoot(), { recursive: true });
	await core.filesystem.saveConfig({
		projectName: "Server memo broadcast",
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
		"memo broadcast test WebSocket",
		2000,
	);
	socket.onmessage = (event) => {
		messages.push(String(event.data));
	};
	return socket;
};

/**
 * Every request opens its own connection. Bun 1.3.14 on Windows answers only the first request of a
 * keep-alive connection with a route; a real client is unaffected, and on a healthy runtime this
 * only gives up connection reuse.
 */
const request = (path: string, init: RequestInit = {}) =>
	fetch(`http://127.0.0.1:${serverPort}${path}`, {
		...init,
		headers: { ...(init.headers as Record<string, string> | undefined), Connection: "close" },
	});

const jsonRequest = (path: string, method: string, payload: unknown) =>
	request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

/**
 * The memo watcher starts inside initializeServices, which is triggered by the first store-touching
 * request (not by the memo endpoints, which do their own IO). Reading the corpus is what starts it,
 * and watcher binding is deferred, so give it room to attach before writing files.
 */
const settleServices = async () => {
	const initial = await request("/api/tasks");
	expect(initial.ok).toBe(true);
	await withTimeout(sleep(1500), "the memo watcher to settle", 4000);
};

describe("memo WebSocket publication", () => {
	it("publishes memos-updated for an API create, update and delete", async () => {
		const messages: string[] = [];
		await openSocket(messages);
		await settleServices();

		messages.length = 0;
		const created = await jsonRequest("/api/memos", "POST", { content: "Broadcast me #live", tags: ["live"] });
		expect(created.status).toBe(201);
		const memo = (await created.json()) as { id: string };
		await retry(
			async () => {
				if (!messages.includes("memos-updated")) throw new Error("A memo create was not published");
			},
			40,
			250,
		);

		messages.length = 0;
		const updated = await jsonRequest(`/api/memos/${memo.id}`, "PUT", { content: "Edited through the API" });
		expect(updated.status).toBe(200);
		await retry(
			async () => {
				if (!messages.includes("memos-updated")) throw new Error("A memo update was not published");
			},
			40,
			250,
		);

		messages.length = 0;
		const deleted = await request(`/api/memos/${memo.id}`, { method: "DELETE" });
		expect(deleted.status).toBe(204);
		await retry(
			async () => {
				if (!messages.includes("memos-updated")) throw new Error("A memo delete was not published");
			},
			40,
			250,
		);
	}, 30000);

	it("publishes memos-updated for a memo file edited outside the web UI", async () => {
		const messages: string[] = [];
		await openSocket(messages);
		await settleServices();
		messages.length = 0;

		await writeFile(
			join(memoRoot(), "20261001-1.md"),
			stringifyFrontmatter("Edited on disk by another tool\n", {
				id: "20261001-1",
				created_date: "2026-10-01 09:00",
				updated_date: "2026-10-01 09:05",
			}),
			"utf8",
		);

		await retry(
			async () => {
				if (!messages.includes("memos-updated")) throw new Error("An external memo edit was not published");
			},
			40,
			250,
		);
		expect(messages).not.toContain("tasks-updated");
	}, 20000);
});
