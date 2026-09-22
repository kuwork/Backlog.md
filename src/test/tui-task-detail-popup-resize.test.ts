import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

type TestScreen = {
	width: number;
	height: number;
	emit(event: string): void;
	listeners(event: string): unknown[];
};

type TestBox = {
	atop: number;
	top?: number;
	left?: number;
	width?: number;
	height?: number;
	style: { border?: { fg?: string } };
	emit?: (event: string, ...args: unknown[]) => void;
};

/** A real screen with the size the tests drive, since a non-TTY screen reports 1x1. */
function createTestScreen(width: number, height: number) {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: width, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: height, writable: true });
	return { screen, mutable: screen as unknown as TestScreen };
}

/** createTaskPopup bails out when stdout is not a TTY, so tests run under a patched flag. */
function patchTTY() {
	const original = process.stdout.isTTY;
	let patched = false;
	if (process.stdout.isTTY === false) {
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		patched = true;
	}
	return () => {
		if (patched) {
			Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
		}
	};
}

function makeTask(): Task {
	return {
		id: "TASK-1",
		title: "Resize regression task",
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
	};
}

function pressKey(widget: TestBox | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

const TEST_TIMEOUT = 2000;

describe("task detail popup resize", () => {
	it(
		"reflows the backdrop to track the popup when the terminal shrinks and grows",
		async () => {
			const { screen, mutable } = createTestScreen(80, 24);
			const restoreTTY = patchTTY();
			try {
				const result = await createTaskPopup(screen, makeTask());
				expect(result).not.toBeNull();
				if (!result) return;

				const background = result.background as unknown as TestBox;
				const popup = result.popup as unknown as TestBox;

				// 80x24: popup 68x19 centered at top 2-3, so the backdrop sits at top 1,
				// left 4, 72 wide and 21 tall.
				expect(background.top).toBe(1);
				expect(background.left).toBe(4);
				expect(background.width).toBe(72);
				expect(background.height).toBe(21);

				// Shrink to 80x12: the popup reflows to height 9 and the backdrop must follow
				// instead of keeping the geometry it was drawn with.
				mutable.height = 12;
				mutable.emit("resize");

				expect(background.top).toBe(0);
				expect(background.height).toBe(11);
				expect(background.left).toBe(4);
				expect(background.width).toBe(72);

				// The popup itself stays fully on-screen with its border inside the viewport.
				expect(popup.atop).toBeGreaterThanOrEqual(0);
				expect(popup.atop + 9).toBeLessThanOrEqual(12);

				// The backdrop hugs the popup: its top tracks the popup's top and its bottom
				// stays within one row of the popup's bottom (the renderer and the layout
				// helper resolve "center" with formulas that can differ by one row).
				expect(Math.abs((background.top ?? 0) - (popup.atop - 1))).toBeLessThanOrEqual(1);
				expect(Math.abs((background.top ?? 0) + (background.height ?? 0) - (popup.atop + 9))).toBeLessThanOrEqual(1);

				// Growing back to 80x24 restores the original backdrop geometry.
				mutable.height = 24;
				mutable.emit("resize");

				expect(background.top).toBe(1);
				expect(background.height).toBe(21);
			} finally {
				restoreTTY();
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"removes the resize listener when the popup closes and ignores resizes afterwards",
		async () => {
			const { screen, mutable } = createTestScreen(80, 24);
			const restoreTTY = patchTTY();
			try {
				const listenersBeforeOpen = mutable.listeners("resize").length;
				const result = await createTaskPopup(screen, makeTask());
				expect(result).not.toBeNull();
				if (!result) return;

				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen + 1);

				result.close();

				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen);

				// A resize after the close must not reach the destroyed popup.
				mutable.height = 12;
				expect(() => mutable.emit("resize")).not.toThrow();
			} finally {
				restoreTTY();
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"keeps the close keys and the focus/blur border colors unchanged",
		async () => {
			const { screen, mutable } = createTestScreen(80, 24);
			const restoreTTY = patchTTY();
			try {
				const listenersBeforeOpen = mutable.listeners("resize").length;
				const result = await createTaskPopup(screen, makeTask());
				expect(result).not.toBeNull();
				if (!result) return;

				// Focus highlights the border, blur restores it.
				const contentArea = result.contentArea as unknown as TestBox;
				contentArea.emit?.("focus");
				expect((result.popup as unknown as TestBox).style.border?.fg).toBe("yellow");
				contentArea.emit?.("blur");
				expect((result.popup as unknown as TestBox).style.border?.fg).toBe("gray");

				// Escape on the content area closes the popup and drops the resize listener.
				pressKey(contentArea, "escape");
				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen);

				// q on the popup closes it too.
				const second = await createTaskPopup(screen, makeTask());
				expect(second).not.toBeNull();
				pressKey(second?.popup as unknown as TestBox, "q");
				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen);
			} finally {
				restoreTTY();
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);
});
