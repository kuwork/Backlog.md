import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import AcceptanceCriteriaProgress from "../web/components/AcceptanceCriteriaProgress";

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

describe("AcceptanceCriteriaProgress", () => {
	it("renders a 10-cell bar with the exact fraction for partial completion", () => {
		const html = renderToString(
			<AcceptanceCriteriaProgress
				cells={10}
				task={task({
					acceptanceCriteriaItems: [
						{ index: 1, text: "a", checked: true },
						{ index: 2, text: "b", checked: true },
						{ index: 3, text: "c", checked: false },
					],
				})}
			/>,
		);
		expect(html).toContain("data-cell-count=\"10\"");
		expect(html).toContain("aria-valuenow=\"2\"");
		expect(html).toContain("aria-valuemax=\"3\"");
		expect(html).toContain("2 of 3 acceptance criteria checked");
	});

	it("honors the 5-cell layout", () => {
		const html = renderToString(
			<AcceptanceCriteriaProgress
				cells={5}
				task={task({
					acceptanceCriteriaItems: [
						{ index: 1, text: "a", checked: true },
						{ index: 2, text: "b", checked: false },
					],
				})}
			/>,
		);
		expect(html).toContain("data-cell-count=\"5\"");
		expect(html).toContain("1 of 2 acceptance criteria checked");
	});

	it("renders nothing for tasks without acceptance criteria", () => {
		const html = renderToString(<AcceptanceCriteriaProgress cells={10} task={task({ acceptanceCriteriaItems: [] })} />);
		expect(html).toBe("");
	});

	it("renders nothing for non-In-Progress statuses", () => {
		const html = renderToString(
			<AcceptanceCriteriaProgress cells={10} task={task({ status: "To Do" })} />,
		);
		expect(html).toBe("");
	});
});
