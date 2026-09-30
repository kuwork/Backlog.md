import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	compileStateMachine,
	DEFAULT_STATE_MACHINE,
	DEFAULT_STATE_MACHINES,
	defaultStateMachineForLocale,
	detectDefaultLocale,
	hiddenStatusNames,
	statusNames,
	validateStatusesShape,
} from "../core/state-machine.ts";
import type { StatusesConfig } from "../types/index.ts";
import { getTerminalStatuses, isTerminalStatus } from "../utils/terminal-status.ts";

describe("statusNames", () => {
	it("reads both shapes and skips entries without a name", () => {
		expect(statusNames(["To Do", "Done"])).toEqual(["To Do", "Done"]);
		expect(statusNames([{ name: "To Do" }, { name: "Done", category: "done" }])).toEqual(["To Do", "Done"]);
		expect(statusNames([{ name: "To Do" }, "Done"])).toEqual(["To Do", "Done"]);
		expect(statusNames([{ name: "  " }])).toEqual([]);
		expect(statusNames(undefined)).toEqual([]);
	});
});

describe("hiddenStatusNames", () => {
	it("returns nothing for a plain string array or an empty/undefined config", () => {
		expect(hiddenStatusNames(["To Do", "In Progress", "Done"])).toEqual([]);
		expect(hiddenStatusNames(undefined)).toEqual([]);
		expect(hiddenStatusNames([])).toEqual([]);
	});

	it("returns only the statuses whose display flag is explicitly false", () => {
		const statuses: StatusesConfig = [
			{ name: "To Do" },
			{ name: "Dropped", category: "dropped", exit: "archive", display: false },
			{ name: "Done", category: "done", exit: "complete", display: true },
		];
		expect(hiddenStatusNames(statuses)).toEqual(["Dropped"]);
	});

	it("the preset machine hides only Dropped", () => {
		expect(hiddenStatusNames(DEFAULT_STATE_MACHINE)).toEqual(["Dropped"]);
		expect(hiddenStatusNames(DEFAULT_STATE_MACHINE)).not.toContain("Done");
	});
});

describe("compileStateMachine — legacy string arrays (FR-7)", () => {
	const machine = compileStateMachine(["To Do", "In Progress", "Done"]);

	it("keeps the order-based semantics: last column terminal, in-progress wip", () => {
		expect(machine.names()).toEqual(["To Do", "In Progress", "Done"]);
		expect(machine.categoryOf("To Do")).toBe("active");
		expect(machine.categoryOf("In Progress")).toBe("wip");
		expect(machine.categoryOf("Done")).toBe("done");
		expect(machine.terminalStatuses()).toEqual(["Done"]);
		expect(machine.initialStatus()).toBe("To Do");
		expect(machine.exitChannel("Done")).toBe("complete");
	});

	it("declares no transitions, so the editor falls back to the placeholder", () => {
		expect(machine.hasDeclaredTransitions()).toBe(false);
		expect(machine.transitionsOf("To Do")).toEqual([]);
	});

	it("answers terminal-status questions exactly like the old last-element rule", () => {
		expect(getTerminalStatuses(["To Do", "In Progress", "Done"])).toEqual(["Done"]);
		expect(isTerminalStatus("Done", ["To Do", "In Progress", "Done"])).toBe(true);
		expect(isTerminalStatus("done", ["To Do", "In Progress", "Done"])).toBe(true);
		expect(isTerminalStatus("To Do", ["To Do", "In Progress", "Done"])).toBe(false);
	});
});

describe("compileStateMachine — the agreed seven-column default (FR-2)", () => {
	const machine = compileStateMachine(DEFAULT_STATE_MACHINE);

	it("compiles to the seven agreed columns in order", () => {
		expect(machine.names()).toEqual([
			"To Do",
			"Planning",
			"Plan Review",
			"In Progress",
			"In Review",
			"Done",
			"Dropped",
		]);
	});

	it("maps every column to its doc-19 §4.2 category", () => {
		expect(machine.categoryOf("To Do")).toBe("active");
		expect(machine.categoryOf("Planning")).toBe("wip");
		expect(machine.categoryOf("Plan Review")).toBe("blocked");
		expect(machine.categoryOf("In Progress")).toBe("wip");
		expect(machine.categoryOf("In Review")).toBe("blocked");
		expect(machine.categoryOf("Done")).toBe("done");
		expect(machine.categoryOf("Dropped")).toBe("dropped");
	});

	it("has both terminal columns, and only Dropped exits through archive", () => {
		expect(machine.terminalStatuses()).toEqual(["Done", "Dropped"]);
		expect(getTerminalStatuses(DEFAULT_STATE_MACHINE)).toEqual(["Done", "Dropped"]);
		expect(machine.exitChannel("Done")).toBe("complete");
		expect(machine.exitChannel("Dropped")).toBe("archive");
		expect(machine.initialStatus()).toBe("To Do");
	});

	it("is self-consistent: no lint issue of its own", () => {
		expect(machine.validate()).toEqual([]);
	});

	it("carries every declared field on a transition", () => {
		const [toPlanning, toDropped] = machine.transitionsOf("To Do");
		expect(toPlanning).toEqual({
			to: "Planning",
			when: "The user has confirmed the description and acceptance criteria are complete; work can start",
			ai: "allowed",
		});
		expect(toDropped?.ai).toBe("propose");

		const [toPlanReview] = machine.transitionsOf("Planning");
		expect(toPlanReview).toEqual({
			to: "Plan Review",
			when: "The implementation plan has been written to implementationPlan",
			ai: "allowed_if",
			if: "implementationPlan is not empty",
			requires: "implementationPlan is not empty",
		});

		const [approved] = machine.transitionsOf("Plan Review");
		expect(approved?.ai).toBe("allowed_if");
		expect(approved?.if).toContain("approved the implementation plan");
		// The rejection edge carries the evidence requirement; the approval edge carries none.
		const [accepted, rework] = machine.transitionsOf("In Review");
		expect(accepted?.ai).toBe("allowed_if");
		expect(accepted?.if).toContain("accepted the work");
		expect(rework?.evidence).toBe("comments (stating the rework reason)");
	});

	it("falls back to the last column when an object form declares no terminal category", () => {
		const noTerminal: StatusesConfig = [{ name: "A" }, { name: "B" }];
		expect(getTerminalStatuses(noTerminal)).toEqual(["B"]);
	});
});

describe("the localized default machines", () => {
	const LOCALES = ["en", "zh-CN", "zh-TW", "ja"] as const;
	const SEVEN = ["To Do", "Planning", "Plan Review", "In Progress", "In Review", "Done", "Dropped"];

	it("ships exactly the four web-UI locales, all with the same shape", () => {
		expect(Object.keys(DEFAULT_STATE_MACHINES).sort()).toEqual([...LOCALES].sort());
		for (const locale of LOCALES) {
			const variant = DEFAULT_STATE_MACHINES[locale] ?? [];
			expect(statusNames(variant)).toEqual(SEVEN);
			expect(hiddenStatusNames(variant)).toEqual(["Dropped"]);
			expect(compileStateMachine(variant).validate()).toEqual([]);
		}
	});

	it("keeps DEFAULT_STATE_MACHINE as the English variant", () => {
		expect(DEFAULT_STATE_MACHINE).toBe(DEFAULT_STATE_MACHINES.en ?? []);
	});

	it("gates plan approval and acceptance on explicit user approval in every variant", () => {
		for (const locale of LOCALES) {
			const machine = compileStateMachine(DEFAULT_STATE_MACHINES[locale] ?? []);
			const [approved] = machine.transitionsOf("Plan Review");
			expect(approved?.to).toBe("In Progress");
			expect(approved?.ai).toBe("allowed_if");
			expect(approved?.if?.trim().length).toBeGreaterThan(0);

			const [accepted] = machine.transitionsOf("In Review");
			expect(accepted?.to).toBe("Done");
			expect(accepted?.ai).toBe("allowed_if");
			expect(accepted?.if?.trim().length).toBeGreaterThan(0);
		}
	});

	it("hints that dropping archives the task in every variant", () => {
		const archiveWords: Record<string, string> = { en: "archive", "zh-CN": "归档", "zh-TW": "歸檔", ja: "アーカイブ" };
		for (const locale of LOCALES) {
			const machine = compileStateMachine(DEFAULT_STATE_MACHINES[locale] ?? []);
			const [, toDropped] = machine.transitionsOf("To Do");
			expect(toDropped?.to).toBe("Dropped");
			expect(toDropped?.ai).toBe("propose");
			expect(toDropped?.when).toContain(archiveWords[locale] ?? "archive");
			expect(toDropped?.when).not.toContain("exit:");
		}
	});
});

describe("defaultStateMachineForLocale", () => {
	const SEVEN = ["To Do", "Planning", "Plan Review", "In Progress", "In Review", "Done", "Dropped"];
	const EN = DEFAULT_STATE_MACHINES.en ?? [];
	const ZH_CN = DEFAULT_STATE_MACHINES["zh-CN"] ?? [];
	const ZH_TW = DEFAULT_STATE_MACHINES["zh-TW"] ?? [];
	const JA = DEFAULT_STATE_MACHINES.ja ?? [];
	let savedEnv: Record<string, string | undefined>;

	beforeEach(() => {
		savedEnv = {
			LC_ALL: process.env.LC_ALL,
			LC_MESSAGES: process.env.LC_MESSAGES,
			LANG: process.env.LANG,
		};
	});

	afterEach(() => {
		for (const key of ["LC_ALL", "LC_MESSAGES", "LANG"] as const) {
			const value = savedEnv[key];
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it("returns the explicit locale's variant, cloned", () => {
		expect(defaultStateMachineForLocale("zh-CN")).toEqual(ZH_CN);
		expect(defaultStateMachineForLocale("zh-TW")).toEqual(ZH_TW);
		expect(defaultStateMachineForLocale("ja")).toEqual(JA);
		expect(defaultStateMachineForLocale("en")).toEqual(EN);
		const zh = defaultStateMachineForLocale("zh-CN");
		expect(zh).not.toBe(DEFAULT_STATE_MACHINES["zh-CN"]);
		expect(zh[0]?.next?.[0]?.when).toContain("用户");
		expect(defaultStateMachineForLocale("ja")[0]?.next?.[0]?.when).toContain("ユーザー");
	});

	it("normalizes environment-style locale strings", () => {
		expect(defaultStateMachineForLocale("zh_TW.UTF-8")).toEqual(ZH_TW);
		expect(defaultStateMachineForLocale("zh-Hant-TW")).toEqual(ZH_TW);
		expect(defaultStateMachineForLocale("zh_HK")).toEqual(ZH_TW);
		expect(defaultStateMachineForLocale("zh_CN.UTF-8")).toEqual(ZH_CN);
		expect(defaultStateMachineForLocale("ja_JP.UTF-8")).toEqual(JA);
		expect(defaultStateMachineForLocale("en_US.UTF-8")).toEqual(EN);
	});

	it("detects the locale from the environment when none is given", () => {
		delete process.env.LC_ALL;
		delete process.env.LC_MESSAGES;
		process.env.LANG = "zh_TW.UTF-8";
		expect(defaultStateMachineForLocale()).toEqual(ZH_TW);

		process.env.LANG = "ja_JP.UTF-8";
		expect(defaultStateMachineForLocale()).toEqual(JA);

		process.env.LANG = "zh_CN.UTF-8";
		expect(defaultStateMachineForLocale()).toEqual(ZH_CN);
	});

	it("prefers LC_ALL over LANG and skips empty values", () => {
		process.env.LC_ALL = "";
		process.env.LC_MESSAGES = "";
		process.env.LANG = "ja_JP.UTF-8";
		expect(defaultStateMachineForLocale()).toEqual(JA);

		process.env.LC_ALL = "zh_CN.UTF-8";
		expect(defaultStateMachineForLocale()).toEqual(ZH_CN);
	});

	it("falls back to English for an unknown locale, and to the OS locale when env vars are missing", () => {
		delete process.env.LC_ALL;
		delete process.env.LC_MESSAGES;
		delete process.env.LANG;
		// No env vars: the OS locale (Intl) decides - on a zh-CN machine that means Chinese, not English.
		const osRaw = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
		const expectedKey = osRaw.startsWith("zh")
			? /tw|hk|hant/.test(osRaw)
				? "zh-TW"
				: "zh-CN"
			: osRaw.startsWith("ja")
				? "ja"
				: "en";
		expect(detectDefaultLocale()).toBe(expectedKey);
		expect(defaultStateMachineForLocale()).toEqual(DEFAULT_STATE_MACHINES[expectedKey] ?? EN);
		expect(defaultStateMachineForLocale("fr_FR.UTF-8")).toEqual(EN);
		expect(statusNames(defaultStateMachineForLocale("fr"))).toEqual(SEVEN);
	});
});

describe("compileStateMachine — lint (FR-6)", () => {
	const codesOf = (statuses: StatusesConfig) =>
		compileStateMachine(statuses)
			.validate()
			.map((issue) => issue.code);

	it("reports structural problems", () => {
		expect(codesOf("nope" as unknown as StatusesConfig)).toContain("notAnArray");
		expect(codesOf([])).toContain("notAnArray");
		expect(codesOf([{ name: "A" }, { name: "a" }])).toContain("duplicateName");
		expect(codesOf([{ name: "A", category: "later" as never }])).toContain("invalidCategory");
		expect(codesOf([{ name: "A", category: "done" }])).toContain("terminalMissingExit");
		expect(codesOf([{ name: "A", next: [{ to: "B" }] }])).toContain("unknownTarget");
	});

	it("reports semantic problems as warnings only", () => {
		expect(codesOf([{ name: "A", next: [{ to: "B" }, { to: "C" }] }, { name: "B" }, { name: "C" }])).toEqual([
			"missingWhen",
			"missingWhen",
		]);
		expect(
			codesOf([
				{ name: "Start", category: "initial" },
				{ name: "B", next: [{ to: "Start" }] },
			]),
		).toContain("initialAsTarget");
		expect(
			codesOf([
				{ name: "A", next: [{ to: "B", ai: "allowed" }] },
				{ name: "B", category: "done", exit: "complete" },
			]),
		).toContain("allowedIntoTerminal");
		expect(codesOf([{ name: "A", next: [{ to: "B", ai: "allowed_if" }] }, { name: "B" }])).toContain(
			"allowedIfMissingIf",
		);
		expect(codesOf([{ name: "A", next: [{ to: "B", ai: "maybe" as never }] }, { name: "B" }])).toContain("invalidAi");
	});

	it("never reports an issue for a plain string array beyond its shape", () => {
		expect(codesOf(["To Do", "In Progress", "Done"])).toEqual([]);
	});
});

describe("validateStatusesShape", () => {
	it("accepts both shapes and keeps every field", () => {
		const result = validateStatusesShape([
			{ name: "To Do", category: "active", next: [{ to: "Done", when: "x", ai: "propose" }] },
			{ name: "Done", category: "done", exit: "complete", next: [] },
		]);
		expect(result.ok).toBe(true);
	});

	it("rejects only what cannot be written back to config.yml", () => {
		expect(validateStatusesShape("nope").ok).toBe(false);
		expect(validateStatusesShape([]).ok).toBe(false);
		expect(validateStatusesShape([{ name: " " }]).ok).toBe(false);
		expect(validateStatusesShape(["A", "a"]).ok).toBe(false);
		expect(validateStatusesShape([{ name: "A", category: "soon" }]).ok).toBe(false);
		expect(validateStatusesShape([{ name: "A", exit: "delete" }]).ok).toBe(false);
		expect(validateStatusesShape([{ name: "A", next: [{ when: "no target" }] }]).ok).toBe(false);
		expect(validateStatusesShape([{ name: "A", next: [{ to: "A", ai: "sometimes" }] }]).ok).toBe(false);
	});

	it("does not reject declared-but-incomplete machines: lint reports them, saving still works", () => {
		expect(validateStatusesShape([{ name: "A", next: [{ to: "A", ai: "allowed_if" }] }]).ok).toBe(true);
	});
});

describe("describe()", () => {
	const machine = compileStateMachine(DEFAULT_STATE_MACHINE);

	it("renders every declared field of the seven-column default", () => {
		const text = machine.describe();

		expect(text).toContain("| To Do | active | - | shown |");
		expect(text).toContain("| Dropped | dropped | archive | hidden |");
		expect(text).toContain("### AI permission tiers");
		for (const tier of ["allowed", "allowed_if", "propose", "forbidden"]) {
			expect(text).toContain(`\`${tier}\``);
		}
		expect(text).toContain("when: The implementation plan has been written to implementationPlan");
		expect(text).toContain("if: implementationPlan is not empty");
		// `requires` duplicates `if` on the default edges, so the renderer omits it.
		expect(text).not.toContain("requires: implementationPlan is not empty");
		expect(text).toContain("evidence: comments (stating the rejection reason)");
		expect(text).toContain("### Terminal statuses");
		expect(text).toContain("`exit: archive` marks work set aside");
		expect(text).not.toContain("### Archive rules");
		expect(text).toContain("### Stop and wait for the user");
		expect(text).toContain("`In Review` -> `Done`");
	});

	it("renders requires only when it differs from if", () => {
		const text = compileStateMachine([
			{ name: "A", next: [{ to: "B", when: "x", ai: "allowed_if", if: "cond", requires: "cond" }] },
			{ name: "B", next: [{ to: "A", when: "y", ai: "allowed_if", if: "cond", requires: "check(A.done)" }] },
		]).describe();
		expect(text).not.toContain("requires: cond");
		expect(text).toContain("requires: check(A.done)");
	});

	it("tells the reader how to use it, not just what it contains", () => {
		const text = machine.describe();

		expect(text).toContain("**Moving a task:**");
		expect(text).toContain("follow the matching `next` edge");
		expect(text).toContain("obey the edge's `ai`");
		expect(text).toContain('Never take an edge listed under "Stop and wait for the user"');
		expect(text).toContain("| `forbidden` | only the user may make this move |");
		expect(text).toContain("Stop and wait for the user");
		// The procedure comes before the tables it points at.
		expect(text.indexOf("**Moving a task:**")).toBeLessThan(text.indexOf("### Statuses"));
	});

	it("says how to move a task when the project declares no transitions", () => {
		const plain = compileStateMachine(["To Do", "In Progress", "Done"]).describe();

		expect(plain).toContain("**Moving a task:**");
		expect(plain).toContain("may move between any pair of non-terminal statuses");
		expect(plain).not.toContain("follow the matching `next` edge");
	});

	it("states the AC-23 exception for a plain string array, with no tier table", () => {
		const plain = compileStateMachine(["To Do", "In Progress", "Done"]).describe();

		expect(plain).toContain("declares no transitions");
		expect(plain).toContain("| Done | done | complete | shown |");
		expect(plain).not.toContain("### AI permission tiers");
	});

	it("only reads: its whole surface returns config facts, never a verdict", () => {
		// Pinning the surface keeps a future allow/deny method from slipping in unnoticed.
		expect(Object.keys(machine).sort()).toEqual([
			"categoryOf",
			"describe",
			"exitChannel",
			"hasDeclaredTransitions",
			"initialStatus",
			"names",
			"terminalStatuses",
			"transitionsOf",
			"validate",
		]);
	});

	it("announces a broken statuses block instead of rendering it as a smaller machine", () => {
		const text = compileStateMachine([{ name: "To Do" }]).describe({
			declared: 3,
			accepted: 1,
			rejected: [{ index: 1, scope: "status", reason: "missing or empty `name`" }],
		});

		expect(text).toContain("### State machine config problem");
		expect(text).toContain("declares 3 status(es); 1 could be read");
		expect(text).toContain("entry 2: missing or empty `name`");
		expect(text).toContain("omits the dropped items");
	});

	it("says which fallback is in use when nothing could be read", () => {
		const text = compileStateMachine(["To Do", "In Progress", "Done"]).describe({
			declared: 0,
			accepted: 0,
			rejected: [],
			fallback: "the built-in defaults (To Do / In Progress / Done)",
			unreadable: true,
		});

		expect(text).toContain("could not be parsed");
		expect(text).toContain("the fallback every reader uses");
	});

	it("stays quiet when the config is healthy", () => {
		expect(machine.describe()).not.toContain("### State machine config problem");
	});
});
