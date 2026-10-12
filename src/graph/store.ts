/**
 * Graph store abstraction for the Kuzu task graph (doc-014 §1.2).
 *
 * One node table, FileNode, keyed by the file's path relative to the backlog directory: the
 * Markdown file *is* the node, and the task id is merely a property of task files. Nothing else
 * identifies a node, so a file move/rename/archive is one operation everywhere - remove the old
 * path, create the new path, rebuild edges - with no second identity to keep in sync.
 *
 * Two backends implement the same interface:
 * - RyuGraphStore: the WebAssembly build of RyuGraph (a Kuzu fork). It is the DEFAULT backend, since
 *   the WASM runs inside Bun's WebAssembly runtime and avoids the native NAPI segfault that blocks
 *   Kuzu on Windows+Bun - so Cypher search works out of the box on every platform.
 * - MemoryGraphStore: a pure-JS in-memory fallback (the doc's ":memory:" degraded mode). Always
 *   available, used only when BACKLOG_GRAPH_BACKEND=memory is set or when the ryu WASM backend fails
 *   to initialise - so a native/WASM failure can never take the CLI/Web down. Durability is delegated
 *   to the fingerprint cache: a rebuilt graph is identical by construction.
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

/** A read-only Cypher query result, flattened for JSON transport to the Web UI. */
export interface CypherQueryResult {
	/** Column names in their result order (empty when the query returned no rows). */
	columns: string[];
	/** One row per result, each a parallel array to `columns`. Cells are JSON-serializable. */
	rows: unknown[][];
	/**
	 * Best-effort set of FileNode keys (path and id) found in the result, so the UI can highlight
	 * the matched subgraph. Already narrowed to the keys the canvas actually knows about on the
	 * client, so an empty set simply means "no node matched".
	 */
	nodeKeys: string[];
	/** True when the raw result exceeded the row cap and was truncated for display. */
	truncated: boolean;
}

export interface GraphStore {
	readonly backend: "ryu" | "memory";
	/**
	 * Open the store. A persistent backend also verifies that the file it opens is at
	 * SCHEMA_VERSION and rebuilds it from scratch when it is not - see RyuGraphStore.init.
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
	/**
	 * Run a read-only Cypher statement against the store and return its first result set, flattened
	 * for JSON. The ryu backend executes native Cypher; the memory backend does not support it and
	 * rejects the call so the UI can surface a clear "use the ryu backend" message.
	 */
	runCypher(statement: string): Promise<CypherQueryResult>;
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

	async runCypher(): Promise<CypherQueryResult> {
		throw new Error(
			"Cypher 检索需要支持 Cypher 的图后端（ryu）；当前运行在 memory 降级模式，不支持 Cypher。设置 BACKLOG_GRAPH_BACKEND=ryu 后重启，或移除该变量以回退到默认的 ryu 后端。",
		);
	}
}

/**
 * The shape a cache file must have. Bump this whenever SCHEMA_DDL below changes - a renamed table,
 * an added or removed column, a different primary key - and nothing else has to change: a file that
 * records any other version is wiped and rebuilt at open time (see RyuGraphStore.init).
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

/** The Meta row holding SCHEMA_VERSION inside the database. Only the ryu backend persists a file. */
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
 * Bulk-insert edges for a store backend via UNWIND + MATCH + MERGE. We deliberately avoid COPY ... FROM
 * CSV here: ryu COPY for relationship tables is fussy about column naming, and under RyuGraph's
 * WASM build it silently imports zero edges - which would leave the graph view with nodes but no
 * connections. MERGE keeps each (from,to) pair unique per edge type, matching the in-memory store's
 * dedup semantics. An edge whose endpoint node is absent is simply skipped (MATCH does not bind), so a
 * stale edge never throws.
 */
async function upsertEdgesViaRunner(
	run: (sql: string, params: Record<string, unknown>) => Promise<void>,
	edges: GraphEdge[],
): Promise<void> {
	const byType = new Map<GraphEdgeType, Array<{ from: string; to: string }>>();
	for (const edge of edges) {
		const list = byType.get(edge.type) ?? [];
		list.push({ from: edge.from, to: edge.to });
		byType.set(edge.type, list);
	}
	for (const [type, pairs] of byType) {
		if (pairs.length === 0) continue;
		const target = TAG_EDGE_TYPES.includes(type as "TaggedWith") ? "Tag {name: pair.to}" : "FileNode {path: pair.to}";
		const sql = `UNWIND $pairs AS pair MATCH (a:FileNode {path: pair.from}), (b:${target}) MERGE (a)-[:${type}]->(b)`;
		await run(sql, { pairs });
	}
}

/**
 * Resolve the requested graph backend. Default is "ryu" (the RyuGraph WASM build, which runs under
 * Bun/Windows without the native NAPI segfault that blocks Kuzu). An explicit "memory" choice - via
 * the option or the BACKLOG_GRAPH_BACKEND env var - wins; anything else defaults to ryu.
 */
export function resolveGraphBackend(backend?: string): "ryu" | "memory" {
	const choice = backend ?? process.env.BACKLOG_GRAPH_BACKEND;
	if (choice === "memory") return choice;
	return "ryu";
}

type RyuModule = any;

let ryuModule: RyuModule | null = null;

/**
 * Load the RyuGraph WASM module (a Kuzu fork). The WASM build runs in Bun's WebAssembly runtime, so
 * it works under Bun/Windows where Kuzu's native binding cannot. `init()` must be awaited once before
 * any Database is constructed. Never called implicitly for the default backend.
 */
async function loadRyu(): Promise<RyuModule> {
	if (!ryuModule) {
		const mod: any = await import("ryugraph-wasm/sync");
		ryuModule = (mod.default ?? mod) as RyuModule;
		await ryuModule.init();
	}
	return ryuModule;
}

/** A kuzu/ryu node value: has `_label` and no relationship endpoints. */
function isCypherNode(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" && value !== null && !Array.isArray(value) && "_label" in value && !("_src" in value)
	);
}

/** A kuzu/ryu relationship value: carries `_src`/`_dst` endpoints. */
function isCypherRel(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) && "_src" in value && "_dst" in value;
}

/** A kuzu/ryu path value: a node/relationship chain. */
function isCypherPath(value: unknown): value is { _nodes: unknown[]; _rels: unknown[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Array.isArray((value as { _nodes?: unknown })._nodes)
	);
}

/**
 * Collect FileNode keys (path and id) from a result cell so the UI can highlight the matched
 * subgraph. Walks nodes, paths and arrays; a bare string that already looks like a node path
 * (a `RETURN n.path`) is kept too - the client narrows to keys it actually knows about.
 */
function collectCypherNodeKeys(value: unknown, keys: Set<string>): void {
	if (isCypherNode(value)) {
		if (value._label === "FileNode") {
			const path = value.path;
			const id = value.id;
			if (typeof path === "string" && path) keys.add(path);
			if (typeof id === "string" && id) keys.add(id);
		}
		return;
	}
	if (isCypherPath(value)) {
		for (const node of value._nodes) collectCypherNodeKeys(node, keys);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectCypherNodeKeys(item, keys);
		return;
	}
	if (typeof value === "string" && value.includes("/")) keys.add(value);
}

/** Flatten a kuzu/ryu value into a JSON-serializable shape for transport to the UI. */
function serializeCypherValue(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(serializeCypherValue);
	const out: Record<string, unknown> = {};
	if (isCypherNode(value) || isCypherRel(value)) out._label = value._label;
	for (const [key, val] of Object.entries(value)) {
		if (key === "_id" || key === "_src" || key === "_dst") continue;
		out[key] = serializeCypherValue(val);
	}
	return out;
}

/**
 * Parse one cell of RyuGraph's CLI-style `toString()` output back into a value the shared
 * serialize/collect helpers understand. Node/relationship cells render as `{_LABEL: FileNode,
 * path: ..., id: ..., ...}` (note the UPPER-CASE internal keys) - we normalise them to the
 * lower-case `_label`/`_id`/`_src`/`_dst` shape the helpers expect. Anything else is a scalar: bare
 * numbers are coerced for display fidelity, everything else stays a string. This is the int64-safe
 * recovery path used when Bun's embind cannot convert an INT64 result column (see rowsFromResult).
 */
function parseCypherCell(text: string): unknown {
	const t = text.trim();
	if (t.startsWith("{") && t.endsWith("}")) {
		const obj: Record<string, unknown> = {};
		const re = /([A-Za-z_][\w]*):\s*("([^"]*)"|'([^']*)'|[^,}]*)/g;
		let m = re.exec(t);
		while (m) {
			const rawKey = m[1];
			let value = (m[2] ?? "").trim();
			if (
				value.length >= 2 &&
				((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'"))
			) {
				value = value.slice(1, -1);
			}
			const key =
				rawKey === "_LABEL"
					? "_label"
					: rawKey === "_ID"
						? "_id"
						: rawKey === "_SRC"
							? "_src"
							: rawKey === "_DST"
								? "_dst"
								: rawKey;
			if (key) obj[key] = value;
			m = re.exec(t);
		}
		return obj;
	}
	if (/^-?\d+$/.test(t)) return Number(t);
	if (/^-?\d*\.\d+$/.test(t)) return Number(t);
	return t;
}

/**
 * RyuGraph (Kuzu fork) backend over its WebAssembly build - the Cypher engine that works under
 * Bun/Windows, where Kuzu's native NAPI binding segfaults. It is the only Cypher-capable backend
 * (the native Kuzu store was removed in BACK-768); the result accessor differs from kuzu's: Ryu's
 * QueryResult exposes `getAllRows()` (a column-parallel array) instead of `getAll()` (objects keyed
 * by column name), so `rowsFromResult` zips the column names back before the shared serialize/collect helpers
 * run. The WASM module is loaded + `init()`-ed lazily by `loadRyu` because importing it from the
 * default (memory) backend must never pull a native or WASM dependency in.
 */
export class RyuGraphStore implements GraphStore {
	readonly backend = "ryu" as const;

	private db: any = null;
	private conn: any = null;

	constructor(private readonly dbPath: string) {}

	async init(): Promise<void> {
		const ryu = await loadRyu();
		this.db = new ryu.Database(this.dbPath);
		this.conn = new ryu.Connection(this.db);
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
			await this.db.close(); // releases the file lock for the next opener
			this.db = null;
		}
	}

	/**
	 * Empty the graph and stamp it with the current schema. The tables are enumerated rather than
	 * named: a rename leaves a table this build has never heard of, and it has to go too. Rel tables
	 * come first because ryu refuses to drop a node table a relationship table still references.
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
		const rows = await this.rowsFromResult(result);
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
		const rows = await this.rowsFromResult(result);
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
		const rows = await this.rowsFromResult(result);
		await this.closeResult(result);
		return rows.map(toGraphNode);
	}

	async getAllEdges(): Promise<GraphEdge[]> {
		const edges: GraphEdge[] = [];
		for (const type of FILE_EDGE_TYPES) {
			const result = await this.query(
				`MATCH (a:FileNode)-[r:${type}]->(b:FileNode) RETURN a.path AS from, b.path AS to`,
			);
			const rows = await this.rowsFromResult(result);
			await this.closeResult(result);
			for (const row of rows) edges.push({ type, from: String(row.from), to: String(row.to) });
		}
		for (const type of TAG_EDGE_TYPES) {
			const result = await this.query(`MATCH (a:FileNode)-[r:${type}]->(t:Tag) RETURN a.path AS from, t.name AS to`);
			const rows = await this.rowsFromResult(result);
			await this.closeResult(result);
			for (const row of rows) edges.push({ type, from: String(row.from), to: String(row.to) });
		}
		return edges;
	}

	async upsertEdges(edges: GraphEdge[]): Promise<void> {
		await upsertEdgesViaRunner((sql, params) => this.executePrepared(sql, params), edges);
	}

	async countNodes(): Promise<number> {
		const result = await this.query("MATCH (n:FileNode) RETURN count(n) AS c");
		const rows = await this.rowsFromResult(result);
		await this.closeResult(result);
		return Number(rows[0]?.c ?? 0);
	}

	async countEdges(type: GraphEdgeType): Promise<number> {
		const result = await this.query(`MATCH (:FileNode)-[r:${type}]->() RETURN count(r) AS c`);
		const rows = await this.rowsFromResult(result);
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
		const rows = await this.rowsFromResult(result);
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
		const rows = await this.rowsFromResult(result);
		await this.closeResult(result);
		const row = rows[0];
		return row ? String(row.value) : null;
	}

	/**
	 * Run a read-only Cypher statement and flatten the first result set. Mutation keywords are blocked
	 * so a retrieval box can never corrupt the graph cache (it is a derived view of the markdown
	 * truth). The flattened rows carry plain JSON and the set of FileNode key/id values found, which
	 * the UI uses to highlight the matched subgraph.
	 */
	async runCypher(statement: string): Promise<CypherQueryResult> {
		const trimmed = statement.trim();
		if (!trimmed) throw new Error("Cypher 语句为空");
		// Read-only retrieval only: block write keywords to protect the cache. `CALL` (e.g.
		// show_tables) stays allowed because it is read-only introspection.
		if (/\b(CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE)\b/i.test(trimmed)) {
			throw new Error("Cypher 检索仅支持只读查询（MATCH / RETURN / WITH / CALL），已阻止写操作以保护图谱缓存。");
		}
		const result = await this.query(trimmed);
		const rowObjects = await this.rowsFromResult(result);
		await this.closeResult(result);
		const MAX_ROWS = 500;
		const truncated = rowObjects.length > MAX_ROWS;
		const slice = truncated ? rowObjects.slice(0, MAX_ROWS) : rowObjects;
		const nodeKeys = new Set<string>();
		const rows = slice.map((row) =>
			Object.keys(row).map((key) => {
				const cell = row[key];
				collectCypherNodeKeys(cell, nodeKeys);
				return serializeCypherValue(cell);
			}),
		);
		const firstRow = rowObjects[0];
		const columns = firstRow ? Object.keys(firstRow) : [];
		return { columns, rows, nodeKeys: [...nodeKeys], truncated };
	}

	private connection(): any {
		if (!this.conn) throw new Error("RyuGraphStore used before init()");
		return this.conn;
	}

	private async query(statement: string): Promise<any> {
		const result = await this.connection().query(statement);
		if (Array.isArray(result)) {
			const first = result[0];
			if (!first) throw new Error("ryu returned an empty multi-result set");
			return first;
		}
		return result;
	}

	private async queryWithParams(statement: string, params: Record<string, unknown>): Promise<any> {
		const prepared = await this.connection().prepare(statement);
		if (!prepared.isSuccess()) throw new Error(`ryu prepare failed: ${prepared.getErrorMessage()}`);
		const result = await this.connection().execute(prepared, params as Record<string, never>);
		if (Array.isArray(result)) {
			const first = result[0];
			if (!first) throw new Error("ryu returned an empty multi-result set");
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

	/**
	 * Normalize a RyuGraph QueryResult into kuzu/ryu-shaped row objects. Ryu's QueryResult exposes
	 * `getAllRows()` (a column-parallel array) rather than the object-keyed shape kuzu uses; we zip
	 * the column names back so the shared serialize/collect helpers - which
	 * expect `{ column: value }` rows - keep working unchanged. Under Bun, `getAllRows()` throws on
	 * any INT64 column (count/size/sum/arithmetic) because embind's ToBigInt cannot cross the
	 * WASM boundary - we recover via the int64-safe `toString()` representation in that case.
	 */
	private async rowsFromResult(result: any): Promise<Record<string, unknown>[]> {
		const cols = await result.getColumnNames();
		let raw: unknown[][];
		try {
			raw = await result.getAllRows();
		} catch (err) {
			if (String(err).includes("ToBigInt") || String(err).includes("BigInt")) {
				return this.rowsFromResultString(result, cols);
			}
			throw err;
		}
		return raw.map((row: unknown[]) => {
			const obj: Record<string, unknown> = {};
			for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
			return obj;
		});
	}

	/**
	 * Int64-safe fallback used when `getAllRows()` cannot convert an INT64 column under Bun's
	 * embind. RyuGraph's `toString()` renders the result as `|`-delimited cells (node/rel cells as
	 * `{...}` objects), which we parse back into values via parseCypherCell so node-key extraction
	 * and the shared serializers keep working.
	 */
	private async rowsFromResultString(result: any, cols: string[]): Promise<Record<string, unknown>[]> {
		const text = String((await result.toString?.()) ?? "");
		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		// The first line is the header (column names); every subsequent non-empty line is a data row.
		const dataLines = lines.slice(1);
		return dataLines.map((line) => {
			const cells = line.split("|").map((c) => parseCypherCell(c));
			const obj: Record<string, unknown> = {};
			for (let i = 0; i < cols.length; i++) {
				const col = cols[i];
				if (col !== undefined) obj[col] = cells[i] ?? null;
			}
			return obj;
		});
	}

	private async closeResult(result: any) {
		await result?.close?.();
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
	/** Force a specific backend ("ryu" | "memory"); omit for the default "ryu" (WASM) backend. */
	backend?: string;
}

const memoryStores = new Map<string, MemoryGraphStore>();

/**
 * Open a graph store at the given database path (see graph/paths.ts - one database per project and
 * instance slot, kept in the cache directory). The default backend is "ryu" (the RyuGraph WASM
 * build), which runs under Bun/Windows without the native NAPI segfault that blocks Kuzu, so Cypher
 * search works out of the box on every platform. Opt out with an explicit choice:
 * - "memory" forces the pure-JS degraded mode (doc-014 §5), which has no Cypher support but can never
 *   crash the CLI/Web on a native/WASM failure.
 * If the default ryu backend ever fails to initialise, we degrade to memory rather than taking the
 * process down. Memory stores are process singletons keyed by that same path so the cold-start fast
 * path reuses an already-built graph within the same process (a resident Graph Service keeps it warm
 * across reconciliations).
 */
export async function openGraphStore(dbPath: string, options: OpenGraphStoreOptions = {}): Promise<GraphStore> {
	const choice = resolveGraphBackend(options.backend);
	if (choice === "memory") {
		return openMemoryStore(dbPath);
	}
	// Default: "ryu". The WASM backend has no native-binding crash risk, but guard it anyway so a
	// failed init degrades to memory instead of taking the CLI/Web down.
	try {
		const store = new RyuGraphStore(dbPath);
		await store.init();
		return store;
	} catch (err) {
		console.warn(`[graph] RyuGraph (WASM) 后端初始化失败，回退到 memory 降级模式（Cypher 检索不可用）：${String(err)}`);
		return openMemoryStore(dbPath);
	}
}

/** Build or reuse the pure-JS in-memory store (a process singleton per resolved db path). */
async function openMemoryStore(dbPath: string): Promise<GraphStore> {
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
