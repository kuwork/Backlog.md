import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Command } from "commander";
import { DEFAULT_STATUSES } from "../constants/index.ts";
import { resolveBacklogDirectory } from "../utils/backlog-directory.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";

export interface HelpField {
	name: string;
	type: string | (() => string);
	description?: string | (() => string);
}

export interface HelpSchema {
	reads?: string;
	writes?: string;
	required?: HelpField[];
	optional?: HelpField[];
	output?: string;
	examples?: string[];
	note?: string;
}

// The first read every session owes this project. Commands that create or edit work share this one
// literal, so their help footers cannot drift apart and a future edit has a single place to land.
export const INSTRUCTIONS_OVERVIEW_HINT =
	"Run `backlog instructions overview` first if you have not read it yet in this session - it is this project's required first read.";

function resolveText(value: string | (() => string) | undefined): string | undefined {
	return typeof value === "function" ? value() : value;
}

function formatField(field: HelpField): string {
	const type = resolveText(field.type) ?? "";
	const description = resolveText(field.description);
	const suffix = description ? ` - ${description}` : "";
	return `  - ${field.name}: ${type}${suffix}`;
}

function formatFields(title: string, fields: HelpField[] | undefined): string[] {
	if (!fields || fields.length === 0) {
		return [title, "  - None"];
	}
	return [title, ...fields.map(formatField)];
}

function renderHelpSchema(schema: HelpSchema): string {
	const lines = ["", "Input schema:", ...formatFields("Required fields:", schema.required)];

	if (schema.optional) {
		lines.push(...formatFields("Optional fields:", schema.optional));
	}
	if (schema.reads) {
		lines.push("Reads:", `  - ${schema.reads}`);
	}
	if (schema.writes) {
		lines.push("Writes:", `  - ${schema.writes}`);
	}
	if (schema.output) {
		lines.push("Output:", `  - ${schema.output}`);
	}
	if (schema.examples && schema.examples.length > 0) {
		lines.push("Examples:", ...schema.examples.map((example) => `  ${renderConfiguredTaskIds(example)}`));
	}
	if (schema.note) {
		lines.push("", `Note: ${schema.note}`);
	}

	return `\n${lines.join("\n")}\n`;
}

export function addHelpSchema(command: Command, schema: HelpSchema): Command {
	return command.addHelpText("after", () => renderHelpSchema(schema));
}

function stripYamlScalar(value: string): string {
	return value
		.trim()
		.replace(/^['"]|['"]$/g, "")
		.trim();
}

function parseFlowList(value: string): string[] | null {
	const trimmed = value.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
		return null;
	}

	return trimmed.slice(1, -1).split(",").map(stripYamlScalar).filter(Boolean);
}

function parseStatusesFromConfig(content: string): string[] | null {
	const lines = content.split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]?.trim() ?? "";
		if (!line || line.startsWith("#")) {
			continue;
		}
		const match = line.match(/^statuses\s*:\s*(.*)$/);
		if (!match) {
			continue;
		}

		const inlineValue = match[1] ?? "";
		const flowList = parseFlowList(inlineValue);
		if (flowList) {
			return flowList;
		}

		const blockValues: string[] = [];
		// Only items at the block's own depth are statuses; an object entry's nested `next:` list
		// sits deeper and must not be read as one.
		let blockIndent: number | null = null;
		for (let blockIndex = index + 1; blockIndex < lines.length; blockIndex++) {
			const blockLine = lines[blockIndex] ?? "";
			const trimmedBlockLine = blockLine.trim();
			if (!trimmedBlockLine || trimmedBlockLine.startsWith("#")) {
				continue;
			}
			const indent = blockLine.length - blockLine.trimStart().length;
			// A flush-left `key:` starts the next top-level field, ending the statuses block.
			if (indent === 0 && /^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(trimmedBlockLine)) {
				break;
			}
			const itemMatch = trimmedBlockLine.match(/^-\s*(.+)$/);
			if (!itemMatch?.[1]) {
				continue;
			}
			blockIndent ??= indent;
			if (indent !== blockIndent) {
				continue;
			}
			// Object form starts each entry with `- name: "…"`; keep just the name scalar.
			const itemText = itemMatch[1].trim();
			const itemName = itemText.match(/^name\s*:\s*(.+)$/)?.[1];
			blockValues.push(stripYamlScalar(itemName ?? itemText));
		}
		return blockValues.filter(Boolean);
	}

	return null;
}

function parseStringValueFromConfig(content: string, keys: string[]): string | null {
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			continue;
		}
		const key = line.slice(0, colonIndex).trim();
		if (!keys.includes(key)) {
			continue;
		}
		const value = stripYamlScalar(line.slice(colonIndex + 1));
		return value || null;
	}
	return null;
}

function findBacklogConfigPathSync(startDir: string): string | null {
	let current = startDir;
	while (current !== dirname(current)) {
		const resolution = resolveBacklogDirectory(current);
		if (resolution.configPath) {
			return resolution.configPath;
		}
		current = dirname(current);
	}
	return null;
}

function getRuntimeConfigStartDir(): string {
	const override = process.env[BACKLOG_CWD_ENV]?.trim();
	return override ? resolve(override) : process.cwd();
}

function includeDraftStatus(statuses: string[]): string[] {
	const normalizedStatuses = normalizeStatusValues(statuses);
	const hasDraft = normalizedStatuses.some((status) => status.toLowerCase() === "draft");
	return hasDraft ? normalizedStatuses : ["Draft", ...normalizedStatuses];
}

function normalizeStatusValues(statuses: string[]): string[] {
	return statuses.map((status) => status.trim()).filter(Boolean);
}

export function getCliStatusValues(options?: { includeDraft?: boolean }): string[] {
	let configuredStatuses: string[] = [...DEFAULT_STATUSES];
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (configPath) {
		try {
			const parsed = parseStatusesFromConfig(readFileSync(configPath, "utf8"));
			if (parsed && parsed.length > 0) {
				configuredStatuses = parsed;
			}
		} catch {
			configuredStatuses = [...DEFAULT_STATUSES];
		}
	}

	const normalizedStatuses = normalizeStatusValues(configuredStatuses);
	return options?.includeDraft ? includeDraftStatus(normalizedStatuses) : normalizedStatuses;
}

export function getCliTaskPrefix(): string {
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (configPath) {
		try {
			return parseStringValueFromConfig(readFileSync(configPath, "utf8"), ["task_prefix", "taskPrefix"]) ?? "task";
		} catch {
			return "task";
		}
	}
	return "task";
}

/**
 * The project's `config.yml` text, or `null` when this directory has no backlog project.
 *
 * Read-only and synchronous, so a command that must print project-specific guidance (the
 * instructions overview) can do it without becoming async. A read failure is reported as "no
 * project" rather than thrown: losing the guide is worse than losing its project-specific half.
 */
export function readRuntimeConfigTextSync(): string | null {
	const configPath = findBacklogConfigPathSync(getRuntimeConfigStartDir());
	if (!configPath) return null;
	try {
		return readFileSync(configPath, "utf8");
	} catch {
		return null;
	}
}

export function taskIdExample(body: string): string {
	return `${getCliTaskPrefix().toUpperCase()}-${body}`;
}

export function renderConfiguredTaskIds(text: string): string {
	return text
		.replace(/\{\{TASK_ID:(\d+(?:\.\d+)*)\}\}/g, (_match, body: string) => taskIdExample(body))
		.replace(/\b(?:BACK|TASK)-(\d+(?:\.\d+)*)\b/g, (_match, body: string) => taskIdExample(body));
}

export function choiceType(values: readonly string[], options?: { multiple?: boolean }): string {
	return `${options?.multiple ? "one or more of" : "one of"}: ${values.join(", ")}`;
}

export function statusType(options?: { includeDraft?: boolean }): string {
	return `one of configured statuses: ${getCliStatusValues(options).join(", ")}`;
}
