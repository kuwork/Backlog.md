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
		// maxRows: Infinity - a dump must never inherit the interactive 500-row display cap, or every
		// table bigger than that would silently lose rows.
		const result = await store.runCypher(`MATCH (n:${table.name}) RETURN n`, { maxRows: Number.POSITIVE_INFINITY });
		snapshot.nodes[table.name] = result.rows.map((row) => {
			const value = row[0];
			return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
 * key that the dump adds to every node. A row missing a declared property is reported loudly,
 * because the alternative - loading nothing - is indistinguishable from "the data was never there".
 */
function projectRow(row: Record<string, unknown>, table: SnapshotNodeTable): Record<string, unknown> {
	const projected: Record<string, unknown> = {};
	for (const property of table.properties) {
		if (!(property.name in row)) {
			throw new Error(
				`快照损坏：${table.name} 的一行缺少字段 "${property.name}"，无法还原（该行：${JSON.stringify(row)}）。`,
			);
		}
		projected[property.name] = row[property.name];
	}
	return projected;
}

/**
 * Rebuild a database in memory from a snapshot. Order matters: tables, then **all** nodes, then
 * edges - an edge `MATCH` that cannot bind an endpoint drops the edge silently (BACK-766 hit
 * exactly that, which is why the graph once imported zero edges).
 */
export async function hydrateDatabase(store: GraphStore, snapshot: GraphSnapshot): Promise<void> {
	for (const table of snapshot.nodeTables) await store.runWrite(nodeTableDdl(table));
	for (const table of snapshot.relTables) await store.runWrite(relTableDdl(table));
	for (const table of snapshot.nodeTables) {
		const rows = (snapshot.nodes[table.name] ?? []).map((row) => projectRow(row, table));
		const assignments = table.properties.map((p) => `${p.name}: row.${p.name}`).join(", ");
		for (let start = 0; start < rows.length; start += BATCH_SIZE) {
			await store.runWrite(`UNWIND $rows AS row CREATE (:${table.name} {${assignments}})`, {
				rows: rows.slice(start, start + BATCH_SIZE),
			});
		}
	}
	for (const table of snapshot.relTables) {
		const rows = snapshot.edges[table.name] ?? [];
		for (let start = 0; start < rows.length; start += BATCH_SIZE) {
			await store.runWrite(
				`UNWIND $rows AS row MATCH (a:${table.from} {${table.fromKey}: row.from}), (b:${table.to} {${table.toKey}: row.to}) CREATE (a)-[:${table.name}]->(b)`,
				{ rows: rows.slice(start, start + BATCH_SIZE) },
			);
		}
	}
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
