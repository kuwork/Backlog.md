import { describe, expect, it } from "bun:test";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, upsertBoardTask } from "../ui/board.ts";
import {
	createTaskComposerValues,
	getTaskComposerLayout,
	getTaskComposerPriorityChoices,
	getTaskComposerStatusChoices,
	getTaskComposerWorkflowStatuses,
	TaskComposerController,
	toTaskCreateInput,
} from "../ui/components/task-composer.ts";

describe("TUI task composer model", () => {
	it("rests on the first configured workflow status and never Draft", () => {
		const values = createTaskComposerValues(["Review", "Ready", "Done"]);
		expect(values.status).toBe("Review");
		expect(values.priority).toBe("");
	});

	it("offers Draft only in the opened status choices without changing the resting value", () => {
		const values = createTaskComposerValues(["Backlog", "Doing", "Done"]);
		const choices = getTaskComposerStatusChoices(["Backlog", "Doing", "Done"]);

		expect(choices.map((choice) => choice.value)).toEqual(["Draft", "Backlog", "Doing", "Done"]);
		expect(values.status).toBe("Backlog");
	});

	it("filters Draft out of the workflow statuses and falls back to To Do", () => {
		expect(getTaskComposerWorkflowStatuses(["To Do", "Done"])).toEqual(["To Do", "Done"]);
		expect(getTaskComposerWorkflowStatuses(["Draft", "In Progress"])).toEqual(["In Progress"]);
		expect(getTaskComposerWorkflowStatuses([])).toEqual(["To Do"]);
	});

	it("uses configured priority choices with an explicit unset option", () => {
		expect(getTaskComposerPriorityChoices(["Urgent", "Eventually"])).toEqual([
			{ label: "None", value: "" },
			{ label: "Urgent", value: "urgent" },
			{ label: "Eventually", value: "eventually" },
		]);
	});

	it("defaults priority choices to high/medium/low when unconfigured", () => {
		expect(getTaskComposerPriorityChoices()).toEqual([
			{ label: "None", value: "" },
			{ label: "high", value: "high" },
			{ label: "medium", value: "medium" },
			{ label: "low", value: "low" },
		]);
	});

	it("builds the canonical first-slice payload and omits unset fields", () => {
		expect(
			toTaskCreateInput({
				title: "  Capture intent  ",
				description: "Line one\nLine two",
				status: "Review",
				priority: "high",
			}),
		).toEqual({
			title: "Capture intent",
			description: "Line one\nLine two",
			status: "Review",
			priority: "high",
		});

		expect(toTaskCreateInput({ title: "Minimal", description: "", status: "To Do", priority: "" })).toEqual({
			title: "Minimal",
			status: "To Do",
		});
	});

	it("keeps the composer compact at 100x30 and 80x24, then stacks details at 50x18", () => {
		expect(getTaskComposerLayout(100, 30)).toMatchObject({
			compact: false,
			popupHeight: 20,
			descriptionHeight: 6,
			detailsTop: 9,
			detailsHeight: 3,
			actionsTop: 12,
		});
		expect(getTaskComposerLayout(80, 24)).toMatchObject({ compact: false, popupHeight: 20, actionsTop: 12 });
		expect(getTaskComposerLayout(50, 18)).toMatchObject({
			compact: true,
			popupHeight: 16,
			descriptionHeight: 3,
			detailsTop: 6,
			detailsHeight: 4,
			actionsTop: 10,
		});
	});

	it("keeps the composer inside short terminals so no row is pushed off-screen", () => {
		for (const screenHeight of [6, 8, 10, 12, 14, 16, 20, 24, 40]) {
			const { popupHeight } = getTaskComposerLayout(80, screenHeight);
			expect(popupHeight).toBeLessThanOrEqual(screenHeight);
		}
		expect(getTaskComposerLayout(80, 10).popupHeight).toBe(8);
	});

	it("does not persist invalid input and preserves values after a failed attempt", async () => {
		const controller = new TaskComposerController(["Review", "Done"]);
		let calls = 0;
		const persist = async (_input: TaskCreateInput) => {
			calls += 1;
			throw new Error("Disk is read-only");
		};

		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(0);
		expect(controller.error).toBe("Title is required.");

		controller.values.title = "Retry me";
		controller.values.description = "Keep this description";
		expect(await controller.create(persist)).toBeNull();
		expect(calls).toBe(1);
		expect(controller.error).toBe("Disk is read-only");
		expect(controller.values).toEqual({
			title: "Retry me",
			description: "Keep this description",
			status: "Review",
			priority: "",
		});
	});
});

describe("board task creation helpers", () => {
	it("upserts a task by id, appending new ids and replacing existing ones", () => {
		const first = { id: "TASK-1", title: "One" } as Task;
		const second = { id: "TASK-2", title: "Two" } as Task;

		expect(upsertBoardTask([], first)).toEqual([first]);
		expect(upsertBoardTask([first], second)).toEqual([first, second]);
		expect(upsertBoardTask([first, second], { ...first, title: "One updated" })).toEqual([
			{ ...first, title: "One updated" },
			second,
		]);
	});

	it("describes the board outcome for drafts, hidden tasks, and visible tasks", () => {
		expect(getCreatedTaskBoardOutcome({ id: "TASK-1", status: "To Do" } as Task, true)).toEqual({
			focusTaskId: "TASK-1",
			message: "Created TASK-1.",
			tone: "green",
		});
		expect(getCreatedTaskBoardOutcome({ id: "TASK-1", status: "To Do" } as Task, false)).toEqual({
			message: "Created TASK-1, but it is hidden by the current board filters.",
			tone: "yellow",
		});
		expect(getCreatedTaskBoardOutcome({ id: "DRAFT-1", status: "Draft" } as Task, false)).toEqual({
			message: "Created DRAFT-1 as a draft. Drafts are not shown on the task board.",
			tone: "yellow",
		});
	});
});
