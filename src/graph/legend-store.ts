import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import { userDatabasesDir } from "./databases.ts";

/**
 * Per-database graph legend configs (BACK-806 / M-16).
 *
 * Stored as a single file `backlog/databases/graph-legends.yaml` (next to `registry.json`), mapping
 * database name -> legend config. The file is block-style YAML so it versions cleanly through git
 * and stays hand-editable (comments allowed); deep validation stays client-side in
 * `normalizeLegendConfig`. The server and the CLI both read and write through this module - there is
 * no second storage path.
 */

/** The single file that holds every database's legend config. */
export const GRAPH_LEGEND_STORE_FILENAME = "graph-legends.yaml";

/** The on-disk shape: a database-name -> legend-config map. */
export type LegendConfigMap = Record<string, unknown>;

/** Absolute path to the legend store file for a project. */
export function graphLegendsPath(projectRoot: string): string {
	return join(userDatabasesDir(projectRoot), GRAPH_LEGEND_STORE_FILENAME);
}

/**
 * Load the whole map. Tolerant read: a missing or corrupt file yields an empty map rather than
 * throwing, so the server and CLI never crash on a half-written or hand-edited file.
 */
export function loadLegendConfigs(projectRoot: string): LegendConfigMap {
	try {
		const parsed = parseYAML(readFileSync(graphLegendsPath(projectRoot), "utf8")) as unknown;
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as LegendConfigMap;
		}
	} catch {
		/* missing or unreadable: an empty map is the correct fail-safe */
	}
	return {};
}

/** Load the stored config for one database, or null when none exists. */
export function loadLegendConfig(projectRoot: string, database: string): unknown | null {
	const all = loadLegendConfigs(projectRoot);
	return Object.hasOwn(all, database) ? all[database] : null;
}

/**
 * Write (or remove) a database's legend config atomically.
 *
 * - `config` is a plain object: store it under `database`.
 * - `config` is null: delete `database`'s entry (no-op when it is already absent).
 *
 * Validation that `config` is a plain object is the caller's responsibility (server + CLI both
 * validate before reaching this function); this module only performs the durable write.
 *
 * The write is atomic: a temp file is fully written, then renamed over the target, so a crash
 * mid-write never truncates the store. YAML is a superset of JSON, so a config that arrived over
 * the HTTP API as JSON is stored verbatim in block style.
 */
export function saveLegendConfig(projectRoot: string, database: string, config: unknown | null): void {
	const all = loadLegendConfigs(projectRoot);
	if (config === null) {
		if (!Object.hasOwn(all, database)) return; // idempotent remove
		delete all[database];
	} else {
		all[database] = config;
	}
	const dir = userDatabasesDir(projectRoot);
	mkdirSync(dir, { recursive: true });
	const path = graphLegendsPath(projectRoot);
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, `${stringifyYAML(all, { indent: 2, lineWidth: 0 })}\n`, "utf8");
	renameSync(tmp, path); // atomic: a crash mid-write never truncates the store
}
