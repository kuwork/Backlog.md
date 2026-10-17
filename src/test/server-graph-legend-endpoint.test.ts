import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { parse as parseYAML } from "yaml";
import { graphLegendsPath, saveLegendConfig } from "../graph/legend-store.ts";
import type { GraphLegendUpdatedDetail } from "../graph/legend-updated.ts";
import { encodeGraphLegendUpdatedMessage, parseGraphLegendUpdatedMessage } from "../graph/legend-updated.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch } from "./test-utils.ts";

installCloseConnectionFetch();

interface Running {
	dir: string;
	server: BacklogServer;
	baseUrl: string;
}

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.on("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			if (!address || typeof address === "string") {
				probe.close(() => reject(new Error("Unable to allocate test port.")));
				return;
			}
			probe.close(() => resolve(address.port));
		});
	});
}

async function startProject(): Promise<Running> {
	const dir = createUniqueTestDir("test-graph-legend");
	// Minimal project: a backlog directory + a tiny config so the server boots cleanly.
	mkdirSync(join(dir, "backlog"), { recursive: true });
	writeFileSync(join(dir, "backlog", "config.yml"), "project_name: Legend Test\nautoPort: false\n", "utf8");

	const server = new BacklogServer(dir);
	const port = await getFreePort();
	await server.start(port, false);
	const resolvedPort = server.getPort() ?? port;
	return { dir, server, baseUrl: `http://127.0.0.1:${resolvedPort}` };
}

const SAMPLE = { types: { Person: { caption: "{{name}}", color: "#3b82f6", rules: [] } } };

describe("graph legend persistence endpoints (BACK-806)", () => {
	let ctx: Running;

	beforeEach(async () => {
		ctx = await startProject();
	});

	afterEach(async () => {
		try {
			await ctx?.server.stop();
		} catch {
			// best-effort teardown
		}
		try {
			if (ctx?.dir) rmSync(ctx.dir, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	test("GET returns 204 when no config exists for the database", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/graph/legend?database=demo`);
		expect(res.status).toBe(204);
		expect(await res.text()).toBe("");
	});

	test("GET 400 when the database query param is missing", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/graph/legend`);
		expect(res.status).toBe(400);
	});

	test("round-trip: PUT then GET returns the stored config and writes a block-style LF file", async () => {
		const put = await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "demo", config: SAMPLE }),
		});
		expect(put.status).toBe(204);

		const get = await fetch(`${ctx.baseUrl}/api/graph/legend?database=demo`);
		expect(get.status).toBe(200);
		expect(await get.json()).toEqual(SAMPLE);

		const path = graphLegendsPath(ctx.dir);
		const raw = readFileSync(path, "utf8");
		// Block-style YAML: more than one line, LF endings only, a mapping (not JSON braces).
		expect(raw.split("\n").length).toBeGreaterThan(1);
		expect(raw).not.toContain("\r\n");
		expect(raw).toContain("demo:");
		expect(raw.trimStart().startsWith("{")).toBe(false);
		// Round-trips.
		expect(parseYAML(raw)).toEqual({ demo: SAMPLE });
	});

	test("PUT rejects a non-plain-object config with 400 and leaves the file untouched", async () => {
		const bad = await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "demo", config: "not-an-object" }),
		});
		expect(bad.status).toBe(400);
		// File must be left untouched: it was never created, so it must not exist.
		expect(existsSync(graphLegendsPath(ctx.dir))).toBe(false);

		// Arrays are also rejected.
		const arr = await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "demo", config: [1, 2, 3] }),
		});
		expect(arr.status).toBe(400);
		expect(existsSync(graphLegendsPath(ctx.dir))).toBe(false);
	});

	test("PUT with config:null removes the database entry (reset)", async () => {
		await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "demo", config: SAMPLE }),
		});
		const reset = await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "demo", config: null }),
		});
		expect(reset.status).toBe(204);

		const get = await fetch(`${ctx.baseUrl}/api/graph/legend?database=demo`);
		expect(get.status).toBe(204);

		// Other databases are untouched.
		await fetch(`${ctx.baseUrl}/api/graph/legend`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ database: "other", config: SAMPLE }),
		});
		const other = await fetch(`${ctx.baseUrl}/api/graph/legend?database=other`);
		expect(other.status).toBe(200);
		expect(await other.json()).toEqual(SAMPLE);
	});

	test("a successful PUT broadcasts graph-legend-updated with the database in the payload", async () => {
		const detail = await new Promise<GraphLegendUpdatedDetail | null>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${ctx.server.getPort()}`);
			const timer = setTimeout(() => {
				ws.close();
				reject(new Error("timed out waiting for graph-legend-updated broadcast"));
			}, 10000);
			ws.addEventListener("open", () => {
				fetch(`${ctx.baseUrl}/api/graph/legend`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ database: "demo", config: SAMPLE }),
				}).catch(reject);
			});
			ws.addEventListener("message", (event) => {
				// Ignore unrelated broadcasts (e.g. graph-ready / graph-started) and only resolve on
				// the legend update we triggered.
				const parsed = parseGraphLegendUpdatedMessage(event.data);
				if (!parsed) return;
				clearTimeout(timer);
				ws.close();
				resolve(parsed);
			});
			ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`ws error: ${JSON.stringify(event)}`));
			});
		});
		expect(detail).not.toBeNull();
		expect(detail?.database).toBe("demo");
	});

	test("encode/parse of the broadcast payload round-trips", () => {
		const encoded = encodeGraphLegendUpdatedMessage("default");
		expect(encoded).toContain("graph-legend-updated");
		expect(parseGraphLegendUpdatedMessage(encoded)).toEqual({ database: "default" });
		expect(parseGraphLegendUpdatedMessage("graph-updated")).toBeNull();
	});

	test("an out-of-band write to graph-legends.yaml broadcasts graph-legend-updated (BACK-810)", async () => {
		const detail = await new Promise<GraphLegendUpdatedDetail | null>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${ctx.server.getPort()}`);
			const timer = setTimeout(() => {
				ws.close();
				reject(new Error("timed out waiting for the watcher's graph-legend-updated broadcast"));
			}, 10000);
			ws.addEventListener("open", () => {
				// What the CLI, an MCP tool, or an editor does: write the store file directly, with
				// no HTTP request - the watcher must turn that into the same broadcast.
				try {
					saveLegendConfig(ctx.dir, "demo", SAMPLE);
				} catch (error) {
					clearTimeout(timer);
					ws.close();
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			});
			ws.addEventListener("message", (event) => {
				const parsed = parseGraphLegendUpdatedMessage(event.data);
				if (!parsed) return;
				clearTimeout(timer);
				ws.close();
				resolve(parsed);
			});
			ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`ws error: ${JSON.stringify(event)}`));
			});
		});
		expect(detail?.database).toBe("demo");
	});

	test("the file watcher does not echo the API route's own write (BACK-810)", async () => {
		const seen: string[] = [];
		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${ctx.server.getPort()}`);
			const timer = setTimeout(() => {
				ws.close();
				reject(new Error("timed out waiting for the API route's legend broadcast"));
			}, 10000);
			ws.addEventListener("open", () => {
				fetch(`${ctx.baseUrl}/api/graph/legend`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ database: "demo", config: SAMPLE }),
				}).catch(reject);
			});
			ws.addEventListener("message", (event) => {
				const parsed = parseGraphLegendUpdatedMessage(event.data);
				if (!parsed) return;
				seen.push(parsed.database);
				// The route's own broadcast has landed; hold the socket open a while longer so a
				// watcher echo would certainly arrive inside the window if it were going to.
				setTimeout(() => {
					clearTimeout(timer);
					ws.close();
					resolve();
				}, 800);
			});
			ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`ws error: ${JSON.stringify(event)}`));
			});
		});
		expect(seen).toEqual(["demo"]);
	});

	test("re-saving an unchanged legend broadcasts nothing (BACK-810)", async () => {
		const seen: string[] = [];
		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${ctx.server.getPort()}`);
			const timer = setTimeout(() => {
				ws.close();
				reject(new Error("timed out waiting for the first legend broadcast"));
			}, 10000);
			ws.addEventListener("open", () => {
				fetch(`${ctx.baseUrl}/api/graph/legend`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ database: "demo", config: SAMPLE }),
				}).catch(reject);
			});
			ws.addEventListener("message", (event) => {
				const parsed = parseGraphLegendUpdatedMessage(event.data);
				if (!parsed) return;
				seen.push(parsed.database);
				// Save the exact same config again: the legend did not change, so nothing may be
				// broadcast - hold the socket open well past the watcher's settle window to prove
				// the silence (neither the route nor the watcher may speak).
				fetch(`${ctx.baseUrl}/api/graph/legend`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ database: "demo", config: SAMPLE }),
				})
					.then(() =>
						setTimeout(() => {
							clearTimeout(timer);
							ws.close();
							resolve();
						}, 800),
					)
					.catch(reject);
			});
			ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`ws error: ${JSON.stringify(event)}`));
			});
		});
		expect(seen).toEqual(["demo"]);
	});

	test("removing an absent legend entry broadcasts nothing (BACK-810)", async () => {
		const seen: string[] = [];
		await new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${ctx.server.getPort()}`);
			// No frame is expected: the entry was never there, so nothing changed.
			const timer = setTimeout(() => {
				ws.close();
				resolve();
			}, 800);
			ws.addEventListener("open", () => {
				fetch(`${ctx.baseUrl}/api/graph/legend`, {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ database: "demo", config: null }),
				}).catch(reject);
			});
			ws.addEventListener("message", (event) => {
				const parsed = parseGraphLegendUpdatedMessage(event.data);
				if (!parsed) return;
				seen.push(parsed.database);
			});
			ws.addEventListener("error", (event) => {
				clearTimeout(timer);
				reject(new Error(`ws error: ${JSON.stringify(event)}`));
			});
		});
		expect(seen).toEqual([]);
	});
});
