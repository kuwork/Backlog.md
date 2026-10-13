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
	sql: string;
	maxRows?: number;
}): Promise<DuckdbQueryResult> {
	const requested = options.maxRows ?? DUCKDB_MAX_ROWS;
	const maxRows = Math.min(Math.max(Math.trunc(requested), 1), DUCKDB_ABS_MAX_ROWS);
	const started = performance.now();

	const instance = await DuckDBInstance.create(options.dbPath, { access_mode: "READ_ONLY" });
	let connection: Awaited<ReturnType<typeof instance.connect>> | null = null;
	try {
		connection = await instance.connect();
		const reader = await connection.runAndReadAll(options.sql);
		const columns = reader.columnNames();
		const records = reader.getRowObjects();
		const truncated = records.length > maxRows;
		const rows = records
			.slice(0, maxRows)
			.map((record) => columns.map((column) => toCell((record as Record<string, unknown>)[column])));
		return {
			columns,
			rows,
			truncated,
			elapsedMs: Math.round(performance.now() - started),
			dbPath: options.dbPath,
		};
	} finally {
		if (connection) connection.closeSync();
		instance.closeSync();
	}
}
