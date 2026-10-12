import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeDatabases, UserDatabaseBrowser } from "../graph/browser";
import { createDatabase, DEFAULT_DATABASE, resolveDatabase } from "../graph/databases";
import { dumpDatabase, loadSnapshot, saveSnapshot } from "../graph/snapshot";
import { openGraphStore } from "../graph/store";

/**
 * The browser is the server-side half of the Web UI's database page: a resident process that keeps a
 * user database hydrated until its snapshot changes. These tests pin the two properties the page
 * depends on - row counts come from the snapshot without opening it, and a changed snapshot is
 * replayed rather than served stale.
 */
describe("user database browser", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-browser-"));
		await mkdir(join(root, "backlog"), { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	/** Seed the demo database the way the CLI does: build it in memory, dump it to its snapshot. */
	async function seed(names: string[]): Promise<void> {
		const database = createDatabase(root, "demo", "demo data");
		const store = await openGraphStore(database.source.dbPath, { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make this vacuous
		try {
			await store.runWrite("CREATE NODE TABLE Person(name STRING PRIMARY KEY, age INT64)");
			// Parameters are bound as strings and cast in Cypher: the ryu WASM build's parameter
			// binding throws on a JS number ("Invalid argument type in ToBigInt operation").
			await store.runWrite("UNWIND $rows AS row CREATE (:Person {name: row.name, age: CAST(row.age AS INT64)})", {
				rows: names.map((name) => ({ name, age: "30" })),
			});
			saveSnapshot(database.source.snapshotPath, await dumpDatabase(store, "demo"));
		} finally {
			await store.close();
		}
	}

	/** An out-of-band write, exactly what a CLI call does to the snapshot file. */
	function appendRow(name: string): void {
		const path = resolveDatabase(root, "demo").source.snapshotPath;
		const snapshot = loadSnapshot(path);
		snapshot.nodes.Person?.push({ name, age: 30 });
		saveSnapshot(path, snapshot);
	}

	const countPeople = async (browser: UserDatabaseBrowser): Promise<string> =>
		String((await browser.query(root, "demo", "MATCH (n:Person) RETURN count(n)")).rows[0]?.[0]);

	test("lists `default` without counts, and a user database with the counts from its snapshot", async () => {
		await seed(["Alice", "Bob"]);
		const summaries = describeDatabases(root);
		expect(summaries.map((summary) => summary.name)).toEqual([DEFAULT_DATABASE, "demo"]);
		// Counting `default` would mean rebuilding the whole corpus, so it reports nothing.
		expect(summaries[0]).toMatchObject({ kind: "derived", nodes: null, edges: null });
		expect(summaries[1]).toMatchObject({ kind: "user", description: "demo data", nodes: 2, edges: 0 });
	});

	test("a query replays the database once its snapshot changes underneath the process", async () => {
		await seed(["Alice"]);
		const browser = new UserDatabaseBrowser();
		try {
			expect(await countPeople(browser)).toBe("1");
			expect(await countPeople(browser)).toBe("1"); // the second call is served from the session

			appendRow("Bob");
			expect(await countPeople(browser)).toBe("2");

			expect(await countPeople(browser)).toBe("2"); // and the replayed session is kept
		} finally {
			await browser.closeAll();
		}
	});

	test("`default` is refused: the derived corpus belongs to the graph service", async () => {
		const browser = new UserDatabaseBrowser();
		try {
			await expect(browser.query(root, DEFAULT_DATABASE, "MATCH (n) RETURN count(n)")).rejects.toThrow(/graph service/);
		} finally {
			await browser.closeAll();
		}
	});

	test("querying an unknown database names the ones that exist", async () => {
		await seed(["Alice"]);
		const browser = new UserDatabaseBrowser();
		try {
			await expect(browser.query(root, "nope", "MATCH (n) RETURN count(n)")).rejects.toThrow(/demo/);
		} finally {
			await browser.closeAll();
		}
	});
});
