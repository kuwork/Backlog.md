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

	describe("reserved task prefix", () => {
		async function setupReservedPrefixProject(prefix = "draft"): Promise<Core> {
			const core = await setupProject();
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not loaded");
			await core.filesystem.saveConfig({ ...config, prefixes: { task: prefix } });
			return core;
		}

		it("reports the collision and refuses --fix instead of masking it", async () => {
			await setupReservedPrefixProject("draft");

			const diagnose = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();
			const diagnoseOutput = diagnose.stdout.toString() + diagnose.stderr.toString();

			expect(diagnose.exitCode).toBe(1);
			expect(diagnoseOutput).toContain('Task prefix "draft" collides with a reserved prefix');
			expect(diagnoseOutput).toContain("set task_prefix in the project config file");
			expect(diagnoseOutput).not.toContain("No duplicate task IDs found.");

			const fix = await $`bun ${CLI_PATH} doctor --fix --yes`.cwd(TEST_DIR).nothrow().quiet();
			expect(fix.stdout.toString() + fix.stderr.toString()).toContain(
				"Resolve the reserved task prefix before running --fix.",
			);
			expect((await findBackups()).length).toBe(0);
		});

		it("keeps runtime commands working on a project that already carries a reserved prefix", async () => {
			await setupReservedPrefixProject("draft");

			const list = await $`bun ${CLI_PATH} task list --plain`.cwd(TEST_DIR).nothrow().quiet();
			expect(list.exitCode).toBe(0);

			const create = await $`bun ${CLI_PATH} task create "Still Works" --plain`.cwd(TEST_DIR).nothrow().quiet();
			expect(create.exitCode).toBe(0);
			expect(create.stdout.toString()).toContain("Still Works");
		});

		it("stops reporting once the prefix is no longer reserved", async () => {
			const core = await setupReservedPrefixProject("doc");
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Config not loaded");
			await core.filesystem.saveConfig({ ...config, prefixes: { task: "JIRA" } });

			const result = await $`bun ${CLI_PATH} doctor`.cwd(TEST_DIR).nothrow().quiet();

			expect(result.exitCode).toBe(0);
			expect((result.stdout.toString() + result.stderr.toString()).length).toBeGreaterThan(0);
		});
	});

	describe("dependency defect diagnosis", () => {
		/**
		 * A task file in the shape the writer produces: a block list for dependencies, which is what
		 * the parser reads back and what every measurement in BACK-708 was taken against.
		 */
		function taskFile(id: string, title: string, dependencies: string[] = [], status = "To Do"): string {
			const dependenciesBlock =
				dependencies.length > 0
					? `dependencies:\n${dependencies.map((dependency) => `  - ${dependency}`).join("\n")}\n`
					: "dependencies: []\n";
			return `---\nid: ${id}\ntitle: ${title}\nstatus: ${status}\nassignee: []\ncreated_date: '2026-08-03'\nlabels: []\n${dependenciesBlock}---\n\nBody.\n`;
		}

		async function runDoctor(...args: string[]): Promise<{ exitCode: number; output: string }> {
			const result = await $`bun ${CLI_PATH} doctor ${args}`.cwd(TEST_DIR).nothrow().quiet();
			return { exitCode: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
		}

		it("reports a dependency cycle with its ids in order, as a warning", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Cyclic A.md", taskFile("TASK-1", "Cyclic A", ["TASK-2"]));
			await writeTaskFile("backlog/tasks/task-2 - Cyclic B.md", taskFile("TASK-2", "Cyclic B", ["TASK-1"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("Dependency defects (warnings");
			expect(output).toContain("TASK-1 -> TASK-2 -> TASK-1");
			expect(output).toContain("this command still succeeds");
			expect(output).not.toContain("No duplicate task IDs found.");
			// A warning rather than a failure: a standing condition of the corpus does not fail the
			// command whose job is to diagnose it.
			expect(exitCode).toBe(0);
		});

		it("reports a self-loop as a cycle", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Self.md", taskFile("TASK-1", "Self", ["TASK-1"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("TASK-1 -> TASK-1");
			expect(exitCode).toBe(0);
		});

		it("reports a reference that resolves to nothing, on an open task and on a completed one", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Carrier.md", taskFile("TASK-1", "Carrier", ["TASK-9"]));
			// The completed case is the one nothing else can see: readiness skips terminal records.
			await writeTaskFile(
				"backlog/completed/task-2 - Finished carrier.md",
				taskFile("TASK-2", "Finished carrier", ["TASK-8"], "Done"),
			);

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("References that resolve to nothing (2):");
			expect(output).toContain("TASK-1 -> TASK-9");
			expect(output).toContain("TASK-2 -> TASK-8");
			expect(exitCode).toBe(0);
		});

		it("words a draft target as a forbidden direction rather than a missing id", async () => {
			await setupProject();
			await writeTaskFile("backlog/drafts/draft-1 - Abandonable.md", taskFile("DRAFT-1", "Abandonable", [], "Draft"));
			await writeTaskFile("backlog/tasks/task-1 - Carrier.md", taskFile("TASK-1", "Carrier", ["DRAFT-1"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("may not be depended on (1):");
			expect(output).toContain("TASK-1 -> DRAFT-1 (a draft is never a valid target");
			expect(output).not.toContain("References that resolve to nothing");
			expect(exitCode).toBe(0);
		});

		it("names an archived-only target as a released id", async () => {
			await setupProject();
			await writeTaskFile("backlog/archive/tasks/task-7 - Shelved.md", taskFile("TASK-7", "Shelved", [], "Done"));
			await writeTaskFile("backlog/tasks/task-1 - Carrier.md", taskFile("TASK-1", "Carrier", ["TASK-7"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("References naming a released id (1):");
			expect(output).toContain("TASK-1 -> TASK-7");
			expect(output).toContain("would silently re-bind these references to the new holder");
			// Not folded into the plain missing-id count: the id is real and free, not a typo.
			expect(output).not.toContain("References that resolve to nothing");
			expect(exitCode).toBe(0);
		});

		it("reports a reference claimed by more than one record as ambiguous", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Holder.md", taskFile("TASK-1", "Holder"));
			// A completed record claiming the same identity: queryTasks() collapses the working copy to
			// one record per identity, so only a cross-pool count can see this pair.
			await writeTaskFile(
				"backlog/completed/task-1 - Second holder.md",
				taskFile("TASK-1", "Second holder", [], "Done"),
			);
			await writeTaskFile("backlog/tasks/task-2 - Carrier.md", taskFile("TASK-2", "Carrier", ["TASK-1"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("References claimed by more than one record (1):");
			expect(output).toContain("TASK-2 -> TASK-1 (claimed by 2 records)");
			expect(output).not.toContain("References that resolve to nothing");
			expect(exitCode).toBe(0);
		});

		it("still reports a clean corpus as clean and exits 0", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Root.md", taskFile("TASK-1", "Root"));
			await writeTaskFile("backlog/tasks/task-2 - Leaf.md", taskFile("TASK-2", "Leaf", ["TASK-1"]));

			const { exitCode, output } = await runDoctor();

			expect(output).toContain("No duplicate task IDs found.");
			expect(output).not.toContain("Dependency defects");
			expect(exitCode).toBe(0);
		});

		it("prints the dependency section under --fix, warns without failing and never prompts", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Carrier.md", taskFile("TASK-1", "Carrier", ["TASK-9"]));

			// No --yes: if the run reached the confirmation prompt it would report a cancelled repair.
			const { exitCode, output } = await runDoctor("--fix");

			expect(output).toContain("TASK-1 -> TASK-9");
			expect(output).toContain("Dependency defects are warnings, so this command still succeeds");
			expect(output).not.toContain("Repair cancelled.");
			expect(output).not.toContain("Repaired ");
			expect(exitCode).toBe(0);
		});

		it("repairs a duplicate and still reports the dependency defect", async () => {
			await setupProject();
			await writeTaskFile("backlog/tasks/task-1 - Keep.md", taskFile("TASK-1", "Keep"));
			await writeTaskFile("backlog/tasks/task-01 - Rename.md", taskFile("TASK-01", "Rename", ["TASK-9"]));

			const { exitCode, output } = await runDoctor("--fix", "--yes");

			expect(output).toContain("Repaired 1 duplicate file(s).");
			expect(output).toContain("Dependency defects are warnings and still require manual resolution.");
			// The repaired file kept its dangling reference: the repair touches ids, nothing else.
			expect(await Bun.file(join(TEST_DIR, "backlog/tasks/task-2 - Rename.md")).text()).toContain("TASK-9");
			expect(exitCode).toBe(0);
		});
	});
});
