import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Where the derived task graph lives (doc-014 §0/§3.3).
 *
 * The Kuzu database is nothing but a cache of the markdown truth, so it is never written into the
 * repository. Every instance gets its own database, named after hash(project path + slot):
 *
 *   <cache dir>/backlog-graph-<hash>.kuzu             the database (Kuzu creates a directory)
 *   <cache dir>/backlog-graph-<hash>.kuzu.meta.json   the fingerprint sidecar
 *   <cache dir>/backlog-graph-<hash>.kuzu.lock        the single-holder lock
 *
 * The slot is the instance discriminator, and it is what keeps concurrent processes from fighting
 * over one library: the Web UI claims `port-<port>` (a bound port already identifies that session
 * uniquely) and the TUI claims `tui`, so a browser session, a second browser on another port and a
 * TUI can each hold a graph for the same project at the same time.
 */

/** Instance discriminator inside the cache name space: `port-6478`, `tui`, `default`. */
export type GraphSlot = string;

/** Used when a process has no session identity yet (tests, an unbound server). */
export const DEFAULT_SLOT: GraphSlot = "default";

/**
 * The TUI slot. A TUI session has no port to name it, so it takes this one: its database stays
 * separate from every Web UI session's, and a TUI never blocks (or is blocked by) the browser.
 */
export const TUI_SLOT: GraphSlot = "tui";

/** The Web UI slot: the port it actually bound, so two sessions never share a database. */
export function portSlot(port: number): GraphSlot {
	return `port-${port}`;
}

export interface GraphPaths {
	/** Every file below sits here; handy when a stale cache needs a look. */
	dir: string;
	dbPath: string;
	metaPath: string;
	lockPath: string;
}

export function graphCacheDir(override = process.env.BACKLOG_GRAPH_CACHE_DIR): string {
	if (override) return resolve(override);
	const home = homedir();
	switch (process.platform) {
		case "win32":
			return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "backlog.md", "graph");
		case "darwin":
			return join(home, "Library", "Caches", "backlog.md", "graph");
		default:
			return join(process.env.XDG_CACHE_HOME ?? join(home, ".cache"), "backlog.md", "graph");
	}
}

export function graphPaths(projectRoot: string, slot: GraphSlot = DEFAULT_SLOT): GraphPaths {
	const dir = graphCacheDir();
	const key = `${normalizeProjectRoot(projectRoot)}\n${slot}`;
	const hash = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 16);
	const dbPath = join(dir, `backlog-graph-${hash}.kuzu`);
	// The sidecar and the lock live next to the database they belong to, so removing one cache
	// entry removes all three.
	return { dir, dbPath, metaPath: `${dbPath}.meta.json`, lockPath: `${dbPath}.lock` };
}

function normalizeProjectRoot(projectRoot: string): string {
	const absolute = resolve(projectRoot);
	// Windows paths are case-insensitive: C:\Repo and c:\repo are the same project and must hash
	// to the same cache entry.
	return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}
