import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { defaultExportName, exportTimestamp, renderCsvFile, rowsToCsv, UTF8_BOM } from "../sqlite/csv.ts";
import { buildSqliteCsv } from "../sqlite/export.ts";
import { closeAllSqliteHandles, SQLITE_MAX_ROWS } from "../sqlite/query.ts";

setDefaultTimeout(60_000);

let root: string;

// Same warm-up as src/test/sqlite.test.ts: opening the first SQLite file of a process costs far
// more than the next ones, and Windows hands that bill to whichever test happens to be running.
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

/** A database under `<root>/data/shop.sqlite`. */
function makeProject(rows = 2): { source: string } {
	mkdirSync(join(root, "data"), { recursive: true });
	makeDb(join(root, "data", "shop.sqlite"), rows);
	return { source: relative(root, join(root, "data", "shop.sqlite")).replace(/\\/g, "/") };
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

	test("keeps the bare stem when there is no sqlite extension", () => {
		expect(defaultExportName("plain", new Date(2026, 2, 4, 9, 5, 7))).toBe("plain-20260304-090507.csv");
	});
});

describe("buildSqliteCsv", () => {
	test("returns the BOM'd body and a suggested name, not a path", () => {
		const { source } = makeProject();

		const result = buildSqliteCsv({ projectRoot: root, source, sql: "SELECT name, age FROM people ORDER BY age" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.csv.filename).toMatch(/^shop-\d{8}-\d{6}\.csv$/);
		expect(result.csv.rows).toBe(2);
		expect(result.csv.truncated).toBe(false);
		expect(result.csv.csv.startsWith(UTF8_BOM)).toBe(true);
		expect(result.csv.csv).toContain("name,age\r\nperson-0,0\r\n");
	});

	test("re-runs every read gate and refuses the same things a render refuses", () => {
		const { source } = makeProject();

		const write = buildSqliteCsv({ projectRoot: root, source, sql: "DROP TABLE people" });
		const stacked = buildSqliteCsv({ projectRoot: root, source, sql: "SELECT 1; SELECT 2" });
		const outside = buildSqliteCsv({ projectRoot: root, source: "../outside/shop.sqlite", sql: "SELECT 1" });
		const missing = buildSqliteCsv({ projectRoot: root, source: "data/nope.sqlite", sql: "SELECT 1" });

		for (const refused of [write, stacked, outside, missing]) {
			expect(refused.ok).toBe(false);
		}
	});

	test("reports truncation instead of silently dropping rows", () => {
		const { source } = makeProject(SQLITE_MAX_ROWS + 20);

		const result = buildSqliteCsv({ projectRoot: root, source, sql: "SELECT name FROM people" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.csv.rows).toBe(SQLITE_MAX_ROWS);
		expect(result.csv.truncated).toBe(true);
	});

	test("the exported body is BOM'd and row-for-row what the query returned", () => {
		const { source } = makeProject();
		const result = buildSqliteCsv({ projectRoot: root, source, sql: "SELECT name, age FROM people ORDER BY age" });
		if (!result.ok) throw new Error("expected ok");

		// The export reuses renderCsvFile, so asserting the shape here also pins the serialiser.
		expect(result.csv.csv).toBe(
			renderCsvFile(
				["name", "age"],
				[
					["person-0", 0],
					["person-1", 1],
				],
			),
		);
	});
});
