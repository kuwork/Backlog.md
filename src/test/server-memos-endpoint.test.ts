import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { BacklogServer } from "../server/index.ts";
import { formatLocalDateKey, localDateTimeToStoredUtc } from "../utils/date-utc.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

let testDir: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

/**
 * Seeds a memo exactly like `createMemo` does, but for a chosen LOCAL day. `created_date` is stored
 * UTC, so the local day has to be converted rather than hand-written: the calendar, the `?date=`
 * filter and the day a memo's id points at are all local-day questions.
 */
async function seedMemoOnDay(
	id: string,
	localDay: string,
	time: string,
	body: string,
	tags: string[] = [],
): Promise<void> {
	return seedMemo(id, localDateTimeToStoredUtc(`${localDay} ${time}`), body, tags);
}

/** Writes a memo file by hand with the stored `created_date` value given verbatim. */
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
	await seedMemoOnDay("20190305-1", "2019-03-05", "09:00", "first memo", ["idea"]);
	await seedMemoOnDay("20190305-2", "2019-03-05", "18:12", "second memo");
	await seedMemoOnDay("20190401-1", "2019-04-01", "08:00", "third memo");

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
	it("paginates newest first and reports the envelope", async () => {
		const { status, body } = await fetchJson("/api/memos?limit=2");

		expect(status).toBe(200);
		expect(body.items).toHaveLength(2);
		expect((body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190401-1", "20190305-2"]);
		expect(body.total).toBe(3);
		expect(body.offset).toBe(0);
		expect(body.limit).toBe(2);
		expect(body.hasMore).toBe(true);

		const second = await fetchJson("/api/memos?limit=2&offset=2");
		expect((second.body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190305-1"]);
		expect(second.body.offset).toBe(2);
		expect(second.body.hasMore).toBe(false);
	});

	it("filters by date and still paginates", async () => {
		const { status, body } = await fetchJson("/api/memos?date=2019-03-05&limit=1");

		expect(status).toBe(200);
		expect((body.items as { id: string }[]).map((memo) => memo.id)).toEqual(["20190305-2"]);
		expect(body.total).toBe(2);
		expect(body.hasMore).toBe(true);

		const empty = await fetchJson("/api/memos?date=2019-03-06");
		expect(empty.body.items).toEqual([]);
		expect(empty.body.hasMore).toBe(false);
	});

	it("answers 400 for malformed query values", async () => {
		expect((await fetchJson("/api/memos?limit=abc")).status).toBe(400);
		expect((await fetchJson("/api/memos?limit=0")).status).toBe(400);
		expect((await fetchJson("/api/memos?date=2026/10/01")).status).toBe(400);
		expect((await fetchJson("/api/memos?offset=-1")).status).toBe(400);
		expect((await fetchJson("/api/memos?offset=abc")).status).toBe(400);
	});

	it("rejects the retired cursor parameter instead of ignoring it", async () => {
		const { status, body } = await fetchJson("/api/memos?cursor=20190305-2");
		expect(status).toBe(400);
		expect(String(body.error)).toContain("offset");
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

	it("counts a late-evening memo on its local day even when it is stored under the next UTC date", async () => {
		const lateStored = localDateTimeToStoredUtc("2019-03-05 23:00");
		await seedMemo("20190305-3", lateStored, "late memo");

		const { body } = await fetchJson("/api/memos/calendar?year=2019&month=3");
		expect(body["2019-03-05"]).toBe(3);

		// In UTC the stored date is the same day and there is nothing to tell apart; anywhere else it
		// is a different day and must not collect a bucket of its own. The pinned-zone cases in
		// memo-local-day-timezone.test.ts are what force the two apart on a UTC test runner.
		const utcDay = lateStored.slice(0, 10);
		if (utcDay !== "2019-03-05") {
			expect(body[utcDay]).toBeUndefined();
		}
	});

	it("defaults to the current month", async () => {
		const today = formatLocalDateKey(new Date());
		await seedMemoOnDay("20990101-1", today, "12:00", "memo written today");

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

	it("archives a memo, drops it from the list and answers 404 or 409 when it cannot", async () => {
		const archived = await request("/api/memos/20190305-1/archive", { method: "POST" });
		expect(archived.status).toBe(200);
		expect(await Bun.file(join(testDir, "backlog", "memos", "20190305-1.md")).exists()).toBe(false);
		expect(await Bun.file(join(testDir, "backlog", "archive", "memos", "20190305-1.md")).exists()).toBe(true);

		const list = (await fetchJson("/api/memos")).body as { items: Array<{ id: string }> };
		expect(list.items.some((memo) => memo.id === "20190305-1")).toBe(false);

		const missing = await request("/api/memos/20190305-1/archive", { method: "POST" });
		expect(missing.status).toBe(404);

		// A copy already sitting in the archive collides instead of being overwritten.
		await Bun.write(join(testDir, "backlog", "archive", "memos", "20190305-2.md"), "archived before\n");
		expect((await request("/api/memos/20190305-2/archive", { method: "POST" })).status).toBe(409);
		expect(await Bun.file(join(testDir, "backlog", "memos", "20190305-2.md")).exists()).toBe(true);
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
