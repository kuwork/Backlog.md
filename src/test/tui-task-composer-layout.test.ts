import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { openTaskComposer } from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

/**
 * Regression coverage for BACK-678: the composer used to derive both its height and its
 * compact/normal choice from fixed breakpoints, so at 8 rows the scrollable form was a single row
 * (the bordered text inputs showed a bare border with no editable row and no cursor) and at 80 or
 * 100 columns a 30% selector column was 20 cells wide while "Status: In Progress ▼" needs 21, which
 * clipped the cue that marks a selector. These tests drive the real composer on real screens and
 * assert on the rendered geometry.
 */

type TestWidget = {
	content?: string;
	type?: string;
	width?: number | string;
	height?: number | string;
	childBase?: number;
	hidden?: boolean;
	position?: { top?: number | string; left?: number | string; height?: number | string };
	options?: { label?: string };
	children?: TestWidget[];
	_reading?: boolean;
	getCursor?: () => { x: number; y: number };
	emit?: (event: string, ...args: unknown[]) => void;
};

type TestScreen = {
	width: number;
	height: number;
	focused?: TestWidget;
	children?: unknown[];
	emit(event: string): void;
};

function collectWidgets(node: { children?: unknown[] }, out: TestWidget[] = []): TestWidget[] {
	for (const child of node.children ?? []) {
		const widget = child as TestWidget;
		out.push(widget);
		if (widget.children) collectWidgets(widget, out);
	}
	return out;
}

function findByLabel(widgets: TestWidget[], label: string): TestWidget | undefined {
	return widgets.find((widget) => widget.options?.label === label);
}

function findByContent(widgets: TestWidget[], content: string): TestWidget | undefined {
	return widgets.find((widget) => widget.content === content);
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const shift = name.startsWith("S-");
	const keyName = shift ? name.slice(2) : name;
	const key = { name: keyName, full: name, shift };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

/** The composer mounts its widgets asynchronously, so let both focus hops settle. */
async function settleComposerFocus(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

const SHIPPED_STATUSES = ["To Do", "In Progress", "Done"];
const stubTask = () => ({ id: "TASK-1", title: "Stub" }) as Task;

/**
 * Opens the composer on a real screen of the requested size, hands it to the case body, then
 * closes it through Escape so the widget tree and the returned promise both unwind.
 */
async function withComposer(
	width: number,
	height: number,
	statuses: readonly string[],
	run: (screen: TestScreen) => void,
): Promise<void> {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: width, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: height, writable: true });
	Object.defineProperty(screen, "fullUnicode", { configurable: true, value: true, writable: true });
	const resultPromise = openTaskComposer({ screen, statuses, persist: async () => stubTask() });
	const eventScreen = screen as unknown as TestScreen;
	try {
		await settleComposerFocus();
		run(eventScreen);
	} finally {
		pressKey(eventScreen.focused, "escape", "\x1b");
		await withTimeout(resultPromise, `composer at ${width}x${height}`, 1000);
		screen.destroy();
	}
}

describe("TUI task composer extreme-size layout", () => {
	it("keeps an editable row and a visible cursor for both text fields at 8 to 10 rows", async () => {
		for (const screenHeight of [8, 9, 10]) {
			await withComposer(80, screenHeight, SHIPPED_STATUSES, (screen) => {
				const widgets = collectWidgets(screen);
				const form = widgets.find((widget) => widget.type === "scrollable-box");
				const title = findByLabel(widgets, " Title ");
				const description = findByLabel(widgets, " Description ");
				// Popup chrome plus one complete bordered input have to stay inside the viewport.
				expect(form?.height).toBeGreaterThanOrEqual(3);

				const expectEditableRowVisible = (input: TestWidget | undefined) => {
					// The caret sits on the input's second row, below its top border. A one-row
					// viewport used to clip that row away, leaving a border with no cursor.
					const editableRow = Number(input?.position?.top ?? 0) + 1;
					const viewportTop = form?.childBase ?? 0;
					const viewportBottom = viewportTop + Number(form?.height ?? 0);
					expect(editableRow).toBeGreaterThanOrEqual(viewportTop);
					expect(editableRow).toBeLessThan(viewportBottom);
					// The field is in read mode, so it accepts input and paints its caret.
					expect(input?._reading).toBe(true);
					expect(input?.getCursor?.()).toBeDefined();
				};

				expect(screen.focused).toBe(title);
				expectEditableRowVisible(title);
				pressKey(screen.focused, "tab", "\t");
				expect(screen.focused).toBe(description);
				expectEditableRowVisible(description);

				// A short terminal cannot show every field, so the buttons stay reachable by scrolling.
				for (let step = 0; step < 6 && screen.focused?.content !== "Create task"; step += 1) {
					pressKey(screen.focused, "down");
				}
				expect(screen.focused?.content).toBe("Create task");
				expect(form?.childBase).toBeGreaterThan(0);
			});
		}
	});

	it("renders the longest shipped status and its cue without clipping at 80 and 100 columns", async () => {
		// The composer rests on the first configured status, so In Progress leads the list.
		for (const screenWidth of [80, 100]) {
			await withComposer(screenWidth, 24, ["In Progress", "To Do", "Done"], (screen) => {
				const status = findByContent(collectWidgets(screen), "Status: In Progress ▼");
				expect(status).toBeDefined();
				expect(status?.content?.endsWith(" ▼")).toBe(true);
				expect(Number(status?.width)).toBeGreaterThanOrEqual(Bun.stringWidth(status?.content ?? ""));
			});
		}
	});

	it("stacks both selectors on full-width rows when the configured status cannot fit a column", async () => {
		const longStatus = "Waiting for external review";
		await withComposer(100, 24, [longStatus, "To Do"], (screen) => {
			const widgets = collectWidgets(screen);
			const status = findByContent(widgets, `Status: ${longStatus} ▼`);
			const priority = findByContent(widgets, "Priority: None ▼");
			const create = findByContent(widgets, "Create task");
			// Compact stacks the selectors inside the details frame, one per row, and drops the
			// "Actions" caption so the buttons are the last row.
			expect(status?.position?.top).toBe(7);
			expect(priority?.position?.top).toBe(8);
			expect(create?.position?.top).toBe(10);
			for (const selector of [status, priority]) {
				expect(Number(selector?.width)).toBeGreaterThanOrEqual(Bun.stringWidth(selector?.content ?? ""));
				expect(selector?.position?.left).toBe(3);
			}
		});
	});

	it("reflows an open composer between the normal and compact layouts on resize", async () => {
		const longStatus = "Waiting for external review";
		await withComposer(100, 24, [longStatus, "To Do"], (screen) => {
			const layout = () => {
				const widgets = collectWidgets(screen);
				return {
					description: findByLabel(widgets, " Description "),
					details: findByLabel(widgets, " Details "),
					actions: findByContent(widgets, "Actions"),
					status: findByContent(widgets, `Status: ${longStatus} ▼`),
					priority: findByContent(widgets, "Priority: None ▼"),
					create: findByContent(widgets, "Create task"),
				};
			};
			const expectSelectorsFit = () => {
				const current = layout();
				for (const selector of [current.status, current.priority]) {
					expect(Number(selector?.width)).toBeGreaterThanOrEqual(Bun.stringWidth(selector?.content ?? ""));
				}
				return current;
			};

			// 100 columns cannot hold this status in a normal selector column, so it starts stacked.
			let current = expectSelectorsFit();
			expect(current.description?.position).toMatchObject({ top: 3, height: 3 });
			expect(current.details?.position).toMatchObject({ top: 6, height: 4 });
			expect(current.actions?.hidden).toBe(true);
			expect(current.status?.position).toMatchObject({ top: 7, left: 3 });
			expect(current.priority?.position).toMatchObject({ top: 8, left: 3 });
			expect(current.create?.position?.top).toBe(10);

			// A wide terminal fits it in the side-by-side column, so the expanded form comes back.
			screen.width = 140;
			screen.emit("resize");
			current = expectSelectorsFit();
			expect(current.description?.position).toMatchObject({ top: 3, height: 6 });
			expect(current.details?.position).toMatchObject({ top: 9, height: 3 });
			expect(current.actions?.hidden).toBe(false);
			expect(current.status?.position).toMatchObject({ top: 10, left: 3 });
			expect(current.priority?.position).toMatchObject({ top: 10, left: "35%" });

			screen.width = 50;
			screen.height = 18;
			screen.emit("resize");
			// 50 columns cap the popup at 46 cells, which cannot hold this 37-cell selector at all,
			// so only the stacked geometry is asserted here.
			current = layout();
			expect(current.description?.position).toMatchObject({ top: 3, height: 3 });
			expect(current.details?.position).toMatchObject({ top: 6, height: 4 });
			expect(current.actions?.hidden).toBe(true);
			expect(current.status?.position).toMatchObject({ top: 7, left: 3 });
			expect(current.priority?.position).toMatchObject({ top: 8, left: 3 });
		});
	});
});
