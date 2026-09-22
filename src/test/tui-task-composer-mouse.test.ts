import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { openTaskComposer } from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

/**
 * Regression coverage for BACK-679: the composer used to half-support the mouse. Clicking a text
 * field moved focus to it but never entered read mode (no caret, keystrokes lost), and the control
 * that was active before the click kept the focused highlight, which reads as a frozen composer.
 *
 * These tests drive the same path a terminal mouse event takes — `program.emit("mouse", …)` with
 * real coordinates taken from the rendered widget bounds, so blessed's own hit testing, the
 * clickable registry and the event bubbling chain all take part — instead of emitting `click`
 * straight at a widget. The discriminating assertion is `_reading`: measured on the pre-fix
 * composer it stayed `undefined`/`false` after a click even though focus moved.
 */

type TestWidget = {
	content?: string;
	type?: string;
	items?: Array<{ content?: string }>;
	options?: { label?: string };
	children?: unknown[];
	lpos?: { xi: number; xl: number; yi: number; yl: number };
	_reading?: boolean;
	style?: { border?: { fg?: string }; inverse?: boolean; bold?: boolean };
	getCursor?: () => { x: number; y: number };
	getValue?: () => string;
	emit?: (event: string, ...args: unknown[]) => void;
};

type TestScreen = {
	width: number;
	height: number;
	focused?: TestWidget;
	children?: unknown[];
	program: { emit?: (event: string, data: unknown) => void };
	render(): void;
};

const SHIPPED_STATUSES = ["To Do", "In Progress", "Done"];
const SHIPPED_PRIORITIES = ["High", "Medium", "Low"];
const stubTask = () => ({ id: "TASK-1", title: "Stub" }) as Task;

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

function findByContent(widgets: TestWidget[], prefix: string): TestWidget | undefined {
	return widgets.find((widget) => (widget.content ?? "").startsWith(prefix));
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

function typeText(widget: TestWidget | undefined, value: string): void {
	for (const character of value) pressKey(widget, character, character);
}

async function settleComposerFocus(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Clicks the centre of a widget through the screen's program, which is what a terminal hands to
 * blessed. Requires a prior render so the widget has layout bounds.
 */
async function mouseClick(screen: TestScreen, widget: TestWidget | undefined): Promise<void> {
	if (!widget?.lpos) throw new Error("widget has no rendered bounds to click");
	const x = Math.floor((widget.lpos.xi + widget.lpos.xl) / 2);
	const y = Math.floor((widget.lpos.yi + widget.lpos.yl) / 2);
	screen.program.emit?.("mouse", { action: "mousedown", x, y, button: "left" });
	screen.program.emit?.("mouse", { action: "mouseup", x, y, button: "left" });
	await settleComposerFocus();
}

/** Opens the composer at 100x30, hands the live screen to the case, then unwinds both popups. */
async function withComposer(run: (screen: TestScreen, widgets: TestWidget[]) => Promise<void>): Promise<void> {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
	Object.defineProperty(screen, "fullUnicode", { configurable: true, value: true, writable: true });
	const resultPromise = openTaskComposer({
		screen,
		statuses: SHIPPED_STATUSES,
		priorities: SHIPPED_PRIORITIES,
		persist: async () => stubTask(),
	});
	const eventScreen = screen as unknown as TestScreen;
	try {
		await settleComposerFocus();
		eventScreen.render();
		await run(eventScreen, collectWidgets(screen as unknown as { children?: unknown[] }));
	} finally {
		// Unwind even when the case failed, and never let teardown mask the assertion that failed:
		// a composer that half-supports the mouse can throw from inside blessed when Escape reaches
		// a text field whose reader was blurred out from under it (measured on the pre-fix code).
		try {
			// The first escape closes an open picker, the second cancels the composer itself.
			for (let attempt = 0; attempt < 3; attempt += 1) {
				pressKey(eventScreen.focused, "escape", "\x1b");
				await settleComposerFocus();
			}
			await withTimeout(resultPromise, "composer mouse test", 1000);
		} catch {
			// Already reported by the case body; keep the screen cleanup unconditional.
		} finally {
			screen.destroy();
		}
	}
}

describe("TUI task composer mouse activation", () => {
	it("clicks both text fields into exclusive read mode and accepts typed characters", async () => {
		await withComposer(async (screen, widgets) => {
			const title = findByLabel(widgets, " Title ");
			const description = findByLabel(widgets, " Description ");

			await mouseClick(screen, description);
			expect(screen.focused).toBe(description);
			expect(description?._reading).toBe(true);
			expect(description?.getCursor?.()).toBeDefined();
			expect(description?.style?.border?.fg).toBe("yellow");
			expect(title?.style?.border?.fg).toBe("gray");
			typeText(screen.focused, "Clicked description");
			expect(description?.getValue?.()).toBe("Clicked description");

			await mouseClick(screen, title);
			expect(screen.focused).toBe(title);
			expect(title?._reading).toBe(true);
			expect(title?.style?.border?.fg).toBe("yellow");
			expect(description?.style?.border?.fg).toBe("gray");
			typeText(screen.focused, "Clicked title");
			expect(title?.getValue?.()).toBe("Clicked title");
			// The first click's text survives the second field's activation.
			expect(description?.getValue?.()).toBe("Clicked description");
		});
	});

	it("re-clicks Title after keyboard navigation and on the active field without losing read mode", async () => {
		await withComposer(async (screen, widgets) => {
			const title = findByLabel(widgets, " Title ");
			const status = findByContent(widgets, "Status:");

			// Walk the keyboard away from Title first, so the click has to move focus back.
			pressKey(screen.focused, "down");
			pressKey(screen.focused, "down");
			expect(screen.focused).toBe(status);
			expect(status?.style).toMatchObject({ inverse: true, bold: true });

			await mouseClick(screen, title);
			expect(screen.focused).toBe(title);
			expect(title?._reading).toBe(true);
			expect(title?.style?.border?.fg).toBe("yellow");
			expect(status?.style).toMatchObject({ inverse: false, bold: false });
			typeText(screen.focused, "First");
			expect(title?.getValue?.()).toBe("First");

			// Clicking the already active field restarts the same reader instead of dropping out of it.
			await mouseClick(screen, title);
			expect(screen.focused).toBe(title);
			expect(title?._reading).toBe(true);
			typeText(screen.focused, " again");
			expect(title?.getValue?.()).toBe("First again");
		});
	});

	it("keeps the clicked field in read mode instead of letting the click bubble re-focus it", async () => {
		await withComposer(async (screen, widgets) => {
			const description = findByLabel(widgets, " Description ");

			await mouseClick(screen, description);
			// blessed's screen.focused setter re-emits `blur` on the outgoing widget, so the
			// bubbling `element click` auto-focus would blur the reader readInput just started.
			expect(description?._reading).toBe(true);
			typeText(description, "still editable");
			expect(description?.getValue?.()).toBe("still editable");
			pressKey(description, "backspace");
			expect(description?.getValue?.()).toBe("still editabl");
		});
	});

	it("opens the Status and Priority pickers from a click and restores selector focus", async () => {
		await withComposer(async (screen, widgets) => {
			const title = findByLabel(widgets, " Title ");
			const selectors = [
				{
					widget: findByContent(widgets, "Status:"),
					choices: ["Draft", "To Do", "In Progress", "Done"],
				},
				{
					widget: findByContent(widgets, "Priority:"),
					choices: ["None", "High", "Medium", "Low"],
				},
			];

			for (const { widget, choices } of selectors) {
				await mouseClick(screen, widget);
				expect(screen.focused?.items?.map((item) => item.content)).toEqual(choices);
				// The click moves the highlight straight away, while the picker is still open,
				// rather than only when the picker closes and hands focus back.
				expect(title?.style?.border?.fg).toBe("gray");
				pressKey(screen.focused, "enter", "\r");
				await settleComposerFocus();
				expect(screen.focused).toBe(widget);
				expect(widget?.style).toMatchObject({ inverse: true, bold: true });
			}
		});
	});
});
