import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import { resolveBacklogDirectory } from "../utils/backlog-directory.ts";
import { DEFAULT_SLOT, graphPaths } from "./paths.ts";
import { emptySnapshot, saveSnapshot, snapshotFingerprint } from "./snapshot.ts";

/**
 * Named graph databases.
 *
 * `default` is the derived graph of the markdown corpus: a rebuildable **cache**, so it lives in the
 * OS cache directory and is always read-only. Everything the user creates is **user data** and lives
 * with the project, under `<backlog>/databases/`, so it is versionable, portable and backed up with
 * the repository:
 *
 *   backlog/databases/registry.json          the register of user databases
 *   backlog/databases/<name>.graph.json      the durable snapshot (see snapshot.ts)
 *   backlog/databases/<name>.lock            per-database single-holder lock
 *
 * Per-database locks are what keep `default` and every user database from blocking one another.
 */

/** The built-in database: the derived markdown graph. Always read-only. */
export const DEFAULT_DATABASE = "default";

/** Where user databases live, relative to the backlog directory. Shared with the init structure. */
export const USER_DATABASES_DIR = DEFAULT_DIRECTORIES.DATABASES;

export const REGISTRY_VERSION = 1;
export const MAX_DATABASE_NAME_LENGTH = 64;

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export type GraphDatabaseKind = "derived" | "user";

export interface DatabaseSource {
	/** The path handed to the graph store. ryu keeps the data in WASM memory, so this is a handle. */
	dbPath: string;
	/** The JSON snapshot that makes a user database durable (empty for the derived database). */
	snapshotPath: string;
	/** Per-database single-holder lock. */
	lockPath: string;
}

export interface GraphDatabase {
	name: string;
	kind: GraphDatabaseKind;
	description: string;
	createdAt: string | null;
	updatedAt: string | null;
	/**
	 * Content hash of the snapshot as the CLI last wrote it, or null when nothing is recorded
	 * (a derived database, or a database created before this field existed). Comparing it with the
	 * file on disk is what detects an out-of-band edit between two CLI runs.
	 */
	snapshotFingerprint: string | null;
	source: DatabaseSource;
}

interface RegistryEntry {
	description: string;
	createdAt: string;
	updatedAt: string;
	snapshotFingerprint?: string | null;
}

interface Registry {
	version: number;
	databases: Record<string, RegistryEntry>;
}

export function userDatabasesDir(projectRoot: string): string {
	const backlogDir = resolveBacklogDirectory(projectRoot).backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG;
	return join(projectRoot, backlogDir, USER_DATABASES_DIR);
}

export function registryPath(projectRoot: string): string {
	return join(userDatabasesDir(projectRoot), "registry.json");
}

export function userDatabaseSource(projectRoot: string, name: string): DatabaseSource {
	const dir = userDatabasesDir(projectRoot);
	return {
		dbPath: join(dir, `${name}.kuzu`),
		snapshotPath: join(dir, `${name}.graph.json`),
		lockPath: join(dir, `${name}.lock`),
	};
}

/** Validate a user database name; returns an error message, or null when the name is usable. */
export function validateDatabaseName(name: string): string | null {
	if (name.length === 0) return "数据库名不能为空。";
	if (name === DEFAULT_DATABASE) return `"${DEFAULT_DATABASE}" 是内置数据库名，不能占用。`;
	if (name.length > MAX_DATABASE_NAME_LENGTH) return `数据库名过长（上限 ${MAX_DATABASE_NAME_LENGTH} 字符）。`;
	if (!NAME_PATTERN.test(name)) return "数据库名只能包含字母、数字、下划线和连字符，且必须以字母开头。";
	return null;
}

export function readRegistry(projectRoot: string): Registry {
	try {
		const parsed = JSON.parse(readFileSync(registryPath(projectRoot), "utf8")) as Partial<Registry>;
		if (parsed && typeof parsed === "object" && parsed.databases && typeof parsed.databases === "object") {
			return { version: parsed.version ?? REGISTRY_VERSION, databases: parsed.databases };
		}
	} catch {
		/* missing or unreadable: an empty registry is the correct fail-safe */
	}
	return { version: REGISTRY_VERSION, databases: {} };
}

export function writeRegistry(projectRoot: string, registry: Registry): void {
	const dir = userDatabasesDir(projectRoot);
	mkdirSync(dir, { recursive: true });
	const path = registryPath(projectRoot);
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
	renameSync(tmp, path); // atomic: a crash mid-write never truncates the registry
}

/** The derived database descriptor - always available, never registered. */
export function derivedDatabase(projectRoot: string): GraphDatabase {
	const paths = graphPaths(projectRoot, DEFAULT_SLOT);
	return {
		name: DEFAULT_DATABASE,
		kind: "derived",
		description: "markdown corpus (derived, read-only)",
		createdAt: null,
		updatedAt: null,
		snapshotFingerprint: null,
		source: { dbPath: paths.dbPath, snapshotPath: "", lockPath: paths.lockPath },
	};
}

/** `default` first, then every user database in name order. */
export function listDatabases(projectRoot: string): GraphDatabase[] {
	const registry = readRegistry(projectRoot);
	const users = Object.entries(registry.databases)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([name, entry]): GraphDatabase => ({
				name,
				kind: "user",
				description: entry.description,
				createdAt: entry.createdAt,
				updatedAt: entry.updatedAt,
				snapshotFingerprint: entry.snapshotFingerprint ?? null,
				source: userDatabaseSource(projectRoot, name),
			}),
		);
	return [derivedDatabase(projectRoot), ...users];
}

/** Resolve a database by name, throwing a message that lists what is actually available. */
export function resolveDatabase(projectRoot: string, name: string): GraphDatabase {
	if (name === DEFAULT_DATABASE) return derivedDatabase(projectRoot);
	const entry = readRegistry(projectRoot).databases[name];
	if (entry) {
		return {
			name,
			kind: "user",
			description: entry.description,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
			snapshotFingerprint: entry.snapshotFingerprint ?? null,
			source: userDatabaseSource(projectRoot, name),
		};
	}
	const known = listDatabases(projectRoot).map((db) => db.name);
	throw new Error(
		`数据库 "${name}" 不存在。可用：${known.join(", ")}；用 \`backlog graph create ${name} "<描述>"\` 新建。`,
	);
}

/** Register a new user database and write its (empty) snapshot so it exists on disk immediately. */
export function createDatabase(projectRoot: string, name: string, description: string): GraphDatabase {
	const invalid = validateDatabaseName(name);
	if (invalid) throw new Error(invalid);
	const registry = readRegistry(projectRoot);
	if (Object.hasOwn(registry.databases, name)) throw new Error(`数据库 "${name}" 已存在。`);
	const source = userDatabaseSource(projectRoot, name);
	saveSnapshot(source.snapshotPath, emptySnapshot(name));
	const now = timestamp();
	registry.databases[name] = {
		description,
		createdAt: now,
		updatedAt: now,
		snapshotFingerprint: snapshotFingerprint(source.snapshotPath),
	};
	writeRegistry(projectRoot, registry);
	return resolveDatabase(projectRoot, name);
}

/** Remove a user database: its registry entry, its snapshot and any stale lock. */
export function dropDatabase(projectRoot: string, name: string): void {
	const invalid = validateDatabaseName(name);
	if (invalid) throw new Error(invalid);
	const registry = readRegistry(projectRoot);
	if (!Object.hasOwn(registry.databases, name)) throw new Error(`数据库 "${name}" 不存在。`);
	delete registry.databases[name];
	writeRegistry(projectRoot, registry);
	const source = userDatabaseSource(projectRoot, name);
	rmSync(source.snapshotPath, { force: true });
	rmSync(`${source.snapshotPath}.tmp`, { force: true });
	rmSync(source.lockPath, { force: true });
}

/**
 * Record a successful write: bump `updatedAt` and store the fingerprint the CLI just wrote, so the
 * next run can tell whether the file was touched by anything else in the meantime.
 */
export function recordSnapshot(projectRoot: string, name: string, fingerprint: string | null): void {
	const registry = readRegistry(projectRoot);
	const entry = registry.databases[name];
	if (!entry) return;
	entry.updatedAt = timestamp();
	entry.snapshotFingerprint = fingerprint;
	writeRegistry(projectRoot, registry);
}

function timestamp(): string {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
