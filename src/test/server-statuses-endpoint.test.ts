import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { DEFAULT_STATE_MACHINE } from "../core/state-machine.ts";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { BacklogConfig, StatusesConfig } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup, withTimeout } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

/**
 * Every request opens its own connection. Bun 1.3.14 on Windows answers only the first request of a
 * keep-alive connection with a route: the second goes to the fallback (404) even though the path is
 * the same one that just matched.
 */
async function request(path: string, init?: RequestInit): Promise<Response> {
	return fetch(`http://127.0.0.1:${serverPort}${path}`, {
		...init,
		headers: { ...(init?.headers as Record<string, string> | undefined), Connection: "close" },
	});
}

const putJson = (path: string, body: unknown) =>
	request(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const savedConfig = async () => new FileSystem(TEST_DIR).loadConfig();

describe("BacklogServer statuses endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-statuses");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Statuses",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		await retry(async () => {
			const response = await request("/api/config");
			if (!response.ok) throw new Error("server not ready");
		});
	});

	afterEach(async () => {
		if (socket) {
			socket.close();
			socket = null;
		}
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("serves plain names — plus the terminal set and the default column, which bare names cannot express", async () => {
		const write = await putJson("/api/config/statuses", { statuses: DEFAULT_STATE_MACHINE });
		expect(write.ok).toBe(true);
		const response = await request("/api/statuses");
		expect(await response.json()).toEqual({
			statuses: ["To Do", "Planning", "Plan Review", "In Progress", "In Review", "Done", "Dropped"],
			terminalStatuses: ["Done", "Dropped"],
			defaultStatus: "To Do",
		});
	});

	it("reports the last column as terminal for a plain string-array machine", async () => {
		const response = await request("/api/statuses");
		expect(await response.json()).toEqual({
			statuses: ["To Do", "In Progress", "Done"],
			terminalStatuses: ["Done"],
			defaultStatus: "To Do",
		});
	});

	it("reports the status named by default_status, even when it is not the initial category", async () => {
		const config = (await (await request("/api/config")).json()) as BacklogConfig & Record<string, unknown>;
		const write = await putJson("/api/config", {
			...config,
			defaultStatus: "In Progress",
			statuses: [
				{ name: "To Do", category: "initial", next: [] },
				{ name: "In Progress", category: "wip", next: [] },
				{ name: "Done", category: "done", exit: "complete", next: [] },
			],
		});
		expect(write.ok).toBe(true);
		const response = await request("/api/statuses");
		const payload = (await response.json()) as { terminalStatuses: string[]; defaultStatus: string };
		expect(payload.terminalStatuses).toEqual(["Done"]);
		expect(payload.defaultStatus).toBe("In Progress");
	});

	it("serves terminalStatuses on /api/config without letting it reach the file", async () => {
		const payload = (await (await request("/api/config")).json()) as BacklogConfig & Record<string, unknown>;
		expect(payload.terminalStatuses).toEqual(["Done"]);
		const response = await putJson("/api/config", payload);
		expect(response.ok).toBe(true);
		const saved = (await savedConfig()) as BacklogConfig & Record<string, unknown>;
		// Derived value, not a setting: serializeConfig writes only keys it knows, so posting the
		// body the API just handed out cannot plant terminalStatuses in config.yml.
		expect(saved.terminalStatuses).toBeUndefined();
		expect(saved.statuses).toEqual(["To Do", "In Progress", "Done"]);
	});

	it("rejects a config save whose statuses cannot be written back", async () => {
		const config = (await (await request("/api/config")).json()) as BacklogConfig;
		const response = await putJson("/api/config", { ...config, statuses: [{ category: "active" }] });
		expect(response.status).toBe(400);
		expect(((await response.json()) as { error: string }).error).toContain("Invalid statuses");
		// Nothing was written: the saved config still holds the original statuses.
		expect((await savedConfig())?.statuses).toEqual(["To Do", "In Progress", "Done"]);
	});

	it("accepts a config save with a well-formed object form and keeps every field", async () => {
		const config = (await (await request("/api/config")).json()) as BacklogConfig;
		const statuses: StatusesConfig = [
			{
				name: "To Do",
				category: "active",
				next: [
					{ to: "Done", when: "finished", ai: "allowed_if", if: "tests pass", requires: "tests", evidence: "diff" },
				],
			},
			{ name: "Done", category: "done", exit: "complete", next: [] },
		];
		const response = await putJson("/api/config", { ...config, statuses });
		expect(response.ok).toBe(true);
		expect((await savedConfig())?.statuses).toEqual(statuses);
	});

	it("writes the agreed seven-column default on its own, leaving the rest of the config alone", async () => {
		const before = (await savedConfig()) as BacklogConfig;
		const response = await putJson("/api/config/statuses", { statuses: DEFAULT_STATE_MACHINE });
		expect(response.ok).toBe(true);
		const after = (await savedConfig()) as BacklogConfig;
		expect(after.statuses).toEqual(DEFAULT_STATE_MACHINE);
		expect(after.projectName).toBe(before.projectName);
		expect(after.dateFormat).toBe(before.dateFormat);
	});

	it("refuses a malformed statuses payload on the dedicated route too", async () => {
		const response = await putJson("/api/config/statuses", { statuses: ["A", "a"] });
		expect(response.status).toBe(400);
		expect((await savedConfig())?.statuses).toEqual(["To Do", "In Progress", "Done"]);
	});

	/**
	 * A config save changes statuses, so the board (which reads /api/statuses) and the terminal
	 * status must reload. The only client signal that triggers a full config/statuses reload is
	 * `config-updated`; `tasks-updated` only re-merges the task corpus and would leave the board
	 * columns unchanged (the bug BACK-715 regression guards against).
	 */
	it("publishes config-updated, not tasks-updated, when a full config save changes statuses", async () => {
		const messages: string[] = [];
		socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
		await withTimeout(
			new Promise<void>((resolve, reject) => {
				if (!socket) return reject(new Error("WebSocket was not created"));
				socket.onopen = () => resolve();
				socket.onerror = () => reject(new Error("WebSocket failed to open"));
			}),
			"statuses broadcast test WebSocket",
			2000,
		);
		socket.onmessage = (event) => messages.push(String(event.data));

		const config = (await (await request("/api/config")).json()) as BacklogConfig;
		const statuses: StatusesConfig = [
			{ name: "To Do", category: "active", next: [] },
			{ name: "Done", category: "done", exit: "complete", next: [] },
		];
		const response = await putJson("/api/config", { ...config, statuses });
		expect(response.ok).toBe(true);

		await retry(
			async () => {
				if (!messages.includes("config-updated")) throw new Error("config-updated was not published");
			},
			40,
			250,
		);
		// The save itself must publish config-updated (the signal the board reloads on). Background
		// indexers may also emit tasks-updated on their own, which is orthogonal to this assertion.
	});

	it("publishes config-updated when the dedicated statuses route changes the machine", async () => {
		const messages: string[] = [];
		socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
		await withTimeout(
			new Promise<void>((resolve, reject) => {
				if (!socket) return reject(new Error("WebSocket was not created"));
				socket.onopen = () => resolve();
				socket.onerror = () => reject(new Error("WebSocket failed to open"));
			}),
			"statuses broadcast test WebSocket",
			2000,
		);
		socket.onmessage = (event) => messages.push(String(event.data));

		const response = await putJson("/api/config/statuses", { statuses: DEFAULT_STATE_MACHINE });
		expect(response.ok).toBe(true);

		await retry(
			async () => {
				if (!messages.includes("config-updated")) throw new Error("config-updated was not published");
			},
			40,
			250,
		);
	});

	/**
	 * Saving statuses must also refresh the machine that is injected into the project's instruction
	 * files, or the guidance an agent reads would keep describing the machine that was just replaced.
	 */
	it("rewrites the injected state machine in AGENTS.md when statuses change", async () => {
		const agentsPath = join(TEST_DIR, "AGENTS.md");
		await Bun.write(
			agentsPath,
			[
				"<!-- BACKLOG.MD GUIDELINES START -->",
				"old guidelines",
				"<!-- BACKLOG.MD GUIDELINES END -->",
				"",
				"<!-- BACKLOG.MD STATE MACHINE START -->",
				"## This project's state machine",
				"",
				"STALE MACHINE",
				"",
				"<!-- BACKLOG.MD STATE MACHINE END -->",
				"",
			].join("\n"),
		);

		const response = await putJson("/api/config/statuses", { statuses: DEFAULT_STATE_MACHINE });
		expect(response.ok).toBe(true);

		const text = await Bun.file(agentsPath).text();
		expect(text).not.toContain("STALE MACHINE");
		expect(text).toContain("| Dropped | dropped | archive | hidden |");
		// Exactly one block, and the guidelines half is left alone.
		expect(text.split("<!-- BACKLOG.MD STATE MACHINE START -->").length - 1).toBe(1);
		expect(text).toContain("old guidelines");
	});
});
