import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { request } from "node:http";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { createDatabase, resolveDatabase } from "../graph/databases.ts";
import { dumpDatabase, saveSnapshot } from "../graph/snapshot.ts";
import { openGraphStore } from "../graph/store.ts";
import { BacklogServer } from "../server/index.ts";
import { UTF8_BOM } from "../sqlite/csv.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

/**
 * node:http, not fetch: the query-block component tests replace `globalThis.fetch` with a stub and
 * never restore it, and bun runs same-directory files in one process - an endpoint test that used
 * fetch would talk to the stub instead of the server.
 */
function call(
	method: string,
	path: string,
	body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
	return new Promise((resolvePromise, rejectPromise) => {
		const req = request(
			{
				hostname: "127.0.0.1",
				port: serverPort,
				path,
				method,
				headers: { "Content-Type": "application/json", Connection: "close" },
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer) => chunks.push(chunk));
				response.on("end", () => {
					const text = Buffer.concat(chunks).toString("utf8");
					resolvePromise({ status: response.statusCode ?? 0, json: JSON.parse(text) as Record<string, unknown> });
				});
			},
		);
		req.on("error", rejectPromise);
		if (body !== undefined) req.write(JSON.stringify(body));
		req.end();
	});
}

async function post(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
	return call("POST", path, body);
}

describe("BacklogServer cypher-query block endpoints (BACK-802)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-cypher-query");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Cypher Query",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});
		createDatabase(TEST_DIR, "shop", "test database");

		// Warm the ryu WASM module up before the server's graph service starts: `loadRyu` caches the
		// module before its async init resolves, so a query racing the service's own init would see a
		// half-initialised module ("The WebAssembly module is not initialized").
		const warm = await openGraphStore(join(TEST_DIR, "warm.kuzu"), { backend: "ryu", schema: "none" });
		await warm.close();

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			const { status } = await call("GET", "/api/config");
			if (status !== 200) throw new Error("not ready");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("runs a read-only statement and answers with the SQL explorers' grid shape", async () => {
		const { status, json } = await post("/api/graph/cypher-query", { source: "shop", query: "RETURN 1 AS one" });
		expect(status).toBe(200);
		expect(json.columns).toEqual(["one"]);
		expect(json.rows).toEqual([[1]]);
		expect(json.truncated).toBe(false);
		expect(typeof json.elapsedMs).toBe("number");
		expect(json.totalRows).toBe(1);
		expect(json.nodeKeys).toEqual([]);
	});

	it("rejects an unregistered database name and lists what is available", async () => {
		const { status, json } = await post("/api/graph/cypher-query", { source: "nope", query: "RETURN 1" });
		expect(status).toBe(400);
		expect(String(json.error)).toContain("nope");
		expect(String(json.error)).toContain("default");
		expect(String(json.error)).toContain("shop");
	});

	it.each([
		"../outside",
		"backlog/databases/shop.kuzu",
		"C:\\tmp\\shop",
		"a/b",
	])("rejects the path-shaped source %s with the same registry gate", async (source) => {
		const { status, json } = await post("/api/graph/cypher-query", { source, query: "RETURN 1" });
		expect(status).toBe(400);
		expect(String(json.error)).toContain("Available");
	});

	it("surfaces the read-only gate for a write statement", async () => {
		const { status, json } = await post("/api/graph/cypher-query", {
			source: "shop",
			query: "CREATE (:Shop {id: 'x'})",
		});
		expect(status).toBe(400);
		expect(String(json.error)).toContain("read-only");
	});

	it("export-csv takes exactly { source, query } and returns the file body plus a suggested name", async () => {
		const { status, json } = await post("/api/graph/export-csv", { source: "shop", query: "RETURN 1 AS one" });
		expect(status).toBe(200);
		expect(String(json.filename)).toMatch(/^shop-\d{8}-\d{6}\.csv$/);
		expect(json.csv).toBe(`${UTF8_BOM}one\r\n1\r\n`);
		expect(json.rows).toBe(1);
		expect(json.truncated).toBe(false);
	});

	it("export-csv rejects an unregistered source through the same gate", async () => {
		const { status, json } = await post("/api/graph/export-csv", { source: "nope", query: "RETURN 1" });
		expect(status).toBe(400);
		expect(String(json.error)).toContain("shop");
	});

	it("view=graph attaches the raw node/rel rows alongside the coerced grid (BACK-803)", async () => {
		// Seed the shop database the way the CLI does: build it in a store, dump it to its snapshot.
		const database = resolveDatabase(TEST_DIR, "shop");
		const store = await openGraphStore(database.source.dbPath, { backend: "ryu", schema: "none" });
		try {
			await store.runWrite("CREATE NODE TABLE Person(name STRING PRIMARY KEY)");
			await store.runWrite("CREATE REL TABLE KNOWS(FROM Person TO Person)");
			await store.runWrite("CREATE (:Person {name: 'Alice'})-[:KNOWS]->(:Person {name: 'Bob'})");
			saveSnapshot(database.source.snapshotPath, await dumpDatabase(store, "shop"));
		} finally {
			await store.close();
		}

		const { status, json } = await post("/api/graph/cypher-query", {
			source: "shop",
			query: "MATCH (a:Person)-[r:KNOWS]->(b:Person) RETURN a, r, b",
			view: "graph",
		});
		expect(status).toBe(200);

		// The grid stays coerced: nodes as JSON without the handles, the rel as compact text.
		const rows = json.rows as unknown[][];
		const [nodeCell, relCell] = rows[0] as [string, string, string];
		expect(JSON.parse(nodeCell)).toEqual({ _label: "Person", name: "Alice" });
		expect(relCell).toMatch(/^\(.+\)-\[KNOWS\]->\(.+\)$/);

		// The raw channel keeps the structures and the handles the graph view joins edges with.
		const graphRows = json.graphRows as Record<string, unknown>[][];
		const [a, r, b] = graphRows[0] as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>];
		expect(a._label).toBe("Person");
		expect(typeof a._id).toBe("string");
		expect(r._label).toBe("KNOWS");
		expect(r._src).toBe(a._id);
		expect(r._dst).toBe(b._id);
		expect(json.nodeKeys).toEqual([]);
	});

	it("a request without view=graph carries no raw channel", async () => {
		const { status, json } = await post("/api/graph/cypher-query", { source: "shop", query: "RETURN 1 AS one" });
		expect(status).toBe(200);
		expect("graphRows" in json).toBe(false);
	});
});
