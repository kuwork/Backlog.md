import type {
	AiPolicy,
	StatusCategory,
	StatusDefinition,
	StatusExitChannel,
	StatusesConfig,
	StatusTransition,
} from "../types/index.ts";

/**
 * State machine compiler (M1 subset).
 *
 * The machine is a *declaration*: it is parsed and rendered, never enforced. Nothing here
 * answers "may this transition happen" — there is no method returning allow/deny.
 */

export const STATUS_CATEGORIES: readonly StatusCategory[] = ["initial", "active", "wip", "blocked", "done", "dropped"];

export const AI_POLICIES: readonly AiPolicy[] = ["allowed", "allowed_if", "propose", "forbidden"];

/** Terminal categories: reaching them stamps `actualEnd`. */
const TERMINAL_CATEGORIES: readonly StatusCategory[] = ["done", "dropped"];

/** The seven-column default machine agreed in doc-19 §4.1. */
export const DEFAULT_STATE_MACHINE: StatusDefinition[] = [
	{
		name: "To Do",
		category: "active",
		next: [
			{ to: "Planning", when: "人类已确认描述与验收标准完整，可以开工", ai: "allowed" },
			{ to: "Dropped", when: "任务已过时或被放弃（如很久以前列的、现在不再需要做）", ai: "propose" },
		],
	},
	{
		name: "Planning",
		category: "wip",
		next: [
			{
				to: "Plan Review",
				when: "实现计划已写入 implementationPlan",
				ai: "allowed_if",
				if: "implementationPlan 非空",
				requires: "implementationPlan 非空",
			},
		],
	},
	{
		name: "Plan Review",
		category: "blocked",
		next: [
			{ to: "In Progress", when: "人类已批准实现计划", ai: "forbidden" },
			{ to: "Planning", when: "计划被驳回或需修改", ai: "propose", evidence: "comments（写明驳回理由）" },
		],
	},
	{
		name: "In Progress",
		category: "wip",
		next: [
			{
				to: "In Review",
				when: "实现完成，diff / 测试 / 验收说明已就绪",
				ai: "allowed_if",
				if: "finalSummary 非空",
				requires: "finalSummary 非空",
			},
			{ to: "Planning", when: "实施中发现计划需要调整", ai: "allowed" },
		],
	},
	{
		name: "In Review",
		category: "blocked",
		next: [
			{ to: "Done", when: "人类验收通过", ai: "forbidden" },
			{ to: "In Progress", when: "验收未通过，需返工", ai: "propose", evidence: "comments（写明返工理由）" },
		],
	},
	{ name: "Done", category: "done", exit: "complete", next: [] },
	{ name: "Dropped", category: "dropped", exit: "archive", display: false, next: [] },
];

/** Machine-readable rule id, so a localized UI can render its own wording. */
export type LintCode =
	| "notAnArray"
	| "invalidEntry"
	| "duplicateName"
	| "invalidCategory"
	| "terminalMissingExit"
	| "unknownTarget"
	| "missingWhen"
	| "initialAsTarget"
	| "allowedIntoTerminal"
	| "allowedIfMissingIf"
	| "invalidAi";

export interface LintIssue {
	/** Structural issues fall back to the default machine; semantic ones only warn. */
	level: "structural" | "semantic";
	code: LintCode;
	/** Values the UI interpolates into its translated message. */
	args: { status?: string; target?: string; value?: string };
	/** Chinese default wording, for surfaces that have no locale (CLI `config validate`). */
	message: string;
}

export interface StateMachine {
	names(): string[];
	categoryOf(status: string): StatusCategory;
	transitionsOf(status: string): StatusTransition[];
	/** True when the config declares transitions at all (false for plain string arrays). */
	hasDeclaredTransitions(): boolean;
	initialStatus(): string;
	terminalStatuses(): string[];
	exitChannel(status: string): StatusExitChannel | undefined;
	validate(): LintIssue[];
	/**
	 * Render the machine as guidance for a human or an AI, straight from the config.
	 *
	 * Read-only and never throwing: it reports what the config declares, and still returns a
	 * usable text when the `statuses` block is broken - in which case it says so. `diagnostics`
	 * is what the config reader had to reject.
	 */
	describe(diagnostics?: MachineDiagnostics): string;
}

function normalizeKey(value: string): string {
	return value.trim().toLowerCase();
}

function isStatusDefinition(entry: unknown): entry is StatusDefinition {
	return typeof entry === "object" && entry !== null && typeof (entry as StatusDefinition).name === "string";
}

/**
 * Read `statuses` as plain names, whatever shape it is in. Every consumer that only needs
 * column names (board, `--status` validation, the web UI) must go through this so an object
 * form config behaves exactly like the string array it replaces.
 */
export function statusNames(statuses: StatusesConfig | undefined | null): string[] {
	if (!Array.isArray(statuses)) return [];
	const names: string[] = [];
	for (const entry of statuses) {
		if (typeof entry === "string") {
			if (entry.trim().length > 0) names.push(entry);
			continue;
		}
		if (isStatusDefinition(entry) && entry.name.trim().length > 0) names.push(entry.name);
	}
	return names;
}

/**
 * Statuses whose board column should be hidden (`display: false`). The default is shown, so a
 * plain string array or an object entry without the field is never hidden. This is a stronger,
 * always-on hide than `hideEmptyColumns`: a hidden status never gets a column, even while a task
 * is being dragged.
 */
export function hiddenStatusNames(statuses: StatusesConfig | undefined | null): string[] {
	if (!Array.isArray(statuses)) return [];
	const hidden: string[] = [];
	for (const entry of statuses) {
		if (typeof entry === "string") continue;
		if (isStatusDefinition(entry) && entry.name.trim().length > 0 && entry.display === false) {
			hidden.push(entry.name);
		}
	}
	return hidden;
}

/** True when the config uses the object form anywhere. */
export function hasObjectFormStatuses(statuses: StatusesConfig | undefined | null): boolean {
	return Array.isArray(statuses) && statuses.some((entry) => isStatusDefinition(entry));
}

export type StatusesShapeCheck = { ok: true; statuses: StatusesConfig } | { ok: false; error: string };

/**
 * Check a `statuses` payload coming from a client (web UI, MCP, tests).
 *
 * Only what cannot be written back to `config.yml` is rejected — a wrong shape, an empty name,
 * duplicate names, an unknown category or exit channel. Field-level lint (missing `when`,
 * `allowed_if` without `if`, an `ai` value outside the four tiers) is *reported by*
 * {@link StateMachine.validate} and does not block a save.
 */
export function validateStatusesShape(value: unknown): StatusesShapeCheck {
	if (!Array.isArray(value)) return { ok: false, error: "statuses 必须是数组" };
	if (value.length === 0) return { ok: false, error: "statuses 不能为空" };

	const statuses: StatusesConfig = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (typeof entry === "string") {
			if (entry.trim().length === 0) return { ok: false, error: "statuses 不能包含空字符串" };
			statuses.push(entry);
		} else if (isStatusDefinition(entry)) {
			if (entry.name.trim().length === 0) return { ok: false, error: "statuses 元素的 name 不能为空" };
			const raw = entry as StatusDefinition & Record<string, unknown>;
			if (raw.category !== undefined && !STATUS_CATEGORIES.includes(raw.category as StatusCategory)) {
				return { ok: false, error: `状态 "${entry.name}" 的 category 必须是六类之一` };
			}
			if (raw.exit !== undefined && raw.exit !== "complete" && raw.exit !== "archive") {
				return { ok: false, error: `状态 "${entry.name}" 的 exit 必须是 complete 或 archive` };
			}
			if (raw.next !== undefined) {
				if (!Array.isArray(raw.next)) return { ok: false, error: `状态 "${entry.name}" 的 next 必须是数组` };
				for (const transition of raw.next) {
					const normalized = normalizeTransition(transition);
					if (!normalized) return { ok: false, error: `状态 "${entry.name}" 的 next 含有缺少 to 的转换` };
					if (normalized.ai !== undefined && !AI_POLICIES.includes(normalized.ai)) {
						return {
							ok: false,
							error: `状态 "${entry.name}" → "${normalized.to}" 的 ai 必须是四档之一`,
						};
					}
				}
			}
			statuses.push(entry);
		} else {
			return { ok: false, error: "statuses 元素必须是字符串或带 name 的对象" };
		}

		const name = typeof entry === "string" ? entry : entry.name;
		const key = normalizeKey(name);
		if (seen.has(key)) return { ok: false, error: `状态 "${name}" 重复` };
		seen.add(key);
	}
	return { ok: true, statuses };
}

/** One `statuses` entry, or one transition inside it, that the config reader had to drop. */
export interface StatusesRejection {
	/** 0-based position of the owning entry in the `statuses` array, so a human can find it. */
	index: number;
	/** The status name when it could be read; otherwise a best-effort label of the entry. */
	status?: string;
	scope: "status" | "transition";
	reason: string;
}

/**
 * What the config *reader* had to reject while parsing `statuses`, and what it fell back to.
 *
 * `compileStateMachine` never sees this: the reader drops a malformed entry before the array is
 * handed over, so the lint in {@link StateMachine.validate} cannot notice it either. Carrying the
 * diagnostic alongside the parsed value is what lets the guidance announce a broken block instead
 * of silently rendering a smaller machine (doc-19 FR-8).
 */
export interface MachineDiagnostics {
	/** How many entries `backlog/config.yml` declared. */
	declared: number;
	/** How many of them the parser accepted. */
	accepted: number;
	rejected: StatusesRejection[];
	/** The list actually in use when nothing in the block could be parsed (e.g. the defaults). */
	fallback?: string;
	/** The config document itself could not be parsed, so entries could not even be counted. */
	unreadable?: boolean;
}

/** A parsed `statuses` block plus what the reader had to reject while reading it. */
export interface StatusesInspection {
	/** The parsed statuses, or `undefined` when nothing in the block could be read. */
	statuses?: StatusesConfig;
	diagnostics: MachineDiagnostics;
}

interface CompiledStatus {
	name: string;
	category: StatusCategory;
	exit?: StatusExitChannel;
	next?: StatusTransition[];
	declaresNext: boolean;
	/** `display: false` - the status exists but its board column is hidden. */
	hidden: boolean;
}

function normalizeTransition(raw: unknown): StatusTransition | undefined {
	if (typeof raw !== "object" || raw === null) return undefined;
	const candidate = raw as Partial<StatusTransition> & Record<string, unknown>;
	if (typeof candidate.to !== "string" || candidate.to.trim().length === 0) return undefined;
	const transition: StatusTransition = { to: candidate.to };
	if (typeof candidate.when === "string") transition.when = candidate.when;
	if (typeof candidate.if === "string") transition.if = candidate.if;
	if (typeof candidate.requires === "string") transition.requires = candidate.requires;
	if (typeof candidate.evidence === "string") transition.evidence = candidate.evidence;
	if (typeof candidate.ai === "string") transition.ai = candidate.ai as AiPolicy;
	return transition;
}

function compileEntries(statuses: StatusesConfig | undefined | null): CompiledStatus[] {
	if (!Array.isArray(statuses)) return [];
	const entries: CompiledStatus[] = [];
	for (const entry of statuses) {
		if (typeof entry === "string") {
			if (entry.trim().length === 0) continue;
			entries.push({ name: entry, category: "active", declaresNext: false, hidden: false });
			continue;
		}
		if (!isStatusDefinition(entry) || entry.name.trim().length === 0) continue;
		const raw = entry as StatusDefinition & Record<string, unknown>;
		const next = Array.isArray(raw.next)
			? raw.next.map(normalizeTransition).filter((t): t is StatusTransition => !!t)
			: undefined;
		entries.push({
			name: entry.name,
			category: STATUS_CATEGORIES.includes(entry.category as StatusCategory)
				? (entry.category as StatusCategory)
				: "active",
			exit: raw.exit === "complete" || raw.exit === "archive" ? raw.exit : undefined,
			next,
			declaresNext: next !== undefined,
			hidden: raw.display === false,
		});
	}

	// Legacy string-array rules (FR-7): last column is terminal, "in progress" is wip.
	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		if (!entry || entry.declaresNext) continue;
		entry.next = undefined;
		if (entry.category !== "active") continue;
		if (index === entries.length - 1) {
			entry.category = "done";
			entry.exit = "complete";
		} else if (normalizeKey(entry.name).replace(/[\s_-]/g, "") === "inprogress") {
			entry.category = "wip";
		}
	}
	return entries;
}

/**
 * Compile a `statuses` config into a read-only machine. Unknown input yields an empty
 * machine rather than throwing: a broken config must never crash a command (FR-5 ②).
 */
export function compileStateMachine(statuses: StatusesConfig | undefined | null): StateMachine {
	const entries = compileEntries(statuses);
	const byKey = new Map<string, CompiledStatus>();
	for (const entry of entries) {
		const key = normalizeKey(entry.name);
		if (!byKey.has(key)) byKey.set(key, entry);
	}

	const names = entries.map((entry) => entry.name);
	const lookup = (status: string): CompiledStatus | undefined => byKey.get(normalizeKey(status ?? ""));
	const initial = entries.find((entry) => entry.category === "initial");

	return {
		names: () => names,
		categoryOf: (status) => lookup(status)?.category ?? "active",
		transitionsOf: (status) => lookup(status)?.next ?? [],
		hasDeclaredTransitions: () => entries.some((entry) => entry.declaresNext),
		initialStatus: () => initial?.name ?? names[0] ?? "To Do",
		terminalStatuses: () => entries.filter((entry) => TERMINAL_CATEGORIES.includes(entry.category)).map((e) => e.name),
		exitChannel: (status) => lookup(status)?.exit,
		validate: () => validateEntries(entries, statuses),
		describe: (diagnostics) => renderMachine(entries, statuses, diagnostics),
	};
}

function validateEntries(entries: CompiledStatus[], raw: StatusesConfig | undefined | null): LintIssue[] {
	const issues: LintIssue[] = [];
	if (!Array.isArray(raw) || raw.length === 0) {
		issues.push({ level: "structural", code: "notAnArray", args: {}, message: "statuses 必须是非空数组" });
		return issues;
	}

	const seen = new Set<string>();
	for (const entry of raw) {
		if (typeof entry === "string" || isStatusDefinition(entry)) continue;
		issues.push({
			level: "structural",
			code: "invalidEntry",
			args: {},
			message: `statuses 元素既不是字符串也不是带 name 的对象：${JSON.stringify(entry)}`,
		});
	}
	if (!hasObjectFormStatuses(raw)) {
		for (const name of statusNames(raw)) {
			const key = normalizeKey(name);
			if (seen.has(key)) {
				issues.push({
					level: "structural",
					code: "duplicateName",
					args: { status: name },
					message: `状态 "${name}" 重复`,
				});
			}
			seen.add(key);
		}
		return issues;
	}

	const known = new Set(entries.map((entry) => normalizeKey(entry.name)));
	for (const entry of entries) {
		const key = normalizeKey(entry.name);
		if (seen.has(key)) {
			issues.push({
				level: "structural",
				code: "duplicateName",
				args: { status: entry.name },
				message: `状态 "${entry.name}" 重复`,
			});
		}
		seen.add(key);

		const declared = raw.find((item) => isStatusDefinition(item) && normalizeKey(item.name) === key) as
			| StatusDefinition
			| undefined;
		if (declared?.category && !STATUS_CATEGORIES.includes(declared.category)) {
			issues.push({
				level: "structural",
				code: "invalidCategory",
				args: { status: entry.name, value: declared.category },
				message: `状态 "${entry.name}" 的 category "${declared.category}" 不在六类中`,
			});
		}
		if (TERMINAL_CATEGORIES.includes(entry.category) && !entry.exit) {
			issues.push({
				level: "structural",
				code: "terminalMissingExit",
				args: { status: entry.name },
				message: `终态 "${entry.name}" 缺少 exit（complete / archive）`,
			});
		}

		const next = entry.next ?? [];
		for (const transition of next) {
			const targetKey = normalizeKey(transition.to);
			if (!known.has(targetKey)) {
				issues.push({
					level: "structural",
					code: "unknownTarget",
					args: { status: entry.name, target: transition.to },
					message: `状态 "${entry.name}" 的 next 指向不存在的状态 "${transition.to}"`,
				});
				continue;
			}
			const target = entries.find((candidate) => normalizeKey(candidate.name) === targetKey);
			if (next.length > 1 && !transition.when?.trim()) {
				issues.push({
					level: "semantic",
					code: "missingWhen",
					args: { status: entry.name, target: transition.to },
					message: `状态 "${entry.name}" 出度 > 1，但到 "${transition.to}" 的边缺少 when`,
				});
			}
			if (target?.category === "initial") {
				issues.push({
					level: "semantic",
					code: "initialAsTarget",
					args: { target: transition.to },
					message: `起点状态 "${transition.to}" 不应作为任何 next 的目标`,
				});
			}
			if (target && TERMINAL_CATEGORIES.includes(target.category) && transition.ai === "allowed") {
				issues.push({
					level: "semantic",
					code: "allowedIntoTerminal",
					args: { target: transition.to },
					message: `指向终态 "${transition.to}" 的边不应声明 ai: allowed`,
				});
			}
			if (transition.ai === "allowed_if" && !transition.if?.trim()) {
				issues.push({
					level: "semantic",
					code: "allowedIfMissingIf",
					args: { status: entry.name, target: transition.to },
					message: `状态 "${entry.name}" → "${transition.to}" 声明了 ai: allowed_if 但缺少 if`,
				});
			}
			if (transition.ai !== undefined && !AI_POLICIES.includes(transition.ai)) {
				issues.push({
					level: "semantic",
					code: "invalidAi",
					args: { status: entry.name, target: transition.to, value: transition.ai },
					message: `状态 "${entry.name}" → "${transition.to}" 的 ai "${transition.ai}" 不在四档内`,
				});
			}
		}
	}
	return issues;
}

const AI_TIER_MEANINGS: Record<AiPolicy, string> = {
	allowed: "the AI may make this move on its own",
	allowed_if: "the AI may move only while the edge's `if` holds",
	propose: "the AI proposes the move and waits for a human",
	forbidden: "only a human may make this move",
};

/** Edges the AI must not take by itself (`ai: forbidden` or `ai: propose`). */
function humanOnlyEdges(entries: CompiledStatus[]): Array<{ from: string; transition: StatusTransition }> {
	const edges: Array<{ from: string; transition: StatusTransition }> = [];
	for (const entry of entries) {
		for (const transition of entry.next ?? []) {
			if (transition.ai === "forbidden" || transition.ai === "propose") {
				edges.push({ from: entry.name, transition });
			}
		}
	}
	return edges;
}

function renderEdge(from: string, transition: StatusTransition): string {
	const parts = [`\`${from}\` -> \`${transition.to}\``];
	if (transition.when?.trim()) parts.push(`when: ${transition.when.trim()}`);
	if (transition.ai) parts.push(`ai: ${transition.ai}`);
	if (transition.if?.trim()) parts.push(`if: ${transition.if.trim()}`);
	if (transition.requires?.trim()) parts.push(`requires: ${transition.requires.trim()}`);
	if (transition.evidence?.trim()) parts.push(`evidence: ${transition.evidence.trim()}`);
	return `- ${parts.join(" · ")}`;
}

/**
 * The "your config is broken" block. Rendered only when there is something to report, so a
 * healthy machine stays noise-free.
 */
function renderConfigProblems(diagnostics: MachineDiagnostics | undefined, issues: LintIssue[]): string[] {
	const rejected = diagnostics?.rejected ?? [];
	if (rejected.length === 0 && !diagnostics?.fallback && issues.length === 0) return [];

	const lines = ["### State machine config problem", ""];
	if (diagnostics) {
		if (diagnostics.unreadable) {
			lines.push("`backlog/config.yml` could not be parsed, so its `statuses` block could not be read.", "");
		} else if (diagnostics.declared === 0) {
			lines.push("`backlog/config.yml` declares no `statuses` block.", "");
		} else {
			lines.push(
				`\`backlog/config.yml\` declares ${diagnostics.declared} status(es); ${diagnostics.accepted} could be read.`,
				"",
			);
		}
	}
	if (rejected.length > 0) {
		lines.push("Dropped while reading the config:", "");
		for (const item of rejected) {
			const where =
				item.scope === "transition"
					? `entry ${item.index + 1} (\`${item.status ?? "?"}\`), transitions`
					: `entry ${item.index + 1}`;
			lines.push(`- ${where}: ${item.reason}`);
		}
		lines.push("");
	}
	if (diagnostics?.fallback) {
		lines.push(
			`Nothing usable came out of the block, so the machine below is the fallback every reader uses: ${diagnostics.fallback}.`,
			"",
		);
	} else if (rejected.length > 0) {
		lines.push("The machine below omits the dropped items, so it is not what this project declares.", "");
	}
	if (issues.length > 0) {
		lines.push("The config also fails these checks:", "");
		for (const issue of issues) lines.push(`- (${issue.level}) ${issue.message}`);
		lines.push("");
	}
	lines.push("Treat the machine below as unreliable until `backlog/config.yml` is fixed.", "");
	return lines;
}

/**
 * The `describe()` body. Wrapped by a guard so an unexpected failure still yields a usable text:
 * this guidance is part of the "required first read", and losing it whole is worse than losing
 * detail (doc-19 FR-8).
 */
function renderMachine(
	entries: CompiledStatus[],
	raw: StatusesConfig | undefined | null,
	diagnostics?: MachineDiagnostics,
): string {
	try {
		const issues = validateEntries(entries, raw);
		const declaresTransitions = entries.some((entry) => entry.declaresNext);
		const lines: string[] = ["## This project's state machine", ""];

		if (entries.length > 0) {
			// Without this the reader gets a definition but no procedure: the machine says which moves
			// exist, and this says to consult it before writing a status (doc-19 FR-8).
			lines.push(
				declaresTransitions
					? "**Moving a task:** read its current status, find it below, and follow the matching `next` edge - obey that edge's `ai` (`forbidden` means only a human may make the move), gather its `evidence` first, and never take an edge listed under \"Stop and wait for a human\" without a human's answer."
					: "**Moving a task:** this project declares no transitions, so a task may move between any pair of non-terminal statuses - use the status the user asked for.",
				"",
			);
		}
		lines.push(...renderConfigProblems(diagnostics, issues));

		if (entries.length === 0) {
			lines.push("No statuses are configured.", "");
			return lines.join("\n");
		}

		lines.push("### Statuses", "", "| Status | Category | Exit | Board |", "| --- | --- | --- | --- |");
		for (const entry of entries) {
			lines.push(`| ${entry.name} | ${entry.category} | ${entry.exit ?? "-"} | ${entry.hidden ? "hidden" : "shown"} |`);
		}
		lines.push("");

		if (declaresTransitions) {
			lines.push("### AI permission tiers", "", "| `ai` | What it means |", "| --- | --- |");
			for (const policy of AI_POLICIES) lines.push(`| \`${policy}\` | ${AI_TIER_MEANINGS[policy]} |`);
			lines.push("");
			lines.push("### Transitions", "", "Every declared `next` edge, grouped by the status it starts from.", "");
			for (const entry of entries) {
				lines.push(`#### ${entry.name}`, "");
				if ((entry.next ?? []).length === 0) {
					lines.push("- No outgoing transitions.", "");
					continue;
				}
				for (const transition of entry.next ?? []) lines.push(renderEdge(entry.name, transition));
				lines.push("");
			}
		} else {
			lines.push("### Transitions", "");
			lines.push(
				"This project declares no transitions (a plain string array), so statuses may move between any pair of non-terminal statuses.",
				"",
			);
		}

		const terminals = entries.filter((entry) => TERMINAL_CATEGORIES.includes(entry.category));
		lines.push("### Terminal statuses", "");
		if (terminals.length === 0) {
			lines.push("No status is declared terminal.", "");
		} else {
			lines.push("| Status | Category | Exit |", "| --- | --- | --- |");
			for (const entry of terminals) lines.push(`| ${entry.name} | ${entry.category} | ${entry.exit ?? "-"} |`);
			lines.push("");
			lines.push(
				"A status is terminal when its `category` is `done` or `dropped`; reaching one is what stamps `actualEnd`.",
				"",
			);
		}

		lines.push("### Archive rules", "");
		lines.push("- `exit: complete` marks work that was finished.");
		lines.push("- `exit: archive` marks work that was set aside; it is archived rather than completed.");
		lines.push("");

		lines.push("### Stop and wait for a human", "");
		const humanOnly = humanOnlyEdges(entries);
		if (humanOnly.length === 0) {
			lines.push("No edge is marked `forbidden` or `propose`, so no transition is reserved for a human.", "");
		} else {
			lines.push("These edges are not the AI's to take:", "");
			for (const edge of humanOnly) lines.push(renderEdge(edge.from, edge.transition));
			lines.push("");
		}

		return `${lines.join("\n").trimEnd()}\n`;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return [
			"## This project's state machine",
			"",
			"### State machine config problem",
			"",
			`Rendering the machine failed: ${message}`,
			"",
			"The machine could not be read from `backlog/config.yml`. Fix the `statuses` block and try again.",
			"",
		].join("\n");
	}
}
