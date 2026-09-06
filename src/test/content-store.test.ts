import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ContentStore, type ContentStoreEvent } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import { serializeDocument } from "../markdown/serializer.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { normalizeTaskId } from "../utils/task-path.ts";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup, sleep } from "./test-utils.ts";

let TEST_DIR: string;

describe("ContentStore", () => {
	let filesystem: FileSystem;
	let store: ContentStore;

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

	const sampleDecision: Decision = {
		id: "decision-1",
		title: "Adopt shared cache",
		date: "2025-09-19",
		status: "proposed",
		context: "Context",
		decision: "Decision text",
		consequences: "Consequences",
		rawContent: "## Context\nContext\n\n## Decision\nDecision text\n\n## Consequences\nConsequences",
	};

	const sampleDocument: Document = {
		id: "doc-1",
		title: "Architecture Guide",
		type: "guide",
		createdDate: "2025-09-19",
		rawContent: "# Architecture Guide",
	};

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-content-store");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
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

	// BACK-602 gates upserts on publication ownership: only tasks filed under
	// the current backlog root (or an explicit matching owner) are accepted.
	const publicationOwner = () => ({ root: resolve(filesystem.backlogDir ?? "") });

	it("loads tasks, documents, and decisions during initialization", async () => {
		await filesystem.saveTask(sampleTask);
		await filesystem.saveDecision(sampleDecision);
		await filesystem.saveDocument(sampleDocument);

		const snapshot = await store.ensureInitialized();

		expect(snapshot.tasks).toHaveLength(1);
		expect(snapshot.documents).toHaveLength(1);
		expect(snapshot.decisions).toHaveLength(1);
		expect(snapshot.tasks.map((task) => task.id)).toContain("TASK-1");
	});

	it("emits task updates when underlying files change", async () => {
		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();

		const waitForUpdate = waitForEventWithTimeout(store, (event) => {
			return event.type === "tasks" && event.tasks.some((task) => task.title === "Updated Task");
		});

		await filesystem.saveTask({ ...sampleTask, title: "Updated Task" });
		await waitForUpdate;

		const tasks = store.getTasks();
		expect(tasks.map((task) => task.title)).toContain("Updated Task");
	});

	it("updates documents when new files are added", async () => {
		await store.ensureInitialized();

		const waitForDocument = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.some((doc) => doc.id === "doc-2");
		});

		await filesystem.saveDocument(
			{
				...sampleDocument,
				id: "doc-2",
				title: "Implementation Notes",
				rawContent: "# Implementation Notes",
			},
			"guides",
		);

		await waitForDocument;

		const documents = store.getDocuments();
		expect(documents.some((doc) => doc.id === "doc-2")).toBe(true);
	});

	it("preserves cross-branch tasks from the task loader during refresh", async () => {
		await filesystem.saveTask(sampleTask);

		const remoteTask: Task = {
			id: "task-remote",
			title: "Remote Task",
			status: "In Progress",
			assignee: ["alice"],
			createdDate: "2025-10-01 12:00",
			labels: ["remote"],
			dependencies: [],
			rawContent: "## Description\nRemote content",
			source: "remote",
		};

		let loaderCalls = 0;
		store.dispose();
		store = new ContentStore(filesystem, async () => {
			loaderCalls += 1;
			const localTasks = await filesystem.listTasks();
			return [...localTasks, remoteTask];
		});

		await store.ensureInitialized();
		expect(store.getTasks().map((task) => task.id)).toContain("task-remote");

		await (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();

		const refreshedTasks = store.getTasks();
		expect(refreshedTasks.map((task) => task.id)).toContain("task-remote");
		expect(loaderCalls).toBeGreaterThanOrEqual(2);
	});

	it("removes decisions when files are deleted", async () => {
		store.dispose();
		store = new ContentStore(filesystem, undefined, true);
		await filesystem.saveDecision(sampleDecision);
		await store.ensureInitialized();

		const decisionsDir = filesystem.decisionsDir;
		const decisionFiles: string[] = [];
		for await (const file of new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true })) {
			decisionFiles.push(file);
		}
		const decisionFile = decisionFiles.find((file) => file.startsWith("decision-1"));
		if (!decisionFile) {
			throw new Error("Expected decision file was not created");
		}

		const waitForRemoval = waitForEventWithTimeout(store, (event) => {
			return event.type === "decisions" && event.decisions.every((decision) => decision.id !== "decision-1");
		});

		await unlink(join(decisionsDir, decisionFile));
		await waitForRemoval;

		const decisions = store.getDecisions();
		expect(decisions.find((decision) => decision.id === "decision-1")).toBeUndefined();
	});

	it("does not overwrite a newer upsert with a stale task refresh", async () => {
		const deferred = createDeferred<Task[]>();
		let loaderCalls = 0;
		store.dispose();
		store = new ContentStore(filesystem, async () => {
			loaderCalls += 1;
			if (loaderCalls === 1) {
				return filesystem.listTasks();
			}
			return await deferred.promise;
		});

		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();
		expect(store.getTasks()[0]?.title).toBe("Sample Task");

		const refreshPromise = (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();
		await waitUntil(() => loaderCalls >= 2);

		store.upsertTask({ ...sampleTask, title: "Updated by upsert" }, publicationOwner());
		deferred.resolve([sampleTask]);

		await refreshPromise;

		const tasks = store.getTasks();
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.title).toBe("Updated by upsert");
	});

	it("does not overwrite a newer save with a stale document refresh", async () => {
		const deferred = createDeferred<Document[]>();
		let listCalls = 0;
		const originalListDocuments = filesystem.listDocuments.bind(filesystem);
		filesystem.listDocuments = async () => {
			listCalls += 1;
			if (listCalls === 1) {
				return originalListDocuments();
			}
			return await deferred.promise;
		};

		let lastSavedDocument = sampleDocument;
		filesystem.loadDocument = async () => {
			return lastSavedDocument;
		};

		store.dispose();
		store = new ContentStore(filesystem);

		await filesystem.saveDocument(sampleDocument);
		await store.ensureInitialized();
		expect(store.getDocuments()[0]?.title).toBe("Architecture Guide");

		const refreshPromise = (
			store as unknown as { refreshDocumentsFromDisk: () => Promise<void> }
		).refreshDocumentsFromDisk();
		await waitUntil(() => listCalls >= 2);

		lastSavedDocument = { ...sampleDocument, title: "Updated by save" };
		await filesystem.saveDocument(lastSavedDocument);
		deferred.resolve([sampleDocument]);

		await refreshPromise;

		const documents = store.getDocuments();
		expect(documents).toHaveLength(1);
		expect(documents[0]?.title).toBe("Updated by save");
	});

	it("preserves concurrent updates to unrelated tasks during a stale refresh", async () => {
		const deferred = createDeferred<Task[]>();
		let loaderCalls = 0;
		// The real loader returns a normalized corpus; mirror that here so the
		// stale refresh merge sees canonical IDs on both sides.
		const normalizeIds = (tasks: Task[]): Task[] => tasks.map((task) => ({ ...task, id: normalizeTaskId(task.id) }));
		store.dispose();
		store = new ContentStore(filesystem, async () => {
			loaderCalls += 1;
			if (loaderCalls === 1) {
				return normalizeIds(await filesystem.listTasks());
			}
			return await deferred.promise;
		});

		const task2: Task = { ...sampleTask, id: "task-2", title: "Task 2" };
		await filesystem.saveTask(sampleTask);
		await filesystem.saveTask(task2);
		await store.ensureInitialized();
		// Real tasks carry their file path, which is the store's identity for
		// in-place updates; reuse the on-disk snapshot so both upserts target
		// distinct files instead of collapsing onto the filePath-less identity.
		const diskSnapshot = normalizeIds(await filesystem.listTasks());
		const diskTask1 = diskSnapshot.find((t) => t.id === "TASK-1");
		const diskTask2 = diskSnapshot.find((t) => t.id === "TASK-2");
		if (!diskTask1 || !diskTask2) throw new Error("Expected both tasks on disk");

		const refreshPromise = (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();
		await waitUntil(() => loaderCalls >= 2);

		store.upsertTask({ ...diskTask1, title: "Updated TASK-1" }, publicationOwner());
		store.upsertTask({ ...diskTask2, title: "Updated TASK-2" }, publicationOwner());
		deferred.resolve(diskSnapshot);

		await refreshPromise;

		const tasks = store.getTasks();
		// The store exposes canonical (prefix-normalized, uppercase) IDs.
		expect(tasks.find((t) => t.id === "TASK-1")?.title).toBe("Updated TASK-1");
		expect(tasks.find((t) => t.id === "TASK-2")?.title).toBe("Updated TASK-2");
	});

	it("preserves an ABA value cycle during a stale refresh", async () => {
		const deferred = createDeferred<Task[]>();
		let loaderCalls = 0;
		store.dispose();
		store = new ContentStore(filesystem, async () => {
			loaderCalls += 1;
			if (loaderCalls === 1) {
				return filesystem.listTasks();
			}
			return await deferred.promise;
		});

		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();

		const refreshPromise = (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();
		await waitUntil(() => loaderCalls >= 2);

		// In-memory value goes A -> B -> A (same final value as disk, but newer generation).
		store.upsertTask({ ...sampleTask, title: "Intermediate" }, publicationOwner());
		store.upsertTask({ ...sampleTask, title: "Sample Task" }, publicationOwner());
		deferred.resolve([sampleTask]);

		await refreshPromise;

		const tasks = store.getTasks();
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.title).toBe("Sample Task");
		// The in-memory version should still be newer; a subsequent write should not be overwritten by the same stale refresh.
		store.upsertTask({ ...sampleTask, title: "Final" }, publicationOwner());
		expect(store.getTasks()[0]?.title).toBe("Final");
	});

	it("settles a watched document file whose name omits the title suffix", async () => {
		store.dispose();

		const untitledPath = join(filesystem.docsDir, "doc-1.md");
		await Bun.write(untitledPath, serializeDocument({ ...sampleDocument, path: undefined }));

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();

		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.id).toBe("doc-1");
		expect(store.getDocuments()[0]?.path).toBe("doc-1.md");

		const waitForUpdate = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.some((doc) => doc.type === "specification");
		});
		await Bun.write(untitledPath, serializeDocument({ ...sampleDocument, type: "specification", path: undefined }));
		await waitForUpdate;

		expect(store.getDocuments()[0]?.type).toBe("specification");
	});

	it("reconciles a padded filename with an unpadded frontmatter id on load and delete", async () => {
		store.dispose();

		const paddedPath = "doc-0001 - Architecture Guide.md";
		await Bun.write(join(filesystem.docsDir, paddedPath), serializeDocument({ ...sampleDocument, path: undefined }));

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();

		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.id).toBe("doc-1");
		expect(store.getDocuments()[0]?.path).toBe(paddedPath);

		const waitForDeletion = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.length === 0;
		});
		await unlink(join(filesystem.docsDir, paddedPath));
		await waitForDeletion;

		expect(store.getDocuments()).toHaveLength(0);
	});

	it("drops the replaced entry when a file is renamed and its frontmatter id respelled", async () => {
		store.dispose();

		const oldPath = "doc-1 - Old.md";
		const newPath = "doc-2 - New.md";

		await Bun.write(
			join(filesystem.docsDir, oldPath),
			serializeDocument({ ...sampleDocument, id: "doc-1", title: "Old", path: undefined }),
		);

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.id).toBe("doc-1");

		// Delete first, then create the new file, so the old entry is gone before publish.
		await unlink(join(filesystem.docsDir, oldPath));
		await Bun.write(
			join(filesystem.docsDir, newPath),
			serializeDocument({ ...sampleDocument, id: "doc-2", title: "New", path: undefined }),
		);

		await waitUntil(
			() => store.getDocuments().length === 1 && store.getDocuments()[0]?.id === "doc-2",
			getPlatformTimeout(),
		);

		const documents = store.getDocuments();
		expect(documents[0]?.path).toBe(newPath);
	});

	it("handles a document moved into and renamed within a subfolder", async () => {
		store.dispose();

		const oldPath = "doc-1.md";
		const newPath = "guides/doc-1 - Moved.md";

		await Bun.write(join(filesystem.docsDir, oldPath), serializeDocument({ ...sampleDocument, path: undefined }));

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.path).toBe(oldPath);

		const waitForUpdate = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.some((doc) => doc.path === newPath);
		});

		const docsNewPath = join(filesystem.docsDir, "guides");
		await Bun.write(join(docsNewPath, "doc-1 - Moved.md"), serializeDocument({ ...sampleDocument, path: undefined }));
		await unlink(join(filesystem.docsDir, oldPath));
		await waitForUpdate;

		const documents = store.getDocuments();
		expect(documents).toHaveLength(1);
		expect(documents[0]?.id).toBe("doc-1");
		expect(documents[0]?.path).toBe(newPath);
	});

	it("removes documents when a containing folder is deleted", async () => {
		store.dispose();

		await Bun.write(
			join(filesystem.docsDir, "guides", "doc-1 - Foldered.md"),
			serializeDocument({ ...sampleDocument, path: undefined }),
		);

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.path).toBe("guides/doc-1 - Foldered.md");

		const waitForRemoval = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.length === 0;
		});

		await rm(join(filesystem.docsDir, "guides"), { recursive: true, force: true });
		await waitForRemoval;

		expect(store.getDocuments()).toHaveLength(0);
	});

	it("does not resurrect a dropped equivalent document during a concurrent refresh", async () => {
		const deferred = createDeferred<Document[]>();
		let listCalls = 0;
		const originalListDocuments = filesystem.listDocuments.bind(filesystem);
		filesystem.listDocuments = async () => {
			listCalls += 1;
			if (listCalls === 1) {
				return originalListDocuments();
			}
			return await deferred.promise;
		};

		const oldPath = "doc-1 - Title.md";
		const newPath = "doc-0001 - Title.md";
		await Bun.write(
			join(filesystem.docsDir, oldPath),
			serializeDocument({ ...sampleDocument, id: "doc-1", path: undefined }),
		);

		store.dispose();
		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		expect(store.getDocuments()).toHaveLength(1);
		expect(store.getDocuments()[0]?.id).toBe("doc-1");

		const refreshPromise = (
			store as unknown as { refreshDocumentsFromDisk: () => Promise<void> }
		).refreshDocumentsFromDisk();
		await waitUntil(() => listCalls >= 2);

		// Delete first, then create the equivalent file, so the store never sees two equivalents at once.
		await unlink(join(filesystem.docsDir, oldPath));
		await Bun.write(
			join(filesystem.docsDir, newPath),
			serializeDocument({ ...sampleDocument, id: "doc-0001", path: undefined }),
		);

		// Wait for the watcher to settle: the old entry should be gone and the new one published.
		await waitUntil(
			() => store.getDocuments().length === 1 && store.getDocuments()[0]?.id === "doc-0001",
			getPlatformTimeout(),
		);

		deferred.resolve([{ ...sampleDocument, id: "doc-1", path: oldPath }]);
		await refreshPromise;

		const documents = store.getDocuments();
		expect(documents).toHaveLength(1);
		expect(documents[0]?.id).toBe("doc-0001");
		expect(documents[0]?.path).toBe(newPath);
	});

	it("keeps padding-equivalent siblings apart when a frontmatter id is respelled", async () => {
		store.dispose();

		const alphaPath = "doc-001 - Alpha guide.md";
		const betaPath = "doc-01 - Beta guide.md";

		await Bun.write(
			join(filesystem.docsDir, alphaPath),
			serializeDocument({ ...sampleDocument, id: "doc-001", title: "Alpha guide", path: undefined }),
		);
		await Bun.write(
			join(filesystem.docsDir, betaPath),
			serializeDocument({ ...sampleDocument, id: "doc-01", title: "Beta guide", path: undefined }),
		);

		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();

		expect(store.getDocuments()).toHaveLength(2);
		expect(store.getDocuments().map((doc) => [doc.id, doc.path])).toEqual([
			["doc-001", alphaPath],
			["doc-01", betaPath],
		]);

		const waitForUpdate = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.some((doc) => doc.id === "doc-1");
		});
		await Bun.write(
			join(filesystem.docsDir, betaPath),
			serializeDocument({ ...sampleDocument, id: "doc-1", title: "Beta guide", path: undefined }),
		);
		await waitForUpdate;

		expect(store.getDocuments()).toHaveLength(2);
		expect(store.getDocuments().map((doc) => [doc.id, doc.path])).toEqual([
			["doc-001", alphaPath],
			["doc-1", betaPath],
		]);
	});
});

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
} {
	let resolve: (value: T) => void = () => {};
	let reject: (error: Error) => void = () => {};
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function waitUntil(predicate: () => boolean, timeout = 1000): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeout) {
			throw new Error("waitUntil timeout");
		}
		await sleep(10);
	}
}

function waitForEventWithTimeout(
	store: ContentStore,
	predicate: (event: ContentStoreEvent) => boolean,
	timeout = getPlatformTimeout(),
): Promise<ContentStoreEvent> {
	const eventPromise = new Promise<ContentStoreEvent>((resolve) => {
		const unsubscribe = store.subscribe((event) => {
			if (!predicate(event)) {
				return;
			}
			unsubscribe();
			resolve(event);
		});
	});

	return Promise.race([
		eventPromise,
		sleep(timeout).then(() => {
			throw new Error("Timed out waiting for content store event");
		}),
	]);
}
