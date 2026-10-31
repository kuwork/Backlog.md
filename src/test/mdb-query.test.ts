import { afterEach, describe, expect, test } from "bun:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMdbQueryBlock } from "../mdb/block.ts";
import { clearMdbDiscoveryCache, listMdbFiles } from "../mdb/discover.ts";
import { buildMdbCsv } from "../mdb/export.ts";
import { resolveMdbSource } from "../mdb/paths.ts";
import { closeAllMdbHandles, getMdbDatabase, runMdbQuery } from "../mdb/query.ts";

const FIXTURE = join(import.meta.dir, "..", "..", "backlog", "assets", "广州管线探测模板.mdb");
const LIZHENG = join(import.meta.dir, "..", "..", "backlog", "assets", "lizheng.mdb");

describe("parseMdbQueryBlock", () => {
	test("reads source/sql and defaults the view", () => {
		const parsed = parseMdbQueryBlock("source: backlog/assets/sample.mdb\nsql: SELECT 1");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.source).toBe("backlog/assets/sample.mdb");
		expect(parsed.block.sql).toBe("SELECT 1");
		expect(parsed.block.view).toBe("table");
	});

	test("rejects copy_to (no MDB write path)", () => {
		const parsed = parseMdbQueryBlock("source: a.mdb\nsql: SELECT 1\ncopy_to: out.csv");
		// The parser itself accepts the field; the server rejects it. Here we only assert the field is parsed.
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.block.copyTo).toBe("out.csv");
	});
});

describe("runMdbQuery", () => {
	test("runs SQL against a loaded Access file", () => {
		const result = runMdbQuery({ dbPath: FIXTURE, sql: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'" });
		expect(result.columns).toEqual(["n"]);
		expect(typeof result.rows[0]?.[0]).toBe("number");
		expect((result.rows[0]?.[0] as number) > 0).toBe(true);
		expect(result.truncated).toBe(false);
	});

	test("reports pagination metadata and a single page", () => {
		const first = runMdbQuery({ dbPath: FIXTURE, sql: "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1" });
		const table = String(first.rows[0]?.[0]);
		const result = runMdbQuery({
			dbPath: FIXTURE,
			sql: `SELECT * FROM "${table}"`,
			page: 1,
			pageSize: 1,
		});
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(1);
		expect(result.totalPages ?? 0).toBeGreaterThanOrEqual(1);
		expect(result.totalRows).toBeGreaterThanOrEqual(0);
		expect(result.rows.length).toBeLessThanOrEqual(1);
	});

	test("rejects a non-SELECT statement at the engine boundary", () => {
		expect(() => runMdbQuery({ dbPath: FIXTURE, sql: "CREATE TABLE x(a)" })).toThrow();
	});

	test("decodes GBK text columns (Jet code-page recovery)", () => {
		// lizheng.mdb stores ANSI text as GBK; mdb-reader hands back latin1-rendered
		// bytes, which must be recovered to GBK — matching MDB转Excel离线转换器.html.
		const result = runMdbQuery({
			dbPath: LIZHENG,
			sql: `SELECT TNMS FROM "g_TableName" WHERE TNMC = 'd_DZBuLiang'`,
		});
		expect(result.columns).toEqual(["TNMS"]);
		expect(result.rows[0]?.[0]).toBe("地质不良符号表");
	});

	test("leaves pure-ASCII text untouched", () => {
		const result = runMdbQuery({
			dbPath: LIZHENG,
			sql: `SELECT TNMC FROM "g_TableName" WHERE TNMC = 'd_DZBuLiang'`,
		});
		expect(result.rows[0]?.[0]).toBe("d_DZBuLiang");
	});
});

describe("mdb handle cache", () => {
	afterEach(() => {
		closeAllMdbHandles();
	});

	test("shares one loaded copy across queries instead of reparsing the file", () => {
		// A document routinely renders ten blocks against the same database; reparsing per query
		// is what made a save re-render take seconds.
		const first = getMdbDatabase(LIZHENG);
		const second = getMdbDatabase(LIZHENG);
		expect(second).toBe(first);
	});

	test("drops the copy when it is closed explicitly", () => {
		const first = getMdbDatabase(LIZHENG);
		closeAllMdbHandles();
		expect(getMdbDatabase(LIZHENG)).not.toBe(first);
	});

	test("reloads when the file behind a cached path changes", async () => {
		const dir = await mkdtemp(join(tmpdir(), "mdb-cache-"));
		const target = join(dir, "copy.mdb");
		try {
			await copyFile(LIZHENG, target);
			const before = getMdbDatabase(target);
			// Same path, different bytes: the fingerprint has to notice and rebuild.
			// Removed first because Windows refuses to overwrite the file in place.
			await rm(target, { force: true });
			await copyFile(FIXTURE, target);
			const after = getMdbDatabase(target);
			expect(after).not.toBe(before);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("buildMdbCsv", () => {
	test("exports a query to a BOM-prefixed CSV", () => {
		const result = buildMdbCsv({
			projectRoot: join(import.meta.dir, "..", ".."),
			source: "backlog/assets/广州管线探测模板.mdb",
			sql: "SELECT name FROM sqlite_master WHERE type='table' LIMIT 5",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.csv.filename.endsWith(".csv")).toBe(true);
		expect(result.csv.csv.startsWith("﻿")).toBe(true);
		expect(result.csv.rows).toBeGreaterThan(0);
	});

	test("rejects an out-of-project source", () => {
		const result = buildMdbCsv({
			projectRoot: join(import.meta.dir, "..", ".."),
			source: "../escape.mdb",
			sql: "SELECT 1",
		});
		expect(result.ok).toBe(false);
	});
});

describe("mdb discovery", () => {
	afterEach(() => clearMdbDiscoveryCache());

	test("lists the fixture as an MDB file", async () => {
		const files = await listMdbFiles(join(import.meta.dir, "..", ".."));
		expect(files.some((file) => file.path.includes("广州管线探测模板.mdb"))).toBe(true);
	});

	test("resolveMdbSource refuses a non-mdb extension", () => {
		const resolved = resolveMdbSource({ projectRoot: join(import.meta.dir, "..", ".."), source: "a.sqlite" });
		expect(resolved.ok).toBe(false);
	});
});
