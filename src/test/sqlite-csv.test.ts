import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
	defaultExportName,
	exportTimestamp,
	firstFreeTarget,
	renderCsvFile,
	rowsToCsv,
	sanitizeCsvName,
	UTF8_BOM,
} from "../sqlite/csv.ts";
import { exportSqliteCsv } from "../sqlite/export.ts";
import { isInsideProjectRoot } from "../sqlite/paths.ts";
import { closeAllSqliteHandles, SQLITE_MAX_ROWS } from "../sqlite/query.ts";

setDefaultTimeout(60_000);

let root: string;

// Same warm-up as src/test/sqlite.test.ts: opening the first SQLite file of a process costs far more
// than the next ones, and Windows hands that bill to whichever test happens to be running.
{
	const warmPath = join(mkdtempSync(join(tmpdir(), "backlog-csv-warm-")), "warm.sqlite");
	const warm = new Database(warmPath);
	warm.run("CREATE TABLE warm (a INTEGER)");
	warm.close();
	void rm(warmPath, { force: true }).catch(() => {});
}

function makeDb(path: string, rows = 2): void {
	const db = new Database(path);
	db.run("CREATE TABLE people (name TEXT, age INTEGER, note TEXT)");
	// One statement per chunk rather than per row: the truncation case inserts 520 rows and doing
	// that one INSERT at a time costs more seconds than the rest of the suite put together.
	for (let start = 0; start < rows; start += 100) {
		const values: string[] = [];
		for (let index = start; index < Math.min(start + 100, rows); index++) {
			const note = index === 0 ? "'multi\nline'" : "NULL";
			values.push(`('person-${index}', ${index}, ${note})`);
		}
		db.run(`INSERT INTO people (name, age, note) VALUES ${values.join(", ")}`);
	}
	db.close();
}

/** A database under `<root>/data/shop.sqlite`, which is where every export in these tests lands. */
function makeProject(rows = 2): { dbPath: string; source: string } {
	mkdirSync(join(root, "data"), { recursive: true });
	const dbPath = join(root, "data", "shop.sqlite");
	makeDb(dbPath, rows);
	return { dbPath, source: relative(root, dbPath).replace(/\\/g, "/") };
}

function exportDefault(options: { source: string; sql: string; filename?: string }) {
	return exportSqliteCsv({ projectRoot: root, ...options });
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "backlog-csv-")));
});

afterEach(() => {
	closeAllSqliteHandles();
	// Not awaited, and intentionally so: Windows holds a SQLite file briefly after close() and a
	// synchronous rm blocks long enough to blow the timeout. A leftover temp directory is cheaper.
	void rm(root, { recursive: true, force: true }).catch(() => {});
});

describe("isInsideProjectRoot (the write gate)", () => {
	test("accepts a file inside the project and refuses the root itself as a target", () => {
		expect(isInsideProjectRoot(root, join(root, "data", "report.csv"))).toBe(true);
		expect(isInsideProjectRoot(root, root)).toBe(false);
	});

	test("refuses a sibling directory and any path that walks up", () => {
		expect(isInsideProjectRoot(root, join(root, "..", "report.csv"))).toBe(false);
		expect(isInsideProjectRoot(join(root, "data"), join(root, "data", "shop.sqlite"))).toBe(true);
		expect(isInsideProjectRoot(join(root, "data"), join(root, "other", "shop.sqlite"))).toBe(false);
	});
});

describe("rowsToCsv", () => {
	test("writes a header, CRLF endings and a trailing newline", () => {
		expect(rowsToCsv(["name", "age"], [["Ann", 30]])).toBe("name,age\r\nAnn,30\r\n");
	});

	test("quotes a field containing a comma, quote or newline, doubling inner quotes", () => {
		const csv = rowsToCsv(["note"], [["a,b"], ['say "hi"'], ["x\ny"]]);

		expect(csv.split("\r\n")).toEqual(["note", '"a,b"', '"say ""hi"""', '"x\ny"', ""]);
	});

	test("writes NULL as an empty field", () => {
		expect(rowsToCsv(["a", "b"], [[null, 1]])).toBe("a,b\r\n,1\r\n");
	});

	test("leaves Chinese text alone; the BOM is what makes Excel read it", () => {
		const rendered = renderCsvFile(["city"], [["北京"]]);

		expect(rendered.startsWith(UTF8_BOM)).toBe(true);
		expect(rendered).toBe(`${UTF8_BOM}city\r\n北京\r\n`);
	});
});

describe("export naming", () => {
	test("timestamps are local-clock YYYYMMDD-HHmmss", () => {
		const stamp = exportTimestamp(new Date(2026, 2, 4, 9, 5, 7));

		expect(stamp).toBe("20260304-090507");
	});

	test("defaults to <db stem>-<timestamp>.csv", () => {
		expect(defaultExportName("/vault/data/shop.sqlite", new Date(2026, 2, 4, 9, 5, 7))).toBe(
			"shop-20260304-090507.csv",
		);
	});

	test("accepts a hint and appends the extension", () => {
		const checked = sanitizeCsvName("march-report");

		expect(checked).toEqual({ ok: true, name: "march-report.csv" });
	});

	test("keeps an existing .csv extension instead of doubling it", () => {
		expect(sanitizeCsvName("march.csv")).toEqual({ ok: true, name: "march.csv" });
	});

	test("replaces characters that are only illegal on Windows", () => {
		expect(sanitizeCsvName("Q1:A?")).toEqual({ ok: true, name: "Q1-A-.csv" });
	});

	test("refuses anything that could move the write somewhere else", () => {
		for (const hint of ["../escape", "sub/dir/report", "..\\report", "C:report", "\\\\host\\share\\r", ".hidden"]) {
			const checked = sanitizeCsvName(hint);
			expect(checked.ok).toBe(false);
			if (!checked.ok) expect(checked.error.length).toBeGreaterThan(0);
		}
		expect(sanitizeCsvName("   ").ok).toBe(false);
	});

	test("bumps the suffix rather than overwriting", () => {
		const existing = new Set(["report.csv", "report-1.csv"]);

		expect(firstFreeTarget("report.csv", (candidate) => existing.has(candidate))).toBe("report-2.csv");
	});
});

describe("exportSqliteCsv", () => {
	test("writes the grid next to the database and answers with a project-relative path", () => {
		const { source } = makeProject();

		const result = exportDefault({ source, sql: "SELECT name, age FROM people ORDER BY age" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.export.path).toMatch(/^data\/shop-\d{8}-\d{6}\.csv$/);
		expect(result.export.rows).toBe(2);
		expect(result.export.truncated).toBe(false);

		const written = join(root, ...result.export.path.split("/"));
		expect(existsSync(written)).toBe(true);
		const body = readFileSync(written, "utf8");
		expect(body.startsWith(UTF8_BOM)).toBe(true);
		expect(body).toContain("name,age\r\nperson-0,0\r\n");
	});

	test("uses the filename hint when it is safe", () => {
		const { source } = makeProject();

		const result = exportDefault({ source, sql: "SELECT name FROM people", filename: "march-report" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.export.path).toBe("data/march-report.csv");
	});

	test("refuses a filename hint that would leave the directory", () => {
		const { source } = makeProject();

		const result = exportDefault({ source, sql: "SELECT name FROM people", filename: "../escaped" });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(readdirSync(join(root, "data"))).toEqual(["shop.sqlite"]);
	});

	test("never overwrites an existing export", () => {
		const { source } = makeProject();
		expect(exportDefault({ source, sql: "SELECT name FROM people", filename: "same" }).ok).toBe(true);
		expect(exportDefault({ source, sql: "SELECT name FROM people", filename: "same" }).ok).toBe(true);

		expect(readdirSync(join(root, "data"))).toEqual(expect.arrayContaining(["same.csv", "same-1.csv"]));
	});

	test("re-runs every read gate before writing, and creates nothing when one refuses", () => {
		const { source } = makeProject();

		const write = exportDefault({ source, sql: "DROP TABLE people" });
		const stacked = exportDefault({ source, sql: "SELECT 1; SELECT 2" });
		const outside = exportDefault({ source: "../outside/shop.sqlite", sql: "SELECT 1" });
		const missing = exportDefault({ source: "data/nope.sqlite", sql: "SELECT 1" });

		for (const refused of [write, stacked, outside, missing]) {
			expect(refused.ok).toBe(false);
		}
		// The only file that belongs here is still just the database.
		expect(readdirSync(join(root, "data"))).toEqual(["shop.sqlite"]);
	});

	test("reports truncation instead of silently saving a partial file", () => {
		const { source } = makeProject(SQLITE_MAX_ROWS + 20);

		const result = exportDefault({ source, sql: "SELECT name FROM people" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.export.rows).toBe(SQLITE_MAX_ROWS);
		expect(result.export.truncated).toBe(true);
	});
});
