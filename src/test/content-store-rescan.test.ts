import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ContentStore, type ContentStoreEvent } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import type { Document, Task } from "../types/index.ts";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup } from "./test-utils.ts";

const sampleTask: Task = {
	id: "task-1",
	title: "Sample Task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-09-19 10:00",
	labels: [],
	dependencies: [],
	rawContent: "## Description\nSeed content",
};

const sampleDocument: Document = {
	id: "doc-1",
	title: "Architecture Guide",
	type: "guide",
	createdDate: "2025-09-19",
	rawContent: "# Architecture Guide",
};

/** The timer callback is private; this invokes the exact logic the periodic scan runs. */
const rescan = (store: ContentStore): Promise<void> =>
	(store as unknown as { runBackgroundReconciliation: () => Promise<void> }).runBackgroundReconciliation();

let TEST_DIR: string;
let filesystem: FileSystem;
let store: ContentStore;

describe("ContentStore periodic self-heal", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-content-store-rescan");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		// Watchers off: the scan is exercised directly, so no fs.watch noise.
		store = new ContentStore(filesystem);
	});

	afterEach(async () => {
		store?.dispose();
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("recovers a task deleted with rm without a restart", async () => {
		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();
		expect(store.getTasks().map((task) => task.id)).toContain("TASK-1");

		// Simulate a local rm that fs.watch would otherwise miss.
		const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: filesystem.tasksDir }));
		const target = files.find((file) => file.toLowerCase().startsWith("task-1"));
		expect(target).toBeDefined();
		await unlink(join(filesystem.tasksDir, target as string));

		await rescan(store);
		expect(store.getTasks().map((task) => task.id)).not.toContain("TASK-1");

		// Recreate the same-named file: the scan must treat it as an add, not stay blind.
		await filesystem.saveTask(sampleTask);
		await rescan(store);
		expect(store.getTasks().map((task) => task.id)).toContain("TASK-1");
	});

	it("captures an out-of-band CLI task edit that the watcher missed", async () => {
		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();
		expect(store.getTasks().find((task) => task.id === "TASK-1")?.title).toBe("Sample Task");

		// Edit the file directly, as the CLI would, then let the scan reconcile it.
		await filesystem.saveTask({ ...sampleTask, title: "Updated Via Scan" });
		await rescan(store);
		expect(store.getTasks().find((task) => task.id === "TASK-1")?.title).toBe("Updated Via Scan");
	});

	it("does not broadcast documents/wikis on the first (seeding) scan", async () => {
		await filesystem.saveDocument(sampleDocument, undefined);
		await mkdir(join(filesystem.docsDir, "existing-folder"), { recursive: true });
		await store.ensureInitialized();

		const events: ContentStoreEvent[] = [];
		const unsubscribe = store.subscribe((event) => events.push(event));

		// First scan seeds the directory baseline silently: the initial page load already has
		// the current tree, so a broadcast here would be spurious.
		await rescan(store);
		unsubscribe();
		expect(events.some((event) => event.type === "documents" || event.type === "wikis")).toBe(false);
	});

	it("re-syncs the documents sidebar tree when an empty folder is created", async () => {
		await filesystem.saveDocument(sampleDocument, undefined);
		await store.ensureInitialized();

		const events: ContentStoreEvent[] = [];
		const unsubscribe = store.subscribe((event) => events.push(event));

		// Seed the directory set, then discard the seeding emissions.
		await rescan(store);
		events.length = 0;

		await mkdir(join(filesystem.docsDir, "new-folder"), { recursive: true });
		await rescan(store);
		const sawDocuments = events.some((event) => event.type === "documents");
		unsubscribe();
		expect(sawDocuments).toBe(true);
	});

	it("re-syncs the documents sidebar tree when an empty folder is removed", async () => {
		await filesystem.saveDocument(sampleDocument, undefined);
		await mkdir(join(filesystem.docsDir, "new-folder"), { recursive: true });
		await store.ensureInitialized();

		const events: ContentStoreEvent[] = [];
		const unsubscribe = store.subscribe((event) => events.push(event));

		await rescan(store);
		events.length = 0;

		await rm(join(filesystem.docsDir, "new-folder"), { recursive: true, force: true });
		await rescan(store);
		const sawDocuments = events.some((event) => event.type === "documents");
		unsubscribe();
		expect(sawDocuments).toBe(true);
	});

	it("re-syncs the wiki sidebar tree when an empty folder is created and removed", async () => {
		await store.ensureInitialized();
		const wikiRoot = join(dirname(filesystem.docsDir), "wiki");

		const events: ContentStoreEvent[] = [];
		const unsubscribe = store.subscribe((event) => events.push(event));

		await rescan(store);
		events.length = 0;

		await mkdir(join(wikiRoot, "wiki-folder"), { recursive: true });
		await rescan(store);
		const sawWikiAdd = events.some((event) => event.type === "wikis");
		events.length = 0;

		await rm(join(wikiRoot, "wiki-folder"), { recursive: true, force: true });
		await rescan(store);
		const sawWikiRemove = events.some((event) => event.type === "wikis");
		unsubscribe();

		expect(sawWikiAdd).toBe(true);
		expect(sawWikiRemove).toBe(true);
	});

	it("self-heals automatically via the background timer (no manual rescan)", async () => {
		// The timer is the real fix; drive it with a tiny interval and confirm it fires on its own.
		process.env.BACKLOG_RESCAN_INTERVAL_MS = "50";
		const timerStore = new ContentStore(filesystem, undefined, true);
		try {
			await filesystem.saveTask(sampleTask);
			await timerStore.ensureInitialized();
			expect(timerStore.getTasks().map((task) => task.id)).toContain("TASK-1");

			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: filesystem.tasksDir }));
			const target = files.find((file) => file.toLowerCase().startsWith("task-1"));
			expect(target).toBeDefined();
			await unlink(join(filesystem.tasksDir, target as string));

			const removed = await waitForRemoval(timerStore, getPlatformTimeout());
			expect(removed).toBe(true);
		} finally {
			timerStore.dispose();
			delete process.env.BACKLOG_RESCAN_INTERVAL_MS;
		}
	});
});

async function waitForRemoval(store: ContentStore, timeout: number): Promise<boolean> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (
			!store
				.getTasks()
				.map((task) => task.id)
				.includes("TASK-1")
		)
			return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}
