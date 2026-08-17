import { describe, expect, it } from "bun:test";
import { TaskIdentityIndex, type TaskIdentityRecord } from "../core/task-identity-index.ts";
import type { Task } from "../types/index.ts";

const context = {
	repositoryRoot: "/repo",
	projectRoot: "/repo",
	backlogDirectory: "backlog",
};

function task(title: string, id = "BACK-1", status = "To Do"): Task {
	return {
		id,
		title,
		status,
		assignee: [],
		createdDate: "2026-08-01",
		labels: [],
		dependencies: [],
	};
}

function index(records: TaskIdentityRecord[]): TaskIdentityIndex {
	return new TaskIdentityIndex(records, context, ["To Do", "In Progress", "Done"], "most_progressed");
}

function record(partial: Partial<TaskIdentityRecord> & { id: string; path: string }): TaskIdentityRecord {
	return {
		type: "task",
		branch: "main",
		lastModified: new Date("2026-08-01T10:00:00Z"),
		...partial,
	};
}

describe("TaskIdentityIndex", () => {
	it("prefers a live record over an equal-time archive independent of scan order", () => {
		const active = record({
			id: "BACK-001",
			path: "backlog/tasks/back-1 - Shared.md",
			task: task("Active"),
		});
		const archived = record({
			id: "BACK-1",
			type: "archived",
			path: "backlog/archive/tasks/back-1 - Shared.md",
		});

		for (const records of [
			[active, archived],
			[archived, active],
		]) {
			expect(
				index(records)
					.getTasks()
					.map((candidate) => candidate.title),
			).toEqual(["Active"]);
		}
	});

	it("resolves same ID at the same path as one identity with the working copy authoritative", () => {
		const branchCopy = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Login.md",
			branch: "feature/auth",
			lastModified: new Date("2026-08-02T10:00:00Z"),
			task: task("Branch version", "BACK-1", "Done"),
		});
		const workingCopy = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Login.md",
			branch: "local",
			workingCopy: true,
			lastModified: new Date("2026-08-01T10:00:00Z"),
			task: task("Working version", "BACK-1", "To Do"),
		});

		const resolved = index([branchCopy, workingCopy]).resolve("BACK-1");
		expect(resolved.status).toBe("found");
		if (resolved.status === "found") {
			expect(resolved.task.title).toBe("Working version");
		}
	});

	it("fails closed when the same canonical ID has distinct live paths", () => {
		const first = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Login.md",
			task: task("Login", "BACK-1"),
		});
		const second = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Signup.md",
			branch: "feature/x",
			task: task("Signup", "BACK-1"),
		});

		const resolved = index([first, second]).resolve("BACK-1");
		expect(resolved.status).toBe("ambiguous");
		if (resolved.status === "ambiguous") {
			expect(resolved.candidates.length).toBe(2);
		}
	});

	it("treats padded and unpadded spellings as one identity", () => {
		const padded = record({
			id: "BACK-0042",
			path: "backlog/tasks/back-42 - Padded.md",
			task: task("Padded", "BACK-0042"),
		});
		const plain = record({
			id: "BACK-42",
			path: "backlog/tasks/back-42 - Padded.md",
			branch: "feature/y",
			task: task("Plain", "BACK-42", "In Progress"),
		});

		expect(index([padded, plain]).getTasks()).toHaveLength(1);
	});

	it("hides all-archived identities and frees the ID", () => {
		const archived = record({
			id: "BACK-1",
			type: "archived",
			path: "backlog/archive/tasks/back-1 - Gone.md",
		});
		const archiveCopy = record({
			id: "BACK-1",
			type: "archived",
			branch: "feature/z",
			path: "backlog/archive/tasks/back-1 - Gone.md",
		});

		const identityIndex = index([archived, archiveCopy]);
		expect(identityIndex.getTasks()).toHaveLength(0);
		expect(identityIndex.getOccupiedIds()).toEqual([]);
		expect(identityIndex.resolve("BACK-1").status).toBe("not-found");
	});

	it("keeps the ID occupied while any live variant exists", () => {
		const live = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Live.md",
			task: task("Live", "BACK-1"),
		});
		const archived = record({
			id: "BACK-1",
			type: "archived",
			path: "backlog/archive/tasks/back-1 - Live.md",
		});

		const identityIndex = index([live, archived]);
		expect(identityIndex.getOccupiedIds()).toEqual(["BACK-1"]);
	});

	it("applies working-copy authority across lifecycle records", () => {
		const active = record({
			id: "BACK-1",
			path: "backlog/tasks/back-1 - Shared.md",
			workingCopy: true,
			task: task("Active", "BACK-1"),
		});
		const completed = record({
			id: "BACK-1",
			type: "completed",
			path: "backlog/completed/back-1 - Shared.md",
			workingCopy: true,
			lastModified: new Date("2026-08-03T10:00:00Z"),
			task: task("Completed", "BACK-1", "Done"),
		});

		const identityIndex = index([active, completed]);
		// Working-copy active record keeps canonical state active even when completed exists
		expect(identityIndex.getTasks(false).map((candidate) => candidate.title)).toEqual(["Active"]);
		expect(identityIndex.getTasks(true).map((candidate) => candidate.title)).toEqual(["Active"]);

		const completedOnly = index([completed]);
		expect(completedOnly.getTasks(false)).toHaveLength(0);
		expect(completedOnly.getTasks(true).map((candidate) => candidate.source)).toEqual(["completed"]);
	});
});
