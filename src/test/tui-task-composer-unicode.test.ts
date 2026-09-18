import { afterEach, describe, expect, it } from "bun:test";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { caretIndexFromCursor, openTaskComposer } from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup, withTimeout } from "./test-utils.ts";

/**
 * Regression coverage for BACK-592: the composer used to delegate printable insertion to the
 * vendored widgets, which report the caret in terminal display cells but slice the value by UTF-16
 * unit. Typing next to an astral character therefore split its surrogate pair and the broken halves
 * persisted in the task file. These tests drive the real composer and assert on the saved bytes.
 */

const WIDE_ASTRAL = "\u{20BB7}";

type TestWidget = {
	_clines?: { length: number; real?: string[]; rtof?: number[]; fake?: string[] };
	childBase?: number;
	content?: string;
	type?: string;
	getCursor?: () => { x: number; y: number };
	setCursor?: (x: number, y: number) => void;
	getValue?: () => string;
	setValue?: (value: string) => void;
	emit?: (event: string, ...args: unknown[]) => void;
};

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const shift = name.startsWith("S-");
	const keyName = shift ? name.slice(2) : name;
	const key = { name: keyName, full: name, shift };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

function typeText(widget: TestWidget | undefined, value: string): void {
	for (const character of value) pressKey(widget, character, character);
}

/** The composer mounts its widgets asynchronously, so let both focus hops settle. */
async function settleComposerFocus(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

function createComposerScreen(width: number, height: number) {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: width, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: height, writable: true });
	Object.defineProperty(screen, "fullUnicode", { configurable: true, value: true, writable: true });
	return { screen, focused: () => (screen as unknown as { focused?: TestWidget }).focused };
}

/** Walk Tab until the Create action holds focus, so the test does not encode the field count. */
function focusCreateAction(focused: () => TestWidget | undefined): TestWidget | undefined {
	for (let step = 0; step < 8; step += 1) {
		const current = focused();
		if (current?.content === "Create task") return current;
		pressKey(current, "tab", "\t");
	}
	return focused();
}

let TEST_DIR: string;

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

describe("TUI task composer Unicode-safe insertion", () => {
	it("persists mid-field astral insertions from both text fields without corrupting their caret", async () => {
		TEST_DIR = createUniqueTestDir("tui-composer-unicode");
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Unicode Composer");
		const { screen, focused } = createComposerScreen(100, 30);
		let taskPath = "";

		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async (input: TaskCreateInput): Promise<Task> => {
					const result = await core.createTaskFromInput(input, false);
					if (!result.filePath) throw new Error("Expected canonical task creation to return its path");
					taskPath = result.filePath;
					return result.task;
				},
			});
			await settleComposerFocus();

			const title = focused();
			expect(title?.type).toBe("textbox");
			title?.setValue?.(`A${WIDE_ASTRAL}B`);
			pressKey(title, "end");
			// Two Left presses park the cursor on the wide character's second cell, which is the
			// ambiguous position that used to resolve inside the surrogate pair.
			pressKey(title, "left");
			pressKey(title, "left");
			typeText(title, "X");
			expect(title?.getValue?.()).toBe(`AX${WIDE_ASTRAL}B`);
			expect(title?.getCursor?.()).toEqual({ x: -3, y: 0 });

			pressKey(title, "tab", "\t");
			await settleComposerFocus();
			const description = focused();
			description?.setValue?.(`left ${WIDE_ASTRAL} right`);
			pressKey(description, "end");
			for (let step = 0; step < 7; step += 1) pressKey(description, "left");
			typeText(description, "Y");
			expect(description?.getValue?.()).toBe(`left Y${WIDE_ASTRAL} right`);
			expect(description?.getCursor?.()).toEqual({ x: -8, y: 0 });

			const createAction = focusCreateAction(focused);
			expect(createAction?.content).toBe("Create task");
			pressKey(createAction, "enter", "\r");
			expect((await withTimeout(resultPromise, "Unicode-safe composer persistence", 5000))?.id).toBe("TASK-1");

			const persisted = await Bun.file(taskPath).text();
			// YAML escapes astral title characters while Markdown keeps them literal; both forms must
			// represent the complete code point rather than separate surrogate halves.
			expect(persisted).toContain("AX\\U00020BB7B");
			expect(persisted).toContain(`left Y${WIDE_ASTRAL} right`);
			expect(persisted).not.toContain("\uFFFD");
			expect(persisted).not.toContain("\\uD842");
			expect(await core.fs.loadTask("TASK-1")).toMatchObject({
				title: `AX${WIDE_ASTRAL}B`,
				description: `left Y${WIDE_ASTRAL} right`,
			});
		} finally {
			screen.destroy();
		}
	});

	it("keeps an edited early description line in the viewport", async () => {
		TEST_DIR = createUniqueTestDir("tui-composer-viewport");
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Viewport Composer");
		const { screen, focused } = createComposerScreen(40, 30);

		try {
			const resultPromise = openTaskComposer({
				screen,
				statuses: ["To Do", "Done"],
				persist: async () => {
					throw new Error("Should not persist");
				},
			});
			await settleComposerFocus();
			pressKey(focused(), "tab", "\t");
			await settleComposerFocus();
			const description = focused();
			const longDescription = "one ".repeat(80).trim();
			description?.setValue?.(longDescription);
			const rows = description?._clines?.length ?? 1;
			expect(rows).toBeGreaterThan(1);
			// Park the caret on the first wrapped line.
			description?.setCursor?.(0, -(rows - 1));
			const valueBeforeEdit = description?.getValue?.() ?? "";
			const clines = description?._clines;
			const caretBeforeEdit = caretIndexFromCursor(valueBeforeEdit, description?.getCursor?.() ?? { x: 0, y: 0 }, {
				real: clines?.real ?? [valueBeforeEdit],
				rtof: clines?.rtof ?? [0],
				fakeCount: clines?.fake?.length ?? 1,
			});
			expect(caretBeforeEdit).toBeLessThan(valueBeforeEdit.length / 2);

			typeText(description, "X");

			expect(description?.getValue?.()).toBe(
				`${valueBeforeEdit.slice(0, caretBeforeEdit)}X${valueBeforeEdit.slice(caretBeforeEdit)}`,
			);
			// The edit is on an early line, so the viewport must not be left parked on the last one.
			// The exact offset depends on the wrapping geometry, so only the direction is asserted.
			expect(description?.childBase).toBeLessThan((description?._clines?.length ?? 1) - 1);

			pressKey(focused(), "escape", "\x1b");
			expect(await withTimeout(resultPromise, "description viewport cancellation", 5000)).toBeNull();
		} finally {
			screen.destroy();
		}
	});
});
