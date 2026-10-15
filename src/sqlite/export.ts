/**
 * Builds a CSV export of one read-only statement for the browser to save where it chooses.
 *
 * The one rule here is unchanged from the original write-to-disk design: nothing about the *rows*
 * travels from the client. The caller hands over the same two strings a `sqlite-query` block
 * already sends - `source` and `sql` - and this module re-runs both server-side gates and
 * re-executes the statement itself before serialising. The browser then writes the returned text
 * through the File System Access API (or a download), so the destination is the user's, never
 * something decided server-side.
 */

import { defaultExportName, renderCsvFile } from "./csv.ts";
import { resolveSqliteSource } from "./paths.ts";
import { runSqliteQuery, SQLITE_MAX_ROWS } from "./query.ts";
import { validateReadOnlySql } from "./validation.ts";

export interface SqliteCsvPayload {
	/** A suggested filename for the save dialog - `<db stem>-<timestamp>.csv`. */
	filename: string;
	/** The complete file body: UTF-8 BOM plus the rows. Ready to hand to a writable stream. */
	csv: string;
	rows: number;
	truncated: boolean;
}

export type SqliteCsvResult = { ok: true; csv: SqliteCsvPayload } | { ok: false; error: string };

function fail(error: string): SqliteCsvResult {
	return { ok: false, error };
}

export function buildSqliteCsv(options: {
	projectRoot: string;
	/** Project-relative database path, exactly as written in the block. */
	source: string;
	sql: string;
	/** Preview row cap; defaults to {@link SQLITE_MAX_ROWS} and is hard-capped at 5000. */
	maxRows?: number;
}): SqliteCsvResult {
	// Gate 1: read-only SQL, re-validated rather than trusted.
	const validated = validateReadOnlySql(options.sql);
	if (!validated.ok) return fail(validated.error);

	// Gate 2: the four containment gates, exactly as a plain query gets.
	const resolved = resolveSqliteSource({ projectRoot: options.projectRoot, source: options.source });
	if (!resolved.ok) return fail(resolved.error);

	// Gate 3 is the engine itself: a readonly handle plus PRAGMA query_only, so even a validation
	// hole cannot turn an export into a write statement against the database. The export is a
	// preview (not a single page), so its cap comes from config (`queryMaxRows`) when supplied.
	const maxRows = Math.min(Math.max(Math.trunc(options.maxRows ?? SQLITE_MAX_ROWS), 1), 5000);
	const result = runSqliteQuery({ dbPath: resolved.path, sql: validated.sql, maxRows });

	return {
		ok: true,
		csv: {
			filename: defaultExportName(resolved.path),
			csv: renderCsvFile(result.columns, result.rows),
			rows: result.rows.length,
			truncated: result.truncated,
		},
	};
}
