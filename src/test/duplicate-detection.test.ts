import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { detectDuplicateTaskIds, hasDraftIdentityFindings } from "../utils/duplicate-detection.ts";
import { draftIdentityKey, findDuplicateDraftFilenameGroups } from "../utils/task-path.ts";

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

describe("draftIdentityKey", () => {
	it("canonicalizes prefix casing and zero padding", () => {
		const expected = draftIdentityKey("draft-1");

		expect(draftIdentityKey("DRAFT-1")).toBe(expected);
		expect(draftIdentityKey("draft-01")).toBe(expected);
		expect(draftIdentityKey("draft-0001")).toBe(expected);
		expect(draftIdentityKey("  1  ")).toBe(expected);
	});

	it("canonicalizes every dotted segment", () => {
		const expected = draftIdentityKey("draft-1.2.3");

		expect(draftIdentityKey("DRAFT-1.02.003")).toBe(expected);
		expect(draftIdentityKey("draft-01.2.3")).toBe(expected);
	});

	it("keeps distinct identities apart", () => {
		expect(draftIdentityKey("draft-1")).not.toBe(draftIdentityKey("draft-1.1"));
		expect(draftIdentityKey("draft-1")).not.toBe(draftIdentityKey("draft-2"));
	});

	it("returns an empty key for an empty id", () => {
		expect(draftIdentityKey("   ")).toBe("");
	});
});

describe("findDuplicateDraftFilenameGroups", () => {
	it("returns nothing when every filename claims its own identity", () => {
		expect(findDuplicateDraftFilenameGroups(["draft-1 - A.md", "draft-2 - B.md", "draft-1.1 - C.md"])).toEqual([]);
	});

	it("groups padded twins and sorted dotted twins", () => {
		expect(
			findDuplicateDraftFilenameGroups(["draft-1 - A.md", "draft-01 - B.md", "draft-1.1 - C.md", "draft-1.01 - D.md"]),
		).toEqual([
			["draft-1 - A.md", "draft-01 - B.md"],
			["draft-1.1 - C.md", "draft-1.01 - D.md"],
		]);
	});

	it("ignores filenames that declare no draft identity", () => {
		expect(findDuplicateDraftFilenameGroups(["notes.md", "draft-1 - A.md"])).toEqual([]);
	});
});

describe("hasDraftIdentityFindings", () => {
	it("is false when nothing was found", () => {
		expect(hasDraftIdentityFindings({ duplicates: [], unreadable: [], drifted: [] })).toBe(false);
	});

	it("is true for each kind of finding", () => {
		expect(
			hasDraftIdentityFindings({ duplicates: [{ id: "DRAFT-1", paths: ["a", "b"] }], unreadable: [], drifted: [] }),
		).toBe(true);
		expect(hasDraftIdentityFindings({ duplicates: [], unreadable: ["draft-1 - A.md"], drifted: [] })).toBe(true);
		expect(
			hasDraftIdentityFindings({
				duplicates: [],
				unreadable: [],
				drifted: [{ path: "draft-1 - A.md", frontmatterId: "DRAFT-2", filenameId: "DRAFT-1" }],
			}),
		).toBe(true);
	});
});
