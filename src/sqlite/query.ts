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

export function runSqliteQuery(options: { dbPath: string; sql: string; maxRows?: number }): SqliteQueryResult {
	const requested = options.maxRows ?? SQLITE_MAX_ROWS;
	const maxRows = Math.min(Math.max(Math.trunc(requested), 1), SQLITE_ABS_MAX_ROWS);
	const db = openHandle(options.dbPath);
	const started = performance.now();

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
	};
}
