/**
 * A screen must stop reacting to the terminal once the view that owned it has been left. The Tab
 * switch destroys the outgoing view's screen (task-viewer-with-search's tab handler), and blessed's
 * Screen constructor binds a program-level "resize" fan-out that screen.destroy does not remove: the
 * dead screen kept re-emitting "resize" into the view's own listener, the filter header rebuilt
 * itself into a container that belonged to the destroyed screen, and blessed threw "Cannot switch a
 * node's screen." - which is what changing the terminal height did after leaving the drafts list
 * with Tab and opening a detail popup.
 */

import { describe, expect, it } from "bun:test";
import { box } from "neo-neo-bblessed";
import type { Task } from "../types/index.ts";
import { createFilterHeader } from "../ui/components/filter-header.ts";
import { createTaskPopup } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";

type ProgramListeners = {
	program: { listeners(event: string): unknown[] };
};

type TestScreen = ProgramListeners & {
	width: number;
	height: number;
	on(event: string, listener: () => void): void;
	destroy(): void;
};

/** One view's screen: a filter header in a container, with the resize listener both views register. */
function createViewScreen(label: string): { screen: TestScreen; resizes: () => number } {
	const screen = createScreen({ smartCSR: false }) as unknown as TestScreen;
	Object.defineProperty(screen, "width", { configurable: true, value: 120, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
	const container = box({ parent: screen as never, top: 0, left: 0, width: "100%", height: "100%" });
	const header = createFilterHeader({
		parent: container as never,
		statuses: ["To Do", "In Progress", "Done"],
		availableLabels: [],
		availableMilestones: [],
		onFilterChange: () => {},
		onFilterPickerOpen: () => {},
		summary: label,
	});
	let count = 0;
	screen.on("resize", () => {
		count += 1;
		header.rebuild();
	});
	return { screen, resizes: () => count };
}

/** A bare screen, for asserting on the program's listeners without rendering anything. */
function createBareScreen(): TestScreen {
	return createScreen({ smartCSR: false }) as unknown as TestScreen;
}

/** The way a terminal resize arrives: the output emits "resize" and each screen fans it out. */
function changeHeight(height: number): () => void {
	const output = process.stdout as unknown as { columns: number; rows: number; emit: (event: string) => void };
	const previous = { columns: output.columns, rows: output.rows };
	output.columns = 120;
	output.rows = height;
	output.emit("resize");
	return () => {
		output.columns = previous.columns;
		output.rows = previous.rows;
	};
}

/** createTaskPopup bails out when stdout is not a TTY, so the test runs under a patched flag. */
function patchTTY(): () => void {
	const original = process.stdout.isTTY;
	if (process.stdout.isTTY !== false) return () => {};
	Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
	return () => {
		Object.defineProperty(process.stdout, "isTTY", { value: original, configurable: true });
	};
}

const TEST_TIMEOUT = 5000;

describe("screen teardown", () => {
	it(
		"stops a screen that a Tab switch left behind from answering the next terminal resize",
		async () => {
			// The reported steps: leave the list with Tab, open the detail popup on the board, change
			// the terminal height.
			const restoreTTY = patchTTY();
			const listView = createViewScreen("drafts list");
			listView.screen.destroy();
			const boardView = createViewScreen("drafts board");
			const task = { id: "DRAFT-1", title: "Draft", status: "Draft" } as unknown as Task;
			try {
				const popup = await createTaskPopup(boardView.screen as never, task);
				expect(popup).not.toBeNull();

				const restoreSize = changeHeight(15);
				try {
					// The destroyed view must not react: blessed would rebuild its filter header into a
					// dead screen's container and throw "Cannot switch a node's screen.".
					expect(listView.resizes()).toBe(0);
					// The live view keeps its own resize handling.
					expect(boardView.resizes()).toBe(1);
				} finally {
					restoreSize();
				}
				popup?.close();
			} finally {
				restoreTTY();
				boardView.screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it("takes only the destroyed screen's fan-out off the shared program", () => {
		// The reverse order of the Tab switch: the outgoing screen is destroyed while the incoming one
		// is already mounted. Removing every program "resize" listener would silence the live screen
		// here, so the teardown has to drop its own handler by reference.
		const firstView = createBareScreen();
		const secondView = createBareScreen();
		const program = firstView.program;
		const before = program.listeners("resize").length;
		try {
			expect(before).toBeGreaterThanOrEqual(2);

			firstView.destroy();

			expect(program.listeners("resize").length).toBe(before - 1);
		} finally {
			secondView.destroy();
		}
	});
});
