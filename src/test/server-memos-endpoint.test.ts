import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

let testDir: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

/** Seeds a memo exactly like createMemo does, but with a backdated created_date. */
async function seedMemo(id: string, createdDate: string, body: string, tags: string[] = []): Promise<void> {
	const filePath = join(testDir, "backlog", "memos", `${id}.md`);
	await Bun.write(
		filePath,
		stringifyFrontmatter(`${body}\n`, {
			id,
			created_date: createdDate,
			updated_date: createdDate,
			...(tags.length > 0 && { tags }),
		}),
	);
}

/**
 * Every request opens its own connection. Bun 1.3.14 on Windows answers only the first request of a
 * keep-alive connection with a route; a real client is unaffected, and on a healthy runtime this only
 * gives up connection reuse.
 */
const request = (path: string, init: RequestInit = {}) =>
	fetch(`http://127.0.0.1:${serverPort}${path}`, {
		...init,
		headers: { ...(init.headers as Record<string, string> | undefined), Connection: "close" },
	});

async function fetchJson(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
	const response = await request(path, init);
	let body: Record<string, unknown> = {};
	try {
		body = (await response.json()) as Record<string, unknown>;
	} catch {
		body = {};
	}
	return { status: response.status, body };
}

const post = (path: string, payload: unknown) =>
	fetchJson(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

beforeEach(async () => {
	testDir = createUniqueTestDir("server-memos-endpoint");
	filesystem = new FileSystem(testDir);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Memos Endpoints",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	// A fixed month well away from "now", so the calendar defaults test cannot collide with it.
	await seedMemo("20190305-1", "2019-03-05 09:00", "first memo", ["idea"]);
	await seedMemo("20190305-2", "2019-03-05 18:12", "second memo");
	await seedMemo("20190401-1", "2019-04-01 08:00", "third memo");

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

describe("GET /api/memos", () => {
	it("paginates newest first and reports the next cursor", async () => {
		const { status, body } = await fetchJson("/api/memos?limit=2");

		expect(status).toBe(200);
		expect(body.items).toHaveLength(2);
		expect((body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190401-1", "20190305-2"]);
		expect(body.nextCursor).toBe("20190305-2");

		const second = await fetchJson(`/api/memos?limit=2&cursor=${body.nextCursor}`);
		expect((second.body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190305-1"]);
		expect(second.body.nextCursor).toBeNull();
	});

	it("filters by date and still paginates", async () => {
		const { status, body } = await fetchJson("/api/memos?date=2019-03-05&limit=1");

		expect(status).toBe(200);
		expect((body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190305-2"]);
		expect(body.nextCursor).toBe("20190305-2");

		const empty = await fetchJson("/api/memos?date=2019-03-06");
		expect(empty.body.items).toEqual([]);
		expect(empty.body.nextCursor).toBeNull();
	});

	it("answers 400 for malformed query values", async () => {
		expect((await fetchJson("/api/memos?limit=abc")).status).toBe(400);
		expect((await fetchJson("/api/memos?limit=0")).status).toBe(400);
		expect((await fetchJson("/api/memos?date=2026/10/01")).status).toBe(400);
	});
});

describe("POST /api/memos", () => {
	it("creates a memo with a 201 and zero-pads its tags", async () => {
		const { status, body } = await post("/api/memos", { content: "hello #world", tags: [" idea ", "", "idea"] });

		expect(status).toBe(201);
		expect(body.tags).toEqual(["idea"]);
		expect(body.rawContent).toBe("hello #world");
		expect(await Bun.file(join(testDir, "backlog", "memos", `${body.id}.md`)).exists()).toBe(true);
	});

	it("answers 400 for an empty body", async () => {
		expect((await post("/api/memos", { content: "   " })).status).toBe(400);
		expect((await post("/api/memos", {})).status).toBe(400);
		expect((await post("/api/memos", { content: "ok", tags: "idea" })).status).toBe(400);
	});
});

describe("GET /api/memos/calendar", () => {
	it("buckets memos per day and wins over the /api/memos/:id route", async () => {
		const { status, body } = await fetchJson("/api/memos/calendar?year=2019&month=3");

		expect(status).toBe(200);
		expect(body).toEqual({ "2019-03-05": 2 });
	});

	it("defaults to the current month", async () => {
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		await seedMemo("20990101-1", `${today} 12:00`, "memo written today");

		const { status, body } = await fetchJson("/api/memos/calendar");

		expect(status).toBe(200);
		expect(body[today]).toBe(1);
		expect(Object.keys(body).every((day) => day.startsWith(today.slice(0, 7)))).toBe(true);
	});

	it("answers 400 for a malformed month", async () => {
		expect((await fetchJson("/api/memos/calendar?year=2019&month=13")).status).toBe(400);
		expect((await fetchJson("/api/memos/calendar?year=2019&month=Mar")).status).toBe(400);
		expect((await fetchJson("/api/memos/calendar?year=2019&month=0")).status).toBe(400);
	});
});

describe("SPA fallback", () => {
	it("serves the app shell when /memos is refreshed", async () => {
		const response = await request("/memos");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type") ?? "").toContain("text/html");
	});
});

describe("/api/memos/:id", () => {
	it("reads one memo and answers 404 for an unknown id", async () => {
		const { status, body } = await fetchJson("/api/memos/20190305-1");
		expect(status).toBe(200);
		expect(body.rawContent).toBe("first memo");

		const missing = await fetchJson("/api/memos/20990101-9");
		expect(missing.status).toBe(404);
		expect(missing.body.error).toBe("Memo not found");
	});

	it("updates content and tags", async () => {
		const { status, body } = await fetchJson("/api/memos/20190305-1", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "rewritten", tags: ["done"] }),
		});

		expect(status).toBe(200);
		expect(body.rawContent).toBe("rewritten");
		expect(body.tags).toEqual(["done"]);
		expect(body.id).toBe("20190305-1");

		const missing = await fetchJson("/api/memos/20990101-9", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "nope" }),
		});
		expect(missing.status).toBe(404);
	});

	it("deletes a memo with a 204 and answers 404 when it is already gone", async () => {
		const deleted = await request("/api/memos/20190305-1", { method: "DELETE" });
		expect(deleted.status).toBe(204);
		expect(await Bun.file(join(testDir, "backlog", "memos", "20190305-1.md")).exists()).toBe(false);

		const again = await request("/api/memos/20190305-1", { method: "DELETE" });
		expect(again.status).toBe(404);
	});

	it("refuses an id that would escape the memo directory", async () => {
		expect((await fetchJson("/api/memos/..%2F..%2Fconfig")).status).toBe(400);
	});
});

describe("memo writes broadcast", () => {
	it("emits memos-updated over the websocket", async () => {
		const messages: string[] = [];
		socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
		await withTimeout(
			new Promise<void>((resolve, reject) => {
				socket?.addEventListener("open", () => resolve());
				socket?.addEventListener("error", () => reject(new Error("WebSocket failed to open")));
			}),
			"memo broadcast WebSocket",
			2000,
		);
		socket.onmessage = (event) => messages.push(String(event.data));

		await post("/api/memos", { content: "broadcast me" });
		await sleep(200);

		expect(messages).toContain("memos-updated");
	});
});
