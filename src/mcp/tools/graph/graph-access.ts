import { closeSync, mkdirSync, openSync, unlinkSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_DATABASE, type GraphDatabase, recordSnapshot, resolveDatabase } from "../../../graph/databases.ts";
import { DEFAULT_SLOT, graphPaths } from "../../../graph/paths.ts";
import { reconcileGraphStoreOnce } from "../../../graph/reconcile-once.ts";
import {
	dumpDatabase,
	hydrateDatabase,
	loadSnapshotWithFingerprint,
	readSnapshotSchema,
	saveSnapshot,
	snapshotFingerprint,
} from "../../../graph/snapshot.ts";
import { type CypherQueryResult, type GraphStore, openGraphStore } from "../../../graph/store.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";

/**
 * Shared access layer for the Graph MCP tools.
 *
 * Every helper mirrors the CLI's `withGraphDatabase` one-shot model: open the store, prepare it
 * (reconcile the derived corpus graph, or hydrate a user database from its snapshot), run, then
 * close. Holding a long-lived `GraphService` inside the MCP process would rebuild the whole corpus
 * on startup and risk a second open of the same ryu database while a write tool ran - so the
 * tools stay stateless and reproduce exactly what `backlog graph` does per invocation.
 */

/** Patterns that mean a statement is a write, not a read. `\b` keeps column names like `created` safe. */
const WRITE_KEYWORD = /\b(CREATE|MERGE|SET|DELETE|DROP|INSERT|UPDATE)\b/i;

/** True when the statement would mutate the graph - the read-only tools must refuse it. */
export function isWriteStatement(statement: string): boolean {
	return WRITE_KEYWORD.test(statement);
}

/** A best-effort single-holder lock, mirroring the CLI's `tryAcquireGraphLock` (doc-014 §3.3). */
function tryAcquireGraphLock(lockPath: string): { release: () => void } | null {
	try {
		const fd = openSync(lockPath, "wx");
		writeSync(fd, `${process.pid}\n`);
		closeSync(fd);
		return {
			release: () => {
				try {
					unlinkSync(lockPath);
				} catch {
					/* already gone */
				}
			},
		};
	} catch {
		return null;
	}
}

/** Open a database store for a read and prepare it. The caller MUST call `close()`. */
export async function openDatabaseReadonly(
	rootDir: string,
	db: string,
): Promise<{ store: GraphStore; database: GraphDatabase; close: () => Promise<void> }> {
	let database: GraphDatabase;
	try {
		database = resolveDatabase(rootDir, db);
	} catch (error) {
		// `resolveDatabase` throws a plain Error listing what is available; surface it as a clear
		// MCP error (the "does not exist" text) instead of the generic "An unexpected error occurred".
		throw new BacklogToolError(error instanceof Error ? error.message : String(error), "RESOURCE_NOT_FOUND");
	}
	mkdirSync(dirname(database.source.dbPath), { recursive: true });
	const store = await openGraphStore(database.source.dbPath, {
		backend: "ryu",
		schema: database.kind === "user" ? "none" : "corpus",
	});
	if (store.backend !== "ryu") {
		await store.close();
		throw new Error(
			"Cypher needs the ryu backend; this process runs the memory fallback, which has no Cypher support. Check that RyuGraph WASM is available.",
		);
	}
	if (database.kind === "derived") {
		// Reuse the snapshot the Web UI / GraphService already wrote when it still matches; otherwise
		// rebuild from the corpus. Same derived graph, just reached without a long-lived service.
		await reconcileGraphStoreOnce(rootDir, store, graphPaths(rootDir, DEFAULT_SLOT), { reuseSnapshot: true });
	} else {
		const loaded = loadSnapshotWithFingerprint(database.source.snapshotPath);
		await hydrateDatabase(store, loaded.snapshot);
	}
	return {
		store,
		database,
		close: () => store.close(),
	};
}

/** Run a read-only Cypher statement against `db` and return the first result set. */
export async function queryDatabase(rootDir: string, db: string, statement: string): Promise<CypherQueryResult> {
	const { store, close } = await openDatabaseReadonly(rootDir, db);
	try {
		return await store.runCypher(statement);
	} finally {
		await close();
	}
}

/**
 * Open a user database for a write: hydrate from its snapshot, run `fn`, then dump the snapshot back
 * and record the new fingerprint. Refuses the read-only `default` database. The caller's `fn` is
 * trusted to issue write Cypher (import / insert); this wrapper only persists the result safely.
 */
export async function withUserDatabaseWrite<T>(
	rootDir: string,
	db: string,
	fn: (store: GraphStore, database: GraphDatabase) => Promise<T>,
): Promise<T> {
	let database: GraphDatabase;
	try {
		database = resolveDatabase(rootDir, db);
	} catch (error) {
		throw new BacklogToolError(error instanceof Error ? error.message : String(error), "RESOURCE_NOT_FOUND");
	}
	if (database.kind !== "user") {
		throw new Error(
			`"${DEFAULT_DATABASE}" is the markdown-derived database and is read-only (it is rebuilt from the corpus, so writes are overwritten). ` +
				"Create a database with graph_create_database and write to that one.",
		);
	}
	mkdirSync(dirname(database.source.dbPath), { recursive: true });
	const lock = tryAcquireGraphLock(database.source.lockPath);
	if (!lock) {
		throw new Error(
			`Database "${database.name}" is being written by another process (lock: ${database.source.lockPath}). ` +
				"The write was aborted to avoid overwriting it; try again later.",
		);
	}
	const store = await openGraphStore(database.source.dbPath, { backend: "ryu", schema: "none" });
	try {
		if (store.backend !== "ryu") {
			throw new Error(
				"Cypher writes need the ryu backend; this process runs the memory fallback, which has no Cypher support. Check that RyuGraph WASM is available.",
			);
		}
		const loaded = loadSnapshotWithFingerprint(database.source.snapshotPath);
		const loadedFingerprint = loaded.fingerprint;
		await hydrateDatabase(store, loaded.snapshot);
		const result = await fn(store, database);
		// A second window: the snapshot must still be the one we hydrated before we overwrite it.
		const current = snapshotFingerprint(database.source.snapshotPath);
		if (current !== loadedFingerprint) {
			throw new Error(
				`The snapshot of database "${database.name}" changed after it was loaded (recorded ${loadedFingerprint ?? "no file"}, ` +
					`actual ${current ?? "no file"}). The write was aborted to avoid overwriting those changes.`,
			);
		}
		saveSnapshot(database.source.snapshotPath, await dumpDatabase(store, database.name));
		recordSnapshot(rootDir, database.name, snapshotFingerprint(database.source.snapshotPath));
		return result;
	} finally {
		if (store.backend === "ryu") await store.close();
		lock.release();
	}
}

/** Introspect a database's schema (node tables + properties, relationship tables + endpoints). */
export async function schemaDatabase(
	rootDir: string,
	db: string,
): Promise<Awaited<ReturnType<typeof readSnapshotSchema>>> {
	const { store, close } = await openDatabaseReadonly(rootDir, db);
	try {
		return await readSnapshotSchema(store);
	} finally {
		await close();
	}
}
