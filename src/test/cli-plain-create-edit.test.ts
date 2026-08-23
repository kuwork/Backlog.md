import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --plain for task create/edit", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-plain-create-edit");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first using shell API (same as other tests)
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Plain Create/Edit Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("prints plain details after task create --plain", async () => {
		const result = await $`bun ${cliPath} task create "Example" --desc "Hello" --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		// Begins with File: line and contains key sections
		expect(out).toContain("File: ");
		expect(out).toContain("Task TASK-1 - Example");
		expect(out).toContain("Status:");
		expect(out).toContain("Created:");
		expect(out).toContain("Description:");
		expect(out).toContain("Hello");
		expect(out).toContain("Acceptance Criteria:");
		expect(out).toContain("Definition of Done:");
		// Should not contain TUI escape codes
		expect(out).not.toContain("[?1049h");
		expect(out).not.toContain("\x1b");
	});

	it("assigns default tail ordinals and preserves explicit ordinals on CLI create", async () => {
		const first = await $`bun ${cliPath} task create "First ordinal CLI task" --plain`.cwd(TEST_DIR).quiet();
		expect(first.exitCode).toBe(0);
		expect(first.stdout.toString()).toContain("Ordinal: 1000");

		const second = await $`bun ${cliPath} task create "Second ordinal CLI task" --plain`.cwd(TEST_DIR).quiet();
		expect(second.exitCode).toBe(0);
		expect(second.stdout.toString()).toContain("Ordinal: 2000");

		const explicit = await $`bun ${cliPath} task create "Explicit ordinal CLI task" --ordinal 7500 --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(explicit.exitCode).toBe(0);
		expect(explicit.stdout.toString()).toContain("Ordinal: 7500");
	});

	it("rejects non-finite ordinals on CLI create", async () => {
		const result = await $`bun ${cliPath} task create "Invalid ordinal CLI task" --ordinal Infinity`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid ordinal: Infinity. Must be a non-negative number.");
	});

	it("applies configured defaultAssignee on CLI task create without -a", async () => {
		await $`bun ${cliPath} config set defaultAssignee "@alice,@bob"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task create "Default Owner" --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @alice, @bob");
	});

	it("lets explicit -a override configured defaultAssignee on CLI task create", async () => {
		await $`bun ${cliPath} config set defaultAssignee "@alice,@bob"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task create "Explicit Owner" -a @carol --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @carol");
		expect(result.stdout.toString()).not.toContain("@alice");
	});

	it("lets --unassign create a task without defaultAssignee", async () => {
		await $`bun ${cliPath} config set defaultAssignee "@alice,@bob"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task create "Unassigned Owner" --unassign --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).not.toContain("Assignee:");
	});

	it('rejects -a "" on task create and prompts --unassign', async () => {
		const result = await $`bun ${cliPath} task create "Empty Assignee" -a "" --plain`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("use --unassign");
	});

	it("rejects combining --unassign and -a on task create", async () => {
		const result = await $`bun ${cliPath} task create "Conflicting Flags" -a @carol --unassign --plain`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Cannot use --unassign and -a");
	});

	it("clears assignee with task edit --unassign", async () => {
		await $`bun ${cliPath} task create "Edit Assignee" -a @alice --plain`.cwd(TEST_DIR).quiet();

		const editResult = await $`bun ${cliPath} task edit 1 --unassign --plain`.cwd(TEST_DIR).quiet();
		expect(editResult.exitCode).toBe(0);
		expect(editResult.stdout.toString()).not.toContain("Assignee:");
	});

	it('rejects -a "" on task edit and prompts --unassign', async () => {
		await $`bun ${cliPath} task create "Edit Assignee" -a @alice --plain`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit 1 -a "" --plain`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("use --unassign");
	});
	it("parses comma-separated assignees on task create", async () => {
		const result = await $`bun ${cliPath} task create "Comma Assignees" -a "@alice,@bob" --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @alice, @bob");
	});

	it("collects repeated -a flags on task create", async () => {
		const result = await $`bun ${cliPath} task create "Repeated Assignees" -a @alice -a @bob --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @alice, @bob");
	});

	it("replaces assignees with comma-separated -a on task edit", async () => {
		await $`bun ${cliPath} task create "Edit Assignees" -a @alice --plain`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit 1 -a "@carol,@dave" --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @carol, @dave");
		expect(result.stdout.toString()).not.toContain("@alice");
	});

	it("collects repeated -a flags on task edit", async () => {
		await $`bun ${cliPath} task create "Edit Repeated Assignees" -a @alice --plain`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit 1 -a @carol -a @dave --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Assignee: @carol, @dave");
	});

	it("prints plain details after task edit --plain", async () => {
		// Create base task first (without plain)
		await $`bun ${cliPath} task create "Edit Me" --desc "First"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${cliPath} task edit 1 -s "In Progress" --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		const out = result.stdout.toString();
		expect(result.exitCode).toBe(0);
		// Begins with File: line and contains updated details
		expect(out).toContain("File: ");
		expect(out).toContain("Task TASK-1 - Edit Me");
		expect(out).toContain("Status: ◒ In Progress");
		expect(out).toContain("Created:");
		expect(out).toContain("Updated:");
		expect(out).toContain("Description:");
		expect(out).toContain("Acceptance Criteria:");
		expect(out).toContain("Definition of Done:");
		// Should not contain TUI escape codes
		expect(out).not.toContain("[?1049h");
		expect(out).not.toContain("\x1b");
	});
});
