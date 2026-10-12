import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseSqliteQueryBlock } from "../sqlite/block.ts";
import { clearSqliteDiscoveryCache, listSqliteFiles } from "../sqlite/discover.ts";
import { resolveSqliteSource } from "../sqlite/paths.ts";
import { closeAllSqliteHandles, runSqliteQuery } from "../sqlite/query.ts";
import { validateReadOnlySql } from "../sqlite/validation.ts";

describe("parseSqliteQueryBlock", () => {
	test("reads an inline sql and defaults the view", () => {
		const parsed = parseSqliteQueryBlock("source: backlog/databases/shop.sqlite\nsql: SELECT 1");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.source).toBe("backlog/databases/shop.sqlite");
		expect(parsed.block.sql).toBe("SELECT 1");
		expect(parsed.block.view).toBe("table");
	});

	test("reads a | block scalar, stripping the least indent", () => {
		const parsed = parseSqliteQueryBlock(
			[
				"source: backlog/databases/shop.sqlite",
				"view: list",
				"sql: |",
				"  SELECT name, age",
				"  FROM people",
				"  WHERE age > 18",
			].join("\n"),
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.sql).toBe("SELECT name, age\nFROM people\nWHERE age > 18");
		expect(parsed.block.view).toBe("list");
	});

	test("keeps blank lines inside a block scalar", () => {
		const parsed = parseSqliteQueryBlock("source: a.db\nsql: |\n  SELECT 1\n\n  -- tail");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.sql).toBe("SELECT 1\n\n-- tail");
	});

	test("rejects a missing required field", () => {
		expect(parseSqliteQueryBlock("sql: SELECT 1").ok).toBe(false);
		expect(parseSqliteQueryBlock("source: a.db").ok).toBe(false);
	});

	test("rejects an unknown field instead of ignoring it", () => {
		const parsed = parseSqliteQueryBlock("source: a.db\nsql: SELECT 1\ndatabase: other.db");
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toContain("database");
	});

	test("rejects a duplicated field", () => {
		expect(parseSqliteQueryBlock("source: a.db\nsource: b.db\nsql: SELECT 1").ok).toBe(false);
	});

	test("rejects an unknown view", () => {
		expect(parseSqliteQueryBlock("source: a.db\nsql: SELECT 1\nview: grid").ok).toBe(false);
	});

	test("rejects an indented field line", () => {
		expect(parseSqliteQueryBlock("  source: a.db\nsql: SELECT 1").ok).toBe(false);
	});
});

describe("validateReadOnlySql", () => {
	test("accepts SELECT", () => {
		expect(validateReadOnlySql("SELECT 1").ok).toBe(true);
	});

	test("accepts WITH … SELECT", () => {
		expect(validateReadOnlySql("WITH t AS (SELECT 1 AS a) SELECT * FROM t").ok).toBe(true);
	});

	test("strips one trailing semicolon", () => {
		const validated = validateReadOnlySql("SELECT 1;");
		expect(validated.ok).toBe(true);
		if (!validated.ok) return;
		expect(validated.sql).toBe("SELECT 1");
	});

	test("rejects a second statement", () => {
		expect(validateReadOnlySql("SELECT 1; SELECT 2").ok).toBe(false);
	});

	test("rejects write keywords", () => {
		for (const sql of ["DELETE FROM people", "DROP TABLE people", "PRAGMA table_info(people)"]) {
			expect(validateReadOnlySql(sql).ok).toBe(false);
		}
	});

	test("rejects a write keyword hidden in a comment", () => {
		expect(validateReadOnlySql("SELECT 1 /* DROP TABLE people */").ok).toBe(false);
	});

	test("allows keywords inside string literals and quoted identifiers", () => {
		expect(validateReadOnlySql("SELECT * FROM log WHERE action = 'drop'").ok).toBe(true);
		expect(validateReadOnlySql('SELECT "delete_log" FROM t').ok).toBe(true);
		expect(validateReadOnlySql("SELECT * FROM [update_log]").ok).toBe(true);
	});

	test("rejects an empty statement", () => {
		expect(validateReadOnlySql("   ").ok).toBe(false);
	});
});

// SQLite file creation on Windows is occasionally very slow (tens of seconds) for reasons outside
// this suite's control; the default 5s budget turns that into a flaky failure.
setDefaultTimeout(60_000);

let root: string;

// Opening the first SQLite file of a process costs far more than the ones after it, and on Windows
// that one-off has been seen to eat a whole test's time budget. Pay it here, once, outside any test.
{
	const warmPath = join(mkdtempSync(join(tmpdir(), "backlog-sqlite-warm-")), "warm.sqlite");
	const warm = new Database(warmPath);
	warm.run("CREATE TABLE warm (a INTEGER)");
	warm.close();
	void rm(warmPath, { force: true }).catch(() => {});
}

function makeDb(path: string): void {
	const db = new Database(path);
	db.run("CREATE TABLE people (name TEXT, age INTEGER)");
	db.run("INSERT INTO people (name, age) VALUES ('Ann', 30), ('Bob', 41)");
	db.close();
}

/** Project-relative, slash-separated: the shape a block's `source` has, on every platform. */
function relativeToRoot(path: string): string {
	return relative(root, path).replace(/\\/g, "/");
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "backlog-sqlite-"));
	clearSqliteDiscoveryCache();
});

/**
 * Best effort, and deliberately not awaited: Windows keeps a SQLite file locked for a moment after
 * `Database.close()`, and a synchronous `rmSync` on that lock blocks long enough to blow a test
 * timeout. The handles are already closed; a leftover temp directory costs nothing.
 */
function removeTree(path: string): void {
	void rm(path, { recursive: true, force: true }).catch(() => {});
}

afterEach(() => {
	closeAllSqliteHandles();
	removeTree(root);
});

describe("resolveSqliteSource", () => {
	test("resolves a project-relative source", () => {
		mkdirSync(join(root, "backlog", "databases"), { recursive: true });
		const dbPath = join(root, "backlog", "databases", "shop.sqlite");
		makeDb(dbPath);

		const result = resolveSqliteSource({ projectRoot: root, source: "backlog/databases/shop.sqlite" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(relativeToRoot(result.path)).toBe("backlog/databases/shop.sqlite");
	});

	test("refuses a leading slash: the project takes relative paths only", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		makeDb(join(root, "data", "shop.sqlite"));

		// The same file resolves fine without the slash - only the leading-slash form is refused.
		expect(resolveSqliteSource({ projectRoot: root, source: "data/shop.sqlite" }).ok).toBe(true);
		const result = resolveSqliteSource({ projectRoot: root, source: "/data/shop.sqlite" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain("前导");
	});

	test("refuses absolute paths, schemes and escapes", () => {
		for (const source of ["/../outside.sqlite", "https://example.com/a.db", "C:\\data\\a.db", "~/a.db"]) {
			expect(resolveSqliteSource({ projectRoot: root, source }).ok).toBe(false);
		}
	});

	test("refuses a file that is not a SQLite database", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		writeFileSync(join(root, "data", "fake.db"), "not a database at all");
		expect(resolveSqliteSource({ projectRoot: root, source: "data/fake.db" }).ok).toBe(false);
	});

	test("refuses an extension outside the whitelist", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		makeDb(join(root, "data", "shop.sqlite"));
		expect(resolveSqliteSource({ projectRoot: root, source: "data/shop.bin" }).ok).toBe(false);
	});

	test("refuses a database inside an excluded or hidden directory", () => {
		mkdirSync(join(root, "node_modules"), { recursive: true });
		mkdirSync(join(root, ".cache"), { recursive: true });
		makeDb(join(root, "node_modules", "dep.sqlite"));
		makeDb(join(root, ".cache", "tmp.sqlite"));

		expect(resolveSqliteSource({ projectRoot: root, source: "node_modules/dep.sqlite" }).ok).toBe(false);
		expect(resolveSqliteSource({ projectRoot: root, source: ".cache/tmp.sqlite" }).ok).toBe(false);
	});

	test("refuses a symlink that leaves the project", () => {
		const outside = mkdtempSync(join(tmpdir(), "backlog-sqlite-out-"));
		try {
			const outsideDb = join(outside, "out.sqlite");
			makeDb(outsideDb);
			try {
				symlinkSync(outsideDb, join(root, "linked.sqlite"), "file");
			} catch {
				// Symlinks need privileges this machine may not grant; the gate itself is covered
				// by the realpath check below only when a link could actually be created.
				return;
			}
			expect(resolveSqliteSource({ projectRoot: root, source: "linked.sqlite" }).ok).toBe(false);
		} finally {
			removeTree(outside);
		}
	});
});

describe("runSqliteQuery", () => {
	test("returns columns and rows", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		const dbPath = join(root, "data", "shop.sqlite");
		makeDb(dbPath);

		const result = runSqliteQuery({ dbPath, sql: "SELECT name, age FROM people ORDER BY age" });
		expect(result.columns).toEqual(["name", "age"]);
		expect(result.rows).toEqual([
			["Ann", 30],
			["Bob", 41],
		]);
		expect(result.truncated).toBe(false);
	});

	test("truncates past the row cap", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		const dbPath = join(root, "data", "shop.sqlite");
		makeDb(dbPath);

		const result = runSqliteQuery({ dbPath, sql: "SELECT name FROM people", maxRows: 1 });
		expect(result.rows.length).toBe(1);
		expect(result.truncated).toBe(true);
	});

	test("the engine itself refuses a write, whatever validation decided", () => {
		mkdirSync(join(root, "data"), { recursive: true });
		const dbPath = join(root, "data", "shop.sqlite");
		makeDb(dbPath);

		expect(() => runSqliteQuery({ dbPath, sql: "CREATE TABLE stolen (a INTEGER)" })).toThrow();
	});
});

describe("listSqliteFiles", () => {
	test("lists project databases and skips excluded directories", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		mkdirSync(join(root, "node_modules"), { recursive: true });
		mkdirSync(join(root, ".cache"), { recursive: true });
		makeDb(join(root, "data", "shop.sqlite"));
		makeDb(join(root, "node_modules", "dep.sqlite"));
		makeDb(join(root, ".cache", "tmp.sqlite"));

		const files = await listSqliteFiles(root);
		expect(files.map((entry) => entry.path)).toEqual(["data/shop.sqlite"]);
	});

	test("serves a cached walk until the TTL expires", async () => {
		mkdirSync(join(root, "data"), { recursive: true });
		makeDb(join(root, "data", "a.sqlite"));
		const first = await listSqliteFiles(root, 1_000);
		expect(first.length).toBe(1);

		makeDb(join(root, "data", "b.sqlite"));
		expect((await listSqliteFiles(root, 1_500)).length).toBe(1);
		expect((await listSqliteFiles(root, 61_500)).length).toBe(2);
	});
});
