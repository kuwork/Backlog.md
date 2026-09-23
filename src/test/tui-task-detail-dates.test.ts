import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: "BACK-1",
		title: "Task BACK-1",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-07-24",
		...overrides,
	};
}

const detail = (task: Task) => generateDetailContent(task).bodyContent.join("\n");

describe("task detail date lines", () => {
	it("shows due, planned, and actual dates only when the task has them", () => {
		const dated = makeTask({
			dueDate: "2026-10-01",
			plannedStart: "2026-09-20",
			plannedEnd: "2026-09-30",
			actualStart: "2026-09-21 09:30",
			actualEnd: "",
		});
		const body = detail(dated);
		expect(body).toContain("{bold}Due:{/bold} 2026-10-01");
		expect(body).toContain("{bold}Planned:{/bold} 2026-09-20 → 2026-09-30");
		expect(body).toContain("{bold}Actual:{/bold} 2026-09-21 09:30 → -");

		// A task without dates keeps the Details section free of date lines.
		const plain = detail(makeTask());
		expect(plain).not.toContain("{bold}Due:{/bold}");
		expect(plain).not.toContain("{bold}Planned:{/bold}");
		expect(plain).not.toContain("{bold}Actual:{/bold}");
	});

	it("shows a planned or actual range with a dash for the missing endpoint", () => {
		const body = detail(makeTask({ plannedEnd: "2026-09-30" }));
		expect(body).toContain("{bold}Planned:{/bold} - → 2026-09-30");
	});
});
