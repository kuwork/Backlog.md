import { describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AmbiguousTaskIdError, Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

function makeTask(id: string, title: string, status = "To Do"): Task {
	return {
		id,
		title,
		status,
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
	};
}

describe("Core task identity collision", () => {
	it("fails closed when the same canonical ID exists at distinct task file paths", async () => {
		const TEST_DIR = createUniqueTestDir("task-collision");
		try {
			const core = new Core(TEST_DIR);
			await core.filesystem.ensureBacklogStructure();
			await core.filesystem.saveConfig({
				projectName: "Collision",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
			});

			// Create two live files sharing the same ID via the filesystem directly
			const tasksDir = join(TEST_DIR, "backlog", "tasks");
			await mkdir(tasksDir, { recursive: true });
			await Bun.write(join(tasksDir, "back-1 - Login.md"), serialize(makeTask("BACK-1", "Login")));
			await Bun.write(join(tasksDir, "back-1 - Signup.md"), serialize(makeTask("BACK-1", "Signup")));

			await expect(core.getTask("BACK-1")).rejects.toBeInstanceOf(AmbiguousTaskIdError);
		} finally {
			await safeCleanup(TEST_DIR);
		}
	});
});

function serialize(task: Task): string {
	const lines = [
		"---",
		`id: ${task.id}`,
		`title: ${task.title}`,
		`status: ${task.status}`,
		"assignee: []",
		`created_date: ${task.createdDate}`,
		"labels: []",
		"dependencies: []",
		"---",
		"",
		`# ${task.title}`,
		"",
	];
	return lines.join("\n");
}
