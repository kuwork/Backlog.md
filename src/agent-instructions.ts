import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLAUDE_AGENT_CONTENT, CLI_AGENT_NUDGE, MCP_AGENT_NUDGE, README_GUIDELINES } from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export type AgentInstructionFile =
	| "AGENTS.md"
	| "CLAUDE.md"
	| "GEMINI.md"
	| ".github/copilot-instructions.md"
	| "README.md";

export type AgentInstructionWriteAction = "created" | "updated" | "unchanged";

export interface AgentInstructionWriteResult {
	action: AgentInstructionWriteAction;
	fileName: AgentInstructionFile;
	filePath: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadContent(textOrPath: string): Promise<string> {
	if (textOrPath.includes("\n")) return textOrPath;
	try {
		const path = isAbsolute(textOrPath) ? textOrPath : join(__dirname, textOrPath);
		return await Bun.file(path).text();
	} catch {
		return textOrPath;
	}
}

type GuidelineMarkerKind = "default" | "mcp" | "state-machine";

/**
 * Gets the appropriate markers for a given file type
 */
function getMarkers(kind: GuidelineMarkerKind = "default"): { start: string; end: string } {
	const label =
		kind === "mcp"
			? "BACKLOG.MD MCP GUIDELINES"
			: kind === "state-machine"
				? "BACKLOG.MD STATE MACHINE"
				: "BACKLOG.MD GUIDELINES";
	// All markdown files support HTML comments
	return {
		start: `<!-- ${label} START -->`,
		end: `<!-- ${label} END -->`,
	};
}

/**
 * Checks if the Backlog.md guidelines are already present in the content
 */
function hasBacklogGuidelines(content: string): boolean {
	const { start } = getMarkers();
	return content.includes(start);
}

/**
 * Wraps the Backlog.md guidelines with appropriate markers
 */
function wrapWithMarkers(content: string, kind: GuidelineMarkerKind = "default"): string {
	const { start, end } = getMarkers(kind);
	return `\n${start}\n${content}\n${end}\n`;
}

function stripGuidelineSection(
	content: string,
	kind: GuidelineMarkerKind,
): { content: string; removed: boolean; firstIndex?: number } {
	const { start, end } = getMarkers(kind);
	let removed = false;
	let result = content;
	let firstIndex: number | undefined;

	while (true) {
		const startIndex = result.indexOf(start);
		if (startIndex === -1) {
			break;
		}

		const endIndex = result.indexOf(end, startIndex);
		if (endIndex === -1) {
			break;
		}

		let removalStart = startIndex;
		while (removalStart > 0 && (result[removalStart - 1] === " " || result[removalStart - 1] === "\t")) {
			removalStart -= 1;
		}
		if (removalStart > 0 && result[removalStart - 1] === "\n") {
			removalStart -= 1;
			if (removalStart > 0 && result[removalStart - 1] === "\r") {
				removalStart -= 1;
			}
		} else if (removalStart > 0 && result[removalStart - 1] === "\r") {
			removalStart -= 1;
		}

		let removalEnd = endIndex + end.length;
		if (removalEnd < result.length && result[removalEnd] === "\r") {
			removalEnd += 1;
		}
		if (removalEnd < result.length && result[removalEnd] === "\n") {
			removalEnd += 1;
		}

		if (firstIndex === undefined) {
			firstIndex = removalStart;
		}
		result = result.slice(0, removalStart) + result.slice(removalEnd);
		removed = true;
	}

	return { content: result, removed, firstIndex };
}

/**
 * Put the rendered state machine into its own marker block, replacing whatever was there before.
 *
 * Kept separate from the guideline block on purpose: the machine is re-rendered from the current
 * `config.yml` on every call, so it has to be replaceable without disturbing the static guidelines.
 * An `undefined` section still strips a stale block, which is how a project that no longer wants
 * the machine in its instructions gets rid of it.
 */
function applyStateMachineSection(content: string, section?: string): string {
	const stripped = stripGuidelineSection(content, "state-machine");
	const base = stripped.content;
	const block = section?.trim();
	if (!block) return base;

	let insertAt = stripped.firstIndex;
	if (insertAt === undefined) {
		// No block of ours yet: sit right after the guidelines block when the file has one.
		const { end } = getMarkers("default");
		const endIndex = base.indexOf(end);
		insertAt = endIndex === -1 ? base.length : endIndex + end.length;
		if (insertAt < base.length && base[insertAt] === "\r") insertAt += 1;
		if (insertAt < base.length && base[insertAt] === "\n") insertAt += 1;
	}

	const bounded = Math.max(0, Math.min(insertAt, base.length));
	return base.slice(0, bounded) + wrapWithMarkers(block, "state-machine") + base.slice(bounded);
}

export async function addAgentInstructions(
	projectRoot: string,
	git?: GitOperations,
	files: AgentInstructionFile[] = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"],
	autoCommit = false,
	stateMachineSection?: string,
): Promise<AgentInstructionWriteResult[]> {
	const mapping: Record<AgentInstructionFile, string> = {
		"AGENTS.md": CLI_AGENT_NUDGE,
		"CLAUDE.md": CLI_AGENT_NUDGE,
		"GEMINI.md": CLI_AGENT_NUDGE,
		".github/copilot-instructions.md": CLI_AGENT_NUDGE,
		"README.md": README_GUIDELINES,
	};

	const paths: string[] = [];
	const results: AgentInstructionWriteResult[] = [];
	for (const name of files) {
		const content = await loadContent(mapping[name]);
		const filePath = join(projectRoot, name);
		let finalContent = "";
		const fileExists = existsSync(filePath);
		const action: AgentInstructionWriteAction = fileExists ? "updated" : "created";

		// Check if file exists first to avoid Windows hanging issue
		if (fileExists) {
			try {
				// On Windows, use synchronous read to avoid hanging
				let existing: string;
				if (process.platform === "win32") {
					existing = readFileSync(filePath, "utf-8");
				} else {
					existing = await Bun.file(filePath).text();
				}

				const originalExisting = existing;
				const mcpStripped = stripGuidelineSection(existing, "mcp");
				if (mcpStripped.removed) {
					existing = mcpStripped.content;
				}

				const defaultStripped = stripGuidelineSection(existing, "default");
				if (defaultStripped.removed) {
					const insertAt = defaultStripped.firstIndex ?? defaultStripped.content.length;
					finalContent =
						defaultStripped.content.slice(0, insertAt) +
						wrapWithMarkers(content) +
						defaultStripped.content.slice(insertAt);
				} else if (hasBacklogGuidelines(existing)) {
					// Guidelines already exist but could not be parsed, skip this file.
					results.push({ action: "unchanged", fileName: name, filePath });
					continue;
				} else {
					// Append Backlog.md guidelines with markers
					if (!existing.endsWith("\n")) existing += "\n";
					finalContent = existing + wrapWithMarkers(content);
				}

				finalContent = applyStateMachineSection(finalContent, stateMachineSection);

				if (finalContent === originalExisting) {
					results.push({ action: "unchanged", fileName: name, filePath });
					continue;
				}
			} catch (error) {
				console.error(`Error reading existing file ${filePath}:`, error);
				// If we can't read it, just use the new content with markers
				finalContent = applyStateMachineSection(wrapWithMarkers(content), stateMachineSection);
			}
		} else {
			// File doesn't exist, create with markers
			finalContent = applyStateMachineSection(wrapWithMarkers(content), stateMachineSection);
		}

		await mkdir(dirname(filePath), { recursive: true });
		await Bun.write(filePath, finalContent);
		paths.push(filePath);
		results.push({ action, fileName: name, filePath });
	}

	if (git && paths.length > 0 && autoCommit) {
		await git.addFiles(paths);
		await git.commitFiles("Add AI agent instructions", paths);
	}

	return results;
}

export { loadContent as _loadAgentGuideline };

/** True when the file already carries a rendered state machine block. */
function hasStateMachineGuidelines(content: string): boolean {
	return content.includes(getMarkers("state-machine").start);
}

/**
 * Re-render the state machine block in the instruction files that already carry Backlog guidance.
 *
 * This is the "statuses changed" refresh: the machine sits in its own marker block, so a project
 * that edited its statuses (settings page, config file) can have that block rewritten without
 * touching the static guidelines. Files that do not exist are skipped - changing a status must
 * never be the reason an instruction file appears - and a file with no Backlog guidance at all is
 * left alone, because adding the machine there is a decision, not a side effect.
 */
export async function refreshStateMachineInAgentInstructions(
	projectRoot: string,
	section: string,
	files: AgentInstructionFile[] = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"],
): Promise<AgentInstructionWriteResult[]> {
	const results: AgentInstructionWriteResult[] = [];
	for (const name of files) {
		const filePath = join(projectRoot, name);
		if (!existsSync(filePath)) continue;
		try {
			const existing = process.platform === "win32" ? readFileSync(filePath, "utf-8") : await Bun.file(filePath).text();
			if (!hasBacklogGuidelines(existing) && !hasStateMachineGuidelines(existing)) continue;
			const next = applyStateMachineSection(existing, section);
			if (next === existing) {
				results.push({ action: "unchanged", fileName: name, filePath });
				continue;
			}
			await Bun.write(filePath, next);
			results.push({ action: "updated", fileName: name, filePath });
		} catch (error) {
			// A refresh is a courtesy; never let it break the config write that triggered it.
			console.error(`Error refreshing the state machine block in ${filePath}:`, error);
		}
	}
	return results;
}

async function readExistingFile(filePath: string): Promise<string> {
	if (process.platform === "win32") {
		return readFileSync(filePath, "utf-8");
	}
	return await Bun.file(filePath).text();
}

export interface EnsureMcpGuidelinesResult {
	changed: boolean;
	created: boolean;
	fileName: AgentInstructionFile;
	filePath: string;
}

export async function ensureMcpGuidelines(
	projectRoot: string,
	fileName: AgentInstructionFile,
): Promise<EnsureMcpGuidelinesResult> {
	const filePath = join(projectRoot, fileName);
	const fileExists = existsSync(filePath);
	let existing = "";
	let original = "";
	let insertIndex: number | null = null;

	if (fileExists) {
		try {
			existing = await readExistingFile(filePath);
			original = existing;
			const cliStripped = stripGuidelineSection(existing, "default");
			if (cliStripped.removed && cliStripped.firstIndex !== undefined) {
				insertIndex = cliStripped.firstIndex;
			}
			existing = cliStripped.content;
			const mcpStripped = stripGuidelineSection(existing, "mcp");
			if (mcpStripped.removed && mcpStripped.firstIndex !== undefined) {
				insertIndex = mcpStripped.firstIndex;
			}
			existing = mcpStripped.content;
		} catch (error) {
			console.error(`Error reading existing file ${filePath}:`, error);
			existing = "";
		}
	}

	const nudgeBlock = wrapWithMarkers(MCP_AGENT_NUDGE, "mcp");
	let nextContent: string;
	if (insertIndex !== null) {
		const normalizedIndex = Math.max(0, Math.min(insertIndex, existing.length));
		nextContent = existing.slice(0, normalizedIndex) + nudgeBlock + existing.slice(normalizedIndex);
	} else {
		nextContent = existing;
		if (nextContent && !nextContent.endsWith("\n")) {
			nextContent += "\n";
		}
		nextContent += nudgeBlock;
	}

	const finalContent = nextContent;
	const changed = !fileExists || finalContent !== original;

	await mkdir(dirname(filePath), { recursive: true });
	if (changed) {
		await Bun.write(filePath, finalContent);
	}

	return { changed, created: !fileExists, fileName, filePath };
}

/**
 * Installs the Claude Code backlog agent to the project's .claude/agents directory
 */
export async function installClaudeAgent(projectRoot: string): Promise<void> {
	const agentDir = join(projectRoot, ".claude", "agents");
	const agentPath = join(agentDir, "project-manager-backlog.md");

	// Create the directory if it doesn't exist
	await mkdir(agentDir, { recursive: true });

	// Write the agent content
	await Bun.write(agentPath, CLAUDE_AGENT_CONTENT);
}
