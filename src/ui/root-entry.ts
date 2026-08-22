import { renderConfiguredTaskIds } from "../commands/help-schema.ts";
import { INSTRUCTION_GUIDES } from "../mcp/workflow-guides.ts";

type RootEntryOptions = {
	version: string;
	initialized: boolean;
	color?: boolean;
};

const ANSI = {
	reset: "\u001B[0m",
	logo: "\u001B[1;36m",
	title: "\u001B[1m",
	section: "\u001B[1;33m",
} as const;

const LOGO_LINES = [
	"██████╗  █████╗  █████╗ ██╗  ██╗██╗      █████╗  ██████╗    ███╗   ███╗██████╗ ",
	"██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝██║     ██╔══██╗██╔════╝    ████╗ ████║██╔══██╗",
	"██████╦╝███████║██║  ╚═╝█████═╝ ██║     ██║  ██║██║  ██╗    ██╔████╔██║██║  ██║",
	"██╔══██╗██╔══██║██║  ██╗██╔═██╗ ██║     ██║  ██║██║  ╚██╗   ██║╚██╔╝██║██║  ██║",
	"██████╦╝██║  ██║╚█████╔╝██║ ╚██╗███████╗╚█████╔╝╚██████╔╝██╗██║ ╚═╝ ██║██████╔╝",
	"╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚══════╝ ╚════╝  ╚═════╝ ╚═╝╚═╝     ╚═╝╚═════╝ ",
];

function commandLine(command: string, description: string): string {
	return `  ${command.padEnd(46)} ${description}`;
}

function colorize(value: string, code: string, enabled: boolean): string {
	return enabled ? `${code}${value}${ANSI.reset}` : value;
}

function sectionTitle(value: string, color: boolean): string {
	return colorize(value, ANSI.section, color);
}

export function formatRootEntry({ version, initialized, color = false }: RootEntryOptions): string {
	const logoLines = LOGO_LINES.map((line) => colorize(line, ANSI.logo, color));
	const lines: string[] = [...logoLines, "", `${colorize("Backlog.md", ANSI.title, color)} v${version}`, ""];

	if (!initialized) {
		lines.push("This directory is not initialized for Backlog.md.", "");
		lines.push(sectionTitle("Project setup:", color));
		lines.push(commandLine("backlog init", "Initialize Backlog.md interactively"));
		lines.push(commandLine("backlog init --defaults", "Initialize with default settings"));
		lines.push(commandLine("backlog init --no-git", "Initialize without Git integration"));
		lines.push("");
	} else {
		lines.push(sectionTitle("Common workflow:", color));
		lines.push(commandLine('backlog search "query" --plain', "Search tasks, docs, and decisions"));
		lines.push(commandLine("backlog task list --plain", "List tasks"));
		lines.push(commandLine(renderConfiguredTaskIds("backlog task view {{TASK_ID:123}} --plain"), "Read task context"));
		lines.push(commandLine('backlog task create "Title" -d "Description"', "Create a task"));
		lines.push(commandLine("backlog board", "Open the TUI Kanban board"));
		lines.push(commandLine("backlog browser", "Open the Web UI Kanban board"));
		lines.push("");
	}

	lines.push(sectionTitle("Local instructions:", color));
	lines.push(commandLine("backlog instructions", "List workflow guides"));
	for (const guide of INSTRUCTION_GUIDES) {
		lines.push(commandLine(`backlog instructions ${guide.key}`, guide.description));
	}
	lines.push("");

	lines.push(sectionTitle("LLM Wiki:", color));
	lines.push(commandLine("backlog wiki install <agent>", "Install the LLM wiki skill for your agent"));
	lines.push("");

	lines.push(sectionTitle("Command help:", color));
	lines.push(commandLine("backlog <command> --help", "Show options, fields, and examples"));
	lines.push("");
	lines.push("Docs: https://backlog.md");
	lines.push("");

	return `${lines.join("\n")}\n`;
}

export async function printRootEntry(options: RootEntryOptions): Promise<void> {
	const color = options.color ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
	process.stdout.write(formatRootEntry({ ...options, color }));
}
