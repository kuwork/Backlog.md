import { existsSync, lstatSync } from "node:fs";
import { mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseFrontmatter } from "../markdown/frontmatter.ts";
import {
	TASK_MIGRATION_ARCHITECT_SEED_FILES,
	TASK_MIGRATION_ARCHITECT_SKILL,
} from "../skills/embedded/task-migration-architect.ts";
import { resolveAgent, type SupportedAgent } from "./wiki-install.ts";

const SKILL_NAME = "task-migration-architect";
const CENTRAL_SKILLS_DIR = ".agents/skills";
const AGENT_SKILL_TARGET: Record<SupportedAgent, string> = {
	claude: ".claude/skills",
	codex: ".codex/skills",
	agents: ".agents/skills",
};

export interface MigrateInstallOptions {
	force?: boolean;
	dryRun?: boolean;
}

export interface MigrateInstallResult {
	agent: SupportedAgent;
	agentSkillsPath: string;
	skillTargetDir: string;
	skillName: string;
	filesWritten: string[];
	seedFilesWritten: string[];
	seedFilesSkipped: string[];
	symlinkCreated: boolean;
	symlinkExisted: boolean;
	fallbackCopy: boolean;
	skillMeta: {
		name?: string;
		description?: string;
		trigger?: string;
	};
}

function parseSkillMeta(skillContent: string): MigrateInstallResult["skillMeta"] {
	try {
		const parsed = parseFrontmatter(skillContent);
		return {
			name: parsed.data.name as string | undefined,
			description: parsed.data.description as string | undefined,
			trigger: parsed.data.trigger as string | undefined,
		};
	} catch {
		return {};
	}
}

async function ensureDirectory(dirPath: string, dryRun: boolean): Promise<void> {
	if (dryRun) return;
	await mkdir(dirPath, { recursive: true });
}

async function writeSkillFiles(
	skillDir: string,
	dryRun: boolean,
): Promise<{
	filesWritten: string[];
	seedFilesWritten: string[];
	seedFilesSkipped: string[];
	skillMeta: MigrateInstallResult["skillMeta"];
}> {
	const filesWritten: string[] = [];
	const seedFilesWritten: string[] = [];
	const seedFilesSkipped: string[] = [];
	let skillMeta: MigrateInstallResult["skillMeta"] = {};

	for (const [relativePath, content] of Object.entries(TASK_MIGRATION_ARCHITECT_SKILL)) {
		const filePath = join(skillDir, relativePath);
		await ensureDirectory(dirname(filePath), dryRun);

		if (!dryRun) {
			await writeFile(filePath, content, "utf-8");
		}
		filesWritten.push(relativePath);

		if (relativePath === "SKILL.md") {
			skillMeta = parseSkillMeta(content);
		}
	}

	// Seed files are project-owned memory (e.g. the migration exclusions list):
	// write only when missing, never overwrite — even with --force.
	for (const [relativePath, content] of Object.entries(TASK_MIGRATION_ARCHITECT_SEED_FILES)) {
		const filePath = join(skillDir, relativePath);
		if (existsSync(filePath)) {
			seedFilesSkipped.push(relativePath);
			continue;
		}
		await ensureDirectory(dirname(filePath), dryRun);
		if (!dryRun) {
			await writeFile(filePath, content, "utf-8");
		}
		seedFilesWritten.push(relativePath);
	}

	return { filesWritten, seedFilesWritten, seedFilesSkipped, skillMeta };
}

async function resolveSkillTargetDir(
	projectRoot: string,
	agent: SupportedAgent,
	force: boolean,
	dryRun: boolean,
): Promise<{ skillTargetDir: string; symlinkCreated: boolean; symlinkExisted: boolean; fallbackCopy: boolean }> {
	const agentSkillsPath = join(projectRoot, AGENT_SKILL_TARGET[agent]);
	const centralPath = join(projectRoot, CENTRAL_SKILLS_DIR);
	const centralSkillDir = join(centralPath, SKILL_NAME);

	// If agent target is the same as central storage (e.g. "agents"), use central directly
	if (agentSkillsPath === centralPath) {
		return { skillTargetDir: centralSkillDir, symlinkCreated: false, symlinkExisted: false, fallbackCopy: false };
	}

	// If agent skills path already exists as a real directory, use it directly
	if (existsSync(agentSkillsPath)) {
		const stat = lstatSync(agentSkillsPath);
		if (stat.isDirectory() && !stat.isSymbolicLink()) {
			return {
				skillTargetDir: join(agentSkillsPath, SKILL_NAME),
				symlinkCreated: false,
				symlinkExisted: false,
				fallbackCopy: false,
			};
		}
		if (stat.isSymbolicLink()) {
			const target = await readlink(agentSkillsPath).catch(() => "");
			const resolvedTarget = resolve(dirname(agentSkillsPath), target.trim());
			const expectedTarget = resolve(centralPath);
			const normalizedTarget = target.trim().replace(/\\/g, "/");
			if (resolvedTarget === expectedTarget || normalizedTarget === CENTRAL_SKILLS_DIR) {
				return {
					skillTargetDir: centralSkillDir,
					symlinkCreated: false,
					symlinkExisted: true,
					fallbackCopy: false,
				};
			}
			if (!force && !dryRun) {
				throw new Error(
					`"${AGENT_SKILL_TARGET[agent]}" already exists as a symlink pointing elsewhere. Use --force to replace.`,
				);
			}
			if (!dryRun) {
				await rm(agentSkillsPath);
			}
		} else {
			if (!force && !dryRun) {
				throw new Error(`"${AGENT_SKILL_TARGET[agent]}" already exists as a file. Use --force to replace.`);
			}
			if (!dryRun) {
				await rm(agentSkillsPath, { force: true });
			}
		}
	}

	// Ensure parent directory exists for the symlink
	await mkdir(dirname(agentSkillsPath), { recursive: true });

	// Try to create symlink
	const relativeCentral = relative(dirname(agentSkillsPath), centralPath).replace(/\\/g, "/");
	if (dryRun) {
		return { skillTargetDir: centralSkillDir, symlinkCreated: true, symlinkExisted: false, fallbackCopy: false };
	}

	try {
		await symlink(relativeCentral, agentSkillsPath, "dir");
		return { skillTargetDir: centralSkillDir, symlinkCreated: true, symlinkExisted: false, fallbackCopy: false };
	} catch (error) {
		// Fallback to direct copy on Windows or when symlink fails
		const isWindows = process.platform === "win32";
		const message = error instanceof Error ? error.message : String(error);
		if (isWindows && message.toLowerCase().includes("operation not permitted")) {
			console.warn(
				`Unable to create symlink on Windows (requires Developer Mode or elevated privileges). Falling back to direct copy into ${AGENT_SKILL_TARGET[agent]}.`,
			);
			return {
				skillTargetDir: join(agentSkillsPath, SKILL_NAME),
				symlinkCreated: false,
				symlinkExisted: false,
				fallbackCopy: true,
			};
		}
		throw error;
	}
}

export async function installMigrateSkill(
	projectRoot: string,
	agentAlias: string,
	options: MigrateInstallOptions = {},
): Promise<MigrateInstallResult> {
	const agent = resolveAgent(agentAlias);
	const { force = false, dryRun = false } = options;

	const { skillTargetDir, symlinkCreated, symlinkExisted, fallbackCopy } = await resolveSkillTargetDir(
		projectRoot,
		agent,
		force,
		dryRun,
	);

	// Check if skill already exists
	if (existsSync(skillTargetDir) && !force && !dryRun) {
		throw new Error(`Skill "${SKILL_NAME}" already exists at "${skillTargetDir}". Use --force to overwrite.`);
	}

	const { filesWritten, seedFilesWritten, seedFilesSkipped, skillMeta } = await writeSkillFiles(skillTargetDir, dryRun);

	return {
		agent,
		agentSkillsPath: AGENT_SKILL_TARGET[agent],
		skillTargetDir,
		skillName: SKILL_NAME,
		filesWritten,
		seedFilesWritten,
		seedFilesSkipped,
		symlinkCreated,
		symlinkExisted,
		fallbackCopy,
		skillMeta,
	};
}

export function formatMigrateInstallResult(result: MigrateInstallResult, dryRun: boolean): string {
	const lines: string[] = [];
	const prefix = dryRun ? "[DRY RUN] Would " : "";

	lines.push(`${prefix}install skill "${result.skillName}" for agent "${result.agent}"`);
	lines.push("");
	lines.push(`  Target directory: ${result.skillTargetDir}`);
	lines.push(`  Agent path:      ${result.agentSkillsPath}`);
	lines.push("");
	lines.push(`  Files ${dryRun ? "to write" : "written"}:`);
	for (const file of result.filesWritten) {
		lines.push(`    - ${file}`);
	}

	if (result.seedFilesWritten.length > 0) {
		lines.push("");
		lines.push(`  Project memory ${dryRun ? "to seed" : "seeded"} (template; never overwritten):`);
		for (const file of result.seedFilesWritten) {
			lines.push(`    - ${file}`);
		}
	}
	if (result.seedFilesSkipped.length > 0) {
		lines.push("");
		lines.push("  Project memory kept (already exists):");
		for (const file of result.seedFilesSkipped) {
			lines.push(`    - ${file}`);
		}
	}

	if (result.symlinkCreated) {
		lines.push("");
		lines.push(`  ${prefix}create symlink: ${result.agentSkillsPath} → ${CENTRAL_SKILLS_DIR}`);
	} else if (result.symlinkExisted) {
		lines.push("");
		lines.push(`  Symlink already exists: ${result.agentSkillsPath}`);
	} else if (result.fallbackCopy) {
		lines.push("");
		lines.push("  Fallback copy used (symlink requires elevated privileges on Windows)");
	}

	if (result.skillMeta.name || result.skillMeta.description) {
		lines.push("");
		lines.push("  Skill info:");
		if (result.skillMeta.name) lines.push(`    Name:        ${result.skillMeta.name}`);
		if (result.skillMeta.description) lines.push(`    Description: ${result.skillMeta.description}`);
		if (result.skillMeta.trigger) lines.push(`    Trigger:     ${result.skillMeta.trigger}`);
	}

	return lines.join("\n");
}
