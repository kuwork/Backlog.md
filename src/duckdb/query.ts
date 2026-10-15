/**
 * Query execution for DuckDB (doc-16 §4 layer 3, §5.2-§5.3; mirrors sqlite/query.ts).
 *
 * A DuckDB database is never opened for writing: the instance is created with `access_mode:
 * READ_ONLY`, which makes the engine itself reject any mutating statement, so a hole in validation
 * is a bug instead of an incident. Everything crossing to the client has to be JSON-safe, so `toCell`
 * coerces BIGINT, DECIMAL, TIMESTAMP, DATE and BLOB into the same `SqliteCell` union the SQLite
 * explorer already serialises and prints.
 */

import { DuckDBInstance } from "@duckdb/node-api";
import type { SqliteCell } from "../sqlite/query.ts";
import type { DuckdbSourceKind } from "./paths.ts";
import { resolveDuckdbWriteTarget } from "./paths.ts";

/** Result cap. Also the memory guard: there is no pagination, so a bigger answer means a better SQL. */
export const DUCKDB_MAX_ROWS = 500;

/** Hard ceiling when a caller asks for more; keeps a hand-written `maxRows` from being a foot-gun. */
const DUCKDB_ABS_MAX_ROWS = 5000;

export type DuckdbCell = SqliteCell;

export interface DuckdbQueryResult {
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
	/** Project-relative path of the file written by a `copy_to` target, when one was requested. */
	writtenTo?: string;
}

/**
 * Formats a DuckDB DECIMAL as a plain decimal string. `value` is the unscaled bigint (units of
 * 10^-scale), so `3.140` arrives here as `3140n` with `scale: 3`.
 */
function decimalToString(value: bigint, scale: number): string {
	const negative = value < 0n;
	const abs = negative ? -value : value;
	const digits = abs.toString().padStart(scale + 1, "0");
	const intPart = digits.slice(0, digits.length - scale);
	const fracPart = scale > 0 ? digits.slice(digits.length - scale) : "";
	const out = fracPart ? `${intPart}.${fracPart}` : intPart;
	return negative ? `-${out}` : out;
}

/**
 * Coerces one DuckDB value into the JSON-safe `SqliteCell` union. DuckDB's `getRowObjects()` returns
 * wrapper objects for the non-primitive types, keyed by a tell-tale property, so the dispatch is by
 * shape rather than by importing the (version-sensitive) value classes.
 */
function toCell(value: unknown): SqliteCell {
	if (value === null || value === undefined) return null;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "string") return value;
	if (typeof value === "bigint") return value.toString();
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if ("micros" in obj) return new Date(Number(obj.micros) / 1000).toISOString();
		if ("days" in obj) return new Date((obj.days as number) * 86400000).toISOString().slice(0, 10);
		if ("bytes" in obj) {
			const bytes = obj.bytes as Uint8Array | { byteLength?: number };
			const length = bytes instanceof Uint8Array ? bytes.byteLength : (bytes.byteLength ?? 0);
			return `<blob ${length} 字节>`;
		}
		if ("value" in obj && "scale" in obj) {
			return decimalToString(BigInt(obj.value as string | bigint), Number(obj.scale));
		}
	}
	return String(value);
}

export async function runDuckdbQuery(options: {
	dbPath: string;
	/** How the source was resolved: a real database is attached read-only, a data file runs on `:memory:`. */
	kind: DuckdbSourceKind;
	sql: string;
	maxRows?: number;
	/** 1-based page for the pagination browser; when set, the result is a single page, not capped. */
	page?: number;
	/** Rows per page for the pagination browser (default 50). */
	pageSize?: number;
	/** Optional write target (project-relative `.csv` / `.xlsx`). When set, the result is also copied out. */
	copyTo?: string;
	/** Project root, needed only to gate a `copyTo` target. */
	projectRoot?: string;
}): Promise<DuckdbQueryResult> {
	const started = performance.now();

	// A `.duckdb` source is attached read-only so the engine rejects any mutation; a CSV / XLSX data
	// file opens an in-memory instance and the SQL's bare path is resolved by the engine's
	// replacement scan (plus autoload of the official `excel` extension for xlsx).
	const instance = await DuckDBInstance.create(
		options.kind === "database" ? options.dbPath : ":memory:",
		options.kind === "database" ? { access_mode: "READ_ONLY" } : undefined,
	);
	let connection: Awaited<ReturnType<typeof instance.connect>> | null = null;
	try {
		connection = await instance.connect();

		// Pagination mode: push LIMIT / OFFSET down to the engine via a subquery wrap and count the
		// total separately. Only one page is fetched per request, so this is exempt from the 5000
		// hard cap — the pagination browser can browse data sets larger than 5000 rows.
		if (options.page !== undefined && options.page >= 1) {
			const pageSize = clamp(options.pageSize ?? 50, 1, 1000);
			const offset = (Math.trunc(options.page) - 1) * pageSize;
			const wrapped = stripSemicolon(options.sql);
			const countReader = await runWithExtensionGuard(
				connection,
				options.kind,
				`SELECT COUNT(*) AS _c FROM (${wrapped}) AS _p`,
			);
			const countRows = countReader.getRowObjects();
			const totalRows = Number(countRows[0]?.["_c"] ?? 0);

			const reader = await runWithExtensionGuard(
				connection,
				options.kind,
				`SELECT * FROM (${wrapped}) AS _p LIMIT ${pageSize} OFFSET ${offset}`,
			);
			const columns = reader.columnNames();
			const records = reader.getRowObjects();
			const rows = records.map((record) =>
				columns.map((column) => toCell((record as Record<string, unknown>)[column])),
			);

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
		const requested = options.maxRows ?? DUCKDB_MAX_ROWS;
		const maxRows = clamp(requested, 1, DUCKDB_ABS_MAX_ROWS);
		const reader = await runWithExtensionGuard(connection, options.kind, options.sql);
		const columns = reader.columnNames();
		const records = reader.getRowObjects();
		const truncated = records.length > maxRows;
		const rows = records
			.slice(0, maxRows)
			.map((record) => columns.map((column) => toCell((record as Record<string, unknown>)[column])));

		// Optional write path: copy the result set out to a gated project file. It runs on the same
		// instance, so it inherits the read-only guarantee for `.duckdb` sources (a `COPY ... TO`
		// writes a separate file and is allowed even on a read-only database handle). Only the
		// preview (non-paginated) result is written.
		let writtenTo: string | undefined;
		const copyTo = options.copyTo;
		const projectRoot = options.projectRoot;
		if (copyTo && projectRoot && options.page === undefined) {
			writtenTo = await runCopyTo(connection, { copyTo, projectRoot, sql: options.sql });
		}

		return {
			columns,
			rows,
			truncated,
			elapsedMs: Math.round(performance.now() - started),
			dbPath: options.dbPath,
			totalRows: records.length,
			writtenTo,
		};
	} finally {
		if (connection) connection.closeSync();
		instance.closeSync();
	}
}

/**
 * Runs the read statement, translating an `excel` extension autoload/autoinstall failure (typically
 * an offline environment with no local cache) into a readable, surfaced error instead of a raw
 * stack trace. Only data-file sources depend on an extension, so `.duckdb` errors pass through.
 */
async function runWithExtensionGuard(
	connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
	kind: DuckdbSourceKind,
	sql: string,
): Promise<Awaited<ReturnType<typeof connection.runAndReadAll>>> {
	try {
		return await connection.runAndReadAll(sql);
	} catch (error) {
		if (kind === "data-file" && isExtensionLoadFailure(error)) {
			throw new Error(
				"无法加载 Excel 扩展（excel）：很可能是离线环境无法下载该扩展。请联网后重试，或确认本地已缓存该扩展。",
			);
		}
		throw error;
	}
}

/** Heuristic: does this error look like the `excel` extension could not be autoloaded / installed? */
function isExtensionLoadFailure(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();
	return (
		/extension/.test(message) &&
		/(install|load|download|autoload|not found|could not|resolve|fetch|connection|network|timeout|unable to)/.test(
			lower,
		)
	);
}

/** Writes the result of `sql` to the gated `copyTo` target and returns its project-relative path. */
async function runCopyTo(
	connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
	options: { copyTo: string; projectRoot: string; sql: string },
): Promise<string> {
	const resolved = resolveDuckdbWriteTarget({ projectRoot: options.projectRoot, target: options.copyTo });
	if (!resolved.ok) throw new Error(resolved.error);

	const lower = options.copyTo.toLowerCase();
	const format = lower.endsWith(".xlsx") ? "FORMAT XLSX, HEADER TRUE" : "FORMAT CSV, HEADER TRUE";
	await connection.run(`COPY (${options.sql}) TO '${resolved.path}' (${format})`);
	return options.copyTo;
}

/** Clamps `value` to [min, max] after truncating to an integer. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(Math.trunc(value), min), max);
}

/** Removes a single trailing statement terminator so the SQL can be wrapped in a subquery. */
function stripSemicolon(sql: string): string {
	return sql.replace(/;\s*$/, "");
}
