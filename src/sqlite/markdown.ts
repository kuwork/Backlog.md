/**
 * Result grid to Markdown table (BACK-775).
 *
 * This lives next to the rest of the sqlite module rather than in `src/web` because it belongs to
 * the same contract as the query engine: whatever `query.ts` hands over is exactly what has to be
 * printable here, including its JSON-safe coercion of BIGINT and BLOB. It imports nothing that runs.
 */

import type { SqliteCell } from "./query.ts";

/**
 * Escapes one cell for a GFM table row.
 *
 * NULL becomes an empty cell rather than the string "NULL": Markdown has no way to grey it out the
 * way the UI does, and a literal NULL pasted into a document is indistinguishable from a real value.
 */
export function cellToMarkdown(cell: SqliteCell): string {
	if (cell === null) return "";
	return escapeCellText(typeof cell === "string" ? cell : String(cell));
}

/** Newlines break a table row in two, so they become `<br>`; a raw pipe would open a new column. */
function escapeCellText(text: string): string {
	return text
		.replace(/[\r\n]+/g, "<br>")
		.replace(/\|/g, "\\|")
		.replace(/[\t]+/g, " ");
}

function rowToMarkdown(cells: readonly SqliteCell[]): string {
	return `| ${cells.map(cellToMarkdown).join(" | ")} |`;
}

/**
 * Serialises a whole result as a GitHub-flavoured Markdown table.
 *
 * An empty but columned result still gets a header row: pasting the header alone is how someone
 * documents the shape of a query that returned nothing yet.
 */
export function resultToMarkdownTable(result: {
	columns: readonly string[];
	rows: readonly (readonly SqliteCell[])[];
}): string {
	if (result.columns.length === 0) return "";
	const header = `| ${result.columns.map((column) => escapeCellText(column)).join(" | ")} |`;
	const delimiter = `| ${result.columns.map(() => "---").join(" | ")} |`;
	const body = result.rows.map(rowToMarkdown);
	return [header, delimiter, ...body].join("\n");
}
