import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import {
	createUnifiedTaskUpdateCallbacks,
	loadTasksForUnifiedView,
	type UnifiedTaskState,
} from "../ui/unified-view.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("loadTasksForUnifiedView", () => {
	let testDir: string;
	let core: Core;

	beforeEach(() => {
		testDir = createUniqueTestDir("unified-view-load");
		core = new Core(testDir);
	});

	afterEach(async () => {
		try {
			await safeCleanup(testDir);
		} catch {
			// Ignore cleanup failures in tests
		}
	});

	it("uses provided loader progress and closes the loading screen", async () => {
		const updates: string[] = [];
		let closed = false;

		const result = await loadTasksForUnifiedView(core, {
			tasksLoader: async (updateProgress) => {
				updateProgress("step one");
				return { tasks: [], statuses: ["To Do", "In Progress"] };
			},
			loadingScreenFactory: async () => ({
				update: (msg: string) => {
					updates.push(msg);
				},
				close: async () => {
					closed = true;
				},
			}),
		});

		expect(updates).toContain("step one");
		expect(closed).toBe(true);
		expect(result.statuses).toEqual(["To Do", "In Progress"]);
	});

	it("reconciles watcher callbacks and keeps selection valid", async () => {
		const makeTask = (id: string, title: string, status = "To Do"): Task => ({
			id,
			title,
			status,
			assignee: [],
			createdDate: "2026-07-14",
			labels: [],
			dependencies: [],
		});
		const first = makeTask("task-1", "First");
		const selected = makeTask("task-2", "Selected");
		let state: UnifiedTaskState = { tasks: [first, selected], selectedTask: selected };
		const published: UnifiedTaskState[] = [];
		const callbacks = createUnifiedTaskUpdateCallbacks(
			() => state,
			(next) => {
				state = next;
				published.push(next);
			},
		);

		const moved = makeTask("task-2", "Selected edited", "In Progress");
		await callbacks.onTaskChanged?.(moved);
		expect(state.tasks).toEqual([first, moved]);
		expect(state.selectedTask).toBe(moved);

		const added = makeTask("task-3", "Added");
		await callbacks.onTaskAdded?.(added);
		expect(state.tasks).toEqual([first, moved, added]);

		await callbacks.onTaskRemoved?.("task-2");
		expect(state.tasks).toEqual([first, added]);
		expect(state.selectedTask).toBe(added);
		expect(published).toHaveLength(3);
	});
});
