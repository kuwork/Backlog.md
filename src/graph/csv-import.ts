import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { nodeTableDdl, readSnapshotSchema, type SnapshotNodeTable } from "./snapshot.ts";
import type { GraphStore } from "./store.ts";

/**
 * CSV import for a user database (BACK-770).
 *
 * The file is read with node's `fs` and inserted with batched parameterised `UNWIND` - never with
 * ryu's `COPY FROM`, whose WASM build imports **zero** rows without saying so (the same silent
 * failure BACK-766 hit on relationship tables). Reading it ourselves is also what makes a malformed
 * file reportable before a single row is written.
 *
 * Two further constraints shape the code:
 * - A numeric parameter must be passed as text and cast in Cypher. Under Bun's embind a JS number
 *   for an INT64 or DOUBLE parameter throws `TypeError: Invalid argument type in ToBigInt
 *   operation`, and `CAST('abc' AS INT64)` is silent - it yields NULL rather than an error - so
 *   every value is validated here, in JS, and only then handed over.
 * - ryu treats a `$rows` parameter as a LIST<STRUCT> and silently reads a heterogeneous list as
 *   empty, so every row is built with exactly the same keys in exactly the same order.
 */

/** The column types a CSV column can be auto-created with. Anything else reads as STRING. */
export type CsvColumnType = "STRING" | "INT64" | "DOUBLE" | "BOOLEAN";

/** Rows per `UNWIND` batch. One parameterised statement per batch keeps the WASM call small. */
const INSERT_BATCH_SIZE = 500;

export interface CsvColumn {
	/** The property name written into the graph (after `--map`). */
	name: string;
	/** The header it came from in the file, for error messages. */
	source: string;
	type: CsvColumnType;
	primaryKey: boolean;
}

/** A CSV file read into memory and resolved into a target table: everything but the insert itself. */
export interface CsvTableData {
	table: string;
	columns: CsvColumn[];
	/** Data rows, each parallel to `columns`, still raw text. */
	rows: string[][];
}

export interface ReadCsvOptions {
	/** Target node table. Defaults to a name derived from the file name. */
	table?: string;
	/** Whether the first line is a header. Default true. */
	hasHeader?: boolean;
	/** Rename columns: `{ "First Name": "firstName" }`. Values must be valid property names. */
	map?: Record<string, string>;
}

/** A CSV imported as edges rather than nodes. */
export interface CsvRelationOptions {
	/** Relationship table to write into; created with the given endpoints when absent. */
	rel: string;
	/** CSV column holding the source node's key. */
	from: string;
	/** CSV column holding the destination node's key. */
	to: string;
	/** Endpoint node tables, used only when the relationship table does not exist yet. */
	fromNode?: string;
	toNode?: string;
}

export interface CsvRelationResult {
	rel: string;
	fromNode: string;
	toNode: string;
	/** True when the relationship table did not exist and was created. */
	created: boolean;
	/** Edges the database gained. */
	inserted: number;
	/** Rows that produced no edge: an unknown endpoint key, or an edge the pair already had. */
	skipped: number;
}

export interface CsvImportResult {
	table: string;
	/** True when the table did not exist and was auto-created with inferred column types. */
	created: boolean;
	columns: CsvColumn[];
	/** Rows the database gained: keys it had never seen before. */
	inserted: number;
	/** Rows that overwrote a row the database already had (same primary key). */
	updated: number;
	/** Rows whose key repeats an earlier row of the same file - the later one wins. */
	skipped: number;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INT_PATTERN = /^[+-]?\d+$/;
const DOUBLE_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const TRUE_WORDS = new Set(["true", "1", "yes", "y", "t"]);
const FALSE_WORDS = new Set(["false", "0", "no", "n", "f"]);

/**
 * Parse RFC-4180-ish CSV text into records of raw cells. Quoted fields may contain commas,
 * newlines and escaped (`""`) quotes; `\r\n`, `\n` and lone `\r` all end a record. The only hard
 * failure is an unterminated quote, which is reported with its line number - a parse that guessed
 * would silently shift every following column.
 */
export function parseCsvText(text: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let cell = "";
	let quoted = false;
	let line = 1;
	let recordStart = 1;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char !== '"') {
				if (char === "\n") line++;
				cell += char;
				continue;
			}
			if (text[i + 1] === '"') {
				cell += '"';
				i++; // an escaped quote inside a quoted field
				continue;
			}
			quoted = false;
			continue;
		}
		if (char === '"' && cell.length === 0) {
			quoted = true; // opens a field only at field start; a stray quote elsewhere is literal
			continue;
		}
		if (char === ",") {
			record.push(cell);
			cell = "";
			continue;
		}
		if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++; // CRLF is one terminator
			record.push(cell);
			records.push(record);
			record = [];
			cell = "";
			line++;
			recordStart = line;
			continue;
		}
		cell += char;
	}
	if (quoted) throw new Error(`CSV parse failed: the quote opened on line ${recordStart} is never closed.`);
	if (cell.length > 0 || record.length > 0) {
		record.push(cell);
		records.push(record);
	}
	return records.filter((row) => row.some((value) => value.trim().length > 0)); // blank lines are not data
}

/** The narrowest type that every non-empty value in the column fits: INT64, then DOUBLE, then BOOLEAN. */
export function inferColumnType(values: string[]): CsvColumnType {
	let seen = 0;
	let allInt = true;
	let allDouble = true;
	let allBool = true;
	for (const raw of values) {
		const value = raw.trim();
		if (value.length === 0) continue; // an empty cell says nothing about the type
		seen++;
		if (!INT_PATTERN.test(value)) allInt = false;
		if (!DOUBLE_PATTERN.test(value) || !Number.isFinite(Number(value))) allDouble = false;
		if (!TRUE_WORDS.has(value.toLowerCase()) && !FALSE_WORDS.has(value.toLowerCase())) allBool = false;
	}
	if (seen === 0) return "STRING"; // an all-empty column: text, rather than guessing
	if (allInt) return "INT64";
	if (allDouble) return "DOUBLE";
	if (allBool) return "BOOLEAN";
	return "STRING";
}

/**
 * Turn one raw cell into the value the insert statement passes: text for STRING (cast in Cypher for
 * everything else), `null` for an empty non-text cell. Anything the column's type cannot hold is an
 * error that names the line - ryu would otherwise store NULL instead of complaining.
 */
export function coerceCsvValue(raw: string, type: CsvColumnType, column: string, line: number): string | null {
	const value = raw.trim();
	if (value.length === 0) return type === "STRING" ? "" : null;
	switch (type) {
		case "STRING":
			return value;
		case "INT64":
			if (!INT_PATTERN.test(value)) throw csvError(line, column, value, "INT64 integer");
			return value;
		case "DOUBLE":
			if (!DOUBLE_PATTERN.test(value) || !Number.isFinite(Number(value)))
				throw csvError(line, column, value, "DOUBLE number");
			return value;
		case "BOOLEAN": {
			const word = value.toLowerCase();
			if (TRUE_WORDS.has(word)) return "true";
			if (FALSE_WORDS.has(word)) return "false";
			throw csvError(line, column, value, "BOOLEAN (true/false/1/0/yes/no)");
		}
	}
}

function csvError(line: number, column: string, value: string, expected: string): Error {
	return new Error(
		`CSV line ${line}: value "${value}" of column "${column}" is not a valid ${expected}. Fix that row, or use --map to map the column to STRING.`,
	);
}

/** `people.csv` -> `people`, `2024 data.csv` -> `T2024_data`: a usable table name either way. */
export function tableNameFromPath(filePath: string): string {
	const stem = basename(filePath).replace(/\.[^.]+$/, "");
	const sanitized = stem.replace(/[^A-Za-z0-9_]/g, "_");
	return /^[A-Za-z_]/.test(sanitized) ? sanitized : `T${sanitized}`;
}

/**
 * Read a CSV file and resolve it into a target table: header, `--map` renames, column types,
 * everything validated. Nothing here touches a database, so a malformed file is rejected before a
 * store is even opened - which is what keeps "a malformed file leaves the database unchanged" true
 * rather than merely likely.
 */
export function readCsvFile(filePath: string, options: ReadCsvOptions = {}): CsvTableData {
	let text: string;
	try {
		text = readFileSync(filePath, "utf8");
	} catch (error) {
		throw new Error(`Cannot read CSV file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
	}
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // a BOM would become part of the first header
	const records = parseCsvText(text);
	if (records.length === 0) throw new Error(`CSV file "${filePath}" has no parseable content.`);

	const hasHeader = options.hasHeader !== false;
	const headerRow = hasHeader ? records[0] : undefined;
	const dataRows = hasHeader ? records.slice(1) : records;
	if (dataRows.length === 0) throw new Error(`CSV file "${filePath}" has a header but no data rows.`);

	const width = hasHeader ? (headerRow?.length ?? 0) : (dataRows[0]?.length ?? 0);
	for (const [index, row] of dataRows.entries()) {
		if (row.length !== width) {
			throw new Error(
				`CSV line ${index + (hasHeader ? 2 : 1)} has ${row.length} columns, expected ${width} (same as the ${hasHeader ? "header" : "first row"}).`,
			);
		}
	}

	const map = options.map ?? {};
	const columns: CsvColumn[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < width; i++) {
		const source = hasHeader ? (headerRow?.[i] ?? "").trim() : `column${i + 1}`;
		if (hasHeader && source.length === 0)
			throw new Error(`CSV header column ${i + 1} has no name; add one or use --no-header.`);
		// hasOwn, not `map[source]`: a header named "toString" would otherwise pick up a prototype.
		const name = Object.hasOwn(map, source) ? (map[source] ?? source) : source;
		if (!IDENTIFIER.test(name)) {
			throw new Error(
				`Column name "${name}" (from "${source}") is not a valid property name (start with a letter or underscore, then letters, digits and underscores only). Rename it with --map "${source}"=<new name>.`,
			);
		}
		if (seen.has(name))
			throw new Error(`Column name "${name}" is duplicated (conflict after --map); check the header or --map.`);
		seen.add(name);
		columns.push({
			name,
			source,
			type: inferColumnType(dataRows.map((row) => row[i] ?? "")),
			primaryKey: i === 0, // the first column is the key: it is what makes a re-import idempotent
		});
	}

	const table = options.table?.trim() || tableNameFromPath(filePath);
	if (!IDENTIFIER.test(table)) {
		throw new Error(
			`Table name "${table}" is not a valid table name (start with a letter or underscore, then letters, digits and underscores only). Set one with --node <table>.`,
		);
	}
	return { table, columns, rows: dataRows };
}

/** ryu reports a BOOLEAN column as `BOOL`; both mean the same thing here. */
function normalizeType(type: string): CsvColumnType | null {
	const upper = type.toUpperCase();
	if (upper === "STRING") return "STRING";
	if (upper === "INT64" || upper === "INT32") return "INT64";
	if (upper === "DOUBLE" || upper === "FLOAT") return "DOUBLE";
	if (upper === "BOOLEAN" || upper === "BOOL") return "BOOLEAN";
	return null;
}

/**
 * Insert a prepared CSV into a user database. A missing table is created from the inferred column
 * types; an existing one is imported into its declared columns, and a CSV column it does not have is
 * an error rather than a silent drop.
 */
export async function importCsvTable(store: GraphStore, csv: CsvTableData): Promise<CsvImportResult> {
	const existing = (await readSnapshotSchema(store)).nodeTables.find((table) => table.name === csv.table);
	let columns = csv.columns;
	let created = false;
	let primaryKey: string | null = null;
	if (!existing) {
		const declared: SnapshotNodeTable = {
			name: csv.table,
			properties: csv.columns.map((column) => ({
				name: column.name,
				type: column.type,
				primaryKey: column.primaryKey,
			})),
		};
		await store.runWrite(nodeTableDdl(declared));
		created = true;
		primaryKey = columns[0]?.name ?? null; // the first column, see readCsvFile
	} else {
		columns = resolveAgainstExisting(csv, existing);
		primaryKey = existing.properties.find((property) => property.primaryKey)?.name ?? null;
	}
	const before = await countRows(store, csv.table);
	const statement = insertStatement(csv.table, columns, primaryKey);
	const rows: Record<string, string | null>[] = [];
	const keysWithinFile = new Set<string>();
	let skipped = 0;
	csv.rows.forEach((row, index) => {
		const line = index + 2; // line 1 is the header, even with --no-header the offset is harmless
		const record: Record<string, string | null> = {};
		// Every record carries every key, in order: a heterogeneous $rows list is read as empty.
		for (const [i, column] of columns.entries()) {
			record[column.name] = coerceCsvValue(row[i] ?? "", column.type, column.source, line);
		}
		const key = primaryKey ? String(record[primaryKey] ?? "") : "";
		// A newline in the merge key is refused rather than written: ryu's MERGE silently splits such
		// a value into two nodes (measured: `MERGE (n:T {k: "a\nb"})` produced "a" and "b"), and the
		// same value in any other column is stored intact - so the key is the one place it matters.
		if (primaryKey && /[\r\n]/.test(key)) {
			throw new Error(
				`CSV line ${line}: the primary key column "${primaryKey}" contains a newline, which ryu would split into two nodes (silently losing data). Use a key without newlines.`,
			);
		}
		if (primaryKey && keysWithinFile.has(key)) skipped++; // the later row wins, so count it rather than drop it
		keysWithinFile.add(key);
		rows.push(record);
	});
	for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
		await store.runWrite(statement, { rows: rows.slice(start, start + INSERT_BATCH_SIZE) });
	}
	const after = await countRows(store, csv.table);
	const inserted = Math.max(0, after - before);
	return {
		table: csv.table,
		created,
		columns,
		inserted,
		updated: Math.max(0, rows.length - skipped - inserted),
		skipped,
	};
}

/**
 * The one insert statement, built once for the whole file.
 *
 * `MERGE` on the primary key - not `CREATE` - because a `CREATE` batch that hits a duplicate key is
 * dropped **entirely and silently** by ryu: one repeated key would lose every other row in its batch
 * (measured: a batch of two with one duplicate inserted nothing at all). A key the database already
 * had is therefore updated rather than lost, which is also what makes re-importing a corrected file
 * do what one expects. A table with no primary key has nothing to merge on, so it falls back to
 * `CREATE`.
 */
function insertStatement(table: string, columns: CsvColumn[], primaryKey: string | null): string {
	const value = (column: CsvColumn): string =>
		column.type === "STRING" ? `row.\`${column.name}\`` : `CAST(row.\`${column.name}\` AS ${column.type})`;
	const keyColumn = primaryKey ? columns.find((column) => column.name === primaryKey) : undefined;
	if (!keyColumn) {
		const pattern = columns.map((column) => `\`${column.name}\`: ${value(column)}`).join(", ");
		return `UNWIND $rows AS row CREATE (:${table} {${pattern}})`;
	}
	const assignments = columns
		.filter((column) => column.name !== keyColumn.name)
		.map((column) => `n.\`${column.name}\` = ${value(column)}`);
	const merge = `MERGE (n:${table} {\`${keyColumn.name}\`: ${value(keyColumn)}})`;
	return `UNWIND $rows AS row ${merge}${assignments.length > 0 ? ` SET ${assignments.join(", ")}` : ""}`;
}

/**
 * Import a CSV as **edges** instead of nodes: two columns name the endpoints by key, and the
 * relationship table is created when it does not exist yet.
 *
 * Endpoint keys are matched, not created - an edge whose node is missing is skipped by ryu (the
 * `MATCH` simply does not bind), and the count of rows that produced no edge is reported rather than
 * left to be discovered by a query that returns too little. `MERGE` keeps a repeated import from
 * stacking duplicate edges on the same pair.
 */
export async function importCsvRelations(
	store: GraphStore,
	csv: CsvTableData,
	options: CsvRelationOptions,
): Promise<CsvRelationResult> {
	const names = csv.columns.map((column) => column.name);
	const fromIndex = names.indexOf(options.from);
	const toIndex = names.indexOf(options.to);
	for (const [flag, column, index] of [
		["--from", options.from, fromIndex],
		["--to", options.to, toIndex],
	] as const) {
		if (index < 0)
			throw new Error(`${flag} names the column "${column}", which is not in the CSV (columns: ${names.join(", ")}).`);
	}

	const schema = await readSnapshotSchema(store);
	const existing = schema.relTables.find((table) => table.name === options.rel);
	let endpoints: { fromNode: string; toNode: string; fromKey: string; toKey: string; fromType: string; toType: string };
	let created = false;
	if (existing) {
		// The table's own declaration wins: its endpoints and their keys are what the snapshot was
		// built from, so re-linking has to use exactly those.
		if (!existing.fromKey || !existing.toKey) {
			throw new Error(
				`The endpoint tables of relation "${options.rel}" have no primary key, so endpoints cannot be matched by key.`,
			);
		}
		endpoints = {
			fromNode: existing.from,
			toNode: existing.to,
			fromKey: existing.fromKey,
			toKey: existing.toKey,
			fromType: keyType(schema, existing.from, existing.fromKey),
			toType: keyType(schema, existing.to, existing.toKey),
		};
	} else {
		const fromNode = options.fromNode;
		const toNode = options.toNode;
		if (!fromNode || !toNode) {
			throw new Error(
				`Relation "${options.rel}" does not exist yet; set the endpoint node tables with --from-node / --to-node (use --node when both ends share one table).`,
			);
		}
		const fromTable = requireNodeTable(schema, fromNode, options.rel);
		const toTable = requireNodeTable(schema, toNode, options.rel);
		const fromKey = primaryKeyOf(fromTable);
		const toKey = primaryKeyOf(toTable);
		endpoints = {
			fromNode,
			toNode,
			fromKey,
			toKey,
			fromType: keyType(schema, fromNode, fromKey),
			toType: keyType(schema, toNode, toKey),
		};
		await store.runWrite(`CREATE REL TABLE IF NOT EXISTS ${options.rel}(FROM ${fromNode} TO ${toNode})`);
		created = true;
	}

	const bind = (column: string, type: string): string =>
		type.toUpperCase() === "STRING" ? `row.\`${column}\`` : `CAST(row.\`${column}\` AS ${type})`;
	const statement =
		"UNWIND $rows AS row " +
		`MATCH (a:${endpoints.fromNode} {\`${endpoints.fromKey}\`: ${bind(options.from, endpoints.fromType)}}), ` +
		`(b:${endpoints.toNode} {\`${endpoints.toKey}\`: ${bind(options.to, endpoints.toType)}}) ` +
		`MERGE (a)-[:${options.rel}]->(b)`;
	const rows = csv.rows.map((row) => ({
		[options.from]: row[fromIndex] ?? "",
		[options.to]: row[toIndex] ?? "",
	}));

	const before = await countEdges(store, options.rel, endpoints.fromNode, endpoints.toNode);
	for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
		await store.runWrite(statement, { rows: rows.slice(start, start + INSERT_BATCH_SIZE) });
	}
	const after = await countEdges(store, options.rel, endpoints.fromNode, endpoints.toNode);
	const inserted = Math.max(0, after - before);
	return {
		rel: options.rel,
		fromNode: endpoints.fromNode,
		toNode: endpoints.toNode,
		created,
		inserted,
		// A row that produced no edge: an endpoint key the database does not have, or an edge this
		// pair already carries. ryu skips both silently, so they are counted here instead.
		skipped: Math.max(0, rows.length - inserted),
	};
}

function requireNodeTable(schema: { nodeTables: SnapshotNodeTable[] }, name: string, rel: string): SnapshotNodeTable {
	const table = schema.nodeTables.find((candidate) => candidate.name === name);
	if (!table) {
		throw new Error(
			`Node table "${name}" does not exist, so the edges of "${rel}" cannot be imported. Import the nodes first: backlog graph import <db> <csv> --node ${name}`,
		);
	}
	return table;
}

function primaryKeyOf(table: SnapshotNodeTable): string {
	const key = table.properties.find((property) => property.primaryKey)?.name;
	if (!key) {
		throw new Error(
			`Node table "${table.name}" has no primary key, so it cannot be an edge endpoint (endpoints are matched by key).`,
		);
	}
	return key;
}

function keyType(schema: { nodeTables: SnapshotNodeTable[] }, table: string, key: string): string {
	return (
		schema.nodeTables.find((candidate) => candidate.name === table)?.properties.find((p) => p.name === key)?.type ??
		"STRING"
	);
}

async function countEdges(store: GraphStore, rel: string, fromNode: string, toNode: string): Promise<number> {
	const result = await store.runCypher(`MATCH (a:${fromNode})-[e:${rel}]->(b:${toNode}) RETURN count(e)`);
	return Number(result.rows[0]?.[0] ?? 0);
}

/** Fit the CSV's columns onto a table that already exists, or say exactly why it cannot be done. */
function resolveAgainstExisting(csv: CsvTableData, existing: SnapshotNodeTable): CsvColumn[] {
	const declared = new Map(existing.properties.map((property) => [property.name, property]));
	const unknown = csv.columns.filter((column) => !declared.has(column.name));
	if (unknown.length > 0) {
		throw new Error(
			`Table "${csv.table}" already exists and has no column ${unknown.map((c) => `"${c.name}"`).join(", ")} (existing columns: ${existing.properties
				.map((p) => p.name)
				.join(", ")}). Map those columns onto existing ones with --map.`,
		);
	}
	const primaryKey = existing.properties.find((property) => property.primaryKey)?.name;
	if (primaryKey && !csv.columns.some((column) => column.name === primaryKey)) {
		throw new Error(
			`Primary key column "${primaryKey}" of table "${csv.table}" is not in the CSV (CSV columns: ${csv.columns
				.map((c) => c.name)
				.join(", ")}). A primary key cannot be empty; supply it with --map.`,
		);
	}
	return csv.columns.map((column) => {
		const property = declared.get(column.name);
		const type = property ? normalizeType(property.type) : null;
		if (!type) {
			throw new Error(
				`Column "${column.name}" of table "${csv.table}" has type "${property?.type ?? "?"}"; CSV import supports STRING / INT64 / DOUBLE / BOOLEAN only.`,
			);
		}
		return { ...column, type, primaryKey: column.name === primaryKey };
	});
}

async function countRows(store: GraphStore, table: string): Promise<number> {
	const result = await store.runCypher(`MATCH (n:${table}) RETURN count(n)`);
	return Number(result.rows[0]?.[0] ?? 0);
}
