/**
 * Graph store abstraction for the Kuzu task graph (doc-014 §1.2).
 *
 * Two backends implement the same interface:
 * - KuzuGraphStore: the real embedded Kuzu database (backlog/graph.kuzu). The native binding
 *   segfaults when loaded from Bun on this machine (doc-014 §5 anticipated Windows packaging
 *   issues), so it is only activated when explicitly requested - e.g. a host process running on
 *   Node - or via BACKLOG_GRAPH_BACKEND=kuzu.
 * - MemoryGraphStore: a pure-JS in-memory fallback (the doc's ":memory:" degraded mode). Always
 *   available, used by default so a crash in the native module can never take the CLI/Web down.
 *   Durability is delegated to the fingerprint cache: a rebuilt graph is identical by construction.
 *
 * Markdown files remain the single source of truth (doc-014 §0); the store is a derived cache and
 * every mutation here is driven by file-system reconciliation only.
 */

export type GraphKind = "task" | "draft" | "milestone";

export interface GraphNode {
	id: string;
	title: string;
	kind: GraphKind;
	status: string;
	filePath: string;
}

export type GraphEdgeType = "ParentOf" | "BelongsToMilestone" | "DependsOn";

export interface GraphEdge {
	type: GraphEdgeType;
	from: string;
	to: string;
}

export interface GraphStore {
	readonly backend: "kuzu" | "memory";
	init(): Promise<void>;
	close(): Promise<void>;
	/** Drop every node and edge - used by the rebuild path (fail-safe direction is always rebuild). */
	clear(): Promise<void>;
	/** Batch upsert nodes; existing ids are replaced and their edges detached. */
	upsertNodes(nodes: GraphNode[]): Promise<void>;
	/** Batch remove nodes together with all their edges (DETACH DELETE semantics). */
	deleteNodes(ids: string[]): Promise<void>;
	/** Batch insert edges; duplicates are ignored. */
	upsertEdges(edges: GraphEdge[]): Promise<void>;
	countNodes(): Promise<number>;
	countEdges(type: GraphEdgeType): Promise<number>;
	hasNode(id: string): Promise<boolean>;
	getNode(id: string): Promise<GraphNode | null>;
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
	private meta = new Map<string, string>();

	async init(): Promise<void> {}

	async close(): Promise<void> {
		this.nodes.clear();
		this.edges.clear();
		this.meta.clear();
	}

	async clear(): Promise<void> {
		this.nodes.clear();
		this.edges.clear();
	}

	async upsertNodes(nodes: GraphNode[]): Promise<void> {
		for (const node of nodes) {
			this.nodes.set(node.id, { ...node });
			for (const key of [...this.edges.keys()]) {
				const edge = this.edges.get(key);
				if (edge && (edge.from === node.id || edge.to === node.id)) this.edges.delete(key);
			}
		}
	}

	async deleteNodes(ids: string[]): Promise<void> {
		const doomed = new Set(ids);
		for (const id of doomed) this.nodes.delete(id);
		for (const key of [...this.edges.keys()]) {
			const edge = this.edges.get(key);
			if (edge && (doomed.has(edge.from) || doomed.has(edge.to))) this.edges.delete(key);
		}
	}

	async upsertEdges(edges: GraphEdge[]): Promise<void> {
		for (const edge of edges) {
			if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) continue;
			this.edges.set(edgeKey(edge.type, edge.from, edge.to), { ...edge });
		}
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

	async hasNode(id: string): Promise<boolean> {
		return this.nodes.has(id);
	}

	async getNode(id: string): Promise<GraphNode | null> {
		const node = this.nodes.get(id);
		return node ? { ...node } : null;
	}

	async setMeta(key: string, value: string): Promise<void> {
		this.meta.set(key, value);
	}

	async getMeta(key: string): Promise<string | null> {
		return this.meta.get(key) ?? null;
	}
}

const SCHEMA_DDL = [
	"CREATE NODE TABLE IF NOT EXISTS Task (id STRING PRIMARY KEY, title STRING, kind STRING, status STRING, filePath STRING)",
	"CREATE REL TABLE IF NOT EXISTS ParentOf(FROM Task TO Task)",
	"CREATE REL TABLE IF NOT EXISTS BelongsToMilestone(FROM Task TO Task)",
	"CREATE REL TABLE IF NOT EXISTS DependsOn(FROM Task TO Task)",
	"CREATE NODE TABLE IF NOT EXISTS Meta (name STRING PRIMARY KEY, value STRING)",
] as const;

const NODE_BATCH_SIZE = 100;

type KuzuModule = typeof import("kuzu");

/** Edge-import CSV: ids only, so no quoting is needed; ids never contain commas. */
async function writeEdgeCsv(type: GraphEdgeType, edges: GraphEdge[]): Promise<string> {
	const { join } = await import("node:path");
	const { mkdtemp, writeFile } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const dir = await mkdtemp(join(tmpdir(), "backlog-kuzu-"));
	const csvPath = join(dir, `${type.toLowerCase()}.csv`);
	const lines = ["from,to", ...edges.map((e) => `${e.from},${e.to}`)];
	await writeFile(csvPath, `${lines.join("\n")}\n`, "utf8");
	return csvPath;
}

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
		for (const ddl of SCHEMA_DDL) {
			const result = await this.conn.query(ddl);
			await this.closeResult(result);
		}
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

	async clear(): Promise<void> {
		// Rel tables must go first: they depend on Task.
		for (const table of ["ParentOf", "BelongsToMilestone", "DependsOn", "Task", "Meta"]) {
			const result = await this.query(`DROP TABLE IF EXISTS ${table}`);
			await this.closeResult(result);
		}
		for (const ddl of SCHEMA_DDL) {
			const result = await this.query(ddl);
			await this.closeResult(result);
		}
	}

	async upsertNodes(nodes: GraphNode[]): Promise<void> {
		if (nodes.length === 0) return;
		await this.deleteNodes(nodes.map((n) => n.id));
		for (let start = 0; start < nodes.length; start += NODE_BATCH_SIZE) {
			const batch = nodes.slice(start, start + NODE_BATCH_SIZE);
			const patterns: string[] = [];
			const params: Record<string, string> = {};
			batch.forEach((node, i) => {
				const p = `n${i}`;
				patterns.push(
					`(:Task {id: $${p}id, title: $${p}title, kind: $${p}kind, status: $${p}status, filePath: $${p}filePath})`,
				);
				params[`${p}id`] = node.id;
				params[`${p}title`] = node.title;
				params[`${p}kind`] = node.kind;
				params[`${p}status`] = node.status;
				params[`${p}filePath`] = node.filePath;
			});
			await this.executePrepared(`CREATE ${patterns.join(", ")}`, params);
		}
	}

	async deleteNodes(ids: string[]): Promise<void> {
		if (ids.length === 0) return;
		await this.executePrepared("MATCH (n:Task) WHERE n.id IN $ids DETACH DELETE n", { ids });
	}

	async upsertEdges(edges: GraphEdge[]): Promise<void> {
		// Deduplicate - one edge per (type, from, to).
		const unique = new Map<string, GraphEdge>();
		for (const edge of edges) unique.set(edgeKey(edge.type, edge.from, edge.to), edge);
		for (const type of ["ParentOf", "BelongsToMilestone", "DependsOn"] as const) {
			const selected = [...unique.values()].filter((e) => e.type === type);
			if (selected.length === 0) continue;
			const csvPath = await writeEdgeCsv(type, selected);
			try {
				const result = await this.query(`COPY ${type} FROM '${csvPath.replace(/\\/g, "/")}' (HEADER=true)`);
				await this.closeResult(result);
			} finally {
				const { unlink } = await import("node:fs/promises");
				await unlink(csvPath).catch(() => {}); // temp file best-effort cleanup
			}
		}
	}

	async countNodes(): Promise<number> {
		const result = await this.query("MATCH (n:Task) RETURN count(n) AS c");
		const rows = await result.getAll();
		await this.closeResult(result);
		return Number(rows[0]?.c ?? 0);
	}

	async countEdges(type: GraphEdgeType): Promise<number> {
		const result = await this.query(`MATCH (:Task)-[r:${type}]->() RETURN count(r) AS c`);
		const rows = await result.getAll();
		await this.closeResult(result);
		return Number(rows[0]?.c ?? 0);
	}

	async hasNode(id: string): Promise<boolean> {
		return (await this.getNode(id)) !== null;
	}

	async getNode(id: string): Promise<GraphNode | null> {
		const result = await this.queryWithParams(
			"MATCH (n:Task {id: $id}) RETURN n.id AS id, n.title AS title, n.kind AS kind, n.status AS status, n.filePath AS filePath LIMIT 1",
			{ id },
		);
		const rows = await result.getAll();
		await this.closeResult(result);
		const row = rows[0];
		if (!row) return null;
		return {
			id: String(row.id),
			title: String(row.title ?? ""),
			kind: String(row.kind ?? "task") as GraphKind,
			status: String(row.status ?? ""),
			filePath: String(row.filePath ?? ""),
		};
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

export interface OpenGraphStoreOptions {
	/** "kuzu" forces the native backend; anything else keeps the pure-JS fallback. */
	backend?: string;
}

const memoryStores = new Map<string, MemoryGraphStore>();

/**
 * Open a graph store for the project. The native kuzu backend is opt-in (BACKLOG_GRAPH_BACKEND=kuzu
 * or an explicit option) because loading the binding inside Bun segfaults on this machine; the
 * default is the in-memory degraded mode sanctioned by doc-014 §5. Memory stores are process
 * singletons keyed by project root so the cold-start fast path reuses an already-built graph
 * within the same process (a resident Graph Service keeps it warm across reconciliations).
 */
export async function openGraphStore(projectRoot: string, options: OpenGraphStoreOptions = {}): Promise<GraphStore> {
	const { join, resolve } = await import("node:path");
	if (isKuzuRequested(options.backend)) {
		const store = new KuzuGraphStore(join(projectRoot, "backlog", "graph.kuzu"));
		await store.init();
		return store;
	}
	const key = resolve(projectRoot);
	let store = memoryStores.get(key);
	if (!store) {
		store = new MemoryGraphStore();
		await store.init();
		memoryStores.set(key, store);
	}
	return store;
}
