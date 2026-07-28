import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
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

describe("BacklogServer preview endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-preview");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Preview",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		const backlogDir = filesystem.backlogDir;
		await mkdir(join(backlogDir, "tasks"), { recursive: true });
		await mkdir(join(backlogDir, "docs"), { recursive: true });
		await mkdir(join(backlogDir, "decisions"), { recursive: true });
		await mkdir(join(backlogDir, "wiki"), { recursive: true });

		await writeFile(
			join(backlogDir, "tasks", "task-1 - Preview-Test.md"),
			["# TASK-1", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n"),
		);
		await writeFile(
			join(backlogDir, "docs", "doc-1 - Preview-Test.md"),
			["---", "id: doc-1", "title: Preview Test", "---", "# Doc 1", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n"),
		);
		await writeFile(
			join(backlogDir, "decisions", "decision-1 - Preview-Test.md"),
			["# Decision 1", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n"),
		);
		await writeFile(
			join(backlogDir, "wiki", "preview-test.md"),
			["# Wiki Page", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n"),
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<string[]>("/api/tasks");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("previews a task with a line range", async () => {
		const result = await fetchJson<{ content: string; lineStart?: number; lineEnd?: number; totalLines: number }>(
			"/api/preview?type=task&id=1&lineStart=2&lineEnd=4",
		);

		expect(result.content).toBe(["Line 2", "Line 3", "Line 4"].join("\n"));
		expect(result.lineStart).toBe(2);
		expect(result.lineEnd).toBe(4);
		expect(result.totalLines).toBe(5);
	});

	it("previews a document with a single line", async () => {
		const result = await fetchJson<{ content: string; lineStart?: number; lineEnd?: number }>(
			"/api/preview?type=doc&id=doc-1&lineStart=7",
		);

		expect(result.content).toBe("Line 3");
		expect(result.lineStart).toBe(7);
		expect(result.lineEnd).toBe(7);
	});

	it("previews a decision with a line range", async () => {
		const result = await fetchJson<{ content: string; lineStart?: number; lineEnd?: number }>(
			"/api/preview?type=decision&id=1&lineStart=1&lineEnd=2",
		);

		expect(result.content).toBe(["# Decision 1", "Line 2"].join("\n"));
		expect(result.lineStart).toBe(1);
		expect(result.lineEnd).toBe(2);
	});

	it("previews a wiki page with a line range", async () => {
		const result = await fetchJson<{ content: string; lineStart?: number; lineEnd?: number }>(
			"/api/preview?type=wiki&id=preview-test&lineStart=2&lineEnd=3",
		);

		expect(result.content).toBe(["Line 2", "Line 3"].join("\n"));
		expect(result.lineStart).toBe(2);
		expect(result.lineEnd).toBe(3);
	});

	it("returns 404 for missing entity", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/preview?type=task&id=999&lineStart=1`);
		expect(response.status).toBe(404);
	});

	it("returns 400 for invalid preview type", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/preview?type=unknown&id=1`);
		expect(response.status).toBe(400);
	});
});
