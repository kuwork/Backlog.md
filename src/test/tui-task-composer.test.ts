import { describe, expect, it } from "bun:test";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, upsertBoardTask } from "../ui/board.ts";
import type { CaretLines } from "../ui/components/task-composer.ts";
import {
	caretIndexFromCursor,
	createTaskComposerValues,
	cursorFromCaretIndex,
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
				dueDate: "2026-10-01",
				plannedStart: "2026-09-20",
				plannedEnd: "2026-09-30",
				actualStart: "",
				actualEnd: "",
			}),
		).toEqual({
			title: "Capture intent",
			description: "Line one\nLine two",
			status: "Review",
			priority: "high",
			dueDate: "2026-10-01",
			plannedStart: "2026-09-20",
			plannedEnd: "2026-09-30",
		});

		expect(
			toTaskCreateInput({
				title: "Minimal",
				description: "",
				status: "To Do",
				priority: "",
				dueDate: "",
				plannedStart: "",
				plannedEnd: "",
				actualStart: "",
				actualEnd: "",
			}),
		).toEqual({
			title: "Minimal",
			status: "To Do",
		});
	});

	it("refuses malformed dates and names the field", () => {
		expect(() =>
			toTaskCreateInput({
				title: "Dated",
				description: "",
				status: "To Do",
				priority: "",
				dueDate: "tomorrow",
				plannedStart: "",
				plannedEnd: "",
				actualStart: "",
				actualEnd: "",
			}),
		).toThrow("Due must be YYYY-MM-DD (or YYYY-MM-DD HH:mm).");

		expect(() =>
			toTaskCreateInput({
				title: "Dated",
				description: "",
				status: "To Do",
				priority: "",
				dueDate: "2026-10-01 09:30",
				plannedStart: "",
				plannedEnd: "",
				actualStart: "",
				actualEnd: "",
			}),
		).not.toThrow();
	});

	it("keeps the normal layout at 100x30 and 80x24, then stacks details at 50x18", () => {
		expect(getTaskComposerLayout(100, 30)).toMatchObject({
			compact: false,
			popupHeight: 24,
			descriptionHeight: 6,
			detailsTop: 9,
			detailsHeight: 3,
			datesTop: 12,
			datesHeight: 5,
			actionsTop: 17,
		});
		expect(getTaskComposerLayout(80, 24)).toMatchObject({ compact: false, popupHeight: 24, actionsTop: 17 });
		expect(getTaskComposerLayout(50, 18)).toMatchObject({
			compact: true,
			popupHeight: 16,
			descriptionHeight: 3,
			detailsTop: 6,
			detailsHeight: 4,
			datesTop: 10,
			actionsTop: 15,
		});
	});

	it("sizes the popup so the longest configured selector fits a normal column", () => {
		const shipped = getTaskComposerLayout(80, 24, { statuses: ["To Do", "In Progress", "Done"] });
		// "Status: In Progress ▼" is 21 cells, and a normal selector column is 30% of the form,
		// so the popup grows past its preferred 72 columns instead of clipping the cue.
		expect(shipped.popupWidth).toBe(74);
		expect(shipped.compact).toBe(false);

		// Content that cannot fit any normal column switches to the stacked compact layout.
		expect(getTaskComposerLayout(80, 24, { statuses: ["Waiting for external review", "To Do"] }).compact).toBe(true);
		expect(getTaskComposerLayout(140, 24, { statuses: ["To Do", "Done"] }).popupWidth).toBe(72);
	});

	it("reserves a complete bordered input at heights of 8 to 10 rows", () => {
		for (const screenHeight of [8, 9, 10]) {
			const { popupHeight } = getTaskComposerLayout(80, screenHeight);
			expect(popupHeight).toBeGreaterThanOrEqual(8);
			expect(popupHeight).toBeLessThanOrEqual(screenHeight);
		}
	});

	it("keeps the composer inside short terminals so no row is pushed off-screen", () => {
		for (const screenHeight of [6, 8, 10, 12, 14, 16, 20, 24, 40]) {
			const { popupHeight } = getTaskComposerLayout(80, screenHeight);
			expect(popupHeight).toBeLessThanOrEqual(screenHeight);
		}
		expect(getTaskComposerLayout(80, 10).popupHeight).toBe(8);
	});

	it("maps a display-cell cursor onto code-point boundaries around a wide astral character", () => {
		const value = "A\u{20BB7}B";
		const lines: CaretLines = {
			// The widget adds \x03 as an internal placeholder for the character's second cell.
			real: ["A\u{20BB7}\x03B"],
			rtof: [0],
			fakeCount: 1,
			displayWidth: (text) =>
				Array.from(text).reduce((width, character) => width + (character === "\u{20BB7}" ? 2 : 1), 0),
		};

		// The widget can leave its cursor on the second cell of a wide character. Resolve that
		// ambiguous cell to the boundary before the character, never between its surrogates.
		expect(caretIndexFromCursor(value, { x: -2, y: 0 }, lines)).toBe(1);
		expect(cursorFromCaretIndex(value, 1, lines)).toEqual({ x: -3, y: 0 });
		for (const index of [0, 1, 3, 4]) {
			expect(caretIndexFromCursor(value, cursorFromCaretIndex(value, index, lines), lines)).toBe(index);
		}
	});

	it("never resolves a caret inside a surrogate pair, for any displayed column", () => {
		const value = "A\u{20BB7}B";
		const writeWidth = (text: string) => Array.from(text).reduce((w, ch) => w + (ch === "\u{20BB7}" ? 2 : 1), 0);
		const lines: CaretLines = { real: ["A\u{20BB7}\x03B"], rtof: [0], fakeCount: 1, displayWidth: writeWidth };

		// Columns are walked to one past the end so the cursor can sit on either cell of the wide
		// character: no column may produce an index that splits its surrogate pair.
		for (let column = 0; column <= writeWidth("A\u{20BB7}B") + 2; column += 1) {
			const caret = caretIndexFromCursor(value, { x: -column, y: 0 }, lines);
			expect(caret).not.toBe(2);
			expect(`${value.slice(0, caret)}X${value.slice(caret)}`).not.toContain("\uFFFD");
		}
		// Without a display-width hook the conversion still cannot split the pair.
		const fallback: CaretLines = { real: ["A\u{20BB7}\x03B"], rtof: [0], fakeCount: 1 };
		expect(caretIndexFromCursor(value, { x: -2, y: 0 }, fallback)).not.toBe(2);
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
			dueDate: "",
			plannedStart: "",
			plannedEnd: "",
			actualStart: "",
			actualEnd: "",
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
