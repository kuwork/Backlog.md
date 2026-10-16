import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatMigrateInstallResult, installMigrateSkill } from "../commands/migrate-install.ts";
import {
	TASK_MIGRATION_ARCHITECT_SEED_FILES,
	TASK_MIGRATION_ARCHITECT_SKILL,
} from "../skills/embedded/task-migration-architect.ts";
import { createUniqueTestDir } from "./test-utils.ts";

const SEED_PATH = "references/current-branch-migration-exclusions.md";

describe("migrate-install", () => {
	let TEST_PROJECT: string;

	beforeEach(async () => {
		TEST_PROJECT = createUniqueTestDir("test-migrate-install");
		await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_PROJECT, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_PROJECT, { recursive: true, force: true }).catch(() => {});
	});

	it("writes skill files and seeds project memory", async () => {
		const result = await installMigrateSkill(TEST_PROJECT, "agents");

		const skillDir = join(TEST_PROJECT, ".agents", "skills", "task-migration-architect");
		expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);

		for (const relativePath of Object.keys(TASK_MIGRATION_ARCHITECT_SKILL)) {
			expect(existsSync(join(skillDir, relativePath))).toBe(true);
		}

		expect(result.seedFilesWritten).toContain(SEED_PATH);
		const seedContent = TASK_MIGRATION_ARCHITECT_SEED_FILES[SEED_PATH];
		if (!seedContent) throw new Error("seed file missing from embedded module");
		const seeded = await readFile(join(skillDir, SEED_PATH), "utf-8");
		expect(seeded).toBe(seedContent);
	});

	it("does not embed the fork's private exclusions content", () => {
		// The real memory file of this repo must never be shipped; only the template is embedded.
		expect(TASK_MIGRATION_ARCHITECT_SKILL[SEED_PATH]).toBeUndefined();
		expect(TASK_MIGRATION_ARCHITECT_SEED_FILES[SEED_PATH]).toContain("（模板）");
	});

	it("seeds the memory file only when missing, never overwrites even with --force", async () => {
		await installMigrateSkill(TEST_PROJECT, "agents");

		const skillDir = join(TEST_PROJECT, ".agents", "skills", "task-migration-architect");
		const seedFile = join(skillDir, SEED_PATH);
		const customMemory = "# 当前分支迁移排除清单\n\n项目自己维护的内容。\n";
		await writeFile(seedFile, customMemory, "utf-8");

		const result = await installMigrateSkill(TEST_PROJECT, "agents", { force: true });

		expect(result.seedFilesWritten).not.toContain(SEED_PATH);
		expect(result.seedFilesSkipped).toContain(SEED_PATH);
		expect(await readFile(seedFile, "utf-8")).toBe(customMemory);
		// Skill content files are still refreshed by --force
		expect(result.filesWritten).toContain("SKILL.md");
	});

	it("returns skill metadata from SKILL.md", async () => {
		const result = await installMigrateSkill(TEST_PROJECT, "codex");

		expect(result.skillName).toBe("task-migration-architect");
		expect(result.agent).toBe("codex");
		expect(result.filesWritten).toContain("SKILL.md");
		expect(result.skillMeta.name).toBe("task-migration-architect");
		expect(result.skillMeta.description).toBeTruthy();
	});

	it("dry-run does not create files", async () => {
		const result = await installMigrateSkill(TEST_PROJECT, "agents", { dryRun: true });

		expect(result.filesWritten.length).toBeGreaterThan(0);
		expect(result.seedFilesWritten).toContain(SEED_PATH);
		const skillDir = join(TEST_PROJECT, ".agents", "skills", "task-migration-architect");
		expect(existsSync(skillDir)).toBe(false);
	});

	it("rejects overwriting existing skill without --force", async () => {
		await installMigrateSkill(TEST_PROJECT, "agents");
		await expect(installMigrateSkill(TEST_PROJECT, "agents")).rejects.toThrow("already exists");
	});

	it("throws for invalid agent aliases", async () => {
		await expect(installMigrateSkill(TEST_PROJECT, "cursor")).rejects.toThrow("Unsupported agent");
	});

	describe("formatMigrateInstallResult", () => {
		it("reports seeded and kept memory files", () => {
			const seeded = formatMigrateInstallResult(
				{
					agent: "agents",
					agentSkillsPath: ".agents/skills",
					skillTargetDir: ".agents/skills/task-migration-architect",
					skillName: "task-migration-architect",
					filesWritten: ["SKILL.md"],
					seedFilesWritten: [SEED_PATH],
					seedFilesSkipped: [],
					symlinkCreated: false,
					symlinkExisted: false,
					fallbackCopy: false,
					skillMeta: {},
				},
				false,
			);
			expect(seeded).toContain("Project memory seeded");
			expect(seeded).toContain(SEED_PATH);

			const kept = formatMigrateInstallResult(
				{
					agent: "agents",
					agentSkillsPath: ".agents/skills",
					skillTargetDir: ".agents/skills/task-migration-architect",
					skillName: "task-migration-architect",
					filesWritten: ["SKILL.md"],
					seedFilesWritten: [],
					seedFilesSkipped: [SEED_PATH],
					symlinkCreated: false,
					symlinkExisted: false,
					fallbackCopy: false,
					skillMeta: {},
				},
				false,
			);
			expect(kept).toContain("Project memory kept");
			expect(kept).toContain(SEED_PATH);
		});

		it("shows dry-run prefix when dryRun is true", () => {
			const result = formatMigrateInstallResult(
				{
					agent: "codex",
					agentSkillsPath: ".codex/skills",
					skillTargetDir: ".agents/skills/task-migration-architect",
					skillName: "task-migration-architect",
					filesWritten: ["SKILL.md"],
					seedFilesWritten: [SEED_PATH],
					seedFilesSkipped: [],
					symlinkCreated: false,
					symlinkExisted: false,
					fallbackCopy: false,
					skillMeta: {},
				},
				true,
			);

			expect(result).toContain("[DRY RUN]");
		});
	});
});
