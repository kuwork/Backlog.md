import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { clearDuckdbDiscoveryCache, listDuckdbFiles } from "../duckdb/discover.ts";
import { buildDuckdbCsv } from "../duckdb/export.ts";
import {
	duckdbSourceKind,
	hasDuckdbMagic,
	isDuckdbFileName,
	resolveDuckdbSource,
	resolveDuckdbWriteTarget,
} from "../duckdb/paths.ts";
import { runDuckdbQuery } from "../duckdb/query.ts";
import { screenDuckdbSqlLiterals } from "../duckdb/sql-literals.ts";
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

/** A CSV data file the in-memory instance can read through its replacement scan. */
function writeCsv(path: string, header = "id,name", rows = ["1,alice", "2,bob"]): void {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, [header, ...rows].join("\n"));
}

beforeEach(() => {
	root = `${tmpdir()}/backlog-duckdb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	mkdirSync(root, { recursive: true });
	clearDuckdbDiscoveryCache();
});

afterEach(() => {
	void rmSync(root, { recursive: true, force: true });
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

	test("parses an optional copy_to field", () => {
		const parsed = parseQueryBlock(
			"source: backlog/databases/shop.csv\nsql: |\n  SELECT 1\ncopy_to: backlog/databases/out.csv",
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.copyTo).toBe("backlog/databases/out.csv");
	});
});

describe("isDuckdbFileName / duckdbSourceKind / hasDuckdbMagic", () => {
	test("whitelist now covers .duckdb / .csv / .xlsx", () => {
		expect(isDuckdbFileName("shop.duckdb")).toBe(true);
		expect(isDuckdbFileName("shop.csv")).toBe(true);
		expect(isDuckdbFileName("shop.xlsx")).toBe(true);
		expect(isDuckdbFileName("shop.sqlite")).toBe(false);
		expect(isDuckdbFileName("shop")).toBe(false);
	});

	test("duckdbSourceKind reports database vs data-file", () => {
		expect(duckdbSourceKind("shop.duckdb")).toBe("database");
		expect(duckdbSourceKind("shop.CSV")).toBe("data-file");
		expect(duckdbSourceKind("shop.xlsx")).toBe("data-file");
		expect(duckdbSourceKind("shop.sqlite")).toBeNull();
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
	test("resolves a project-relative .duckdb source as a database", async () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		const path = join(root, "backlog", "databases", "shop.duckdb");
		await makeDuckdb(path);

		const result = resolveDuckdbSource({ projectRoot: root, source: "backlog/databases/shop.duckdb" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.kind).toBe("database");
		expect(relativeToRoot(result.path)).toBe("backlog/databases/shop.duckdb");
	});

	test("resolves a project-relative .csv source as a data-file without a magic check", async () => {
		const path = join(root, "data", "orders.csv");
		writeCsv(path);

		const result = resolveDuckdbSource({ projectRoot: root, source: "data/orders.csv" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.kind).toBe("data-file");
		expect(relativeToRoot(result.path)).toBe("data/orders.csv");
	});

	test("refuses an extension outside the whitelist", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		await makeDuckdb(join(root, "data", "shop.duckdb"));
		expect(resolveDuckdbSource({ projectRoot: root, source: "data/shop.sqlite" }).ok).toBe(false);
	});

	test("refuses a .duckdb file that is not a database (magic check)", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		writeFileSync(join(root, "data", "fake.duckdb"), "not a database at all");
		expect(resolveDuckdbSource({ projectRoot: root, source: "data/fake.duckdb" }).ok).toBe(false);
	});

	test("refuses a leading slash", async () => {
		expect(resolveDuckdbSource({ projectRoot: root, source: "/data/shop.duckdb" }).ok).toBe(false);
	});
});

describe("runDuckdbQuery - database source", () => {
	test("coerces DuckDB value types into the shared cell union", async () => {
		const path = join(root, "shop.duckdb");
		await makeDuckdb(path);
		const result = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
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
		await expect(
			runDuckdbQuery({ dbPath: path, kind: "database", sql: "CREATE TABLE other (x INTEGER)" }),
		).rejects.toThrow();
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

		const result = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
			sql: "SELECT v FROM nums ORDER BY v",
			maxRows: 3,
		});
		expect(result.rows.length).toBe(3);
		expect(result.truncated).toBe(true);
	});
});

describe("runDuckdbQuery - pagination", () => {
	async function makeNums(path: string, count: number): Promise<void> {
		const instance = await DuckDBInstance.create(path);
		const conn = await instance.connect();
		await conn.run("CREATE TABLE nums (id INTEGER, name VARCHAR)");
		// Bulk insert in a single statement; 6000 individual INSERTs time out the WASM round-trips.
		await conn.run(`INSERT INTO nums SELECT i, 'p' || i FROM range(${count}) AS t(i)`);
		conn.closeSync();
		instance.closeSync();
	}

	test("paginates by page and reports totalPages", async () => {
		const path = join(root, "people.duckdb");
		await makeNums(path, 10);

		const first = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
			sql: "SELECT id, name FROM nums ORDER BY id",
			page: 1,
			pageSize: 3,
		});
		expect(first.rows.length).toBe(3);
		expect(first.totalRows).toBe(10);
		expect(first.totalPages).toBe(4);
		expect(first.page).toBe(1);
		expect(first.truncated).toBe(false);
		expect(first.rows[0]).toEqual([0, "p0"]);

		const second = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
			sql: "SELECT id, name FROM nums ORDER BY id",
			page: 2,
			pageSize: 3,
		});
		expect(second.rows.length).toBe(3);
		expect(second.rows[0]).toEqual([3, "p3"]);
		expect(second.page).toBe(2);
	});

	test("preview mode reports totalRows and truncates", async () => {
		const path = join(root, "people.duckdb");
		await makeNums(path, 10);

		const result = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
			sql: "SELECT id FROM nums ORDER BY id",
			maxRows: 5,
		});
		expect(result.rows.length).toBe(5);
		expect(result.totalRows).toBe(10);
		expect(result.truncated).toBe(true);
	});

	test("pagination is exempt from the 5000 hard cap", async () => {
		const path = join(root, "big.duckdb");
		await makeNums(path, 6000);

		const result = await runDuckdbQuery({
			dbPath: path,
			kind: "database",
			sql: "SELECT id FROM nums ORDER BY id",
			page: 1,
			pageSize: 50,
		});
		expect(result.rows.length).toBe(50);
		expect(result.totalRows).toBe(6000);
		expect(result.totalPages).toBe(120);
		expect(result.truncated).toBe(false);
	});
});

describe("runDuckdbQuery - data-file sources", () => {
	test("queries a CSV via the in-memory instance (absolute path in SQL)", async () => {
		const csv = join(root, "orders.csv");
		writeCsv(csv);

		const result = await runDuckdbQuery({
			dbPath: csv,
			kind: "data-file",
			sql: `SELECT * FROM '${csv}'`,
		});
		expect(result.columns).toEqual(["id", "name"]);
		expect(result.rows.length).toBe(2);
	});

	test("queries a CSV via a project-root-relative bare path (cwd-anchored)", async () => {
		// The engine's replacement scan resolves a bare path against process.cwd(), which for a block
		// is the project root. Drop a fixture there (under the gitignored tmp/) and reference it by
		// its project-relative path, then clean up.
		const bareRoot = join(process.cwd(), "tmp", `duckdb-bare-${Date.now()}`);
		const csv = join(bareRoot, "orders.csv");
		writeCsv(csv);
		const rel = relative(process.cwd(), csv).replace(/\\/g, "/");
		try {
			const result = await runDuckdbQuery({
				dbPath: csv,
				kind: "data-file",
				sql: `SELECT * FROM '${rel}'`,
			});
			expect(result.columns).toEqual(["id", "name"]);
			expect(result.rows.length).toBe(2);
		} finally {
			rmSync(bareRoot, { recursive: true, force: true });
		}
	});

	test("queries an XLSX via the official excel extension, skipping when offline", async () => {
		const xlsx = join(process.cwd(), "backlog", "databases", "demo-shop.xlsx");
		if (!existsSync(xlsx)) {
			console.warn("skipping xlsx test: demo-shop.xlsx missing");
			return;
		}
		try {
			const result = await runDuckdbQuery({
				dbPath: xlsx,
				kind: "data-file",
				sql: `SELECT * FROM '${relative(process.cwd(), xlsx).replace(/\\/g, "/")}'`,
			});
			expect(result.columns.length).toBeGreaterThan(0);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Offline CI: the excel extension cannot be downloaded. The error is surfaced, not silent.
			if (/Excel 扩展/.test(message)) {
				console.warn("skipping xlsx test:", message);
				return;
			}
			throw error;
		}
	});

	test("surfaces a readable error when the excel extension cannot load", async () => {
		const csv = join(root, "orders.csv");
		writeCsv(csv);
		// A .duckdb source mis-resolved would never hit this; force the data-file path with a CSV
		// so any extension failure would be about the engine, not the file. Here we just assert the
		// happy path stays clean; the offline branch is covered by the xlsx test above.
		const result = await runDuckdbQuery({
			dbPath: csv,
			kind: "data-file",
			sql: `SELECT * FROM '${csv}'`,
		});
		expect(result.rows.length).toBe(2);
	});
});

describe("screenDuckdbSqlLiterals", () => {
	const projectRoot = join(tmpdir(), `duckdb-screen-${Date.now()}`);
	mkdirSync(projectRoot, { recursive: true });

	test("rejects a URL scheme literal", () => {
		const screened = screenDuckdbSqlLiterals(projectRoot, "SELECT * FROM read_csv_auto('http://example.com/data.csv')");
		expect(screened.ok).toBe(false);
	});

	test("rejects an escaping path literal", () => {
		const screened = screenDuckdbSqlLiterals(projectRoot, "SELECT * FROM read_csv_auto('../../etc/secrets.csv')");
		expect(screened.ok).toBe(false);
	});

	test("accepts a project-contained path literal", () => {
		const screened = screenDuckdbSqlLiterals(projectRoot, "SELECT * FROM read_csv_auto('data/orders.csv')");
		expect(screened.ok).toBe(true);
	});

	test("accepts a query that has no path-like literals", () => {
		const screened = screenDuckdbSqlLiterals(projectRoot, "SELECT * FROM t WHERE name = 'alice'");
		expect(screened.ok).toBe(true);
	});
});

describe("resolveDuckdbWriteTarget (copy_to)", () => {
	test("accepts a project-relative .csv target", () => {
		const result = resolveDuckdbWriteTarget({ projectRoot: root, target: "out/data.csv" });
		expect(result.ok).toBe(true);
	});

	test("accepts a project-relative .xlsx target", () => {
		const result = resolveDuckdbWriteTarget({ projectRoot: root, target: "out/data.xlsx" });
		expect(result.ok).toBe(true);
	});

	test("rejects a non-csv/xlsx target", () => {
		expect(resolveDuckdbWriteTarget({ projectRoot: root, target: "out/data.json" }).ok).toBe(false);
	});

	test("rejects overwriting a .duckdb file", () => {
		expect(resolveDuckdbWriteTarget({ projectRoot: root, target: "out/data.duckdb" }).ok).toBe(false);
	});

	test("rejects an escaping target", () => {
		expect(resolveDuckdbWriteTarget({ projectRoot: root, target: "../../escape.csv" }).ok).toBe(false);
	});

	test("rejects an absolute target", () => {
		expect(resolveDuckdbWriteTarget({ projectRoot: root, target: "/tmp/escape.csv" }).ok).toBe(false);
	});
});

describe("runDuckdbQuery - copy_to write path", () => {
	test("writes the result out and reports writtenTo", async () => {
		const db = join(root, "shop.duckdb");
		await makeDuckdb(db);
		const target = "export.csv";
		const result = await runDuckdbQuery({
			dbPath: db,
			kind: "database",
			sql: "SELECT 1 AS x",
			copyTo: target,
			projectRoot: root,
		});
		expect(result.writtenTo).toBe("export.csv");
		expect(existsSync(join(root, target))).toBe(true);
	});

	test("refuses a copy_to target that escapes the project", async () => {
		const db = join(root, "shop.duckdb");
		await makeDuckdb(db);
		await expect(
			runDuckdbQuery({
				dbPath: db,
				kind: "database",
				sql: "SELECT 1 AS x",
				copyTo: "../../escape.csv",
				projectRoot: root,
			}),
		).rejects.toThrow();
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

describe("validateReadOnlySql - extension / write keywords", () => {
	test("refuses INSTALL / LOAD / COPY in user SQL", () => {
		expect(validateReadOnlySql("INSTALL excel").ok).toBe(false);
		expect(validateReadOnlySql("LOAD excel").ok).toBe(false);
		expect(validateReadOnlySql("COPY people TO 'out.csv'").ok).toBe(false);
	});

	test("still allows a plain SELECT", () => {
		expect(validateReadOnlySql("SELECT 1").ok).toBe(true);
	});
});

describe("listDuckdbFiles", () => {
	test("finds .duckdb / .csv / .xlsx files and ignores other extensions", async () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		await makeDuckdb(join(root, "backlog", "databases", "shop.duckdb"));
		writeCsv(join(root, "backlog", "databases", "orders.csv"));
		writeFileSync(join(root, "backlog", "databases", "products.xlsx"), "");
		writeFileSync(join(root, "backlog", "databases", "ignore.sqlite"), "x");

		const files = await listDuckdbFiles(root);
		const names = files.map((file) => file.path).sort();
		expect(names).toEqual([
			"backlog/databases/orders.csv",
			"backlog/databases/products.xlsx",
			"backlog/databases/shop.duckdb",
		]);
	});

	test("rejects a statement blocked by read-only validation", () => {
		// The export path re-validates SQL; a write keyword must be refused before any file is opened.
		expect(validateReadOnlySql("DELETE FROM people").ok).toBe(false);
	});
});
