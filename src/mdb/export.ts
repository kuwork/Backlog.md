/**
 * Builds a CSV export of one read-only statement for the browser to save where it chooses.
 *
 * Mirrors sqlite/export.ts: the caller hands over the same two strings an `mdb-query` block already
 * sends - `source` and `sql` - and this module re-runs both server-side gates and re-executes the
 * statement itself before serialising. The browser then writes the returned text through the File
 * System Access API (or a download), so the destination is the user's, never decided server-side.
 */

import { defaultExportName, renderCsvFile } from "../sqlite/csv.ts";
import { validateReadOnlySql } from "../sqlite/validation.ts";
import { resolveMdbSource } from "./paths.ts";
import { MDB_MAX_ROWS, runMdbQuery } from "./query.ts";

export interface MdbCsvPayload {
	/** A suggested filename for the save dialog - `<db stem>-<timestamp>.csv`. */
	filename: string;
	/** The complete file body: UTF-8 BOM plus the rows. Ready to hand to a writable stream. */
	csv: string;
	rows: number;
	truncated: boolean;
}

export type MdbCsvResult = { ok: true; csv: MdbCsvPayload } | { ok: false; error: string };

function fail(error: string): MdbCsvResult {
	return { ok: false, error };
}

export function buildMdbCsv(options: {
	projectRoot: string;
	/** Project-relative database path, exactly as written in the block. */
	source: string;
	sql: string;
	/** Preview row cap; defaults to {@link MDB_MAX_ROWS} and is hard-capped at 5000. */
	maxRows?: number;
}): MdbCsvResult {
	// Gate 1: read-only SQL, re-validated rather than trusted.
	const validated = validateReadOnlySql(options.sql);
	if (!validated.ok) return fail(validated.error);

	// Gate 2: the four containment gates, exactly as a plain query gets.
	const resolved = resolveMdbSource({ projectRoot: options.projectRoot, source: options.source });
	if (!resolved.ok) return fail(resolved.error);

	// Gate 3 is the engine itself: an in-memory `query_only` database, so even a validation hole
	// cannot turn an export into a write statement against anything on disk.
	const maxRows = Math.min(Math.max(Math.trunc(options.maxRows ?? MDB_MAX_ROWS), 1), 5000);
	const result = runMdbQuery({ dbPath: resolved.path, sql: validated.sql, maxRows });

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
