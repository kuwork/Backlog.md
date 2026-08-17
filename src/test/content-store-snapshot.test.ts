import { describe, expect, it } from "bun:test";
import { ContentStore } from "../core/content-store.ts";
import type { FileSystem } from "../file-system/operations.ts";
import type { Task } from "../types/index.ts";

function task(id: string, title = "Task"): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
	};
}

class FakeFileSystem
	implements
		Pick<
			FileSystem,
			"listCompletedTasks" | "ensureBacklogStructure" | "listDocuments" | "listDecisions" | "listWikiPages"
		>
{
	constructor(private readonly completed: Task[]) {}
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

describe("ContentStore corpus snapshot", () => {
	it("separates active and completed tasks in the snapshot", async () => {
		const store = new ContentStore(
			new FakeFileSystem([task("TASK-9", "Done task")]) as unknown as FileSystem,
			async () => [task("TASK-1", "Active")],
		);
		const snapshot = await store.getTaskCorpusSnapshot();
		expect(snapshot.activeTasks.map((t) => t.id)).toEqual(["TASK-1"]);
		expect(snapshot.completedTasks.map((t) => t.id)).toEqual(["TASK-9"]);
	});

	it("resolves a task by padded-insensitive ID", async () => {
		const store = new ContentStore(new FakeFileSystem([]) as unknown as FileSystem, async () => [
			task("TASK-0042", "Padded"),
		]);
		const resolved = await store.resolveTaskForRead("task-42");
		expect(resolved.task?.id).toBe("TASK-0042");
	});

	it("returns not-found without throwing when the ID is absent", async () => {
		const store = new ContentStore(new FakeFileSystem([]) as unknown as FileSystem, async () => [
			task("TASK-1", "Active"),
		]);
		const resolved = await store.resolveTaskForRead("TASK-99");
		expect(resolved.task).toBeUndefined();
		expect(resolved.candidates).toBeUndefined();
	});

	it("mutation resolution ignores completed variants", async () => {
		const store = new ContentStore(new FakeFileSystem([task("TASK-1", "Done")]) as unknown as FileSystem, async () => [
			task("TASK-1", "Active"),
		]);
		const resolved = await store.resolveTaskForMutation("TASK-1");
		expect(resolved.task?.title).toBe("Active");
	});
});
