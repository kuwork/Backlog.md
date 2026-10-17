import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { saveLegendConfig } from "../graph/legend-store.ts";
import { type GraphLegendWatcherHandle, watchGraphLegendStore } from "../utils/graph-legend-watcher.ts";
import { createUniqueTestDir, sleep } from "./test-utils.ts";

/**
 * Unit tests for the graph legend store watcher (BACK-810).
 *
 * Every write goes through `saveLegendConfig` - the same atomic temp+rename path the CLI and the
 * MCP tools use - so these tests exercise exactly what an out-of-band writer does to the file.
 */

const SAMPLE = { types: { Person: { caption: "{{name}}", color: "#3b82f6", rules: [] } } };

/** Records every broadcast; `waitFor` resolves once `count` messages have arrived. */
class Recorder {
	readonly messages: string[] = [];

	async record(database: string): Promise<void> {
		this.messages.push(database);
	}

	async waitFor(count: number, timeoutMs = 5000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		while (this.messages.length < count) {
			if (Date.now() > deadline) {
				throw new Error(`timed out waiting for ${count} broadcasts, got ${JSON.stringify(this.messages)}`);
			}
			await sleep(20);
		}
	}

	async expectSilent(windowMs = 700): Promise<void> {
		await sleep(windowMs);
		expect(this.messages).toEqual([]);
	}
}

describe("graph legend store watcher (BACK-810)", () => {
	let dir: string;
	let watcher: GraphLegendWatcherHandle | null = null;
	let recorder: Recorder;

	function startWatcher(): Recorder {
		recorder = new Recorder();
		watcher = watchGraphLegendStore(dir, { onLegendChanged: (database) => recorder.record(database) });
		return recorder;
	}

	beforeEach(() => {
		dir = createUniqueTestDir("test-legend-watcher");
		mkdirSync(join(dir, "backlog"), { recursive: true });
	});

	afterEach(() => {
		try {
			watcher?.stop();
		} catch {
			// best-effort teardown
		}
		watcher = null;
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	test("broadcasts the changed database once when the store is written out-of-band", async () => {
		const rec = startWatcher();
		// Wait for the initial baseline read to land so the seed cannot race the write.
		await sleep(150);

		saveLegendConfig(dir, "demo", SAMPLE);

		await rec.waitFor(1);
		await sleep(400); // let any duplicate settle
		expect(rec.messages).toEqual(["demo"]);
	});

	test("broadcasts only the database that changed, not its neighbours", async () => {
		saveLegendConfig(dir, "demo", SAMPLE);
		saveLegendConfig(dir, "other", SAMPLE);
		const rec = startWatcher();
		await sleep(150);

		saveLegendConfig(dir, "other", { types: { FileNode: { caption: "{{path}}" } } });

		await rec.waitFor(1);
		await sleep(400);
		expect(rec.messages).toEqual(["other"]);
	});

	test("broadcasts a removal like a write", async () => {
		saveLegendConfig(dir, "demo", SAMPLE);
		const rec = startWatcher();
		await sleep(150);

		saveLegendConfig(dir, "demo", null);

		await rec.waitFor(1);
		await sleep(400);
		expect(rec.messages).toEqual(["demo"]);
	});

	test("stays silent when the same content is rewritten", async () => {
		saveLegendConfig(dir, "demo", SAMPLE);
		const rec = startWatcher();
		await sleep(150);

		saveLegendConfig(dir, "demo", { types: { Person: { caption: "{{name}}", color: "#3b82f6", rules: [] } } });

		await rec.expectSilent();
	});

	test("coalesces rapid successive writes into one broadcast per settled state", async () => {
		const rec = startWatcher();
		await sleep(150);

		// Three writes to the same database before the settle delay can elapse.
		saveLegendConfig(dir, "demo", { types: { A: {} } });
		saveLegendConfig(dir, "demo", { types: { B: {} } });
		saveLegendConfig(dir, "demo", { types: { C: {} } });

		await rec.waitFor(1);
		await sleep(400);
		expect(rec.messages).toEqual(["demo"]);
	});

	test("waits for the databases directory when the project has none (fresh project)", async () => {
		// No backlog/databases/ yet: the watcher must start on the parent and move across.
		const rec = startWatcher();
		await sleep(150);

		saveLegendConfig(dir, "demo", SAMPLE); // creates the directory and the file in one go

		await rec.waitFor(1);
		await sleep(400);
		expect(rec.messages).toEqual(["demo"]);
	});

	test("notePublishedStore suppresses the echo of an API-route write", async () => {
		const rec = startWatcher();
		await sleep(150);

		// What the PUT route does: write, then hand the watcher the map the write returned - the
		// watcher must stay silent for that change, exactly as it must for a web-side edit.
		const stored = saveLegendConfig(dir, "demo", SAMPLE);
		watcher?.notePublishedStore(stored.map);
		await rec.expectSilent();

		// A subsequent out-of-band edit is still reported.
		saveLegendConfig(dir, "demo", { types: { Other: {} } });
		await rec.waitFor(1);
		await sleep(400);
		expect(rec.messages).toEqual(["demo"]);
	});

	test("stays silent when a rewrite only reorders keys", async () => {
		saveLegendConfig(dir, "demo", SAMPLE);
		const rec = startWatcher();
		await sleep(150);

		// Same legend, different key order (an editor tidying the file, a normalizing writer):
		// the picture is identical, so nobody should be refreshed.
		saveLegendConfig(dir, "demo", { types: { Person: { rules: [], color: "#3b82f6", caption: "{{name}}" } } });

		await rec.expectSilent();
	});

	test("stop() closes the watcher: later writes produce nothing", async () => {
		const rec = startWatcher();
		await sleep(150);

		watcher?.stop();
		saveLegendConfig(dir, "demo", SAMPLE);

		await rec.expectSilent();
	});
});
