/**
 * CSV serialisation and export naming (BACK-776).
 *
 * The one decision baked in here is the file body shape: RFC 4180 quoting plus CRLF plus a UTF-8
 * BOM. The BOM is not decoration - Excel on Windows reads an unbommed UTF-8 file as the local
 * codepage, which turns every Chinese cell into mojibake, and this tool's own databases are full of
 * Chinese. Where the file lands is the browser's choice (File System Access API / download), so the
 * only name this module produces is a *suggestion*, never a path it writes to.
 */

import type { SqliteCell } from "./query.ts";

export const CSV_EXTENSION = ".csv";

/** Excel needs this at the head of the file to read UTF-8 rather than the local codepage. */
export const UTF8_BOM = "﻿";

/** Extensions stripped from a database filename when suggesting a CSV export name. Shared by the SQLite and DuckDB explorers. */
const DB_NAME_EXTENSIONS = [".sqlite", ".sqlite3", ".db", ".duckdb"] as const;

function cellToCsv(cell: SqliteCell): string {
	if (cell === null) return "";
	const text = typeof cell === "string" ? cell : String(cell);
	if (/["\r\n,]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
	return text;
}

/**
 * Serialises a grid as RFC 4180 CSV with CRLF line endings, including a trailing one so a second
 * paste into the file does not merge onto the last row.
 */
export function rowsToCsv(columns: readonly string[], rows: readonly (readonly SqliteCell[])[]): string {
	const lines = [columns.map(cellToCsv).join(",")];
	for (const row of rows) lines.push(row.map(cellToCsv).join(","));
	return `${lines.join("\r\n")}\r\n`;
}

/** The complete file body: quoted rows behind the BOM Excel needs. */
export function renderCsvFile(columns: readonly string[], rows: readonly (readonly SqliteCell[])[]): string {
	return `${UTF8_BOM}${rowsToCsv(columns, rows)}`;
}

/** Local-time `YYYYMMDD-HHmmss`; local because that is the clock on the suggested filename. */
export function exportTimestamp(now = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `${day}-${time}`;
}

/** `<db basename>-<timestamp>.csv`: the suggested name the save dialog opens with. */
export function defaultExportName(dbPath: string, now = new Date()): string {
	const base = dbPath.split(/[\\/]/).pop() ?? "export";
	const lower = base.toLowerCase();
	const extension = DB_NAME_EXTENSIONS.find((candidate) => lower.endsWith(candidate));
	const stem = extension ? base.slice(0, base.length - extension.length) : base;
	return `${stem || "export"}-${exportTimestamp(now)}${CSV_EXTENSION}`;
}
