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
 * {@link StateMachine.validate} and never blocks a save: M1 declares, it does not enforce.
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

interface CompiledStatus {
	name: string;
	category: StatusCategory;
	exit?: StatusExitChannel;
	next?: StatusTransition[];
	declaresNext: boolean;
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
			entries.push({ name: entry, category: "active", declaresNext: false });
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
