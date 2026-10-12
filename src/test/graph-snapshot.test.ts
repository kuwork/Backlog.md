import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	dumpDatabase,
	emptySnapshot,
	type GraphSnapshot,
	hydrateDatabase,
	loadSnapshot,
	loadSnapshotWithFingerprint,
	saveSnapshot,
	snapshotFingerprint,
	snapshotStats,
} from "../graph/snapshot";
import { openGraphStore } from "../graph/store";

describe("graph snapshot round-trip", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-snapshot-"));
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("schema, rows and edges survive dump -> save -> load -> hydrate", async () => {
		// A user database opens with `schema: "none"`: the store creates no tables of its own.
		const writer = await openGraphStore(join(root, "a.kuzu"), { backend: "ryu", schema: "none" });
		expect(writer.backend).toBe("ryu"); // fail loudly: a memory fallback would make every assertion below vacuous
		const path = join(root, "demo.graph.json");
		try {
			await writer.runWrite("CREATE NODE TABLE Person(name STRING PRIMARY KEY, age INT64)");
			await writer.runWrite("CREATE REL TABLE KNOWS(FROM Person TO Person)");
			await writer.runWrite("CREATE (:Person {name: 'Alice', age: 30}), (:Person {name: 'Bob', age: 41})");
			await writer.runWrite("MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'}) CREATE (a)-[:KNOWS]->(b)");
			const snapshot = await dumpDatabase(writer, "demo");
			saveSnapshot(path, snapshot);
			expect(snapshotStats(snapshot)).toEqual({
				tables: [
					{ name: "Person", kind: "NODE", rows: 2 },
					{ name: "KNOWS", kind: "REL", rows: 1 },
				],
				nodes: 2,
				edges: 1,
			});
		} finally {
			await writer.close();
		}

		// A brand-new store, exactly as the next CLI process would open it, rebuilds from the
		// snapshot alone. Nodes must hydrate before edges or the edge MATCH silently drops them.
		const reader = await openGraphStore(join(root, "b.kuzu"), { backend: "ryu", schema: "none" });
		try {
			await hydrateDatabase(reader, loadSnapshot(path));
			const edges = await reader.runCypher("MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a.name, b.name");
			expect(edges.rows).toEqual([["Alice", "Bob"]]);
			const nodes = await reader.runCypher("MATCH (p:Person) RETURN count(p)");
			expect(String(nodes.rows[0]?.[0])).toBe("2");
		} finally {
			await reader.close();
		}
	});

	test("a missing snapshot reads as an empty database", () => {
		const snapshot = loadSnapshot(join(root, "absent.graph.json"));
		expect(snapshot.nodeTables).toEqual([]);
		expect(snapshotStats(snapshot)).toEqual({ tables: [], nodes: 0, edges: 0 });
	});

	test("the load fingerprint changes when the file changes underneath a writer", () => {
		// The lost-update guard: a writer compares the fingerprint it saw at load time with the file
		// at dump time, so an out-of-band edit is detected instead of overwritten.
		const path = join(root, "guarded.graph.json");
		expect(snapshotFingerprint(path)).toBeNull(); // no file yet
		const absent = loadSnapshotWithFingerprint(path);
		expect(absent.fingerprint).toBeNull();

		saveSnapshot(path, emptySnapshot("guarded"));
		const loaded = loadSnapshotWithFingerprint(path);
		expect(loaded.fingerprint).not.toBeNull();
		expect(loaded.snapshot.database).toBe("guarded");
		expect(snapshotFingerprint(path)).toBe(loaded.fingerprint); // untouched -> no false positive

		// Simulate a hand edit (or another tool): same path, different bytes.
		saveSnapshot(path, { ...emptySnapshot("guarded"), nodes: { P: [{ id: 1 }] } });
		expect(snapshotFingerprint(path)).not.toBe(loaded.fingerprint);
	});

	test("dump does not inherit the interactive 500-row cap", async () => {
		// Regression: runCypher truncates its result at 500 rows for display, and dumpDatabase used to
		// inherit that cap - so every table larger than 500 silently lost rows on the way to the
		// snapshot (1200 written rows read back as 500).
		const store = await openGraphStore(join(root, "d.kuzu"), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make the assertions vacuous
		const path = join(root, "big.graph.json");
		try {
			await store.runWrite("CREATE NODE TABLE P(id INT64, PRIMARY KEY(id))");
			await store.runWrite("UNWIND range(1, 1200) AS i CREATE (:P {id: i})");
			const snapshot = await dumpDatabase(store, "big");
			saveSnapshot(path, snapshot);
			expect(snapshot.nodes.P?.length).toBe(1200);
		} finally {
			await store.close();
		}
		const reader = await openGraphStore(join(root, "e.kuzu"), { backend: "ryu", schema: "none" });
		try {
			await hydrateDatabase(reader, loadSnapshot(path));
			const counted = await reader.runCypher("MATCH (p:P) RETURN count(p)");
			expect(String(counted.rows[0]?.[0])).toBe("1200");
		} finally {
			await reader.close();
		}
	});

	test("rows of differing shape still load, because each row is projected to the declared properties", async () => {
		// Regression: ryu turns a `$rows` parameter into a LIST<STRUCT> and silently treats a
		// heterogeneous list as EMPTY. A hand-edited snapshot (one row without the `_label` the dump
		// adds) therefore loaded as zero rows with no error at all.
		const store = await openGraphStore(join(root, "g.kuzu"), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu");
		try {
			const snapshot: GraphSnapshot = {
				...emptySnapshot("mixed"),
				nodeTables: [{ name: "P", properties: [{ name: "name", type: "STRING", primaryKey: true }] }],
				nodes: { P: [{ _label: "P", name: "a" }, { name: "b" }] },
			};
			await hydrateDatabase(store, snapshot);
			const counted = await store.runCypher("MATCH (p:P) RETURN count(p)");
			expect(String(counted.rows[0]?.[0])).toBe("2");
		} finally {
			await store.close();
		}
	});

	test("a NULL property survives dump -> hydrate instead of being read as a broken row", async () => {
		// `RETURN n` leaves a NULL property out of the node, so a snapshot row legally lacks keys -
		// which is what an empty CSV cell looks like on disk (BACK-770). It has to hydrate as NULL,
		// not fail: the row is intact, the property simply has no value.
		const store = await openGraphStore(join(root, "h.kuzu"), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu");
		try {
			const snapshot: GraphSnapshot = {
				...emptySnapshot("nulls"),
				nodeTables: [
					{
						name: "P",
						properties: [
							{ name: "name", type: "STRING", primaryKey: true },
							{ name: "age", type: "INT64", primaryKey: false },
						],
					},
				],
				nodes: { P: [{ name: "a", age: 30 }, { name: "b" }] },
			};
			await hydrateDatabase(store, snapshot);
			const rows = await store.runCypher("MATCH (p:P) RETURN p.name, p.age ORDER BY p.name");
			expect(rows.rows).toEqual([
				["a", 30],
				["b", ""],
			]);
		} finally {
			await store.close();
		}
	});

	test("a row carrying a field the table never declared still fails loudly", async () => {
		// The other half of the guard: a renamed or misspelled field from a hand edit must not load
		// as a row of NULLs (which is indistinguishable from "the data was never there").
		const store = await openGraphStore(join(root, "i.kuzu"), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu");
		try {
			const snapshot: GraphSnapshot = {
				...emptySnapshot("broken"),
				nodeTables: [{ name: "P", properties: [{ name: "name", type: "STRING", primaryKey: true }] }],
				nodes: { P: [{ _label: "P", name: "ok" }, { other: 1 }] },
			};
			await expect(hydrateDatabase(store, snapshot)).rejects.toThrow(/未声明的字段/);
		} finally {
			await store.close();
		}
	});

	test("a row with an empty primary key is refused instead of crashing the WASM backend", async () => {
		// A NULL primary key segfaults ryu, so a corrupt snapshot has to be reported instead.
		const store = await openGraphStore(join(root, "j.kuzu"), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu");
		try {
			const snapshot: GraphSnapshot = {
				...emptySnapshot("nokey"),
				nodeTables: [{ name: "P", properties: [{ name: "name", type: "STRING", primaryKey: true }] }],
				nodes: { P: [{ name: "ok" }, { name: null }] },
			};
			await expect(hydrateDatabase(store, snapshot)).rejects.toThrow(/主键/);
		} finally {
			await store.close();
		}
	});

	test("a value containing a comma survives dump -> save -> load -> hydrate", async () => {
		// Regression: dumpDatabase used `RETURN n`, and ryu cannot hand a whole node across the WASM
		// boundary when one of its properties is INT64 - the caller fell back to parsing ryu's
		// `|`-delimited text, which cut a value at its first comma ("Ann, A" came back as "Ann").
		const writer = await openGraphStore(join(root, "k.kuzu"), { backend: "ryu", schema: "none" });
		expect(writer.backend).toBe("ryu");
		const path = join(root, "comma.graph.json");
		try {
			await writer.runWrite("CREATE NODE TABLE P(name STRING PRIMARY KEY, age INT64)");
			await writer.runWrite("UNWIND $rows AS row CREATE (:P {name: row.name, age: CAST(row.age AS INT64)})", {
				rows: [
					{ name: "Ann, A", age: "22" },
					{ name: "plain", age: null },
				],
			});
			saveSnapshot(path, await dumpDatabase(writer, "comma"));
		} finally {
			await writer.close();
		}
		const reader = await openGraphStore(join(root, "l.kuzu"), { backend: "ryu", schema: "none" });
		try {
			await hydrateDatabase(reader, loadSnapshot(path));
			const rows = await reader.runCypher("MATCH (p:P) RETURN p.name, p.age ORDER BY p.name");
			expect(rows.rows).toEqual([
				["Ann, A", 22],
				["plain", ""],
			]);
		} finally {
			await reader.close();
		}
	});

	test("the derived corpus store still refuses write Cypher", async () => {
		const store = await openGraphStore(join(root, "c.kuzu"), { backend: "ryu" });
		expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make the assertions vacuous
		try {
			await expect(store.runCypher("CREATE (:FileNode {path: 'x'})")).rejects.toThrow();
		} finally {
			await store.close();
		}
	});
});
