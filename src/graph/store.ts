/**
 * Graph store abstraction for the Kuzu task graph (doc-014 §1.2).
 *
 * One node table, FileNode, keyed by the file's path relative to the backlog directory: the
 * Markdown file *is* the node, and the task id is merely a property of task files. Nothing else
 * identifies a node, so a file move/rename/archive is one operation everywhere - remove the old
 * path, create the new path, rebuild edges - with no second identity to keep in sync.
 *
 * Two backends implement the same interface:
 * - KuzuGraphStore: the real embedded Kuzu database (a hashed cache file, see graph/paths.ts). The
 *   native binding segfaults when loaded from Bun on this machine (doc-014 §5 anticipated Windows
 *   packaging issues), so it is only activated when explicitly requested - e.g. a host process
 *   running on Node - or via BACKLOG_GRAPH_BACKEND=kuzu.
 * - MemoryGraphStore: a pure-JS in-memory fallback (the doc's ":memory:" degraded mode). Always
 *   available, used by default so a crash in the native module can never take the CLI/Web down.
 *   Durability is delegated to the fingerprint cache: a rebuilt graph is identical by construction.
 *
 * Markdown files remain the single source of truth (doc-014 §0); the store is a derived cache and
 * every mutation here is driven by file-system reconciliation only.
 */

export type GraphKind = "task" | "draft" | "milestone" | "wiki" | "decision" | "document";

/**
 * Phase 3 (doc-15) node types. A knowledge file's type comes from the whitelisted directory it was
 * scanned from - never from frontmatter, and never from a subfolder name (`wiki/sources/` is a
 * wiki node just like `wiki/concepts/`).
 */
export const KNOWLEDGE_KINDS = ["wiki", "decision", "document"] as const;

export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export function isKnowledgeKind(value: string): value is KnowledgeKind {
	return (KNOWLEDGE_KINDS as readonly string[]).includes(value);
}

export interface GraphNode {
	/** Primary key: path relative to the backlog directory, e.g. "tasks/back-217 - Title.md". */
	path: string;
	/** The task id from frontmatter (back-217 / draft-N / m-1). Empty for knowledge files. */
	id: string;
	/** task | draft | milestone (work files) or wiki | decision | document (knowledge files). */
	type: GraphKind;
	title: string;
	status: string;
	updatedDate: string;
}

export type GraphEdgeType = "ParentOf" | "BelongsToMilestone" | "DependsOn" | "TaggedWith" | "SourcedFrom" | "LinksTo";

/**
 * Edges connect two FileNodes by path, except TaggedWith, whose target is a Tag node name - the one
 * edge that does not end in a file (doc-15 "标签节点").
 */
export interface GraphEdge {
	type: GraphEdgeType;
	from: string;
	to: string;
}

export interface GraphStore {
	readonly backend: "kuzu" | "memory";
	/**
	 * Open the store. A persistent backend also verifies that the file it opens is at
	 * SCHEMA_VERSION and rebuilds it from scratch when it is not - see KuzuGraphStore.init.
	 */
	init(): Promise<void>;
	close(): Promise<void>;
	/**
	 * Empty the graph - used by the rebuild path (fail-safe direction is always rebuild). A
	 * persistent backend also re-stamps the file with the current schema.
	 */
	clear(): Promise<void>;
	/** Batch upsert nodes by path; an existing path is replaced along with its edges. */
	upsertNodes(nodes: GraphNode[]): Promise<void>;
	/**
	 * Additive: register these Tag names, keeping the ones already known. An orphan Tag - one whose
	 * last TaggedWith edge went away with a label edit - is deliberately left in place; it is a
	 * virtual classification node, not a file, and nothing reads a tag count as a correctness claim.
	 */
	upsertTags(names: string[]): Promise<void>;
	/** All Tag names, for the /api/graph payload. */
	getAllTags(): Promise<string[]>;
	/** Batch remove nodes by path together with all their edges (DETACH DELETE semantics). */
	deleteNodes(paths: string[]): Promise<void>;
	/** Batch insert edges; duplicates within the batch are ignored. */
	upsertEdges(edges: GraphEdge[]): Promise<void>;
	/** Remove every edge with an endpoint in `paths` - used to rebuild only affected edges. */
	deleteEdgesTouching(paths: string[]): Promise<void>;
	/** All nodes, for the /api/graph payload. */
	getAllNodes(): Promise<GraphNode[]>;
	/** All edges, for the /api/graph payload. */
	getAllEdges(): Promise<GraphEdge[]>;
	countNodes(): Promise<number>;
	countEdges(type: GraphEdgeType): Promise<number>;
	hasNode(path: string): Promise<boolean>;
	getNode(path: string): Promise<GraphNode | null>;
	setMeta(key: string, value: string): Promise<void>;
	getMeta(key: string): Promise<string | null>;
}

/** Edge tables may hold at most one edge per (from, to) pair. */
export function edgeKey(type: GraphEdgeType, from: string, to: string): string {
	return `${type}|${from}|${to}`;
}

export class MemoryGraphStore implements GraphStore {
	readonly backend = "memory" as const;

	private nodes = new Map<string, GraphNode>();
	private edges = new Map<string, GraphEdge>();
	private tags = new Set<string>();
	private meta = new Map<string, string>();

	async init(): Promise<void> {}

	async close(): Promise<void> {
		this.nodes.clear();
		this.edges.clear();
		this.tags.clear();
		this.meta.clear();
	}

	async clear(): Promise<void> {
		this.nodes.clear();
		this.edges.clear();
		this.tags.clear();
	}

	async upsertNodes(nodes: GraphNode[]): Promise<void> {
		for (const node of nodes) this.nodes.set(node.path, { ...node });
		await this.deleteEdgesTouching(nodes.map((node) => node.path));
	}

	async upsertTags(names: string[]): Promise<void> {
		for (const name of names) this.tags.add(name);
	}

	async deleteNodes(paths: string[]): Promise<void> {
		for (const path of paths) this.nodes.delete(path);
		await this.deleteEdgesTouching(paths);
	}

	async upsertEdges(edges: GraphEdge[]): Promise<void> {
		for (const edge of edges) {
			if (!this.nodes.has(edge.from)) continue;
			// A TaggedWith edge ends in a Tag node, every other edge in a FileNode.
			const targetKnown = edge.type === "TaggedWith" ? this.tags.has(edge.to) : this.nodes.has(edge.to);
			if (!targetKnown) continue;
			this.edges.set(edgeKey(edge.type, edge.from, edge.to), { ...edge });
		}
	}

	async deleteEdgesTouching(paths: string[]): Promise<void> {
		const doomed = new Set(paths);
		for (const key of [...this.edges.keys()]) {
			const edge = this.edges.get(key);
			// A tag name is not a path: only the tagged file end can match a path here.
			const touches =
				!edge || (edge.type === "TaggedWith" ? doomed.has(edge.from) : doomed.has(edge.from) || doomed.has(edge.to));
			if (touches) this.edges.delete(key);
		}
	}

	async getAllNodes(): Promise<GraphNode[]> {
		return [...this.nodes.values()].map((n) => ({ ...n }));
	}

	async getAllTags(): Promise<string[]> {
		return [...this.tags];
	}

	async getAllEdges(): Promise<GraphEdge[]> {
		return [...this.edges.values()].map((e) => ({ ...e }));
	}

	async countNodes(): Promise<number> {
		return this.nodes.size;
	}

	async countEdges(type: GraphEdgeType): Promise<number> {
		let count = 0;
		for (const key of this.edges.keys()) {
			if (key.startsWith(`${type}|`)) count++;
		}
		return count;
	}

	async hasNode(path: string): Promise<boolean> {
		return this.nodes.has(path);
	}

	async getNode(path: string): Promise<GraphNode | null> {
		const node = this.nodes.get(path);
		return node ? { ...node } : null;
	}

	async setMeta(key: string, value: string): Promise<void> {
		this.meta.set(key, value);
	}

	async getMeta(key: string): Promise<string | null> {
		return this.meta.get(key) ?? null;
	}
}

/**
 * The shape a cache file must have. Bump this whenever SCHEMA_DDL below changes - a renamed table,
 * an added or removed column, a different primary key - and nothing else has to change: a file that
 * records any other version is wiped and rebuilt at open time (see KuzuGraphStore.init).
 *
 * The value is written into the database's own Meta table, so a cache file describes its own
 * schema. That matters because kuzu's `CREATE ... IF NOT EXISTS` is a silent no-op for a name that
 * already exists: without a recorded version, a file built by an older release would keep its old
 * table - with its relationship tables still bound to the old endpoints - and every later write
 * would either fail on a missing column or land in a table nothing reads.
 *
 * 1: FileNode(path PRIMARY KEY, id, type, title, status, updatedDate), doc-014 §1.2. A file with no
 *    version row is stale by definition - either empty, or written before this mechanism existed.
 * 2: phase 3 (doc-15) adds the Tag node table plus the TaggedWith/SourcedFrom/LinksTo relationship
 *    tables. `CREATE ... IF NOT EXISTS` would leave a version-1 file's tables as they are - and a
 *    TaggedWith of FileNode->Tag cannot be added to a database whose Tag table never existed - so
 *    the whole file is wiped and rebuilt instead.
 */
export const SCHEMA_VERSION = 2;

/** The Meta row holding SCHEMA_VERSION inside the database. Only the kuzu backend persists a file. */
export const SCHEMA_VERSION_KEY = "schemaVersion";

/** Whether a version read back from a database is the one this build writes. Missing = stale. */
export function isCurrentSchema(stored: string | null): boolean {
	return stored === String(SCHEMA_VERSION);
}

const SCHEMA_DDL = [
	"CREATE NODE TABLE IF NOT EXISTS FileNode (path STRING PRIMARY KEY, id STRING, type STRING, title STRING, status STRING, updatedDate STRING)",
	"CREATE NODE TABLE IF NOT EXISTS Tag (name STRING PRIMARY KEY)",
	"CREATE NODE TABLE IF NOT EXISTS Meta (name STRING PRIMARY KEY, value STRING)",
	"CREATE REL TABLE IF NOT EXISTS ParentOf(FROM FileNode TO FileNode)",
	"CREATE REL TABLE IF NOT EXISTS BelongsToMilestone(FROM FileNode TO FileNode)",
	"CREATE REL TABLE IF NOT EXISTS DependsOn(FROM FileNode TO FileNode)",
	"CREATE REL TABLE IF NOT EXISTS SourcedFrom(FROM FileNode TO FileNode)",
	"CREATE REL TABLE IF NOT EXISTS LinksTo(FROM FileNode TO FileNode)",
	"CREATE REL TABLE IF NOT EXISTS TaggedWith(FROM FileNode TO Tag)",
] as const;

/** Every edge type whose endpoints are both FileNodes. */
export const FILE_EDGE_TYPES = ["ParentOf", "BelongsToMilestone", "DependsOn", "SourcedFrom", "LinksTo"] as const;

/** Edges ending in a Tag node instead of a file: `from` is a path, `to` is a tag name. */
export const TAG_EDGE_TYPES = ["TaggedWith"] as const;

export const EDGE_TYPES = [...FILE_EDGE_TYPES, ...TAG_EDGE_TYPES] as const;

const NODE_BATCH_SIZE = 100;

/**
 * Edge-import CSV. Node paths are file names, so unlike ids they may well contain a comma, a quote
 * or a newline - quote (and escape) anything that would otherwise split the row.
 */
function csvField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function writeEdgeCsv(type: GraphEdgeType, edges: GraphEdge[]): Promise<string> {
	const { join } = await import("node:path");
	const { mkdtemp, writeFile } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const dir = await mkdtemp(join(tmpdir(), "backlog-kuzu-"));
	const csvPath = join(dir, `${type.toLowerCase()}.csv`);
	const lines = ["from,to", ...edges.map((e) => `${csvField(e.from)},${csvField(e.to)}`)];
	await writeFile(csvPath, `${lines.join("\n")}\n`, "utf8");
	return csvPath;
}

type KuzuModule = typeof import("kuzu");

let kuzuModule: KuzuModule | null = null;

/** Load the kuzu native module. Never called implicitly - see the backend-selection notes above. */
async function loadKuzu(): Promise<KuzuModule> {
	if (!kuzuModule) kuzuModule = (await import("kuzu")) as KuzuModule;
	return kuzuModule;
}

export function isKuzuRequested(backend?: string): boolean {
	const choice = backend ?? process.env.BACKLOG_GRAPH_BACKEND ?? "memory";
	return choice === "kuzu";
}

export class KuzuGraphStore implements GraphStore {
	readonly backend = "kuzu" as const;

	private db: import("kuzu").Database | null = null;
	private conn: import("kuzu").Connection | null = null;

	constructor(private readonly dbPath: string) {}

	async init(): Promise<void> {
		const kuzu = await loadKuzu();
		this.db = new kuzu.Database(this.dbPath);
		this.conn = new kuzu.Connection(this.db);
		// The file says which schema it was built with, so a reusable file is recognised without
		// consulting anything outside it (the sidecar cache, the caller's expectations).
		if (isCurrentSchema(await this.readSchemaVersion())) {
			await this.createSchema(); // already there; the DDL pass is a no-op that also repairs
			return;
		}
		await this.clear(); // older or unknown schema: wipe whatever is there, then start clean
	}

	async close(): Promise<void> {
		if (this.conn) {
			await this.conn.close();
			this.conn = null;
		}
		if (this.db) {
			await this.db.close(); // releases the kuzu file lock for the next opener
			this.db = null;
		}
	}

	/**
	 * Empty the graph and stamp it with the current schema. The tables are enumerated rather than
	 * named: a rename leaves a table this build has never heard of, and it has to go too. Rel tables
	 * come first because kuzu refuses to drop a node table a relationship table still references.
	 */
	async clear(): Promise<void> {
		for (const table of await this.listTables()) await this.exec(`DROP TABLE IF EXISTS ${table}`);
		await this.createSchema();
	}

	private async createSchema(): Promise<void> {
		for (const ddl of SCHEMA_DDL) await this.exec(ddl);
		await this.setMeta(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
	}

	/** Table names in this file, relationship tables first so the node tables are droppable. */
	private async listTables(): Promise<string[]> {
		const result = await this.query("CALL show_tables() RETURN name, type");
		const rows = await result.getAll();
		await this.closeResult(result);
		const tables = rows.map((row) => ({ name: String(row.name), rel: String(row.type) === "REL" }));
		return [...tables.filter((t) => t.rel), ...tables.filter((t) => !t.rel)].map((t) => t.name);
	}

	/** A file whose Meta table or row is missing has no recorded schema - see SCHEMA_VERSION. */
	private async readSchemaVersion(): Promise<string | null> {
		try {
			return await this.getMeta(SCHEMA_VERSION_KEY);
		} catch {
			return null; // "Binder exception: Table Meta does not exist" on a fresh file
		}
	}

	async upsertNodes(nodes: GraphNode[]): Promise<void> {
		if (nodes.length === 0) return;
		await this.deleteNodes(nodes.map((n) => n.path)); // replace semantics, edges included
		for (let start = 0; start < nodes.length; start += NODE_BATCH_SIZE) {
			const batch = nodes.slice(start, start + NODE_BATCH_SIZE);
			const patterns: string[] = [];
			const params: Record<string, string> = {};
			batch.forEach((node, i) => {
				const p = `n${i}`;
				patterns.push(
					`(:FileNode {path: $${p}path, id: $${p}id, type: $${p}type, title: $${p}title, status: $${p}status, updatedDate: $${p}updatedDate})`,
				);
				params[`${p}path`] = node.path;
				params[`${p}id`] = node.id;
				params[`${p}type`] = node.type;
				params[`${p}title`] = node.title;
				params[`${p}status`] = node.status;
				params[`${p}updatedDate`] = node.updatedDate;
			});
			await this.executePrepared(`CREATE ${patterns.join(", ")}`, params);
		}
	}

	async upsertTags(names: string[]): Promise<void> {
		const fresh = [...new Set(names)].filter((name) => name.length > 0);
		if (fresh.length === 0) return;
		const known = new Set(await this.getAllTags());
		const missing = fresh.filter((name) => !known.has(name));
		for (let start = 0; start < missing.length; start += NODE_BATCH_SIZE) {
			const batch = missing.slice(start, start + NODE_BATCH_SIZE);
			const patterns: string[] = [];
			const params: Record<string, string> = {};
			batch.forEach((name, i) => {
				const p = `t${i}`;
				patterns.push(`(:Tag {name: $${p}name})`);
				params[`${p}name`] = name;
			});
			await this.executePrepared(`CREATE ${patterns.join(", ")}`, params);
		}
	}

	async getAllTags(): Promise<string[]> {
		const result = await this.query("MATCH (t:Tag) RETURN t.name AS name");
		const rows = await result.getAll();
		await this.closeResult(result);
		return rows.map((row) => String(row.name));
	}

	async deleteNodes(paths: string[]): Promise<void> {
		if (paths.length === 0) return;
		await this.executePrepared("MATCH (n:FileNode) WHERE n.path IN $paths DETACH DELETE n", { paths });
	}

	async deleteEdgesTouching(paths: string[]): Promise<void> {
		if (paths.length === 0) return;
		for (const type of FILE_EDGE_TYPES) {
			await this.executePrepared(
				`MATCH (a:FileNode)-[r:${type}]->(b:FileNode) WHERE a.path IN $paths OR b.path IN $paths DELETE r`,
				{ paths },
			);
		}
		// A tag name is not a path, so only the tagged file end can match here.
		for (const type of TAG_EDGE_TYPES) {
			await this.executePrepared(`MATCH (a:FileNode)-[r:${type}]->(t:Tag) WHERE a.path IN $paths DELETE r`, {
				paths,
			});
		}
	}

	async getAllNodes(): Promise<GraphNode[]> {
		const result = await this.query(
			"MATCH (n:FileNode) RETURN n.path AS path, n.id AS id, n.type AS type, n.title AS title, n.status AS status, n.updatedDate AS updatedDate",
		);
		const rows = await result.getAll();
		await this.closeResult(result);
		return rows.map(toGraphNode);
	}

	async getAllEdges(): Promise<GraphEdge[]> {
		const edges: GraphEdge[] = [];
		for (const type of FILE_EDGE_TYPES) {
			const result = await this.query(
				`MATCH (a:FileNode)-[r:${type}]->(b:FileNode) RETURN a.path AS from, b.path AS to`,
			);
			const rows = await result.getAll();
			await this.closeResult(result);
			for (const row of rows) edges.push({ type, from: String(row.from), to: String(row.to) });
		}
		for (const type of TAG_EDGE_TYPES) {
			const result = await this.query(`MATCH (a:FileNode)-[r:${type}]->(t:Tag) RETURN a.path AS from, t.name AS to`);
			const rows = await result.getAll();
			await this.closeResult(result);
			for (const row of rows) edges.push({ type, from: String(row.from), to: String(row.to) });
		}
		return edges;
	}

	async upsertEdges(edges: GraphEdge[]): Promise<void> {
		// Deduplicate - one edge per (type, from, to); kuzu's COPY would happily insert twice.
		const unique = new Map<string, GraphEdge>();
		for (const edge of edges) unique.set(edgeKey(edge.type, edge.from, edge.to), edge);
		for (const type of EDGE_TYPES) {
			const selected = [...unique.values()].filter((e) => e.type === type);
			if (selected.length === 0) continue;
			const csvPath = await writeEdgeCsv(type, selected);
			try {
				await this.exec(`COPY ${type} FROM '${csvPath.replace(/\\/g, "/")}' (HEADER=true)`);
			} finally {
				const { unlink } = await import("node:fs/promises");
				await unlink(csvPath).catch(() => {}); // temp file best-effort cleanup
			}
		}
	}

	async countNodes(): Promise<number> {
		const result = await this.query("MATCH (n:FileNode) RETURN count(n) AS c");
		const rows = await result.getAll();
		await this.closeResult(result);
		return Number(rows[0]?.c ?? 0);
	}

	async countEdges(type: GraphEdgeType): Promise<number> {
		const result = await this.query(`MATCH (:FileNode)-[r:${type}]->() RETURN count(r) AS c`);
		const rows = await result.getAll();
		await this.closeResult(result);
		return Number(rows[0]?.c ?? 0);
	}

	async hasNode(path: string): Promise<boolean> {
		return (await this.getNode(path)) !== null;
	}

	async getNode(path: string): Promise<GraphNode | null> {
		const result = await this.queryWithParams(
			"MATCH (n:FileNode {path: $path}) RETURN n.path AS path, n.id AS id, n.type AS type, n.title AS title, n.status AS status, n.updatedDate AS updatedDate LIMIT 1",
			{ path },
		);
		const rows = await result.getAll();
		await this.closeResult(result);
		const row = rows[0];
		return row ? toGraphNode(row) : null;
	}

	async setMeta(key: string, value: string): Promise<void> {
		await this.executePrepared("MATCH (m:Meta {name: $name}) DETACH DELETE m", { name: key });
		await this.executePrepared("CREATE (:Meta {name: $name, value: $value})", {
			name: key,
			value,
		});
	}

	async getMeta(key: string): Promise<string | null> {
		const result = await this.queryWithParams("MATCH (m:Meta {name: $name}) RETURN m.value AS value LIMIT 1", {
			name: key,
		});
		const rows = await result.getAll();
		await this.closeResult(result);
		const row = rows[0];
		return row ? String(row.value) : null;
	}

	private connection(): import("kuzu").Connection {
		if (!this.conn) throw new Error("KuzuGraphStore used before init()");
		return this.conn;
	}

	private async query(statement: string): Promise<import("kuzu").QueryResult> {
		const result = await this.connection().query(statement);
		if (Array.isArray(result)) {
			const first = result[0];
			if (!first) throw new Error("kuzu returned an empty multi-result set");
			return first;
		}
		return result;
	}

	private async queryWithParams(
		statement: string,
		params: Record<string, unknown>,
	): Promise<import("kuzu").QueryResult> {
		const prepared = await this.connection().prepare(statement);
		if (!prepared.isSuccess()) throw new Error(`kuzu prepare failed: ${prepared.getErrorMessage()}`);
		const result = await this.connection().execute(prepared, params as Record<string, never>);
		if (Array.isArray(result)) {
			const first = result[0];
			if (!first) throw new Error("kuzu returned an empty multi-result set");
			return first;
		}
		return result;
	}

	/** Run a statement whose result nobody needs - DDL, DELETE, COPY. */
	private async exec(statement: string): Promise<void> {
		const result = await this.query(statement);
		await this.closeResult(result);
	}

	private async executePrepared(statement: string, params: Record<string, unknown>) {
		const result = await this.queryWithParams(statement, params);
		await this.closeResult(result);
	}

	private async closeResult(result: import("kuzu").QueryResult | import("kuzu").QueryResult[]) {
		for (const r of Array.isArray(result) ? result : [result]) {
			await r.close?.();
		}
	}
}

function toGraphNode(row: Record<string, unknown>): GraphNode {
	return {
		path: String(row.path ?? ""),
		id: String(row.id ?? ""),
		type: String(row.type || "task") as GraphKind,
		title: String(row.title ?? ""),
		status: String(row.status ?? ""),
		updatedDate: String(row.updatedDate ?? ""),
	};
}

export interface OpenGraphStoreOptions {
	/** "kuzu" forces the native backend; anything else keeps the pure-JS fallback. */
	backend?: string;
}

const memoryStores = new Map<string, MemoryGraphStore>();

/**
 * Open a graph store at the given database path (see graph/paths.ts - one database per project and
 * instance slot, kept in the cache directory). The native kuzu backend is opt-in
 * (BACKLOG_GRAPH_BACKEND=kuzu or an explicit option) because loading the binding inside Bun
 * segfaults on this machine; the default is the in-memory degraded mode sanctioned by doc-014 §5.
 * Memory stores are process singletons keyed by that same path so the cold-start fast path reuses
 * an already-built graph within the same process (a resident Graph Service keeps it warm across
 * reconciliations).
 */
export async function openGraphStore(dbPath: string, options: OpenGraphStoreOptions = {}): Promise<GraphStore> {
	if (isKuzuRequested(options.backend)) {
		const store = new KuzuGraphStore(dbPath);
		await store.init();
		return store;
	}
	const { resolve } = await import("node:path");
	const key = resolve(dbPath);
	let store = memoryStores.get(key);
	if (!store) {
		store = new MemoryGraphStore();
		await store.init();
		memoryStores.set(key, store);
	}
	return store;
}
