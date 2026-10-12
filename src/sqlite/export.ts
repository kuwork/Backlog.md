/**
 * Writes a query result out as a CSV beside its database (BACK-776).
 *
 * The one rule here: nothing about the *rows* travels from the client. The caller hands over the
 * same two strings a `sqlite-query` block already sends - `source` and `sql` - and this module
 * re-runs both server-side gates and re-executes the statement itself before writing anything.
 * That is what keeps an export from growing into "a general file-write endpoint that takes a path",
 * which is a very different thing to secure.
 *
 * Everything that can be refused is refused before the file exists.
 */

import { existsSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { isScanSkippedDir } from "../utils/project-scan.ts";
import { defaultExportName, firstFreeTarget, renderCsvFile, sanitizeCsvName } from "./csv.ts";
import { isInsideProjectRoot, resolveSqliteSource } from "./paths.ts";
import { runSqliteQuery, SQLITE_MAX_ROWS } from "./query.ts";
import { validateReadOnlySql } from "./validation.ts";

export interface SqliteCsvExport {
	/** Where it landed, project-relative with forward slashes - the same shape a `source` takes. */
	path: string;
	rows: number;
	truncated: boolean;
}

export type SqliteCsvExportResult = { ok: true; export: SqliteCsvExport } | { ok: false; error: string };

function fail(error: string): SqliteCsvExportResult {
	return { ok: false, error };
}

export function exportSqliteCsv(options: {
	projectRoot: string;
	/** Project-relative database path, exactly as written in the block. */
	source: string;
	sql: string;
	/** Optional filename hint; sanitised, and defaults to `<db>-<timestamp>.csv`. */
	filename?: string;
}): SqliteCsvExportResult {
	// Gate 1: read-only SQL, re-validated rather than trusted.
	const validated = validateReadOnlySql(options.sql);
	if (!validated.ok) return fail(validated.error);

	// Gate 2: the four containment gates, exactly as a plain query gets.
	const resolved = resolveSqliteSource({ projectRoot: options.projectRoot, source: options.source });
	if (!resolved.ok) return fail(resolved.error);

	let filename: string;
	if (options.filename && options.filename.trim().length > 0) {
		const checked = sanitizeCsvName(options.filename);
		if (!checked.ok) return fail(checked.error);
		filename = checked.name;
	} else {
		filename = defaultExportName(resolved.path);
	}

	// The write lands next to the *real* database - the source may have reached it through a link.
	const root = realpathSync(options.projectRoot);
	const directory = dirname(resolved.path);
	if (!isInsideProjectRoot(root, directory)) {
		return fail("导出目标不在项目目录内，已拒绝。");
	}

	// Gate 3 is the engine itself: a readonly handle plus PRAGMA query_only, so even a validation
	// hole cannot turn an export into a write statement against the database.
	const result = runSqliteQuery({ dbPath: resolved.path, sql: validated.sql, maxRows: SQLITE_MAX_ROWS });

	const target = firstFreeTarget(`${directory}${sep}${filename}`, existsSync);
	if (!isInsideProjectRoot(root, target)) {
		return fail("导出文件名指向项目目录之外，已拒绝。");
	}
	const segments = relative(root, target).split(/[\\/]/);
	for (const segment of segments) {
		if (isScanSkippedDir(segment)) return fail(`导出目标位于被忽略的目录内（${segment}）：${filename}`);
	}

	writeFileSync(target, renderCsvFile(result.columns, result.rows), "utf8");

	return {
		ok: true,
		export: {
			path: relative(root, target).split(sep).join("/"),
			rows: result.rows.length,
			truncated: result.truncated,
		},
	};
}
