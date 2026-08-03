import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

async function writeTaskFile(relativePath: string, content: string): Promise<void> {
	const absolutePath = join(TEST_DIR, relativePath);
	await mkdir(join(absolutePath, ".."), { recursive: true });
	await Bun.write(absolutePath, content);
}

describe("BacklogServer duplicate task ID endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-duplicate-ids");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Duplicate IDs",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await writeTaskFile(
			"backlog/tasks/task-1 - Canonical Duplicate.md",
			`---\nid: TASK-1\ntitle: Canonical Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
		);
		await writeTaskFile(
			"backlog/tasks/task-01 - Zero Padded Duplicate.md",
			`---\nid: TASK-01\ntitle: Zero Padded Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<unknown>("/api/tasks/duplicate-ids");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("previews duplicate task IDs", async () => {
		const preview = await fetchJson<{
			groups: Array<{ id: string; tasks: Array<{ id: string }> }>;
			changes: Array<{ sourcePath: string; targetPath: string }>;
			repairable: boolean;
		}>("/api/tasks/duplicate-ids");

		expect(preview.groups.length).toBe(1);
		expect(preview.groups[0]?.tasks.map((task) => task.id)).toContain("TASK-1");
		expect(preview.groups[0]?.tasks.map((task) => task.id)).toContain("TASK-01");
		expect(preview.changes.length).toBe(1);
		expect(preview.repairable).toBe(true);
	});

	it("repairs duplicate task IDs and retains backups", async () => {
		const result = await fetchJson<{
			repairedFiles: number;
			changes: Array<{ sourcePath: string; targetPath: string }>;
		}>("/api/tasks/duplicate-ids/repair", { method: "POST" });

		expect(result.repairedFiles).toBe(1);
		expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Canonical Duplicate.md")).exists()).toBe(true);
		expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-01 - Zero Padded Duplicate.md")).exists()).toBe(false);
		expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-2 - Zero Padded Duplicate.md")).exists()).toBe(true);

		const backups = await Array.fromAsync(new Bun.Glob("backlog/tasks/*.backlog-doctor-*.bak").scan({ cwd: TEST_DIR }));
		expect(backups.length).toBe(1);
	});

	it("commits a repair by removing retained backups", async () => {
		await fetchJson<unknown>("/api/tasks/duplicate-ids/repair", { method: "POST" });
		const commit = await fetchJson<{ removedBackups: string[] }>("/api/tasks/duplicate-ids/commit", { method: "POST" });
		expect(commit.removedBackups.length).toBe(1);

		const backups = await Array.fromAsync(new Bun.Glob("backlog/tasks/*.backlog-doctor-*.bak").scan({ cwd: TEST_DIR }));
		expect(backups.length).toBe(0);
	});

	it("rolls back a repair to the original files", async () => {
		await fetchJson<unknown>("/api/tasks/duplicate-ids/repair", { method: "POST" });
		const rollback = await fetchJson<{ restored: string[]; removed: string[] }>("/api/tasks/duplicate-ids/rollback", {
			method: "POST",
		});
		expect(rollback.restored.length).toBe(1);
		expect(rollback.removed.length).toBe(1);

		expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-01 - Zero Padded Duplicate.md")).exists()).toBe(true);
		expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-2 - Zero Padded Duplicate.md")).exists()).toBe(false);
	});
});
