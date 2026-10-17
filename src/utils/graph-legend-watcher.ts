/**
 * Watch the graph legend store and publish the databases whose config changed.
 *
 * The store is a single file (`backlog/databases/graph-legends.yaml`) with several writers: the
 * server's own PUT route (which broadcasts its writes itself), the CLI, the MCP tools, and an
 * editor. This is that file's feed for every writer except the first. It watches the directory
 * rather than the file, whose inode the store's temp+rename write replaces, and hands the caller
 * each database whose entry was added, edited or removed once a change has settled.
 *
 * Mirrors `milestone-watcher` / `config-watcher`: a settle delay coalesces the burst of events a
 * single save produces, and two consecutive identical reads confirm the file is not mid-write.
 * A baseline suppresses a state that was already published - the API route hands over the map it
 * just wrote (`notePublishedStore`), so a web-side edit is never echoed as a second refresh.
 *
 * A fresh project has no `backlog/databases/` at all (the first registry or legend write creates
 * it), so the watcher starts on the parent directory and moves onto the store's directory once
 * it appears.
 */

import { existsSync, type FSWatcher, watch } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { userDatabasesDir } from "../graph/databases.ts";
import { GRAPH_LEGEND_STORE_FILENAME, graphLegendsPath, parseLegendStoreText } from "../graph/legend-store.ts";

export interface GraphLegendWatcherCallbacks {
	/** Called once per database whose stored config changed (added, edited or removed). */
	onLegendChanged?: (database: string) => void | Promise<void>;
}

export interface GraphLegendWatcherHandle {
	stop(): void;
	/**
	 * Adopt a known store state as the published baseline. The API route calls this with the map
	 * `saveLegendConfig` returned - synchronously, right after its own broadcast - so the watcher
	 * can never echo a web-side edit back as a second refresh.
	 */
	notePublishedStore(store: Record<string, unknown>): void;
}

const SETTLE_DELAY_MS = 50;
const STABILITY_DELAY_MS = 35;
const READ_ATTEMPTS = 8;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The databases whose legend is different between two store states. Compared deeply and
 * order-insensitively, so a rewrite that only reorders keys - or rewrites the same config - is
 * not a change and must not refresh anyone.
 */
function changedDatabases(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
	const changed: string[] = [];
	for (const database of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (!isDeepStrictEqual(before[database], after[database])) changed.push(database);
	}
	return changed;
}

export function watchGraphLegendStore(
	projectRoot: string,
	callbacks: GraphLegendWatcherCallbacks,
): GraphLegendWatcherHandle {
	const dir = userDatabasesDir(projectRoot);
	const path = graphLegendsPath(projectRoot);
	const parentDir = dirname(dir);

	let stopped = false;
	let generation = 0;
	let processing = false;
	let pending = false;
	let lastPublished: Record<string, unknown> = {};
	let dirWatcher: FSWatcher | null = null;
	let parentWatcher: FSWatcher | null = null;

	/** The store's per-database configs, or null when the file never settled / is unreadable. */
	const readStore = async (): Promise<Record<string, unknown> | null> => {
		try {
			const first = await Bun.file(path).text();
			await delay(STABILITY_DELAY_MS);
			if (stopped) return null;
			const second = await Bun.file(path).text();
			if (first !== second) return null;
			return parseLegendStoreText(second);
		} catch {
			// Momentarily unreadable: an atomic rename can briefly remove the target on Windows.
			return null;
		}
	};

	const publish = async (eventGeneration: number): Promise<void> => {
		for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
			await delay(attempt === 0 ? SETTLE_DELAY_MS : STABILITY_DELAY_MS);
			if (stopped || eventGeneration !== generation) return;

			const store = await readStore();
			if (!store) continue;
			const changed = changedDatabases(lastPublished, store);
			if (changed.length === 0) return;

			for (const database of changed) {
				if (stopped || eventGeneration !== generation) return;
				await callbacks.onLegendChanged?.(database);
			}
			lastPublished = store;
			return;
		}
	};

	const drain = async (): Promise<void> => {
		if (processing) return;
		processing = true;
		try {
			do {
				pending = false;
				await publish(generation);
			} while (!stopped && pending);
		} finally {
			processing = false;
			if (!stopped && pending) void drain().catch(() => {});
		}
	};

	const schedule = () => {
		generation += 1;
		pending = true;
		void drain().catch(() => {});
	};

	const closeParentWatcher = () => {
		if (!parentWatcher) return;
		try {
			parentWatcher.close();
		} catch {}
		parentWatcher = null;
	};

	/**
	 * Watch the store's directory once it exists. Until then, watch the parent for its creation:
	 * the directory is made by the first registry or legend write, and a watcher started before
	 * that would otherwise never see the first change - the memo and milestone watchers accept
	 * that gap, but here the first write is the common case for a project adopting legends.
	 */
	const ensureDirWatcher = () => {
		if (stopped || dirWatcher) return;
		try {
			dirWatcher = watch(dir, { recursive: false }, (eventType, filename) => {
				if (eventType !== "change" && eventType !== "rename") return;
				// The store's own temp file starts with the store's name; registry.json and the
				// database files that share this directory are none of this watcher's business.
				if (filename && typeof filename === "string" && !filename.startsWith(GRAPH_LEGEND_STORE_FILENAME)) return;
				schedule();
			});
			dirWatcher.on("error", (error) => {
				if (process.env.DEBUG) console.warn("Graph legend watcher error", error);
			});
			closeParentWatcher();
			return;
		} catch {
			// Directory not there yet: fall through to the parent watch below.
		}
		if (stopped || parentWatcher) return;
		try {
			parentWatcher = watch(parentDir, { recursive: false }, () => {
				if (!existsSync(dir)) return;
				ensureDirWatcher();
				// The write that created the directory may have landed before this watch was
				// attached, so reconcile once immediately instead of waiting for the next edit.
				if (dirWatcher) schedule();
			});
			parentWatcher.on("error", (error) => {
				if (process.env.DEBUG) console.warn("Graph legend watcher parent error", error);
			});
		} catch {
			// No parent either: nothing to watch until the next start, same as the memo watcher.
		}
	};

	ensureDirWatcher();

	// Seed the baseline with the state on disk so configs that predate the watcher are not
	// reported as changes (a client fetches the current state when it mounts anyway).
	void (async () => {
		const store = await readStore();
		if (!stopped && store) lastPublished = store;
	})();

	return {
		stop() {
			stopped = true;
			generation += 1;
			pending = false;
			closeParentWatcher();
			if (dirWatcher) {
				try {
					dirWatcher.close();
				} catch {}
				dirWatcher = null;
			}
		},
		notePublishedStore(store) {
			// Synchronous on purpose: the caller is mid-request, and the file event for that very
			// write cannot be delivered until this returns - so the echo is suppressed before the
			// watcher can even observe the change.
			if (!stopped) lastPublished = store;
		},
	};
}
