import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { AmbiguousTaskIdError } from "../utils/task-path.ts";

describe("Task Dependencies", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-dependency-test-"));

		// Initialize git repository first using the same pattern as other tests
		await $`git init -b main`.cwd(tempDir).quiet();
		await $`git config user.name "Test User"`.cwd(tempDir).quiet();
		await $`git config user.email test@example.com`.cwd(tempDir).quiet();

		core = new Core(tempDir);
		await initializeTestProject(core, "test-project");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.warn(`Failed to clean up temp directory: ${error}`);
		}
	});

	test("should create task with dependencies", async () => {
		// Create base tasks first
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Base task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Another base task",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);

		// Create task with dependencies
		const dependentTask: Task = {
			id: "task-3",
			title: "Dependent Task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1", "task-2"],
			description: "Task that depends on others",
		};

		await core.createTask(dependentTask, false);

		// Verify the task was created with dependencies
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should update task dependencies", async () => {
		// Create base tasks
		const task1: Task = {
			id: "task-1",
			title: "Base Task 1",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Base task",
		};

		const task2: Task = {
			id: "task-2",
			title: "Base Task 2",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Another base task",
		};

		const task3: Task = {
			id: "task-3",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task without dependencies initially",
		};

		await core.createTask(task1, false);
		await core.createTask(task2, false);
		await core.createTask(task3, false);

		// Update task to add dependencies
		await core.updateTaskFromInput(task3.id, { dependencies: ["task-1", "task-2"] }, false);

		// Verify the dependencies were updated
		const savedTask = await core.filesystem.loadTask("task-3");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	test("should handle tasks with dependencies in drafts", async () => {
		// Create a draft task
		const draftTask: Task = {
			id: "task-1",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Draft task",
		};

		await core.createTaskFromInput(
			{
				title: draftTask.title,
				status: "Draft",
				description: draftTask.description,
				dependencies: draftTask.dependencies,
			},
			false,
		);

		// Create task that depends on draft
		const task2: Task = {
			id: "task-2",
			title: "Task depending on draft",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"], // Depends on draft task
			description: "Task depending on draft",
		};

		await core.createTask(task2, false);

		// Verify the task was created with dependency on draft
		const savedTask = await core.filesystem.loadTask("task-2");
		expect(savedTask).not.toBeNull();
		expect(savedTask?.dependencies).toEqual(["task-1"]);
	});

	test("should serialize and deserialize dependencies correctly", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task with multiple dependencies",
			status: "In Progress",
			assignee: ["@developer"],
			createdDate: "2024-01-01",
			labels: ["feature", "backend"],
			dependencies: ["task-2", "task-3", "task-4"],
			description: "Task with various metadata and dependencies",
		};

		// Create dependency tasks first
		for (let i = 2; i <= 4; i++) {
			const depTask: Task = {
				id: `task-${i}`,
				title: `Dependency Task ${i}`,
				status: "To Do",
				assignee: [],
				createdDate: "2024-01-01",
				labels: [],
				dependencies: [],
				description: `Dependency task ${i}`,
			};
			await core.createTask(depTask, false);
		}

		await core.createTask(task, false);

		// Load the task back and verify all fields
		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.id).toBe("TASK-1");
		expect(loadedTask?.title).toBe("Task with multiple dependencies");
		expect(loadedTask?.status).toBe("In Progress");
		expect(loadedTask?.assignee).toEqual(["@developer"]);
		expect(loadedTask?.labels).toEqual(["feature", "backend"]);
		expect(loadedTask?.dependencies).toEqual(["task-2", "task-3", "task-4"]);
	});

	test("should handle empty dependencies array", async () => {
		const task: Task = {
			id: "task-1",
			title: "Task without dependencies",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task without dependencies",
		};

		await core.createTask(task, false);

		const loadedTask = await core.filesystem.loadTask("task-1");
		expect(loadedTask).not.toBeNull();
		expect(loadedTask?.dependencies).toEqual([]);
	});

	test("should sanitize archived task dependencies on active tasks only", async () => {
		const archivedTarget: Task = {
			id: "task-1",
			title: "Archive target",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task that will be archived",
		};

		const activeDependent: Task = {
			id: "task-2",
			title: "Active dependent task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["TASK-1", "task-1"],
			description: "Depends on archive target",
		};

		const completedDependent: Task = {
			id: "task-3",
			title: "Completed dependent task",
			status: "Done",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			description: "Completed task should stay unchanged",
		};

		const childTask: Task = {
			id: "task-4",
			title: "Child task",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			parentTaskId: "task-1",
			description: "Parent relationship is out of scope for archive sanitization",
		};

		await core.createTask(archivedTarget, false);
		await core.createTask(activeDependent, false);
		await core.createTask(completedDependent, false);
		await core.createTask(childTask, false);
		await core.completeTask("task-3", false);

		const archived = await core.archiveTask("task-1", false);
		expect(archived).toBe(true);

		const updatedActive = await core.filesystem.loadTask("task-2");
		const updatedChild = await core.filesystem.loadTask("task-4");
		const completedTasks = await core.filesystem.listCompletedTasks();
		const completed = completedTasks.find((task) => task.id === "TASK-3");

		expect(updatedActive?.dependencies).toEqual([]);
		expect(updatedChild?.dependencies).toEqual([]);
		expect(updatedChild?.parentTaskId).toBe("TASK-1");
		expect(completed?.dependencies).toEqual(["task-1"]);
	});

	test("should sanitize archive links when archiving by numeric id with custom task prefix", async () => {
		const config = await core.filesystem.loadConfig();
		expect(config).not.toBeNull();
		if (!config) {
			return;
		}
		config.prefixes = { task: "back" };
		await core.filesystem.saveConfig(config);

		const { task: archiveTarget } = await core.createTaskFromInput({
			title: "Custom prefix target",
		});
		const { task: dependentTask } = await core.createTaskFromInput({
			title: "Custom prefix dependent",
			dependencies: [archiveTarget.id],
		});

		const archived = await core.archiveTask("1", false);
		expect(archived).toBe(true);

		const updatedDependent = await core.filesystem.loadTask(dependentTask.id);
		expect(updatedDependent?.dependencies).toEqual([]);
	});

	test("should not sanitize draft dependencies when archiving", async () => {
		const archiveTarget: Task = {
			id: "task-1",
			title: "Archive target",
			status: "To Do",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: [],
			description: "Task that will be archived",
		};

		const draftTask: Task = {
			id: "draft-1",
			title: "Draft dependent task",
			status: "Draft",
			assignee: [],
			createdDate: "2024-01-01",
			labels: [],
			dependencies: ["task-1"],
			description: "Draft should not be sanitized by archive cleanup",
		};

		await core.createTask(archiveTarget, false);
		await core.createTaskFromInput(
			{
				title: draftTask.title,
				status: "Draft",
				description: draftTask.description,
				dependencies: draftTask.dependencies,
			},
			false,
		);
		await core.archiveTask("task-1", false);

		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.dependencies).toEqual(["TASK-1"]);
	});

	describe("predecessors that left the working copy", () => {
		// Each validated write gets a fresh Core: a store snapshot taken before the file moved can
		// otherwise hide the record that completing put outside the working copy.
		const freshCore = () => new Core(tempDir);

		test("accepts a dependency on a completed task", async () => {
			const setup = freshCore();
			await setup.createTaskFromInput({ title: "Predecessor", description: "Finished first" }, false);
			await setup.completeTask("TASK-1", false);

			const created = await freshCore().createTaskFromInput(
				{ title: "Successor", description: "Depends on a Done task", dependencies: ["TASK-1"] },
				false,
			);

			expect(created.task.dependencies).toEqual(["TASK-1"]);
		});

		test("keeps a completed predecessor when the dependency list is re-edited", async () => {
			const setup = freshCore();
			await setup.createTaskFromInput({ title: "Predecessor", description: "Finished first" }, false);
			await setup.completeTask("TASK-1", false);
			const successor = await freshCore().createTaskFromInput(
				{ title: "Successor", description: "Depends on a Done task", dependencies: ["TASK-1"] },
				false,
			);

			const updated = await freshCore().updateTaskFromInput(
				successor.task.id,
				{ title: "Successor renamed", description: "Depends on a Done task", dependencies: ["TASK-1"] },
				false,
			);

			expect(updated.dependencies).toEqual(["TASK-1"]);
		});

		test("rejects a dependency on an archived task", async () => {
			const setup = freshCore();
			await setup.createTaskFromInput({ title: "Archived predecessor", description: "Shelved" }, false);
			// A second task keeps the allocator past TASK-1, so the successor cannot claim that id
			// itself and only the corpus decides.
			await setup.createTaskFromInput({ title: "Unrelated peer", description: "Keeps the counter" }, false);
			await setup.archiveTask("TASK-1", false);

			await expect(
				freshCore().createTaskFromInput(
					{ title: "Successor", description: "Depends on an archived task", dependencies: ["TASK-1"] },
					false,
				),
			).rejects.toThrow(/do not exist/);
		});

		test("resolves an archived id to the task that reused it", async () => {
			const setup = freshCore();
			await setup.createTaskFromInput({ title: "Archived predecessor", description: "Shelved" }, false);
			await setup.archiveTask("TASK-1", false);

			// Archiving releases the ID, so the next task claims it and the archived file must not
			// make that ordinary identity ambiguous.
			const reused = await freshCore().createTaskFromInput(
				{ title: "New holder of the released id", description: "Reused after the archive" },
				false,
			);
			expect(reused.task.id).toBe("TASK-1");

			const successor = await freshCore().createTaskFromInput(
				{ title: "Successor", description: "Depends on the reused id", dependencies: ["TASK-1"] },
				false,
			);

			expect(successor.task.dependencies).toEqual(["TASK-1"]);
		});

		test("still rejects a dependency id that exists nowhere", async () => {
			await expect(
				freshCore().createTaskFromInput(
					{ title: "Successor", description: "Bad predecessor", dependencies: ["TASK-404"] },
					false,
				),
			).rejects.toThrow(/do not exist/);
		});

		test("fails closed when a completed record and a working-copy task claim one identity", async () => {
			const setup = freshCore();
			await setup.createTaskFromInput({ title: "Predecessor", description: "Finished first" }, false);
			await setup.completeTask("TASK-1", false);

			// Address the completed record from the working copy as well: two files, one identity.
			const [completedRecord] = await freshCore().filesystem.listCompletedTasks();
			const completedPath = completedRecord?.filePath as string;
			writeFileSync(join(setup.filesystem.tasksDir, basename(completedPath)), readFileSync(completedPath, "utf8"));

			await expect(
				freshCore().createTaskFromInput(
					{ title: "Successor", description: "Ambiguous predecessor", dependencies: ["TASK-1"] },
					false,
				),
			).rejects.toThrow(/ambiguous/i);
		});

		test("fails closed when several working-copy files claim one identity", async () => {
			const setup = freshCore();
			const { task: predecessor } = await setup.createTaskFromInput(
				{ title: "Predecessor", description: "Copied in place" },
				false,
			);
			// queryTasks() reports one record per identity, so the corpus check cannot see the
			// second file claiming TASK-1; the working-copy lookup is what fails closed.
			writeFileSync(
				join(setup.filesystem.tasksDir, "task-1 - Second copy.md"),
				readFileSync(predecessor.filePath as string, "utf8"),
			);

			await expect(
				freshCore().createTaskFromInput(
					{ title: "Successor", description: "Ambiguous predecessor", dependencies: ["TASK-1"] },
					false,
				),
			).rejects.toThrow(AmbiguousTaskIdError);
		});
	});
});

import { initializeTestProject } from "./test-utils.ts";
