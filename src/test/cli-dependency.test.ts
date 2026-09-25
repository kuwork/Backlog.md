import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createTaskPlatformAware, editTaskPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

setDefaultTimeout(20000);

describe("CLI Dependency Support", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-dependency");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repository first using the same pattern as other tests
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "test-project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should create task with single dependency using --dep", async () => {
		// Create base task first
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task TASK-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});

	test("should create task with single dependency using --depends-on", async () => {
		// Create base task first
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task TASK-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});

	test("should create task with multiple dependencies (comma-separated)", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies
		const result3 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task TASK-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	test("should create task with multiple dependencies (multiple flags)", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies using multiple flags (simulated as comma-separated)
		const result3 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task TASK-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	test("should normalize task IDs in dependencies", async () => {
		// Create base task first
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency using numeric ID (should be normalized to TASK-X)
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task TASK-2");

		// Verify dependency was normalized
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});

	test("should fail when dependency task does not exist", async () => {
		// Try to create task with non-existent dependency
		const result = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-999" }, TEST_DIR);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("The following dependencies do not exist: TASK-999");
	});

	test("should edit task to add dependencies", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		const result3 = await createTaskPlatformAware({ title: "Task to Edit" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);

		// Edit task to add dependencies
		const result4 = await editTaskPlatformAware({ taskId: "task-3", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result4.exitCode).toBe(0);
		expect(result4.stdout).toContain("Updated task task-3");

		// Verify dependencies were added
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	test("should edit task to set dependencies", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Base Task 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base Task 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base Task 3"`.cwd(TEST_DIR).quiet();

		await $`bun ${cliPath} task create "Task with Dependency" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-4 --dep=task-2,task-3 --plain`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Dependencies: TASK-2, TASK-3");

		// Verify dependencies were replaced (not appended)
		const task = await core.filesystem.loadTask("task-4");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-2", "TASK-3"]);
	});

	test("should edit task to append dependencies", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Base Task 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base Task 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base Task 3"`.cwd(TEST_DIR).quiet();

		await $`bun ${cliPath} task create "Task with Dependency" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-4 --add-dep=task-2,task-3 --plain`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Dependencies: TASK-1, TASK-2, TASK-3");

		// Verify dependencies were appended
		const task = await core.filesystem.loadTask("task-4");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	test("should refuse a dependency on a draft", async () => {
		// Create draft task first using platform-aware helper
		// Drafts now get DRAFT-X ids
		const result1 = await createTaskPlatformAware(
			{
				title: "Draft Task",
				draft: true,
			},
			TEST_DIR,
		);
		expect(result1.exitCode).toBe(0);
		expect(result1.stdout).toContain("Created draft DRAFT-1");

		// A draft is never a valid target: it can be abandoned while its dependents stay, so the
		// direction is refused instead of being written and read back as an unknown id. A draft may
		// depend on a task, which is the direction that makes promotion safe.
		// Note: Tasks and drafts have separate ID sequences now
		const result2 = await createTaskPlatformAware(
			{
				title: "Task depending on draft",
				dependencies: "DRAFT-1",
			},
			TEST_DIR,
		);
		expect(result2.exitCode).toBe(1);
		expect(result2.stderr).toContain("a draft is never a valid target");

		// Nothing was written, so the first non-draft task is still unallocated.
		const task = await core.filesystem.loadTask("task-1");
		expect(task).toBeNull();
	});

	test("should display dependencies in plain text view", async () => {
		// Create base task
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// View task in plain text mode
		const result3 = await viewTaskPlatformAware({ taskId: "task-2", plain: true }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Dependencies: TASK-1");
	});
});

describe("CLI dependency clear flags and empty value handling", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-dependency-clear");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "test-project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	test("task edit --clear-deps clears dependencies", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Base"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-2 --clear-deps --plain`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(0);

		const task = await core.filesystem.loadTask("task-2");
		expect(task?.dependencies).toEqual([]);
	});

	test("task create rejects empty --dep value", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		const result = await $`bun ${cliPath} task create "Bad" --dep=""`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");
		expect(result.stderr.toString()).toContain("Omit the flag");
	});

	test("task edit rejects empty --dep value and suggests --clear-deps", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Task"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-1 --dep=""`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");
		expect(result.stderr.toString()).toContain("Use --clear-deps");
	});

	test("task edit rejects mixed empty and non-empty --dep values", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Base"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-2 --dep="" --dep=task-1`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");
	});

	test("task edit rejects combining --clear-deps with --dep", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");

		await $`bun ${cliPath} task create "Base"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Task" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-2 --clear-deps --dep=task-1`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot combine --clear-deps with --depends-on or --dep");

		const task = await core.filesystem.loadTask("task-2");
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});
});

describe("CLI --remove-dep flag", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-remove-dep");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "test-project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	test("removes a single dependency and leaves others", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1 --dep=task-2`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-3 --remove-dep=task-1 --plain`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(0);

		const task = await core.filesystem.loadTask("task-3");
		expect(task?.dependencies).toEqual(["TASK-2"]);
	});

	test("supports repeated flags and comma-separated values", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base 3"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1,task-2,task-3`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-4 --remove-dep=task-1 --remove-dep=task-2,task-3 --plain`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(0);

		const task = await core.filesystem.loadTask("task-4");
		expect(task?.dependencies).toEqual([]);
	});

	test("rejects blank values", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-2 --remove-dep=""`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot use an empty value with --remove-dep");

		const task = await core.filesystem.loadTask("task-2");
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});

	test("rejects combining --clear-deps with --remove-dep", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-2 --clear-deps --remove-dep=task-1`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot combine --clear-deps with --remove-dep");

		const task = await core.filesystem.loadTask("task-2");
		expect(task?.dependencies).toEqual(["TASK-1"]);
	});

	test("allows combining --depends-on or --dep with --remove-dep", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent" --dep=task-1`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-3 --dep=task-2 --remove-dep=task-1 --plain`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Dependencies: TASK-2");

		const task = await core.filesystem.loadTask("task-3");
		expect(task?.dependencies).toEqual(["TASK-2"]);
	});

	test("rejects combining --dep with --add-dep", async () => {
		const cliPath = join(process.cwd(), "src", "cli.ts");
		await $`bun ${cliPath} task create "Base 1"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Base 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task create "Dependent"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit task-3 --dep=task-1 --add-dep=task-2 --plain`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot combine --ref/--doc/--depends-on/--dep with --add-ref");
	});
});
