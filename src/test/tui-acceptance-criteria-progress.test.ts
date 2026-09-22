import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgress } from "../ui/acceptance-criteria-progress.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Task",
		status: "In Progress",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		...overrides,
	};
}

function criteria(checked: number, total: number) {
	return Array.from({ length: total }, (_, index) => ({
		index: index + 1,
		text: `criterion ${index + 1}`,
		checked: index < checked,
	}));
}

/** Strip blessed color tags so the raw bar characters can be asserted independently of styling. */
function stripTags(value: string): string {
	return value.replace(/\{[^}]+\}/g, "");
}

describe("formatAcceptanceCriteriaProgress", () => {
	it("formats partial completion with a 5-cell ASCII bar and exact fraction", () => {
		const t = task({ acceptanceCriteriaItems: criteria(4, 7) });
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 80))).toBe("[###--] 4/7");
	});

	it("formats the same task with a 3-cell bar in constrained widths", () => {
		const t = task({ acceptanceCriteriaItems: criteria(1, 2) });
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 20))).toBe("[##-] 1/2");
	});

	it("emits only ASCII bar characters so terminals without Block Element glyphs stay legible", () => {
		const t = task({ acceptanceCriteriaItems: criteria(3, 5) });
		const raw = stripTags(formatAcceptanceCriteriaProgress(t, 80));
		expect(raw).toMatch(/^\[[#-]*\] \d+\/\d+$/);
		// No Block Elements (U+2588 filled / U+2591 light shade) may survive the rewrite.
		expect(raw).not.toContain("\u2588");
		expect(raw).not.toContain("\u2591");
	});

	it("colors the filled run green when every criterion is checked", () => {
		const t = task({ acceptanceCriteriaItems: criteria(3, 3) });
		expect(formatAcceptanceCriteriaProgress(t, 80)).toBe("[{green-fg}#####{/}] 3/3");
	});

	it("colors the filled run red at or below one third complete", () => {
		const atOneThird = task({ acceptanceCriteriaItems: criteria(1, 3) });
		expect(formatAcceptanceCriteriaProgress(atOneThird, 80)).toBe("[{red-fg}##{/}---] 1/3");

		const belowOneThird = task({ acceptanceCriteriaItems: criteria(1, 5) });
		expect(formatAcceptanceCriteriaProgress(belowOneThird, 80)).toBe("[{red-fg}#{/}----] 1/5");
	});

	it("colors the filled run yellow just above one third", () => {
		const t = task({ acceptanceCriteriaItems: criteria(2, 5) });
		expect(formatAcceptanceCriteriaProgress(t, 80)).toBe("[{yellow-fg}##{/}---] 2/5");
	});

	it("clamps so any checked criterion shows at least one filled cell", () => {
		// 1/17 rounds to 0 of 5 cells; the clamp must still show one filled cell.
		const t = task({ acceptanceCriteriaItems: criteria(1, 17) });
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 80))).toBe("[#----] 1/17");
	});

	it("clamps so unfinished work never fills the bar completely", () => {
		// 16/17 rounds to 5 of 5 cells; the clamp must leave one empty cell.
		const t = task({ acceptanceCriteriaItems: criteria(16, 17) });
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 80))).toBe("[####-] 16/17");
	});

	it("switches the cell count on the wide-versus-compact width threshold", () => {
		const t = task({ acceptanceCriteriaItems: criteria(1, 2) });
		// 40 is the threshold: wide (5 cells) at 40, compact (3 cells) below it.
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 40))).toBe("[###--] 1/2");
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 39))).toBe("[##-] 1/2");
	});

	it("returns empty for non-In-Progress statuses", () => {
		expect(formatAcceptanceCriteriaProgress(task({ status: "To Do" }))).toBe("");
		expect(formatAcceptanceCriteriaProgress(task({ status: "Done" }))).toBe("");
	});

	it("returns empty when there are no acceptance criteria", () => {
		expect(formatAcceptanceCriteriaProgress(task({ acceptanceCriteriaItems: [] }))).toBe("");
	});

	it("carries no AC label and no percentage beyond the exact fraction", () => {
		const t = task({ acceptanceCriteriaItems: criteria(2, 4) });
		const raw = stripTags(formatAcceptanceCriteriaProgress(t, 80));
		expect(raw).not.toContain("%");
		expect(raw).not.toContain("ac:");
		expect(raw.endsWith("2/4")).toBe(true);
	});

	it("keeps the exact fraction when every criterion is checked but still In Progress", () => {
		const t = task({ status: "In Progress", acceptanceCriteriaItems: criteria(3, 3) });
		expect(stripTags(formatAcceptanceCriteriaProgress(t, 80))).toBe("[#####] 3/3");
	});
});

describe("acceptance-criteria bar on the fork's TUI surfaces", () => {
	it("renders the compact bar in a board card row at a constrained column width", () => {
		const t = task({ acceptanceCriteriaItems: criteria(1, 2) });
		const row = stripTags(formatTaskListItem(t, false, 20));
		expect(row).toContain("[##-] 1/2");
		expect(row).toContain("TASK-1");
	});

	it("renders the wide bar in a board card row when the column is wide enough", () => {
		const t = task({ acceptanceCriteriaItems: criteria(1, 2) });
		const row = stripTags(formatTaskListItem(t, false, 80));
		expect(row).toContain("[###--] 1/2");
	});

	it("drops a board card row to the compact bar when the column is below the threshold", () => {
		// Reproduces the board's own width formula, floor(terminalWidth / columnCount) - 4:
		// a 120-column terminal with three columns yields 36, which must take the compact form.
		const t = task({ acceptanceCriteriaItems: criteria(0, 4) });
		const columnWidth = Math.max(1, Math.floor(120 / 3) - 4);
		expect(columnWidth).toBe(36);
		const row = stripTags(formatTaskListItem(t, false, columnWidth));
		expect(row).toContain("[---] 0/4");
		expect(row).not.toContain("[-----]");
	});

	it("keeps the task detail acceptance-criteria section free of the bar", () => {
		// The bar is a board/list presentation only; the detail pane deliberately does not draw it.
		const t = task({ acceptanceCriteriaItems: criteria(4, 7) });
		const { bodyContent } = generateDetailContent(t);
		const body = stripTags(bodyContent.join("\n"));
		expect(body).toContain("Acceptance Criteria");
		expect(body).not.toMatch(/\[[#-]+\] \d+\/\d+/);
	});

	it("still renders the criteria checklist itself without the bar", () => {
		const t = task({ acceptanceCriteriaItems: criteria(4, 7) });
		const body = stripTags(generateDetailContent(t).bodyContent.join("\n"));
		expect(body).toContain("criterion 1");
		expect(body).toContain("criterion 7");
		// 4 of 7 checked: both checklist symbols survive the bar's removal.
		expect(body).toContain("✓");
		expect(body).toContain("○");
	});
});
