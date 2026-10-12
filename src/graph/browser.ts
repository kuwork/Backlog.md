import { DEFAULT_DATABASE, type GraphDatabase, listDatabases, resolveDatabase } from "./databases.ts";

export { DEFAULT_DATABASE };

import { hydrateDatabase, loadSnapshot, snapshotFingerprint, snapshotStats } from "./snapshot.ts";
import { type CypherQueryResult, type GraphStore, openGraphStore } from "./store.ts";

/**
 * Read-only browsing of user databases from a resident process (the Web UI).
 *
 * A CLI call is a one-shot process, so it has to replay the snapshot on every invocation. A server
 * is not: ryu keeps the graph in WASM memory **inside** this process, so a database hydrated once
 * stays queryable until something changes. What tells us that something changed is the snapshot's
 * fingerprint - the CLI replaces the file atomically after a write, so a changed hash means "replay
 * before answering".
 *
 * Reads take no lock, exactly like the CLI's read path: the snapshot is replaced atomically, so a
 * query that runs while a write is in flight simply sees the older, still-consistent version.
 */

export interface DatabaseSummary {
	name: string;
	kind: "derived" | "user";
	description: string;
	createdAt: string | null;
	updatedAt: string | null;
	/** Row counts from the snapshot; null for `default`, which is a corpus rebuild we will not pay for here. */
	nodes: number | null;
	edges: number | null;
}

interface Session {
	store: GraphStore;
	fingerprint: string | null;
}

/** List every database with its row counts, opening nothing (the snapshot is the cheap source). */
export function describeDatabases(projectRoot: string): DatabaseSummary[] {
	return listDatabases(projectRoot).map((database: GraphDatabase) => {
		if (database.kind === "derived") {
			return {
				name: database.name,
				kind: database.kind,
				description: database.description,
				createdAt: null,
				updatedAt: null,
				nodes: null,
				edges: null,
			};
		}
		const stats = snapshotStats(loadSnapshot(database.source.snapshotPath));
		return {
			name: database.name,
			kind: database.kind,
			description: database.description,
			createdAt: database.createdAt,
			updatedAt: database.updatedAt,
			nodes: stats.nodes,
			edges: stats.edges,
		};
	});
}

/**
 * One cache of hydrated user databases, owned by a long-lived process.
 *
 * Keyed by database path, not by name: two projects never share a session, and a dropped-and
 * recreated database is a different file even if the name is the same.
 */
export class UserDatabaseBrowser {
	private sessions = new Map<string, Session>();

	/** Run a read-only Cypher statement against a user database, replaying it when the file changed. */
	async query(projectRoot: string, name: string, statement: string): Promise<CypherQueryResult> {
		if (name === DEFAULT_DATABASE) {
			// The derived corpus belongs to the graph service: it owns the rebuild and the lock, and
			// the server routes `default` there before reaching this class. Fail loudly if a caller
			// ever bypasses that route rather than silently opening nothing.
			throw new Error(
				`"${DEFAULT_DATABASE}" 是 markdown 派生库，由 graph service 提供（见 /api/graph/cypher），不应交给 UserDatabaseBrowser。`,
			);
		}
		const database = resolveDatabase(projectRoot, name);
		const fingerprint = snapshotFingerprint(database.source.snapshotPath);
		const cached = this.sessions.get(database.source.dbPath);
		if (cached && cached.fingerprint === fingerprint) {
			return await cached.store.runCypher(statement);
		}
		// First query, or the snapshot moved under us: replay before answering.
		await this.close(database.source.dbPath);
		const store = await openGraphStore(database.source.dbPath, { backend: "ryu", schema: "none" });
		try {
			await hydrateDatabase(store, loadSnapshot(database.source.snapshotPath));
			this.sessions.set(database.source.dbPath, { store, fingerprint });
			return await store.runCypher(statement);
		} catch (error) {
			await store.close();
			throw error;
		}
	}

	private async close(dbPath: string): Promise<void> {
		const session = this.sessions.get(dbPath);
		if (!session) return;
		this.sessions.delete(dbPath);
		await session.store.close();
	}

	/** Release every store; the server calls this on shutdown. */
	async closeAll(): Promise<void> {
		for (const dbPath of [...this.sessions.keys()]) await this.close(dbPath);
	}
}
