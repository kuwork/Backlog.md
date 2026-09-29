import { describe, expect, it } from "bun:test";
import {
	compileStateMachine,
	DEFAULT_STATE_MACHINE,
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
			when: "人类已确认描述与验收标准完整，可以开工",
			ai: "allowed",
		});
		expect(toDropped?.ai).toBe("propose");

		const [toPlanReview] = machine.transitionsOf("Planning");
		expect(toPlanReview).toEqual({
			to: "Plan Review",
			when: "实现计划已写入 implementationPlan",
			ai: "allowed_if",
			if: "implementationPlan 非空",
			requires: "implementationPlan 非空",
		});

		const [approved] = machine.transitionsOf("Plan Review");
		expect(approved?.ai).toBe("forbidden");
		// The rejection edge carries the evidence requirement; the approval edge carries none.
		const [accepted, rework] = machine.transitionsOf("In Review");
		expect(accepted?.ai).toBe("forbidden");
		expect(rework?.evidence).toBe("comments（写明返工理由）");
	});

	it("falls back to the last column when an object form declares no terminal category", () => {
		const noTerminal: StatusesConfig = [{ name: "A" }, { name: "B" }];
		expect(getTerminalStatuses(noTerminal)).toEqual(["B"]);
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
