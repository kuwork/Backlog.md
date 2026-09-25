import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { DependencyCycleError, IneligibleDependencyTargetError } from "../utils/task-builders.ts";
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

	test("should sanitize archived task dependencies on active tasks and in the completed corpus", async () => {
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
		expect(completed?.dependencies).toEqual([]);
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

		describe("cycles, targets and the existence split", () => {
			// Each write gets a fresh Core, so the corpus it walks is the one on disk rather than a snapshot
			// taken before the previous write.
			const freshCore = () => new Core(tempDir);

			/** Write a record straight to disk, which is the only way to plant a reference the gate refuses. */
			const plant = async (id: string, dependencies: string[], title = "Planted"): Promise<void> => {
				await freshCore().createTask(
					{
						id,
						title,
						status: "To Do",
						assignee: [],
						createdDate: "2024-01-01",
						labels: [],
						dependencies,
					},
					false,
				);
			};

			/** root <- middle <- tail, all three written through the gate. */
			async function seedChain(): Promise<void> {
				await freshCore().createTaskFromInput({ title: "Root", description: "No predecessors" }, false);
				await freshCore().createTaskFromInput(
					{ title: "Middle", description: "Depends on the root", dependencies: ["TASK-1"] },
					false,
				);
				await freshCore().createTaskFromInput(
					{ title: "Tail", description: "Depends on the middle", dependencies: ["TASK-2"] },
					false,
				);
			}

			test("refuses a dependency list that names the task itself", async () => {
				const created = await freshCore().createTaskFromInput({ title: "Self", description: "Alone" }, false);

				await expect(
					freshCore().updateTaskFromInput(created.task.id, { dependencies: [created.task.id] }, false),
				).rejects.toThrow(/cannot depend on itself/i);

				const onDisk = await freshCore().filesystem.loadTask(created.task.id);
				expect(onDisk?.dependencies ?? []).toEqual([]);
			});

			test("refuses a dependency that closes a two-node cycle and names the chain", async () => {
				await seedChain();

				const refusal = await freshCore()
					.updateTaskFromInput("TASK-1", { dependencies: ["TASK-2"] }, false)
					.then(
						() => null,
						(error: unknown) => error,
					);

				expect(refusal).toBeInstanceOf(DependencyCycleError);
				expect((refusal as Error).message).toContain("TASK-1 -> TASK-2 -> TASK-1");
				const onDisk = await freshCore().filesystem.loadTask("TASK-1");
				expect(onDisk?.dependencies ?? []).toEqual([]);
			});

			test("refuses a dependency that closes a three-node cycle", async () => {
				await seedChain();

				const refusal = await freshCore()
					.updateTaskFromInput("TASK-1", { dependencies: ["TASK-3"] }, false)
					.then(
						() => null,
						(error: unknown) => error,
					);

				expect(refusal).toBeInstanceOf(DependencyCycleError);
				expect((refusal as Error).message).toContain("TASK-1 -> TASK-3 -> TASK-2 -> TASK-1");
			});

			test("accepts a shared predecessor and a diamond", async () => {
				const setup = freshCore();
				await setup.createTaskFromInput({ title: "Root", description: "Shared" }, false);
				await freshCore().createTaskFromInput(
					{ title: "Left", description: "Depends on the root", dependencies: ["TASK-1"] },
					false,
				);
				await freshCore().createTaskFromInput(
					{ title: "Right", description: "Depends on the root", dependencies: ["TASK-1"] },
					false,
				);

				// Left joins Right over the shared root: both branches converge, which is not a cycle.
				const merged = await freshCore().updateTaskFromInput("TASK-2", { dependencies: ["TASK-1", "TASK-3"] }, false);

				expect(merged.dependencies).toEqual(["TASK-1", "TASK-3"]);
				// Re-submitting the list it now holds is still accepted.
				const again = await freshCore().updateTaskFromInput("TASK-2", { dependencies: ["TASK-1", "TASK-3"] }, false);
				expect(again.dependencies).toEqual(["TASK-1", "TASK-3"]);
			});

			test("accepts a replacement list that drops the edge closing a stored cycle", async () => {
				// A cycle can only reach the disk by bypassing the gate, which is what createTask does.
				await plant("TASK-1", ["TASK-2"], "Cyclic A");
				await plant("TASK-2", ["TASK-1"], "Cyclic B");

				// The replacement is judged as a whole, so the cycle is breakable rather than a dead end.
				const updated = await freshCore().updateTaskFromInput("TASK-1", { dependencies: [] }, false);

				expect(updated.dependencies ?? []).toEqual([]);
				const onDisk = await freshCore().filesystem.loadTask("TASK-1");
				expect(onDisk?.dependencies ?? []).toEqual([]);
			});

			test("refuses a dependency on a draft on the create path and on both edit branches", async () => {
				const setup = freshCore();
				const draft = await setup.createTaskFromInput(
					{ title: "Abandonable", description: "Still a draft", status: "Draft" },
					false,
				);
				await freshCore().createTaskFromInput({ title: "Carrier", description: "Holds dependencies" }, false);

				await expect(
					freshCore().createTaskFromInput(
						{ title: "Successor", description: "Depends on a draft", dependencies: [draft.task.id] },
						false,
					),
				).rejects.toThrow(IneligibleDependencyTargetError);

				await expect(
					freshCore().updateTaskFromInput("TASK-1", { dependencies: [draft.task.id] }, false),
				).rejects.toThrow(IneligibleDependencyTargetError);

				await expect(
					freshCore().updateTaskFromInput("TASK-1", { addDependencies: [draft.task.id] }, false),
				).rejects.toThrow(IneligibleDependencyTargetError);
			});

			test("accepts a draft depending on a task, on the create path and on an edit", async () => {
				await freshCore().createTaskFromInput({ title: "Real task", description: "An eligible target" }, false);

				const draft = await freshCore().createTaskFromInput(
					{ title: "Planned work", description: "Depends on a task", status: "Draft", dependencies: ["TASK-1"] },
					false,
				);
				expect(draft.task.dependencies).toEqual(["TASK-1"]);

				const again = await freshCore().updateDraftFromInput(draft.task.id, { dependencies: ["TASK-1"] }, false);
				expect(again.dependencies).toEqual(["TASK-1"]);
			});

			test("still refuses a milestone as a dependency target", async () => {
				const setup = freshCore();
				const milestone = await setup.filesystem.createMilestone("Phase One");

				await expect(
					freshCore().createTaskFromInput(
						{ title: "Successor", description: "Depends on a milestone", dependencies: [milestone.id] },
						false,
					),
				).rejects.toThrow(IneligibleDependencyTargetError);
			});

			test("refuses an edit that introduces an unresolvable dependency", async () => {
				await freshCore().createTaskFromInput({ title: "Carrier", description: "Holds dependencies" }, false);

				await expect(freshCore().updateTaskFromInput("TASK-1", { dependencies: ["TASK-999"] }, false)).rejects.toThrow(
					/do not exist/,
				);
				await expect(
					freshCore().updateTaskFromInput("TASK-1", { addDependencies: ["TASK-999"] }, false),
				).rejects.toThrow(/do not exist/);
			});

			test("carries a stored unresolvable dependency through as written, and reports it", async () => {
				// The BACK-200/217/218 shape: the record already holds a spelling with nothing behind it.
				await plant("TASK-1", ["task-404"], "Carrier");
				const reported: string[][] = [];

				const updated = await freshCore().updateTaskFromInput(
					"TASK-1",
					{ title: "Carrier renamed", dependencies: ["task-404"] },
					false,
					{ onToleratedDependencies: (ids) => reported.push(ids) },
				);

				expect(reported).toEqual([["task-404"]]);
				expect(updated.title).toBe("Carrier renamed");
				// The spelling the record held survives the rewrite instead of being normalised to TASK-404.
				const onDisk = await freshCore().filesystem.loadTask("TASK-1");
				expect(onDisk?.dependencies).toEqual(["task-404"]);
			});

			test("refuses an edit that rewrites a stored dependency into an unresolvable spelling", async () => {
				await plant("TASK-1", ["TASK-404"], "Carrier");

				// A different spelling of a different id is a new mistake even though the slot was already bad.
				await expect(freshCore().updateTaskFromInput("TASK-1", { dependencies: ["BACK-404"] }, false)).rejects.toThrow(
					/do not exist/,
				);
			});

			test("accepts dropping a stored unresolvable dependency", async () => {
				await plant("TASK-1", ["TASK-404"], "Carrier");

				const cleaned = await freshCore().updateTaskFromInput("TASK-1", { dependencies: [] }, false);

				expect(cleaned.dependencies ?? []).toEqual([]);
			});

			test("splits an archive-only target the same way: refused when introduced, carried over when stored", async () => {
				const setup = freshCore();
				await setup.createTaskFromInput({ title: "Shelved", description: "About to be archived" }, false);
				await setup.createTaskFromInput({ title: "Peer", description: "Keeps the allocator busy" }, false);
				await setup.archiveTask("TASK-1", false);

				// Archiving releases the ID, so naming it fresh is still refused.
				await expect(
					freshCore().createTaskFromInput(
						{ title: "Successor", description: "Depends on an archived task", dependencies: ["TASK-1"] },
						false,
					),
				).rejects.toThrow(/do not exist/);

				// A record that already carries it keeps working, and the reference is still reported.
				await plant("TASK-3", ["TASK-1"], "Carrier");
				const reported: string[][] = [];

				const updated = await freshCore().updateTaskFromInput(
					"TASK-3",
					{ title: "Carrier renamed", dependencies: ["TASK-1"] },
					false,
					{ onToleratedDependencies: (ids) => reported.push(ids) },
				);

				expect(reported).toEqual([["TASK-1"]]);
				expect(updated.title).toBe("Carrier renamed");
				const onDisk = await freshCore().filesystem.loadTask("TASK-3");
				expect(onDisk?.dependencies).toEqual(["TASK-1"]);
			});
		});
	});
});

import { initializeTestProject } from "./test-utils.ts";
