import { closeSync, mkdirSync, openSync, unlinkSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_DATABASE, type GraphDatabase, recordSnapshot, resolveDatabase } from "../../../graph/databases.ts";
import { DEFAULT_SLOT, graphPaths } from "../../../graph/paths.ts";
import { reconcileGraphStoreOnce } from "../../../graph/reconcile-once.ts";
import {
	dumpDatabase,
	hydrateDatabase,
	loadSnapshotWithFingerprint,
	saveSnapshot,
	snapshotFingerprint,
} from "../../../graph/snapshot.ts";
import { type CypherQueryResult, type GraphStore, openGraphStore } from "../../../graph/store.ts";

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
	const database = resolveDatabase(rootDir, db);
	mkdirSync(dirname(database.source.dbPath), { recursive: true });
	const store = await openGraphStore(database.source.dbPath, {
		backend: "ryu",
		schema: database.kind === "user" ? "none" : "corpus",
	});
	if (store.backend !== "ryu") {
		await store.close();
		throw new Error("Cypher 操作需要 ryu 后端；当前已降级为 memory（不支持 Cypher）。请确认 RyuGraph WASM 可用。");
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
	const database = resolveDatabase(rootDir, db);
	if (database.kind !== "user") {
		throw new Error(
			`"${DEFAULT_DATABASE}" 是 markdown 派生库、只读（每次从语料重建，写入会被覆盖）。` +
				"请先 graph_create_database 建库，再写入那个库。",
		);
	}
	mkdirSync(dirname(database.source.dbPath), { recursive: true });
	const lock = tryAcquireGraphLock(database.source.lockPath);
	if (!lock) {
		throw new Error(
			`数据库 "${database.name}" 正被另一个进程写入（锁：${database.source.lockPath}）。` +
				"为避免覆盖对方的写入，本次写入已中止，请稍后重试。",
		);
	}
	const store = await openGraphStore(database.source.dbPath, { backend: "ryu", schema: "none" });
	try {
		if (store.backend !== "ryu") {
			throw new Error("Cypher 写入需要 ryu 后端；当前已降级为 memory（不支持 Cypher）。请确认 RyuGraph WASM 可用。");
		}
		const loaded = loadSnapshotWithFingerprint(database.source.snapshotPath);
		const loadedFingerprint = loaded.fingerprint;
		await hydrateDatabase(store, loaded.snapshot);
		const result = await fn(store, database);
		// A second window: the snapshot must still be the one we hydrated before we overwrite it.
		const current = snapshotFingerprint(database.source.snapshotPath);
		if (current !== loadedFingerprint) {
			throw new Error(
				`数据库 "${database.name}" 的快照在本次加载之后被改动过（记录 ${loadedFingerprint ?? "无文件"}，` +
					`实际 ${current ?? "无文件"}）。为避免覆盖这些改动，本次写入已中止。`,
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
