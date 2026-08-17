import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgress } from "../ui/acceptance-criteria-progress.ts";

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

describe("formatAcceptanceCriteriaProgress", () => {
	it("formats partial completion with a 10-cell bar and exact fraction", () => {
		const t = task({
			acceptanceCriteriaItems: [
				{ index: 1, text: "a", checked: true },
				{ index: 2, text: "b", checked: true },
				{ index: 3, text: "c", checked: true },
				{ index: 4, text: "d", checked: true },
				{ index: 5, text: "e", checked: false },
				{ index: 6, text: "f", checked: false },
				{ index: 7, text: "g", checked: false },
			],
		});
		expect(formatAcceptanceCriteriaProgress(t, 80)).toBe("[██████░░░░] 4/7");
	});

	it("uses a 5-cell bar in constrained widths", () => {
		const t = task({
			acceptanceCriteriaItems: [
				{ index: 1, text: "a", checked: true },
				{ index: 2, text: "b", checked: false },
			],
		});
		expect(formatAcceptanceCriteriaProgress(t, 20)).toBe("[███░░] 1/2");
	});

	it("returns empty for non-In-Progress statuses", () => {
		expect(formatAcceptanceCriteriaProgress(task({ status: "To Do" }))).toBe("");
		expect(formatAcceptanceCriteriaProgress(task({ status: "Done" }))).toBe("");
	});

	it("returns empty when there are no acceptance criteria", () => {
		expect(formatAcceptanceCriteriaProgress(task({ acceptanceCriteriaItems: [] }))).toBe("");
	});

	it("keeps the fraction exact when every criterion is checked but still In Progress", () => {
		const t = task({
			status: "In Progress",
			acceptanceCriteriaItems: [
				{ index: 1, text: "a", checked: true },
				{ index: 2, text: "b", checked: true },
				{ index: 3, text: "c", checked: true },
			],
		});
		expect(formatAcceptanceCriteriaProgress(t, 80)).toBe("[██████████] 3/3");
	});
});
