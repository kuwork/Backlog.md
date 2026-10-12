import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cypherCell, type GraphStore } from "./store.ts";

/**
 * Durable storage for user databases.
 *
 * ryu's WASM build keeps the whole database in Emscripten MEMFS - an in-process virtual filesystem
 * - so nothing survives the process that created it (see BACK-767). A user database therefore owns
 * a JSON **snapshot** next to it: the writer dumps schema + rows + edges after every write, and the
 * next process hydrates a fresh in-memory database from it. The snapshot is the durable copy; the
 * ryu file is only a handle.
 */

export const SNAPSHOT_VERSION = 1;

/** Rows per `UNWIND` batch when dumping or hydrating. */
const BATCH_SIZE = 500;

/** A column whose value is text, i.e. the one type for which an empty cell and NULL are different. */
function isTextType(type: string): boolean {
	return type.toUpperCase() === "STRING";
}

export interface SnapshotProperty {
	name: string;
	type: string;
	primaryKey: boolean;
}

export interface SnapshotNodeTable {
	name: string;
	properties: SnapshotProperty[];
}

export interface SnapshotRelTable {
	name: string;
	from: string;
	to: string;
	/** Primary-key property on the source node, used to re-link edges on hydrate. */
	fromKey: string;
	/** Primary-key property on the destination node. */
	toKey: string;
}

export interface SnapshotEdge {
	from: string;
	to: string;
}

export interface GraphSnapshot {
	version: number;
	database: string;
	nodeTables: SnapshotNodeTable[];
	relTables: SnapshotRelTable[];
	nodes: Record<string, Record<string, unknown>[]>;
	edges: Record<string, SnapshotEdge[]>;
}

export function emptySnapshot(database: string): GraphSnapshot {
	return { version: SNAPSHOT_VERSION, database, nodeTables: [], relTables: [], nodes: {}, edges: {} };
}

export interface LoadedSnapshot {
	snapshot: GraphSnapshot;
	/** Identity of the exact bytes read; null when there was no file at all. */
	fingerprint: string | null;
}

/** Content hash of the snapshot on disk, or null when there is no readable file there. */
export function snapshotFingerprint(path: string): string | null {
	try {
		return createHash("sha256").update(readFileSync(path)).digest("hex");
	} catch {
		return null;
	}
}

/**
 * Read a snapshot together with the identity of the bytes that were read.
 *
 * A writer compares that identity against the file just before it dumps, so an out-of-band change -
 * a hand edit, another tool, a restored backup - is detected instead of silently overwritten. The
 * single-holder lock only guards against other CLI processes, so this is the second half of the
 * lost-update guard. A null fingerprint means "there was no file", so any file appearing later
 * counts as a change; an existing-but-unparsable file keeps its fingerprint, so a write may still
 * replace it (that is the recovery path).
 */
export function loadSnapshotWithFingerprint(path: string): LoadedSnapshot {
	let bytes: Buffer;
	try {
		bytes = readFileSync(path);
	} catch {
		return { snapshot: emptySnapshot(""), fingerprint: null };
	}
	const fingerprint = createHash("sha256").update(bytes).digest("hex");
	try {
		const parsed = JSON.parse(bytes.toString("utf8")) as GraphSnapshot;
		if (parsed?.version === SNAPSHOT_VERSION) return { snapshot: parsed, fingerprint };
	} catch {
		/* unparsable: hand back an empty database and let a write replace the file */
	}
	return { snapshot: emptySnapshot(""), fingerprint };
}

/** Read a snapshot; a missing, unreadable or version-mismatched file reads as an empty database. */
export function loadSnapshot(path: string): GraphSnapshot {
	return loadSnapshotWithFingerprint(path).snapshot;
}

export function saveSnapshot(path: string, snapshot: GraphSnapshot): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
	renameSync(tmp, path); // atomic: a crash mid-write never truncates an existing snapshot
}

export function nodeTableDdl(table: SnapshotNodeTable): string {
	const columns = table.properties.map((p) => `${p.name} ${p.type}${p.primaryKey ? " PRIMARY KEY" : ""}`);
	return `CREATE NODE TABLE IF NOT EXISTS ${table.name} (${columns.join(", ")})`;
}

export function relTableDdl(table: SnapshotRelTable): string {
	return `CREATE REL TABLE IF NOT EXISTS ${table.name}(FROM ${table.from} TO ${table.to})`;
}

/**
 * Read the database's schema through ryu's introspection procedures. The same three calls power
 * `backlog graph schema`, so a user never has to re-declare a schema to get it persisted.
 */
export async function readSnapshotSchema(
	store: GraphStore,
): Promise<{ nodeTables: SnapshotNodeTable[]; relTables: SnapshotRelTable[] }> {
	const tables = await store.runCypher("CALL show_tables() RETURN name, type");
	const nodeTables: SnapshotNodeTable[] = [];
	const relTables: SnapshotRelTable[] = [];
	for (const row of tables.rows) {
		const name = String(cypherCell(tables, row, "name") ?? "");
		const kind = String(cypherCell(tables, row, "type") ?? "");
		if (!name) continue;
		if (kind === "NODE") {
			const info = await store.runCypher(`CALL table_info('${name}') RETURN *`);
			nodeTables.push({
				name,
				properties: info.rows.map((r) => {
					const pk = cypherCell(info, r, "primary key");
					return {
						name: String(cypherCell(info, r, "name") ?? ""),
						type: String(cypherCell(info, r, "type") ?? ""),
						primaryKey: pk === true || pk === "true",
					};
				}),
			});
		} else if (kind === "REL") {
			const conn = await store.runCypher(`CALL show_connection('${name}') RETURN *`);
			const first = conn.rows[0] ?? [];
			relTables.push({
				name,
				from: String(cypherCell(conn, first, "source table name") ?? ""),
				to: String(cypherCell(conn, first, "destination table name") ?? ""),
				fromKey: String(cypherCell(conn, first, "source table primary key") ?? ""),
				toKey: String(cypherCell(conn, first, "destination table primary key") ?? ""),
			});
		}
	}
	return { nodeTables, relTables };
}

/** Serialize the whole database (schema + rows + edges) into a snapshot. */
export async function dumpDatabase(store: GraphStore, database: string): Promise<GraphSnapshot> {
	const { nodeTables, relTables } = await readSnapshotSchema(store);
	const snapshot: GraphSnapshot = { version: SNAPSHOT_VERSION, database, nodeTables, relTables, nodes: {}, edges: {} };
	for (const table of nodeTables) {
		// Explicit properties rather than `RETURN n`. ryu cannot hand a whole node across the WASM
		// boundary when any of its properties is INT64 - `getAllRows()` throws and the caller falls
		// back to parsing ryu's `|`-delimited text, which silently truncates a value at its first
		// comma and mangles one containing a newline (a name like "Ann, A" came back as "Ann").
		// Returning the properties one by one stays on the structured path and loses nothing.
		// maxRows: Infinity - a dump must never inherit the interactive 500-row display cap, or every
		// table bigger than that would silently lose rows.
		if (table.properties.length === 0) {
			snapshot.nodes[table.name] = [];
			continue;
		}
		const columns = table.properties.map((p) => `n.\`${p.name}\``).join(", ");
		const result = await store.runCypher(`MATCH (n:${table.name}) RETURN ${columns}`, {
			maxRows: Number.POSITIVE_INFINITY,
		});
		snapshot.nodes[table.name] = result.rows.map((row) => {
			const record: Record<string, unknown> = {};
			table.properties.forEach((property, index) => {
				const value = row[index] ?? null;
				// ryu reports NULL as an empty cell, and an INT64/DOUBLE/BOOLEAN column has no empty
				// value of its own - so an empty cell there is NULL. Left as "" it would be handed
				// back to a typed column on hydrate, which cannot accept it.
				record[property.name] = value === "" && !isTextType(property.type) ? null : value;
			});
			return record;
		});
	}
	for (const table of relTables) {
		if (!table.fromKey || !table.toKey) continue; // an endpoint without a key cannot be re-linked
		const result = await store.runCypher(
			`MATCH (a:${table.from})-[r:${table.name}]->(b:${table.to}) RETURN a.${table.fromKey}, b.${table.toKey}`,
			{ maxRows: Number.POSITIVE_INFINITY },
		);
		snapshot.edges[table.name] = result.rows.map((row) => ({
			from: String(row[0] ?? ""),
			to: String(row[1] ?? ""),
		}));
	}
	return snapshot;
}

/**
 * Reduce a stored row to exactly the table's declared properties.
 *
 * Not cosmetic. ryu converts a `$rows` parameter into a LIST<STRUCT> and needs every entry to have
 * the same shape: a heterogeneous list is **silently treated as empty**, which is how a hand-edited
 * snapshot became a database with zero rows and no error at all. Projecting also drops the `_label`
 * key that the dump adds to every node.
 *
 * A declared property the row does not carry becomes NULL rather than an error: `RETURN n` omits a
 * property ryu holds as NULL, so an absent key is what a NULL looks like on disk - and a CSV cell
 * that was empty is exactly that (BACK-770). A key the table never declared is still refused, which
 * is how a renamed or misspelled field from a hand edit stays loud instead of loading as nothing.
 */
function projectRow(row: Record<string, unknown>, table: SnapshotNodeTable): Record<string, unknown> {
	for (const key of Object.keys(row)) {
		if (key === "_label") continue; // added by the dump, never declared
		if (!table.properties.some((property) => property.name === key)) {
			throw new Error(
				`快照损坏：${table.name} 的一行含未声明的字段 "${key}"（该表的字段：${table.properties
					.map((p) => p.name)
					.join(", ")}；该行：${JSON.stringify(row)}）。`,
			);
		}
	}
	const projected: Record<string, unknown> = {};
	for (const property of table.properties) {
		projected[property.name] = row[property.name] ?? null;
	}
	return projected;
}

/**
 * Turn a projected row into the values the insert statement may pass as parameters.
 *
 * A typed column gets `CAST(... AS type)` and therefore a text value: a JS number handed to an
 * INT64 or DOUBLE parameter throws `TypeError: Invalid argument type in ToBigInt operation` under
 * Bun, so a number read out of a snapshot is stringified on the way back in. Text columns pass
 * through untouched, which is what keeps an empty string an empty string instead of a NULL.
 */
function bindableRow(row: Record<string, unknown>, table: SnapshotNodeTable): Record<string, unknown> {
	const projected = projectRow(row, table);
	const bound: Record<string, unknown> = {};
	for (const property of table.properties) {
		const value = projected[property.name] ?? null;
		if (property.primaryKey && (value === null || value === "")) {
			// Creating a node with a NULL primary key segfaults the ryu WASM build - a corrupt
			// snapshot must say so instead of taking the process down with it.
			throw new Error(
				`快照损坏：${table.name} 有主键 "${property.name}" 为空的行，无法还原（该行：${JSON.stringify(projected)}）。`,
			);
		}
		bound[property.name] = value === null ? null : isTextType(property.type) ? value : String(value);
	}
	return bound;
}

/**
 * The tables a hydrating process actually needs: a subset of the snapshot, or `null` for "all of
 * it".
 *
 * `null` is the safe answer and is what every caller falls back to: a partial hydrate that guessed
 * wrong leaves a query running against a table that was never created, which reads as "no rows"
 * rather than as an error.
 */
export interface HydrateScope {
	nodeTables: string[];
	relTables: string[];
}

/**
 * Which tables a Cypher statement touches, or `null` when that cannot be determined.
 *
 * A node label is only recognised after `(` and a relationship name only after `[`, so a property
 * map (`{name: 'Alice'}`) is never mistaken for a label. `CALL table_info('X')` / `show_connection('X')`
 * are honoured too, since they name their table in a string. Anything else - an unlabelled
 * `MATCH (n)`, a `show_tables()` call, a name the snapshot does not carry - returns `null` on
 * purpose: those either need every table or cannot be answered safely.
 */
export function referencedTables(statement: string, snapshot: GraphSnapshot): HydrateScope | null {
	if (/\b(show_tables|db\.|table_info\s*\(\s*\)|show_connection\s*\(\s*\))/i.test(statement)) return null;
	const nodes = new Set<string>();
	const rels = new Set<string>();
	const pattern = /([([])\s*(?:[A-Za-z_]\w*)?\s*:\s*([A-Za-z_]\w*)/g;
	for (let match = pattern.exec(statement); match; match = pattern.exec(statement)) {
		if (match[1] === "[") rels.add(match[2] ?? "");
		else nodes.add(match[2] ?? "");
	}
	for (const match of statement.matchAll(/table_info\s*\(\s*'([^']+)'\s*\)/gi)) nodes.add(match[1] ?? "");
	for (const match of statement.matchAll(/show_connection\s*\(\s*'([^']+)'\s*\)/gi)) rels.add(match[1] ?? "");
	nodes.delete("");
	rels.delete("");
	if (nodes.size === 0 && rels.size === 0) return null; // `MATCH (n) RETURN n` needs everything

	const knownNodes = new Set(snapshot.nodeTables.map((table) => table.name));
	const knownRels = new Map(snapshot.relTables.map((table) => [table.name, table]));
	// A name the snapshot does not carry means the statement is ahead of the data (or the scan
	// misread it) - hydrating a subset then would silently answer "no rows".
	for (const name of nodes) if (!knownNodes.has(name)) return null;
	for (const name of rels) if (!knownRels.has(name)) return null;

	const needed = new Set(nodes);
	for (const name of rels) {
		const table = knownRels.get(name);
		if (table) {
			needed.add(table.from); // an edge cannot bind without both of its endpoints
			needed.add(table.to);
		}
	}
	return {
		nodeTables: snapshot.nodeTables.filter((table) => needed.has(table.name)).map((table) => table.name),
		relTables: snapshot.relTables.filter((table) => rels.has(table.name)).map((table) => table.name),
	};
}

/**
 * Rebuild a database in memory from a snapshot. Order matters: tables, then **all** nodes, then
 * edges - an edge `MATCH` that cannot bind an endpoint drops the edge silently (BACK-766 hit
 * exactly that, which is why the graph once imported zero edges).
 *
 * `scope` hydrates only the tables listed (plus whatever those tables' edges need); omit it for the
 * whole database.
 */
export async function hydrateDatabase(store: GraphStore, snapshot: GraphSnapshot, scope?: HydrateScope): Promise<void> {
	const nodeTables = scope
		? snapshot.nodeTables.filter((table) => scope.nodeTables.includes(table.name))
		: snapshot.nodeTables;
	const loaded = new Set(nodeTables.map((table) => table.name));
	// A relationship whose endpoint table was not loaded would MATCH nothing and lose the edge, so
	// it is skipped rather than replayed into a void.
	const relTables = (
		scope ? snapshot.relTables.filter((table) => scope.relTables.includes(table.name)) : snapshot.relTables
	).filter((table) => loaded.has(table.from) && loaded.has(table.to));
	for (const table of nodeTables) await store.runWrite(nodeTableDdl(table));
	for (const table of relTables) await store.runWrite(relTableDdl(table));
	for (const table of nodeTables) {
		const rows = (snapshot.nodes[table.name] ?? []).map((row) => bindableRow(row, table));
		const assignments = table.properties
			.map((p) =>
				isTextType(p.type) ? `\`${p.name}\`: row.\`${p.name}\`` : `\`${p.name}\`: CAST(row.\`${p.name}\` AS ${p.type})`,
			)
			.join(", ");
		for (let start = 0; start < rows.length; start += BATCH_SIZE) {
			await store.runWrite(`UNWIND $rows AS row CREATE (:${table.name} {${assignments}})`, {
				rows: rows.slice(start, start + BATCH_SIZE),
			});
		}
	}
	for (const table of relTables) {
		const rows = snapshot.edges[table.name] ?? [];
		// The endpoint key is cast like any other typed column: an INT64 primary key arrives as a
		// number on dump and is stored as text, so matching it needs the cast back.
		const fromType = propertyType(snapshot, table.from, table.fromKey);
		const toType = propertyType(snapshot, table.to, table.toKey);
		const bind = (side: string, type: string): string =>
			isTextType(type) ? `row.${side}` : `CAST(row.${side} AS ${type})`;
		for (let start = 0; start < rows.length; start += BATCH_SIZE) {
			await store.runWrite(
				`UNWIND $rows AS row MATCH (a:${table.from} {\`${table.fromKey}\`: ${bind("from", fromType)}}), ` +
					`(b:${table.to} {\`${table.toKey}\`: ${bind("to", toType)}}) CREATE (a)-[:${table.name}]->(b)`,
				{ rows: rows.slice(start, start + BATCH_SIZE) },
			);
		}
	}
}

/** The declared type of one property, defaulting to STRING when the table or column is not there. */
function propertyType(snapshot: GraphSnapshot, table: string, property: string): string {
	return (
		snapshot.nodeTables.find((candidate) => candidate.name === table)?.properties.find((p) => p.name === property)
			?.type ?? "STRING"
	);
}

export interface SnapshotTableStats {
	name: string;
	kind: "NODE" | "REL";
	rows: number;
}

export interface SnapshotStats {
	tables: SnapshotTableStats[];
	nodes: number;
	edges: number;
}

/** Row / edge counts per table, read straight off the snapshot (no store needed). */
export function snapshotStats(snapshot: GraphSnapshot): SnapshotStats {
	const tables: SnapshotTableStats[] = [
		...snapshot.nodeTables.map((t) => ({
			name: t.name,
			kind: "NODE" as const,
			rows: (snapshot.nodes[t.name] ?? []).length,
		})),
		...snapshot.relTables.map((t) => ({
			name: t.name,
			kind: "REL" as const,
			rows: (snapshot.edges[t.name] ?? []).length,
		})),
	];
	return {
		tables,
		nodes: tables.filter((t) => t.kind === "NODE").reduce((sum, t) => sum + t.rows, 0),
		edges: tables.filter((t) => t.kind === "REL").reduce((sum, t) => sum + t.rows, 0),
	};
}
