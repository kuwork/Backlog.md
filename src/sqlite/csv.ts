/**
 * CSV serialisation and export-target naming (BACK-776).
 *
 * Two decisions are baked in here rather than left to the caller:
 *
 * 1. RFC 4180 quoting plus CRLF plus a UTF-8 BOM. The BOM is not decoration: Excel on Windows
 *    reads an unbommed UTF-8 file as the local codepage, which turns every Chinese cell into
 *    mojibake, and this tool's own databases are full of Chinese.
 * 2. A client-supplied filename is *reduced to a bare safe name* rather than repaired silently.
 *    Anything structural - separators, drive letters, `..`, a leading dot, control characters - is
 *    refused with a reason; only cosmetic Windows-illegal characters get replaced.
 */

import type { SqliteCell } from "./query.ts";

export const CSV_EXTENSION = ".csv";

/** Excel needs this at the head of the file to read UTF-8 rather than the local codepage. */
export const UTF8_BOM = "﻿";

const DEFAULT_MAX_FREE_ATTEMPTS = 1000;

/** Every leading sqlite extension this module strips before appending `.csv`. */
const SQLITE_EXTENSIONS = [".sqlite", ".sqlite3", ".db"] as const;

/** Characters that are merely illegal in a Windows filename, i.e. cosmetic rather than structural. */
const WINDOWS_ILLEGAL = /[<>:"|?*]/g;

/** Control characters break every filesystem differently, so they are refused rather than mapped. */
const CONTROL_CHARACTERS = /\p{Cc}/u;

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

/** The file body as written to disk - quoted rows behind the BOM Excel needs. */
export function renderCsvFile(columns: readonly string[], rows: readonly (readonly SqliteCell[])[]): string {
	return `${UTF8_BOM}${rowsToCsv(columns, rows)}`;
}

/** Local-time `YYYYMMDD-HHmmss`; local because that is the clock next to the file being written. */
export function exportTimestamp(now = new Date()): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `${day}-${time}`;
}

/** `<db basename>-<timestamp>.csv`: the default name of an export sitting next to its database. */
export function defaultExportName(dbPath: string, now = new Date()): string {
	const base = dbPath.split(/[\\/]/).pop() ?? "export";
	const lower = base.toLowerCase();
	const extension = SQLITE_EXTENSIONS.find((candidate) => lower.endsWith(candidate));
	const stem = extension ? base.slice(0, base.length - extension.length) : base;
	return `${stem || "export"}-${exportTimestamp(now)}${CSV_EXTENSION}`;
}

export type CsvNameCheck = { ok: true; name: string } | { ok: false; error: string };

function failName(error: string): CsvNameCheck {
	return { ok: false, error };
}

/**
 * Accepts a hint like `march-report` and returns a name that cannot move the write anywhere else.
 *
 * Refusals rather than rewrites for anything that changes location (a separator would mean a
 * subdirectory, `..` would mean escaping, a leading dot means a dot-file); characters that are only
 * illegal on Windows are replaced, because rejecting a file called `Q1:A` would be pedantry.
 */
export function sanitizeCsvName(raw: string): CsvNameCheck {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return failName("文件名不能为空。");
	if (/[\\/]/.test(trimmed)) return failName("文件名不能包含路径分隔符。");
	if (/^[A-Za-z]:/.test(trimmed) || trimmed.startsWith("\\\\")) {
		return failName("文件名不能是盘符或 UNC 路径。");
	}
	if (trimmed === "." || trimmed === ".." || trimmed.includes("..")) {
		return failName("文件名不能包含 ..。");
	}
	if (trimmed.startsWith(".")) return failName("文件名不能以点开头。");
	if (CONTROL_CHARACTERS.test(trimmed)) return failName("文件名不能包含控制字符。");

	const cleaned = trimmed.replace(WINDOWS_ILLEGAL, "-").replace(/\s+/g, " ").trim();
	if (cleaned.length === 0) return failName("文件名清洗后为空，请换一个名字。");
	const name = cleaned.toLowerCase().endsWith(CSV_EXTENSION) ? cleaned : `${cleaned}${CSV_EXTENSION}`;
	return { ok: true, name };
}

/**
 * First free `<stem>-<n><ext>` name, so an export never overwrites the previous one: two blocks
 * pointing at the same database would otherwise overwrite each other's file within the same second.
 */
export function firstFreeTarget(target: string, exists: (path: string) => boolean): string {
	if (!exists(target)) return target;
	const extension = target.toLowerCase().endsWith(CSV_EXTENSION) ? CSV_EXTENSION : "";
	const stem = extension ? target.slice(0, target.length - extension.length) : target;
	for (let attempt = 1; attempt <= DEFAULT_MAX_FREE_ATTEMPTS; attempt++) {
		const candidate = `${stem}-${attempt}${extension}`;
		if (!exists(candidate)) return candidate;
	}
	return `${stem}-${Date.now()}${extension}`;
}
