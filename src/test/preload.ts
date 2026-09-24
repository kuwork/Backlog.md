import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Test runs must never write into the real graph cache directory (see src/graph/paths.ts).
 * Every suite that boots a server - or the graph itself - would otherwise leave hashed kuzu
 * entries, sidecars and stale locks behind in the user's cache, one set per temp project.
 *
 * A suite that needs its own directory can still set BACKLOG_GRAPH_CACHE_DIR itself first.
 */
process.env.BACKLOG_GRAPH_CACHE_DIR ??= mkdtempSync(join(tmpdir(), "backlog-graph-cache-"));
