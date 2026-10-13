import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { clearDuckdbDiscoveryCache, listDuckdbFiles } from "../duckdb/discover.ts";
import { buildDuckdbCsv } from "../duckdb/export.ts";
import { hasDuckdbMagic, isDuckdbFileName, resolveDuckdbSource } from "../duckdb/paths.ts";
import { runDuckdbQuery } from "../duckdb/query.ts";
import { parseQueryBlock } from "../sqlite/block.ts";
import { validateReadOnlySql } from "../sqlite/validation.ts";

// Opening the first DuckDB file of a process pays a one-off cost; the default 5s budget is too tight.
setDefaultTimeout(60_000);

let root: string;

/** Creates a `.duckdb` file with a row spanning DuckDB's non-primitive value types. */
async function makeDuckdb(path: string): Promise<void> {
	const instance = await DuckDBInstance.create(path);
	const conn = await instance.connect();
	await conn.run(
		"CREATE TABLE people (name VARCHAR, age INTEGER, score DOUBLE, big BIGINT, dec DECIMAL(18,3), ts TIMESTAMP, dt DATE, bl BLOB)",
	);
	await conn.run(
		"INSERT INTO people VALUES ('Ann', 30, 1.5, 1234567890123, 3.14, TIMESTAMP '2026-10-13 08:30:00', DATE '2026-10-13', '\\xDE\\xAD\\xBE\\xEF')",
	);
	conn.closeSync();
	instance.closeSync();
}

/** Project-relative, slash-separated: the shape a block's `source` has, on every platform. */
function relativeToRoot(path: string): string {
	return relative(root, path).replace(/\\/g, "/");
}

beforeEach(() => {
	root = `${tmpdir()}/backlog-duckdb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	mkdirSync(root, { recursive: true });
	clearDuckdbDiscoveryCache();
});

afterEach(() => {
	void rm(root, { recursive: true, force: true }).catch(() => {});
});

describe("parseQueryBlock (shared by duckdb)", () => {
	test("reads source/sql/view regardless of engine", () => {
		const parsed = parseQueryBlock("source: backlog/databases/shop.duckdb\nsql: |\n  SELECT 1");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.source).toBe("backlog/databases/shop.duckdb");
		expect(parsed.block.sql).toBe("SELECT 1");
		expect(parsed.block.view).toBe("table");
	});
});

describe("isDuckdbFileName / hasDuckdbMagic", () => {
	test("matches the .duckdb extension only", () => {
		expect(isDuckdbFileName("shop.duckdb")).toBe(true);
		expect(isDuckdbFileName("shop.sqlite")).toBe(false);
		expect(isDuckdbFileName("shop")).toBe(false);
	});

	test("recognises a real DuckDB file but not a decoy", async () => {
		const path = join(root, "real.duckdb");
		await makeDuckdb(path);
		expect(hasDuckdbMagic(path)).toBe(true);

		const decoy = join(root, "decoy.duckdb");
		writeFileSync(decoy, "this is not a database");
		expect(hasDuckdbMagic(decoy)).toBe(false);
	});
});

describe("resolveDuckdbSource", () => {
	test("resolves a project-relative source", async () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		const path = join(root, "backlog", "databases", "shop.duckdb");
		await makeDuckdb(path);

		const result = resolveDuckdbSource({ projectRoot: root, source: "backlog/databases/shop.duckdb" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(relativeToRoot(result.path)).toBe("backlog/databases/shop.duckdb");
	});

	test("refuses an extension outside the whitelist", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		await makeDuckdb(join(root, "data", "shop.duckdb"));
		expect(resolveDuckdbSource({ projectRoot: root, source: "data/shop.sqlite" }).ok).toBe(false);
	});

	test("refuses a file that is not a DuckDB database", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		writeFileSync(join(root, "data", "fake.duckdb"), "not a database at all");
		expect(resolveDuckdbSource({ projectRoot: root, source: "data/fake.duckdb" }).ok).toBe(false);
	});

	test("refuses a leading slash", async () => {
		expect(resolveDuckdbSource({ projectRoot: root, source: "/data/shop.duckdb" }).ok).toBe(false);
	});
});

describe("runDuckdbQuery", () => {
	test("coerces DuckDB value types into the shared cell union", async () => {
		const path = join(root, "shop.duckdb");
		await makeDuckdb(path);
		const result = await runDuckdbQuery({
			dbPath: path,
			sql: "SELECT name, age, score, big, dec, ts, dt, bl FROM people",
		});

		expect(result.columns).toEqual(["name", "age", "score", "big", "dec", "ts", "dt", "bl"]);
		const row = result.rows[0]!;
		expect(row[0]).toBe("Ann");
		expect(row[1]).toBe(30);
		expect(row[2]).toBe(1.5);
		expect(row[3]).toBe("1234567890123"); // BIGINT -> string
		expect(row[4]).toBe("3.140"); // DECIMAL(18,3) -> fixed-scale decimal string
		expect(row[5]).toBe("2026-10-13T08:30:00.000Z"); // TIMESTAMP -> ISO
		expect(row[6]).toBe("2026-10-13"); // DATE -> ISO date
		expect(row[7]).toBe("<blob 4 字节>"); // BLOB -> summary
		expect(result.truncated).toBe(false);
	});

	test("rejects a write attempt through the read-only engine", async () => {
		const path = join(root, "shop.duckdb");
		await makeDuckdb(path);
		await expect(runDuckdbQuery({ dbPath: path, sql: "CREATE TABLE other (x INTEGER)" })).rejects.toThrow();
	});

	test("truncates beyond maxRows", async () => {
		const path = join(root, "nums.duckdb");
		const instance = await DuckDBInstance.create(path);
		const conn = await instance.connect();
		await conn.run("CREATE TABLE nums (v INTEGER)");
		for (let i = 0; i < 10; i++) {
			await conn.run(`INSERT INTO nums VALUES (${i})`);
		}
		conn.closeSync();
		instance.closeSync();

		const result = await runDuckdbQuery({ dbPath: path, sql: "SELECT v FROM nums ORDER BY v", maxRows: 3 });
		expect(result.rows.length).toBe(3);
		expect(result.truncated).toBe(true);
	});
});

describe("buildDuckdbCsv", () => {
	test("builds a CSV with a <stem>-<timestamp>.csv filename and BOM body", async () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		const path = join(root, "backlog", "databases", "shop.duckdb");
		await makeDuckdb(path);

		const result = await buildDuckdbCsv({
			projectRoot: root,
			source: "backlog/databases/shop.duckdb",
			sql: "SELECT name FROM people",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.csv.filename).toMatch(/^shop-\d{8}-\d{6}\.csv$/);
		expect(result.csv.csv.startsWith("﻿")).toBe(true);
		expect(result.csv.csv).toContain("name\r\nAlice\r\n".replace("Alice", "Ann"));
		expect(result.csv.rows).toBe(1);
		expect(result.csv.truncated).toBe(false);
	});

	test("refuses a write keyword at the validation gate", async () => {
		const result = await buildDuckdbCsv({ projectRoot: root, source: "x.duckdb", sql: "DROP TABLE people" });
		expect(result.ok).toBe(false);
	});
});

describe("listDuckdbFiles", () => {
	test("finds .duckdb files and ignores other extensions", async () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		await makeDuckdb(join(root, "backlog", "databases", "shop.duckdb"));
		await makeDuckdb(join(root, "backlog", "databases", "warehouse.duckdb"));
		writeFileSync(join(root, "backlog", "databases", "ignore.sqlite"), "x");

		const files = await listDuckdbFiles(root);
		const names = files.map((file) => file.path).sort();
		expect(names).toEqual(["backlog/databases/shop.duckdb", "backlog/databases/warehouse.duckdb"]);
	});

	test("rejects a statement blocked by read-only validation", () => {
		// The export path re-validates SQL; a write keyword must be refused before any file is opened.
		expect(validateReadOnlySql("DELETE FROM people").ok).toBe(false);
	});
});
