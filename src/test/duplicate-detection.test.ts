import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";

function makeTask(id: string, filePath: string, title = "Task"): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01T00:00:00Z",
		labels: [],
		dependencies: [],
		filePath,
	};
}

describe("detectDuplicateTaskIds", () => {
	it("returns empty when no duplicates exist", () => {
		const tasks = [
			makeTask("TASK-1", "backlog/tasks/task-1 - A.md"),
			makeTask("TASK-2", "backlog/tasks/task-2 - B.md"),
		];
		expect(detectDuplicateTaskIds(tasks)).toEqual([]);
	});

	it("detects zero-padding equivalence", () => {
		const tasks = [
			makeTask("TASK-1", "backlog/tasks/task-1 - A.md"),
			makeTask("TASK-01", "backlog/tasks/task-01 - B.md"),
		];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tasks).toHaveLength(2);
	});

	it("detects dotted subtask equivalence", () => {
		const tasks = [
			makeTask("TASK-5.1", "backlog/tasks/task-5.1 - A.md"),
			makeTask("TASK-5.01", "backlog/tasks/task-5.01 - B.md"),
		];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tasks).toHaveLength(2);
	});

	it("groups multiple independent collisions", () => {
		const tasks = [
			makeTask("TASK-1", "backlog/tasks/task-1 - A.md"),
			makeTask("TASK-01", "backlog/tasks/task-01 - B.md"),
			makeTask("TASK-2", "backlog/tasks/task-2 - C.md"),
			makeTask("TASK-02", "backlog/tasks/task-02 - D.md"),
		];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(2);
		expect(groups[0]?.tasks).toHaveLength(2);
		expect(groups[1]?.tasks).toHaveLength(2);
	});

	it("does not flag unique hierarchical IDs as duplicates", () => {
		const tasks = [
			makeTask("TASK-5", "backlog/tasks/task-5 - Parent.md"),
			makeTask("TASK-5.1", "backlog/tasks/task-5.1 - Child.md"),
		];
		expect(detectDuplicateTaskIds(tasks)).toEqual([]);
	});
});
