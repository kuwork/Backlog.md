import { describe, expect, it } from "bun:test";
import { collectUnresolvedMilestoneIds } from "../core/milestones.ts";
import type { Milestone, Task } from "../types/index.ts";

const task = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

const milestone = (overrides: Partial<Milestone>): Milestone => ({
	id: "m-1",
	title: "Release 1",
	description: "Milestone: Release 1",
	rawContent: "## Description\n\nMilestone: Release 1",
	...overrides,
});

describe("collectUnresolvedMilestoneIds", () => {
	it("returns the ids a task references that no loaded entity covers", () => {
		const tasks = [
			task({ id: "task-1", milestone: "m-1" }),
			// A CLI milestone add while the client was idle: the task names m-9 but the entity list
			// never learned about it, which is what makes the bucket fall back to the raw id.
			task({ id: "task-2", milestone: "m-9" }),
		];
		expect(collectUnresolvedMilestoneIds(tasks, [milestone({ id: "m-1" })])).toEqual(["m-9"]);
	});

	it("returns nothing when every referenced milestone resolves", () => {
		const tasks = [task({ id: "task-1", milestone: "m-1" }), task({ id: "task-2", milestone: "m-2" })];
		const entities = [milestone({ id: "m-1" }), milestone({ id: "m-2", title: "Release 2" })];
		expect(collectUnresolvedMilestoneIds(tasks, entities)).toEqual([]);
	});

	it("returns a referenced id that has no matching entity at all", () => {
		const tasks = [task({ id: "task-1", milestone: "m-3" })];
		expect(collectUnresolvedMilestoneIds(tasks, [])).toEqual(["m-3"]);
	});

	it("ignores tasks with no milestone and archived entities count as covered", () => {
		const tasks = [task({ id: "task-1" }), task({ id: "task-2", milestone: "m-4" })];
		expect(collectUnresolvedMilestoneIds(tasks, [], [milestone({ id: "m-4", title: "Archived" })])).toEqual([]);
	});

	it("deduplicates repeated references", () => {
		const tasks = [task({ id: "task-1", milestone: "m-9" }), task({ id: "task-2", milestone: "m-9" })];
		expect(collectUnresolvedMilestoneIds(tasks, [])).toEqual(["m-9"]);
	});
});
