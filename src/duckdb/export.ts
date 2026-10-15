/**
 * Builds a CSV export of one read-only DuckDB statement for the browser to save where it chooses.
 *
 * Mirrors sqlite/export.ts and reuses the same CSV serialisation, read-only SQL validation and
 * containment gates. The one rule is unchanged: nothing about the *rows* travels from the client -
 * the caller hands over the same two strings a `duckdb-query` block already sends (`source` and
 * `sql`), this module re-gates and re-runs them server-side, then hands the text back with a
 * suggested filename. The destination is the user's, never something decided server-side.
 */

import { defaultExportName, renderCsvFile } from "../sqlite/csv.ts";
import { validateReadOnlySql } from "../sqlite/validation.ts";
import { resolveDuckdbSource } from "./paths.ts";
import { DUCKDB_MAX_ROWS, runDuckdbQuery } from "./query.ts";

export interface DuckdbCsvPayload {
	/** A suggested filename for the save dialog - `<db stem>-<timestamp>.csv`. */
	filename: string;
	/** The complete file body: UTF-8 BOM plus the rows. Ready to hand to a writable stream. */
	csv: string;
	rows: number;
	truncated: boolean;
}

export type DuckdbCsvResult = { ok: true; csv: DuckdbCsvPayload } | { ok: false; error: string };

function fail(error: string): DuckdbCsvResult {
	return { ok: false, error };
}

export async function buildDuckdbCsv(options: {
	projectRoot: string;
	/** Project-relative database path, exactly as written in the block. */
	source: string;
	sql: string;
	/** Preview row cap; defaults to {@link DUCKDB_MAX_ROWS} and is hard-capped at 5000. */
	maxRows?: number;
}): Promise<DuckdbCsvResult> {
	// Gate 1: read-only SQL, re-validated rather than trusted.
	const validated = validateReadOnlySql(options.sql);
	if (!validated.ok) return fail(validated.error);

	// Gate 2: the four containment gates, exactly as a plain query gets.
	const resolved = resolveDuckdbSource({ projectRoot: options.projectRoot, source: options.source });
	if (!resolved.ok) return fail(resolved.error);

	// Gate 3 is the engine itself: a read-only instance, so even a validation hole cannot turn an
	// export into a write statement against the database. The export is a preview (not a single
	// page), so its cap comes from config (`queryMaxRows`) when supplied.
	const maxRows = Math.min(Math.max(Math.trunc(options.maxRows ?? DUCKDB_MAX_ROWS), 1), 5000);
	const result = await runDuckdbQuery({
		dbPath: resolved.path,
		kind: resolved.kind,
		sql: validated.sql,
		maxRows,
	});

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
