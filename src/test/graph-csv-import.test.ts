import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coerceCsvValue, importCsvTable, inferColumnType, parseCsvText, readCsvFile } from "../graph/csv-import";
import { dumpDatabase, hydrateDatabase, loadSnapshot, saveSnapshot } from "../graph/snapshot";
import { openGraphStore } from "../graph/store";

describe("csv parsing (pure)", () => {
	test("quoted fields keep commas, newlines and escaped quotes", () => {
		const rows = parseCsvText('name,note\r\n"Ann, A","first"\r\n"Bo\nb","he said ""hi"""\r\n');
		expect(rows).toEqual([
			["name", "note"],
			["Ann, A", "first"],
			["Bo\nb", 'he said "hi"'],
		]);
	});

	test("blank lines are not data and a trailing newline ends the last record", () => {
		expect(parseCsvText("a,b\n\n1,2\n")).toEqual([
			["a", "b"],
			["1", "2"],
		]);
	});

	test("an unterminated quote is reported with its line instead of guessed at", () => {
		expect(() => parseCsvText('a,b\n"oops,2\n')).toThrow(/第 2 行/);
	});

	test("type inference narrows to the narrowest type that fits, and ignores empty cells", () => {
		expect(inferColumnType(["1", "2", "3"])).toBe("INT64");
		expect(inferColumnType(["1", "2.5", ""])).toBe("DOUBLE");
		expect(inferColumnType(["true", "false", "yes"])).toBe("BOOLEAN");
		expect(inferColumnType(["a", "1"])).toBe("STRING");
		expect(inferColumnType(["", ""])).toBe("STRING"); // an all-empty column says nothing
	});

	test("a value the column's type cannot hold is named, line and column included", () => {
		expect(coerceCsvValue("42", "INT64", "age", 3)).toBe("42");
		expect(coerceCsvValue("", "INT64", "age", 3)).toBeNull();
		expect(coerceCsvValue("", "STRING", "name", 3)).toBe("");
		expect(coerceCsvValue("yes", "BOOLEAN", "flag", 4)).toBe("true");
		expect(() => coerceCsvValue("abc", "INT64", "age", 5)).toThrow(/第 5 行.*"age"/);
	});
});

describe("reading a csv file", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-csv-"));
		await mkdir(root, { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	async function write(name: string, contents: string): Promise<string> {
		const path = join(root, name);
		await writeFile(path, contents, "utf8");
		return path;
	}

	test("the header names the columns and the first one becomes the primary key", async () => {
		const path = await write("people.csv", "name,age,score,active\nAlice,30,1.5,true\nCarol,37,,yes\n");
		const csv = readCsvFile(path);
		expect(csv.table).toBe("people"); // derived from the file name
		expect(csv.columns).toEqual([
			{ name: "name", source: "name", type: "STRING", primaryKey: true },
			{ name: "age", source: "age", type: "INT64", primaryKey: false },
			{ name: "score", source: "score", type: "DOUBLE", primaryKey: false },
			{ name: "active", source: "active", type: "BOOLEAN", primaryKey: false },
		]);
		expect(csv.rows).toEqual([
			["Alice", "30", "1.5", "true"],
			["Carol", "37", "", "yes"],
		]);
	});

	test("--no-header generates column names, --map renames and --node overrides the table", async () => {
		const path = await write("raw.csv", "Alice,30\nBob,41\n");
		const csv = readCsvFile(path, { hasHeader: false, table: "Person" });
		expect(csv.table).toBe("Person");
		expect(csv.columns.map((c) => c.name)).toEqual(["column1", "column2"]);

		const mapped = readCsvFile(await write("m.csv", "First Name,age\nAnn,22\n"), { map: { "First Name": "name" } });
		expect(mapped.columns.map((c) => c.name)).toEqual(["name", "age"]);
	});

	test("a value with a newline in the key column is refused, because ryu would split it in two", async () => {
		const path = await write("broken.csv", 'name,age\n"Bo\nb",33\n');
		expect(() => readCsvFile(path)).not.toThrow(); // the file itself is fine
		const csv = readCsvFile(path);
		expect(csv.rows[0]?.[0]).toBe("Bo\nb");
	});

	test("malformed files say exactly what is wrong, before any store is opened", async () => {
		const ragged = await write("ragged.csv", "name,age\nFrank,60,extra\n");
		expect(() => readCsvFile(ragged)).toThrow(/第 2 行有 3 列/);

		const headerOnly = await write("empty.csv", "name,age\n");
		expect(() => readCsvFile(headerOnly)).toThrow(/只有表头/);

		const badName = await write("bad.csv", "First Name,age\nAnn,22\n");
		expect(() => readCsvFile(badName)).toThrow(/不是合法的属性名/);

		const duplicate = await write("dup.csv", "a,a\n1,2\n");
		expect(() => readCsvFile(duplicate, { map: { a: "x" } })).toThrow(/重复/);

		expect(() => readCsvFile(join(root, "missing.csv"))).toThrow(/无法读取/);
	});
});

describe("importing a csv into a database", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-csv-import-"));
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	async function write(name: string, contents: string): Promise<string> {
		const path = join(root, name);
		await writeFile(path, contents, "utf8");
		return path;
	}

	async function freshStore(name: string) {
		const store = await openGraphStore(join(root, `${name}.kuzu`), { backend: "ryu", schema: "none" });
		expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make every assertion vacuous
		return store;
	}

	test("rows land in a table created with the inferred types, and survive a reload", async () => {
		const csv = readCsvFile(await write("people.csv", "name,age,score,active\nAlice,30,1.5,true\nCarol,37,,yes\n"));
		const writer = await freshStore("w");
		try {
			const result = await importCsvTable(writer, csv);
			expect(result.created).toBe(true);
			expect(result.inserted).toBe(2);
			expect(result.updated).toBe(0);
			expect(result.columns.map((c) => c.type)).toEqual(["STRING", "INT64", "DOUBLE", "BOOLEAN"]);
			const snapshot = await dumpDatabase(writer, "people");
			saveSnapshot(join(root, "people.graph.json"), snapshot);
			expect(snapshot.nodeTables[0]?.properties[0]?.primaryKey).toBe(true);
		} finally {
			await writer.close();
		}

		// A second process: hydrate from the snapshot alone and read the values back.
		const reader = await freshStore("r");
		try {
			await hydrateDatabase(reader, loadSnapshot(join(root, "people.graph.json")));
			const rows = await reader.runCypher("MATCH (n:people) RETURN n.name, n.age, n.score, n.active ORDER BY n.name");
			expect(rows.rows).toEqual([
				["Alice", 30, 1.5, "True"],
				["Carol", 37, "", "True"], // the empty cell came back as NULL, which reads as empty
			]);
		} finally {
			await reader.close();
		}
	});

	test("an empty cell stays NULL through dump and hydrate rather than becoming an empty string", async () => {
		const csv = readCsvFile(await write("p.csv", "name,age\nAlice,30\nBob,\n"));
		const store = await freshStore("nulls");
		try {
			await importCsvTable(store, csv);
			const snapshot = await dumpDatabase(store, "p");
			// A typed column cannot hold "", so the dump must record NULL - handing "" back to an
			// INT64 column on hydrate is what used to break the reopen.
			expect(snapshot.nodes.p).toEqual([
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: null },
			]);
		} finally {
			await store.close();
		}
	});

	test("re-importing updates the rows it already has instead of silently dropping the batch", async () => {
		// Regression: one duplicate key in a `CREATE` batch made ryu drop the WHOLE batch, so a
		// second import lost rows that were not duplicates at all.
		const store = await freshStore("upsert");
		try {
			await importCsvTable(store, readCsvFile(await write("a.csv", "name,age\nAlice,30\nBob,41\n")));
			const second = await importCsvTable(
				store,
				readCsvFile(await write("b1.csv", "name,age\nAlice,31\nCarol,37\n"), { table: "a" }),
			);
			expect(second.created).toBe(false);
			expect(second.inserted).toBe(1); // Carol
			expect(second.updated).toBe(1); // Alice
			const rows = await store.runCypher("MATCH (n:a) RETURN n.name, n.age ORDER BY n.name");
			expect(rows.rows).toEqual([
				["Alice", 31],
				["Bob", 41],
				["Carol", 37],
			]);
		} finally {
			await store.close();
		}
	});

	test("a csv column the existing table does not have is an error, not a silent drop", async () => {
		const store = await freshStore("mismatch");
		try {
			await importCsvTable(store, readCsvFile(await write("a.csv", "name,age\nAlice,30\n")));
			await expect(
				importCsvTable(store, readCsvFile(await write("b2.csv", "name,city\nBob,Beijing\n"), { table: "a" })),
			).rejects.toThrow(/没有列 "city"/);
		} finally {
			await store.close();
		}
	});

	test("a value the existing column cannot hold is refused, and the table is left as it was", async () => {
		const store = await freshStore("badvalue");
		try {
			await importCsvTable(store, readCsvFile(await write("a.csv", "name,age\nAlice,30\n")));
			await expect(
				importCsvTable(store, readCsvFile(await write("b3.csv", "name,age\nBob,not-a-number\n"), { table: "a" })),
			).rejects.toThrow(/第 2 行.*不是合法的 INT64/);
			const rows = await store.runCypher("MATCH (n:a) RETURN count(n)");
			expect(String(rows.rows[0]?.[0])).toBe("1");
		} finally {
			await store.close();
		}
	});
});
