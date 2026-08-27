import { describe, expect, it } from "bun:test";
import { ContentStore, type ContentStoreEvent } from "../core/content-store.ts";
import type { FileSystem } from "../file-system/operations.ts";
import type { Task } from "../types/index.ts";

function task(id: string, title = "Task", source?: "completed"): Task {
	return {
		id,
		title,
		status: source === "completed" ? "Done" : "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		...(source ? { source } : {}),
		filePath: `backlog/tasks/${id}.md`,
	};
}

/**
 * Deterministic filesystem fake for publication-owner tests. `listTasks` returns the
 * active corpus and `listCompletedTasks` the completed one; both can be swapped live to
 * model warm reconciliation without touching the real filesystem.
 */
class FakeFileSystem
	implements
		Pick<
			FileSystem,
			| "backlogDir"
			| "listTasks"
			| "listCompletedTasks"
			| "ensureBacklogStructure"
			| "listDocuments"
			| "listDecisions"
			| "listWikiPages"
		>
{
	constructor(
		private active: Task[] = [],
		private completed: Task[] = [],
	) {}
	get backlogDir(): string {
		return "/fake/project/backlog";
	}
	setActive(tasks: Task[]): void {
		this.active = tasks;
	}
	setCompleted(tasks: Task[]): void {
		this.completed = tasks;
	}
	async listTasks(): Promise<Task[]> {
		return this.active.map((t) => ({ ...t }));
	}
	async listCompletedTasks(): Promise<Task[]> {
		return this.completed.map((t) => ({ ...t }));
	}
	async ensureBacklogStructure(): Promise<void> {}
	async listDocuments(): Promise<never[]> {
		return [];
	}
	async listDecisions(): Promise<never[]> {
		return [];
	}
	async listWikiPages(): Promise<never[]> {
		return [];
	}
}

describe("ContentStore publication ownership", () => {
	it("defer tasks written for a different publication root until the store owns it", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Active")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		// Publish a task under an owner root that is not the current store root.
		store.upsertTask(task("TASK-2", "Foreign"), { root: "/other/project/backlog" });

		// The foreign task must not become visible; it waits for the store to own its root.
		expect(store.getTasks().map((t) => t.id)).not.toContain("TASK-2");
		// And it is absent from the read snapshot too.
		const snapshot = await store.getTaskCorpusSnapshot();
		expect(snapshot.activeTasks.map((t) => t.id)).not.toContain("TASK-2");
	});

	it("publishes a working-copy task whose owner matches the current root immediately", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Active")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		store.upsertTask({ ...task("TASK-1", "Renamed"), filePath: "/fake/project/backlog/tasks/task-1.md" });
		expect(store.getTasks().find((t) => t.id === "TASK-1")?.title).toBe("Renamed");
	});

	it("exposes whether the store finished initialization", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Active")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		expect(store.isInitialized()).toBe(false);
		await store.ensureInitialized();
		expect(store.isInitialized()).toBe(true);
	});
});

describe("ContentStore batch transitions", () => {
	it("coalesces multiple upserts inside batchTaskUpdates into a single tasks event", async () => {
		const fs = new FakeFileSystem([task("TASK-1"), task("TASK-2"), task("TASK-3")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		const tasksEvents: ContentStoreEvent[] = [];
		store.subscribe((event) => {
			if (event.type === "tasks") tasksEvents.push(event);
		});

		await store.batchTaskUpdates(async () => {
			store.upsertTask({ ...task("TASK-1", "A"), filePath: "/fake/project/backlog/tasks/task-1.md" });
			store.upsertTask({ ...task("TASK-2", "B"), filePath: "/fake/project/backlog/tasks/task-2.md" });
			store.upsertTask({ ...task("TASK-3", "C"), filePath: "/fake/project/backlog/tasks/task-3.md" });
		});

		expect(tasksEvents).toHaveLength(1);
		expect(store.getTasks().map((t) => t.title)).toEqual(["A", "B", "C"]);
	});

	it("transitionTask moves an active task into the completed corpus", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Active"), task("TASK-2", "Other")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		store.transitionTask("TASK-1", task("TASK-1", "Done", "completed"));

		const snapshot = await store.getTaskCorpusSnapshot();
		expect(snapshot.activeTasks.map((t) => t.id)).not.toContain("TASK-1");
		expect(snapshot.completedTasks.map((t) => t.id)).toContain("TASK-1");
		// Active view no longer shows the completed task.
		expect(store.getTasks().map((t) => t.id)).not.toContain("TASK-1");
	});

	it("transitionTask without a completed payload only removes the active task", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Active"), task("TASK-2", "Other")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		store.transitionTask("TASK-1");

		const snapshot = await store.getTaskCorpusSnapshot();
		expect(snapshot.activeTasks.map((t) => t.id)).toEqual(["TASK-2"]);
		expect(snapshot.completedTasks.map((t) => t.id)).not.toContain("TASK-1");
	});
});

describe("ContentStore warm corpus reconciliation", () => {
	it("refreshLocalTaskCorpus surfaces local changes without reloading branches", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Old"), task("TASK-2", "Keep")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();
		expect(store.getTasks().map((t) => t.title)).toEqual(["Old", "Keep"]);

		// A local file changed and a new completed task appeared, all behind the store.
		fs.setActive([task("TASK-1", "New"), task("TASK-2", "Keep")]);
		fs.setCompleted([task("TASK-3", "Closed", "completed")]);

		await store.refreshLocalTaskCorpus();

		expect(store.getTasks().map((t) => t.title)).toEqual(["New", "Keep"]);
		const snapshot = await store.getTaskCorpusSnapshot();
		expect(snapshot.completedTasks.map((t) => t.id)).toContain("TASK-3");
	});

	it("refreshLocalTaskCorpus emits exactly one tasks event on change", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Old")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		const tasksEvents: ContentStoreEvent[] = [];
		store.subscribe((event) => {
			if (event.type === "tasks") tasksEvents.push(event);
		});

		fs.setActive([task("TASK-1", "New")]);
		await store.refreshLocalTaskCorpus();

		expect(tasksEvents).toHaveLength(1);
		expect(store.getTasks()[0]?.title).toBe("New");
	});

	it("refreshLocalTaskCorpus emits no event when nothing changed", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Same")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		const tasksEvents: ContentStoreEvent[] = [];
		store.subscribe((event) => {
			if (event.type === "tasks") tasksEvents.push(event);
		});

		await store.refreshLocalTaskCorpus();

		expect(tasksEvents).toHaveLength(0);
	});
});

describe("ContentStore publication-owner concurrent reload", () => {
	it("keeps an upsert made while a full task refresh is in flight", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Disk")]);
		let callCount = 0;
		let store: ContentStore;
		const loader = async () => {
			callCount += 1;
			if (callCount === 2) {
				// Simulate a concurrent in-memory write that happens after the refresh
				// captured its "before" snapshot but before the loader returns.
				store.upsertTask({
					...task("TASK-1", "InMemory"),
					filePath: "/fake/project/backlog/tasks/task-1.md",
				});
			}
			return fs.listTasks();
		};
		store = new ContentStore(fs as unknown as FileSystem, loader);
		await store.ensureInitialized();
		expect(store.getTasks()[0]?.title).toBe("Disk");

		fs.setActive([task("TASK-1", "Disk"), task("TASK-2", "NewDisk")]);
		await store.refreshTasks();

		expect(store.getTasks().find((t) => t.id === "TASK-1")?.title).toBe("InMemory");
		expect(
			store
				.getTasks()
				.map((t) => t.id)
				.sort(),
		).toEqual(["TASK-1", "TASK-2"]);
	});

	it("retains an in-memory upsert when the disk copy disappears during a refresh", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Disk"), task("TASK-2", "Keep")]);
		let callCount = 0;
		let store: ContentStore;
		const loader = async () => {
			callCount += 1;
			if (callCount === 2) {
				store.upsertTask({
					...task("TASK-1", "InMemory"),
					filePath: "/fake/project/backlog/tasks/task-1.md",
				});
			}
			return fs.listTasks();
		};
		store = new ContentStore(fs as unknown as FileSystem, loader);
		await store.ensureInitialized();

		fs.setActive([task("TASK-2", "Keep")]);
		await store.refreshTasks();

		expect(
			store
				.getTasks()
				.map((t) => t.id)
				.sort(),
		).toEqual(["TASK-1", "TASK-2"]);
	});

	it("removes an unmodified task when the disk copy disappears", async () => {
		const fs = new FakeFileSystem([task("TASK-1", "Disk"), task("TASK-2", "Keep")]);
		const store = new ContentStore(fs as unknown as FileSystem, async () => fs.listTasks());
		await store.ensureInitialized();

		fs.setActive([task("TASK-2", "Keep")]);
		await store.refreshTasks();

		expect(store.getTasks().map((t) => t.id)).toEqual(["TASK-2"]);
	});
});
