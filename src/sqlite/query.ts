/**
 * Query execution (doc-16 §4 layer 3, §5.2-§5.3).
 *
 * Two rules govern this file. First, a database is *never* opened for writing: a readonly handle
 * plus `PRAGMA query_only` is the backstop that makes a hole in validation.ts a bug instead of an
 * incident. Second, everything crossing to the client has to be JSON-safe, because a single BIGINT
 * or BLOB in a result set otherwise throws inside `Response.json`.
 */

import { Database } from "bun:sqlite";

/** Result cap. Also the memory guard: there is no pagination, so a bigger answer means a better SQL. */
export const SQLITE_MAX_ROWS = 500;

/** Hard ceiling when a caller asks for more; keeps a hand-written `maxRows` from being a foot-gun. */
const SQLITE_ABS_MAX_ROWS = 5000;

/** An idle handle is closed rather than left holding the file. */
const IDLE_CLOSE_MS = 60_000;

export type SqliteCell = string | number | boolean | null;

export interface SqliteQueryResult {
	columns: string[];
	rows: SqliteCell[][];
	truncated: boolean;
	elapsedMs: number;
	dbPath: string;
	/** True total row count of the underlying statement (the page count derives from this). */
	totalRows: number;
	/** Present only in pagination mode: the 1-based page that was requested. */
	page?: number;
	/** Present only in pagination mode: the page size that was used. */
	pageSize?: number;
	/** Present only in pagination mode: total number of pages. */
	totalPages?: number;
}

interface Handle {
	db: Database;
	timer: ReturnType<typeof setTimeout>;
}

/** One readonly handle per real path, shared by every block pointing at that database. */
const handles = new Map<string, Handle>();

function scheduleClose(path: string): ReturnType<typeof setTimeout> {
	const timer = setTimeout(() => {
		const handle = handles.get(path);
		if (!handle) return;
		handles.delete(path);
		try {
			handle.db.close();
		} catch {
			/* a handle that will not close is not worth failing a render over */
		}
	}, IDLE_CLOSE_MS);
	// Never keep the process alive just to close a database later.
	(timer as unknown as { unref?: () => void }).unref?.();
	return timer;
}

function openHandle(path: string): Database {
	const existing = handles.get(path);
	if (existing) {
		clearTimeout(existing.timer);
		existing.timer = scheduleClose(path);
		return existing.db;
	}
	const db = new Database(path, { readonly: true });
	db.run("PRAGMA query_only = true");
	handles.set(path, { db, timer: scheduleClose(path) });
	return db;
}

/** Tests only: drop every cached handle so a suite does not leak open files between cases. */
export function closeAllSqliteHandles(): void {
	for (const [path, handle] of handles) {
		clearTimeout(handle.timer);
		handles.delete(path);
		try {
			handle.db.close();
		} catch {
			/* ignore */
		}
	}
}

function toCell(value: unknown): SqliteCell {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "boolean") return value;
	// A BIGINT does not survive JSON.stringify; a BLOB is not text at all.
	if (typeof value === "bigint") return value.toString();
	if (value instanceof Uint8Array) return `<blob ${value.byteLength} 字节>`;
	return String(value);
}

export function runSqliteQuery(options: {
	dbPath: string;
	sql: string;
	maxRows?: number;
	/** 1-based page for the pagination browser; when set, the result is a single page, not capped. */
	page?: number;
	/** Rows per page for the pagination browser (default 50). */
	pageSize?: number;
	/**
	 * A pre-opened database to run against instead of `dbPath`. Used by the MDB explorer, which loads
	 * an Access file into an in-memory database and reuses this engine's execution, pagination and
	 * cell coercion verbatim. When set, `dbPath` is used only as the result's `dbPath` label.
	 */
	database?: Database;
}): SqliteQueryResult {
	const db = options.database ?? openHandle(options.dbPath);
	const started = performance.now();

	// Pagination mode: push LIMIT / OFFSET down to the engine via a subquery wrap and count the
	// total separately. Only one page is ever fetched, so this is exempt from the 5000 hard cap —
	// that is why the pagination browser can browse data sets larger than 5000 rows.
	if (options.page !== undefined && options.page >= 1) {
		const pageSize = clamp(options.pageSize ?? 50, 1, 1000);
		const offset = (Math.trunc(options.page) - 1) * pageSize;
		const wrapped = stripSemicolon(options.sql);
		const countRow = db.prepare(`SELECT COUNT(*) AS _c FROM (${wrapped}) AS _p`).get() as { _c: number };
		const totalRows = Number(countRow?._c ?? 0);

		const statement = db.prepare(`SELECT * FROM (${wrapped}) AS _p LIMIT ${pageSize} OFFSET ${offset}`);
		const records = statement.all() as Record<string, unknown>[];
		const declared = (statement as { columnNames?: string[] }).columnNames;
		const firstRecord = records[0];
		const columns = declared && declared.length > 0 ? declared : firstRecord ? Object.keys(firstRecord) : [];
		const rows = records.map((record) => columns.map((column) => toCell(record[column])));

		return {
			columns,
			rows,
			truncated: false,
			elapsedMs: Math.round(performance.now() - started),
			dbPath: options.dbPath,
			totalRows,
			page: Math.trunc(options.page),
			pageSize,
			totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
		};
	}

	// Preview mode: materialise the whole result and keep only `maxRows`, hard-capped at 5000.
	const requested = options.maxRows ?? SQLITE_MAX_ROWS;
	const maxRows = clamp(requested, 1, SQLITE_ABS_MAX_ROWS);
	const statement = db.prepare(options.sql);
	const records = statement.all() as Record<string, unknown>[];
	const declared = (statement as { columnNames?: string[] }).columnNames;
	const firstRecord = records[0];
	const columns = declared && declared.length > 0 ? declared : firstRecord ? Object.keys(firstRecord) : [];
	const truncated = records.length > maxRows;
	const rows = records.slice(0, maxRows).map((record) => columns.map((column) => toCell(record[column])));

	return {
		columns,
		rows,
		truncated,
		elapsedMs: Math.round(performance.now() - started),
		dbPath: options.dbPath,
		totalRows: records.length,
	};
}

/** Clamps `value` to [min, max] after truncating to an integer. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.trunc(value), min), max);
}

/** Removes a single trailing statement terminator so the SQL can be wrapped in a subquery. */
function stripSemicolon(sql: string): string {
	return sql.replace(/;\s*$/, "");
}
