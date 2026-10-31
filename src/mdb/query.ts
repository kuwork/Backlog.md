/**
 * MDB (Access) live query execution.
 *
 * An `.mdb` is not a SQL engine: it is a collection of tables. To give `mdb-query` blocks the same
 * SQL surface as `sqlite-query` / `duckdb-query`, the file is read with `mdb-reader` and loaded into
 * an in-memory `bun:sqlite` database; the user's statement is then run through {@link runSqliteQuery},
 * so the grid, pagination, cell coercion and `toCell` JSON-safety come for free. The in-memory copy
 * is `PRAGMA query_only`-guarded, so a block can never write the original file.
 *
 * Trade-off: the whole file is materialised in memory (the MDB converter does the same for export).
 * That keeps the SQL path honest — joins across tables work — at the cost of memory for very large
 * databases, which is acceptable for an interactive query block.
 */

import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import MDB from "mdb-reader";
import { runSqliteQuery, type SqliteCell, type SqliteQueryResult } from "../sqlite/query.ts";

/** Result cap. Also the memory guard: a bigger answer means a better SQL (mirrors SQLite). */
export const MDB_MAX_ROWS = 500;

/** Hard ceiling when a caller asks for more; keeps a hand-written `maxRows` from being a foot-gun. */
const MDB_ABS_MAX_ROWS = 5000;

export type MdbCell = SqliteCell;

/** The grid is byte-for-byte the shared `SqliteQueryResult` shape (cells are already coerced). */
export type MdbQueryResult = SqliteQueryResult;

/** Maps a declared MDB column type to a SQLite affinity. Anything unrecognised becomes TEXT. */
function affinityFor(type: string): "INTEGER" | "REAL" | "TEXT" {
	switch (type) {
		case "long":
		case "integer":
		case "byte":
		case "boolean":
		case "autolong":
			return "INTEGER";
		case "double":
		case "float":
		case "single":
		case "currency":
		case "numeric":
		case "decimal":
			return "REAL";
		default:
			// text, memo, ole (binary), repid (GUID), datetime, guid, hyperlink, …
			return "TEXT";
	}
}

/**
 * mdb-reader 把 Jet 文本列按 latin1 逐字节还原成字符（数据库代码页，中文多为 GBK/CP936），
 * 这里再按 GBK 还原成真正的文本，与离线转换器 `MDB转Excel离线转换器.html` 的 `decodeText` 一致。
 * 仅当字符串含高位字节（0x80–0xFF）才尝试，纯 ASCII 原样返回；解码后若替换符过多
 * （编码不匹配）则保留原值，避免误伤 CP1252 或已正确解码的 UTF-16 文本。
 */
function decodeMdbText(value: string): string {
	if (!/[\u0080-\u00ff]/.test(value)) return value;
	const bytes = new Uint8Array(value.length);
	for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
	const out = new TextDecoder("gbk").decode(bytes);
	const bad = (out.match(/\ufffd/g) || []).length;
	if (bad > 0 && bad >= Math.ceil(out.length / 4)) return value;
	return out;
}

/** Coerces one mdb-reader value into a JSON-safe SQLite bindable value. */
function toSqliteValue(value: unknown): SqliteCell {
	if (value === null || value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "string") return decodeMdbText(value);
	if (typeof value === "bigint") return value.toString();
	// mdb-reader returns binary columns (OLE) as a Node Buffer (a Uint8Array subclass).
	if (value instanceof Uint8Array) return `<blob ${value.byteLength} 字节>`;
	if (typeof value === "object" && value !== null && (value as { type?: unknown }).type === "Buffer") {
		const data = (value as { data?: number[] }).data;
		return `<blob ${data?.length ?? 0} 字节>`;
	}
	return String(value);
}

/** Escapes an identifier for quoting in SQL (`"` → `""`). */
function escapeIdent(name: string): string {
	return name.replace(/"/g, '""');
}

/**
 * Reads `path` (an `.mdb` / `.accdb`) and returns a fresh in-memory SQLite database with one table per
 * MDB table, rows already inserted. A table that fails to load is skipped (logged) so one corrupt
 * table does not block queries against the rest. The database is left `query_only` for safety.
 */
export function createMdbDatabase(path: string): Database {
	const db = new MDB(readFileSync(path));
	const mem = new Database(":memory:");
	try {
		const tableNames = db.getTableNames();
		for (const name of tableNames) {
			const table = db.getTable(name);
			const columns = table.getColumns();
			if (columns.length === 0) continue;
			const definitions = columns
				.map((column) => `"${escapeIdent(column.name)}" ${affinityFor(column.type ?? "text")}`)
				.join(", ");
			mem.run(`CREATE TABLE "${escapeIdent(name)}" (${definitions})`);
			const columnNames = columns.map((column) => column.name);
			const insert = mem.prepare(
				`INSERT INTO "${escapeIdent(name)}" VALUES (${columnNames.map(() => "?").join(", ")})`,
			);
			try {
				const rows = table.getData();
				for (const row of rows) {
					insert.run(...columnNames.map((columnName) => toSqliteValue((row as Record<string, unknown>)[columnName])));
				}
			} catch (error) {
				// A single unreadable table (e.g. an unsupported complex type) must not sink the query.
				console.warn(
					`mdb: skipped table "${name}" (${path}): ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
		mem.run("PRAGMA query_only = true");
		return mem;
	} catch (error) {
		mem.close();
		throw error;
	}
}

export function runMdbQuery(options: {
	dbPath: string;
	sql: string;
	maxRows?: number;
	/** 1-based page for the pagination browser; when set, the result is a single page, not capped. */
	page?: number;
	/** Rows per page for the pagination browser (default 50). */
	pageSize?: number;
}): MdbQueryResult {
	const mem = createMdbDatabase(options.dbPath);
	try {
		const requested = options.maxRows ?? MDB_MAX_ROWS;
		const maxRows = Math.min(Math.max(Math.trunc(requested), 1), MDB_ABS_MAX_ROWS);
		return runSqliteQuery({
			dbPath: options.dbPath,
			sql: options.sql,
			maxRows,
			page: options.page,
			pageSize: options.pageSize,
			database: mem,
		});
	} finally {
		mem.close();
	}
}
