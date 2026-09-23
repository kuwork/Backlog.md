import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Draft creation consistency", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-create-consistency");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Draft Consistency Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("keeps IDs and filenames consistent between draft create and task create --draft", async () => {
		const first = await $`bun ${CLI_PATH} draft create "Hallo"`.cwd(TEST_DIR).quiet();
		const second = await $`bun ${CLI_PATH} task create --draft "Goodbye"`.cwd(TEST_DIR).quiet();

		expect(first.stdout.toString()).toContain("Created draft DRAFT-1");
		expect(second.stdout.toString()).toContain("Created draft DRAFT-2");
		expect(second.stdout.toString()).toContain("draft-2 - Goodbye.md");
		expect(second.stdout.toString()).not.toContain("draft-task-");

		const draftFiles = await readdir(join(TEST_DIR, "backlog", "drafts"));
		expect(draftFiles).toContain("draft-1 - Hallo.md");
		expect(draftFiles).toContain("draft-2 - Goodbye.md");
		expect(draftFiles.some((file) => file.startsWith("draft-task-"))).toBe(false);

		const core = new Core(TEST_DIR);
		const secondDraft = await core.filesystem.loadDraft("draft-2");
		expect(secondDraft).not.toBeNull();
		expect(secondDraft?.id).toBe("DRAFT-2");
	});

	it("uses DRAFT IDs in plain output for task create --draft", async () => {
		const result = await $`bun ${CLI_PATH} task create --draft "Plain sample" --plain`.cwd(TEST_DIR).quiet();
		const output = result.stdout.toString();

		expect(output).toContain("draft-1 - Plain-sample.md");
		expect(output).toContain("Task DRAFT-1 - Plain sample");
		expect(output).not.toContain("Task TASK-1");
	});

	it("applies configured defaultAssignee to draft create", async () => {
		await $`bun ${CLI_PATH} config set defaultAssignee "@alice"`.cwd(TEST_DIR).quiet();

		const result = await $`bun ${CLI_PATH} draft create "Draft Owner" --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created draft DRAFT-1");

		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.assignee).toEqual(["@alice"]);
	});

	it("parses comma-separated assignees on draft create", async () => {
		const result = await $`bun ${CLI_PATH} draft create "Comma Draft Assignees" -a "@alice,@bob" --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created draft DRAFT-1");

		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.assignee).toEqual(["@alice", "@bob"]);
	});

	it("collects repeated -a flags on draft create", async () => {
		const result = await $`bun ${CLI_PATH} draft create "Repeated Draft Assignees" -a @alice -a @bob --plain`
			.cwd(TEST_DIR)
			.quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created draft DRAFT-1");

		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.assignee).toEqual(["@alice", "@bob"]);
	});

	it("writes the due, planned and actual dates onto a created draft", async () => {
		// A created draft keeps its status while carrying the same date fields a task does. The
		// actual range is pinned through a child-process timezone so the stored-UTC conversion is
		// observable regardless of the machine's own zone: 09:00 in Tokyo is midnight UTC.
		const result =
			await $`bun ${CLI_PATH} draft create "Dated Draft" --due-date 2026-10-01 --planned-start 2026-09-01 --planned-end 2026-09-30 --actual-start "2026-09-02 09:00" --actual-end "2026-09-20 18:00" --plain`
				.cwd(TEST_DIR)
				.env({ ...process.env, TZ: "Asia/Tokyo" })
				.quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Created draft DRAFT-1");

		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.status).toBe("Draft");
		expect(draft?.dueDate).toBe("2026-10-01");
		expect(draft?.plannedStart).toBe("2026-09-01");
		expect(draft?.plannedEnd).toBe("2026-09-30");
		expect(draft?.actualStart).toBe("2026-09-02 00:00");
		expect(draft?.actualEnd).toBe("2026-09-20 09:00");

		if (!draft?.filePath) throw new Error("Expected the created draft to carry its file path");
		const file = await readFile(draft.filePath, "utf8");
		expect(file).toContain("status: Draft");
		expect(file).toContain("due_date: '2026-10-01'");
		expect(file).toContain("actual_start: '2026-09-02 00:00'");
	});

	it("writes no date field when draft create is given none", async () => {
		const result = await $`bun ${CLI_PATH} draft create "Undated Draft" --plain`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");
		expect(draft?.dueDate).toBeUndefined();
		expect(draft?.plannedStart).toBeUndefined();
		expect(draft?.plannedEnd).toBeUndefined();
		expect(draft?.actualStart).toBeUndefined();
		expect(draft?.actualEnd).toBeUndefined();

		if (!draft?.filePath) throw new Error("Expected the created draft to carry its file path");
		const file = await readFile(draft.filePath, "utf8");
		expect(file).not.toContain("due_date");
		expect(file).not.toContain("planned_start");
		expect(file).not.toContain("actual_start");
	});

	it("advertises the five date flags on both create commands", async () => {
		const flags = ["--due-date", "--planned-start", "--planned-end", "--actual-start", "--actual-end"];
		const draftHelp = (await $`bun ${CLI_PATH} draft create --help`.cwd(TEST_DIR).quiet()).stdout.toString();
		const taskHelp = (await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).quiet()).stdout.toString();

		for (const flag of flags) {
			expect(draftHelp).toContain(flag);
			expect(taskHelp).toContain(flag);
		}
	});
});
