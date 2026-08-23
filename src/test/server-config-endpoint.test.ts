import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

describe("BacklogServer config endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-config");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Config",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<BacklogConfig>("/api/config");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("round-trips defaultAssignee through the config endpoint", async () => {
		const updated = await fetchJson<BacklogConfig>("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectName: "Server Config",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
				defaultAssignee: ["@alice", "@bob"],
			}),
		});

		expect(updated.defaultAssignee).toEqual(["@alice", "@bob"]);

		const loaded = await fetchJson<BacklogConfig>("/api/config");
		expect(loaded.defaultAssignee).toEqual(["@alice", "@bob"]);
	});

	it("clears defaultAssignee when omitted from the update payload", async () => {
		// First set a value
		await fetchJson<BacklogConfig>("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectName: "Server Config",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
				defaultAssignee: ["@alice"],
			}),
		});

		// Then omit defaultAssignee to clear it
		const updated = await fetchJson<BacklogConfig>("/api/config", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectName: "Server Config",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
			}),
		});

		expect(updated.defaultAssignee).toBeUndefined();

		const loaded = await fetchJson<BacklogConfig>("/api/config");
		expect(loaded.defaultAssignee).toBeUndefined();
	});
});
