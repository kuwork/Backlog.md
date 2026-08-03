import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("backlog doctor command", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doctor");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	async function setupProject(): Promise<Core> {
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doctor Test Project");
		return core;
	}

	async function writeTaskFile(relativePath: string, content: string): Promise<void> {
		const absolutePath = join(TEST_DIR, relativePath);
		await mkdir(dirname(absolutePath), { recursive: true });
		await Bun.write(absolutePath, content);
	}

	async function fileExists(relativePath: string): Promise<boolean> {
		return Bun.file(join(TEST_DIR, relativePath)).exists();
	}

	async function findBackups(): Promise<string[]> {
		const files: string[] = [];
		for await (const entry of new Bun.Glob("backlog/**/*.backlog-doctor-*.bak").scan({ cwd: TEST_DIR })) {
			files.push(entry.replace(/\\/g, "/"));
		}
		return files;
	}

	describe("diagnosis", () => {
		it("reports no duplicate task IDs in a fresh project", async () => {
			await setupProject();

			const result = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("No duplicate task IDs found.");
		});

		it("detects zero-padding duplicate task IDs and shows a deterministic repair preview", async () => {
			await setupProject();

			await writeTaskFile(
				"backlog/tasks/task-1 - Canonical Duplicate.md",
				`---\nid: TASK-1\ntitle: Canonical Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
			);
			await writeTaskFile(
				"backlog/tasks/task-01 - Zero Padded Duplicate.md",
				`---\nid: TASK-01\ntitle: Zero Padded Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
			);

			const result = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("Found 1 duplicate ID group(s).");
			expect(output).toContain("Group #1: TASK-1");
			expect(output).toContain("task-1 - Canonical Duplicate.md");
			expect(output).toContain("task-01 - Zero Padded Duplicate.md");
			expect(output).toContain("Planned repairs:");
			expect(output).toContain("backlog/tasks/task-01 - Zero Padded Duplicate.md");
			expect(output).toContain("backlog/tasks/task-2 - Zero Padded Duplicate.md");
			expect(output).toContain("Run 'backlog doctor --fix' to apply this repair after reviewing the preview.");
		});

		it("flags references that need manual review instead of auto-replacing them", async () => {
			await setupProject();

			await writeTaskFile(
				"backlog/tasks/task-1 - Referenced Duplicate.md",
				`---\nid: TASK-1\ntitle: Referenced Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
			);
			await writeTaskFile(
				"backlog/tasks/task-01 - Another Duplicate.md",
				`---\nid: TASK-01\ntitle: Another Duplicate\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nBody.\n`,
			);
			await writeTaskFile("backlog/docs/note.md", "# Note\n\nSee task-1 for the original context.\n");

			const result = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("References requiring manual review:");
			expect(output).toContain("docs/note.md:");
			expect(output).toContain("See task-1 for the original context.");
			expect(output).toContain("TASK-1");
		});
	});

	describe("repair lifecycle", () => {
		it("applies the repair, renames the file, updates the frontmatter ID, and retains backups", async () => {
			await setupProject();

			await writeTaskFile(
				"backlog/tasks/task-1 - Keep.md",
				`---\nid: TASK-1\ntitle: Keep\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nKeep body.\n`,
			);
			await writeTaskFile(
				"backlog/tasks/task-01 - Rename.md",
				`---\nid: TASK-01\ntitle: Rename\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nRename body.\n`,
			);

			const result = await $`bun ${CLI_PATH} doctor --fix --yes`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("Repaired 1 duplicate file(s).");
			expect(output).toContain("Run 'backlog doctor --commit' after reviewing/fixing references,");
			expect(output).toContain("or 'backlog doctor --rollback' to undo the repair before committing.");

			expect(await fileExists("backlog/tasks/task-1 - Keep.md")).toBe(true);
			expect(await fileExists("backlog/tasks/task-01 - Rename.md")).toBe(false);
			expect(await fileExists("backlog/tasks/task-2 - Rename.md")).toBe(true);

			const repairedContent = await Bun.file(join(TEST_DIR, "backlog/tasks/task-2 - Rename.md")).text();
			expect(repairedContent).toContain("id: TASK-2");
			expect(repairedContent).toContain("Rename body.");

			const backups = await findBackups();
			expect(backups.length).toBe(1);
			expect(backups[0]).toContain("task-01 - Rename.md.backlog-doctor-");

			const followUp = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();
			expect(followUp.stdout.toString() + followUp.stderr.toString()).toContain("No duplicate task IDs found.");
		});

		it("commits a repair by removing retained backups", async () => {
			await setupProject();

			await writeTaskFile(
				"backlog/tasks/task-1 - Keep.md",
				`---\nid: TASK-1\ntitle: Keep\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nKeep body.\n`,
			);
			await writeTaskFile(
				"backlog/tasks/task-01 - Rename.md",
				`---\nid: TASK-01\ntitle: Rename\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nRename body.\n`,
			);

			await $`bun ${CLI_PATH} doctor --fix --yes`.cwd(TEST_DIR).nothrow().quiet();
			expect((await findBackups()).length).toBe(1);

			const commitResult = await $`bun ${CLI_PATH} doctor --commit`.cwd(TEST_DIR).nothrow().quiet();
			const commitOutput = commitResult.stdout.toString() + commitResult.stderr.toString();

			expect(commitResult.exitCode).toBe(0);
			expect(commitOutput).toContain("Committed repair. Removed 1 retained backup(s).");
			expect((await findBackups()).length).toBe(0);
			expect(await fileExists("backlog/tasks/task-2 - Rename.md")).toBe(true);
		});

		it("rolls back a repair to the original files", async () => {
			await setupProject();

			await writeTaskFile(
				"backlog/tasks/task-1 - Keep.md",
				`---\nid: TASK-1\ntitle: Keep\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nKeep body.\n`,
			);
			await writeTaskFile(
				"backlog/tasks/task-01 - Rename.md",
				`---\nid: TASK-01\ntitle: Rename\nstatus: To Do\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n---\n\nRename body.\n`,
			);

			await $`bun ${CLI_PATH} doctor --fix --yes`.cwd(TEST_DIR).nothrow().quiet();
			expect(await fileExists("backlog/tasks/task-2 - Rename.md")).toBe(true);

			const rollbackResult = await $`bun ${CLI_PATH} doctor --rollback`.cwd(TEST_DIR).nothrow().quiet();
			const rollbackOutput = rollbackResult.stdout.toString() + rollbackResult.stderr.toString();

			expect(rollbackResult.exitCode).toBe(0);
			expect(rollbackOutput).toContain("Rolled back repair. Restored 1 file(s), removed 1 backup(s).");

			expect(await fileExists("backlog/tasks/task-01 - Rename.md")).toBe(true);
			expect(await fileExists("backlog/tasks/task-2 - Rename.md")).toBe(false);
			expect((await findBackups()).length).toBe(0);

			const restoredContent = await Bun.file(join(TEST_DIR, "backlog/tasks/task-01 - Rename.md")).text();
			expect(restoredContent).toContain("id: TASK-01");
		});
	});
});
