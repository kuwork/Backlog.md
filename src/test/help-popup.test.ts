import { describe, expect, it } from "bun:test";
import {
	getHelpPopupHeight,
	getHelpShortcuts,
	type HelpPopupContext,
	openHelpPopup,
} from "../ui/components/help-popup.ts";
import { createScreen } from "../ui/tui.ts";

type TestWidget = {
	atop?: number;
	aleft?: number;
	childBase?: number;
	children?: unknown[];
	content?: string;
	emit?: (event: string, ...args: unknown[]) => void;
	getScrollHeight?: () => number;
	height?: number;
	width?: number;
	options?: { label?: string };
	type?: string;
};

type TestScreen = {
	width: number;
	height: number;
	children?: TestWidget[];
	focused?: TestWidget;
	emit(event: string): void;
	listeners(event: string): unknown[];
};

function collectWidgets(root: { children?: unknown[] }): TestWidget[] {
	const widgets: TestWidget[] = [];
	const visit = (node: TestWidget) => {
		widgets.push(node);
		for (const child of node.children ?? []) visit(child as TestWidget);
	};
	visit(root as TestWidget);
	return widgets;
}

/** A real screen with the size the tests drive, since a non-TTY screen reports 1x1. */
function createTestScreen(width: number, height: number) {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: width, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: height, writable: true });
	return { screen, mutable: screen as unknown as TestScreen };
}

/** The popup, the backdrop behind it, its help row and its scrollable content. */
function popupParts(screen: unknown): {
	popup?: TestWidget;
	backdrop?: TestWidget;
	help?: TestWidget;
	viewport?: TestWidget;
} {
	const root = screen as { children?: TestWidget[] };
	const widgets = collectWidgets(root as { children?: unknown[] });
	const popup = widgets.find((widget) => widget.options?.label === " Keyboard Shortcuts ");
	return {
		popup,
		backdrop: root.children?.find((child) => child !== popup && child.type === "box"),
		help: widgets.find((widget) => typeof widget.content === "string" && widget.content.includes("Close Help")),
		viewport: widgets.find((widget) => widget.type === "scrollable-box"),
	};
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

const TEST_TIMEOUT = 2000;

async function settleHelpPopup(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

const keysFor = (context: HelpPopupContext) => getHelpShortcuts(context).map((shortcut) => shortcut.key);

describe("help popup shortcuts", () => {
	it("keeps board-specific shortcuts in the board help menu", () => {
		const keys = keysFor("board");

		expect(keys).toContain("F");
		expect(keys).toContain("M");
		expect(keys).toContain("←→");
	});

	it("uses task-list shortcuts in the task viewer help menu", () => {
		const keys = keysFor("task-list");

		expect(keys).toContain("S");
		expect(keys).toContain("L");
		expect(keys).not.toContain("F");
		expect(keys).not.toContain("M");
	});

	it("keeps a close entry in every help context", () => {
		for (const context of ["board", "task-list", "decision-list", "document-list"] as const) {
			expect(getHelpShortcuts(context).some((shortcut) => shortcut.key === "q/Esc")).toBe(true);
		}
	});

	it("sizes the help popup to fit its shortcuts within the screen", () => {
		// 16 board shortcuts + 4 chrome rows fits in a 30-row screen.
		expect(getHelpPopupHeight(16, 30)).toBe(20);
		// A short screen caps the popup height below the content count.
		expect(getHelpPopupHeight(16, 10)).toBe(8);
		// The popup never drops below a minimum usable height.
		expect(getHelpPopupHeight(1, 30)).toBe(5);
		// ...and never grows past the screen it sits on, even below that minimum.
		for (const screenHeight of [1, 2, 3, 4, 5, 8, 12, 24, 40]) {
			expect(getHelpPopupHeight(16, screenHeight)).toBeLessThanOrEqual(screenHeight);
		}
	});

	it("lists filter rows in the order each view footer advertises them", () => {
		const boardFilterKeys = getHelpShortcuts("board")
			.filter((shortcut) => shortcut.desc.startsWith("Filter by"))
			.map((shortcut) => shortcut.key);
		const taskListFilterKeys = getHelpShortcuts("task-list")
			.filter((shortcut) => shortcut.desc.startsWith("Filter by"))
			.map((shortcut) => shortcut.key);

		expect(boardFilterKeys.join("/")).toBe("P/I/F");
		expect(taskListFilterKeys.join("/")).toBe("S/P/I/L");
	});
});

describe("help popup layout", () => {
	it(
		"reflows an open popup, its backdrop and its help row when the terminal shrinks",
		async () => {
			const { screen, mutable } = createTestScreen(80, 24);
			try {
				const result = openHelpPopup(screen);
				await settleHelpPopup();

				mutable.height = 12;
				mutable.emit("resize");
				await settleHelpPopup();

				const shortcutCount = getHelpShortcuts("board").length;
				const { popup, backdrop, help, viewport } = popupParts(screen);

				expect(popup?.height).toBe(getHelpPopupHeight(shortcutCount, 12));
				expect(popup?.atop).toBeGreaterThanOrEqual(0);
				expect((popup?.atop ?? 0) + (popup?.height ?? 0)).toBeLessThanOrEqual(12);
				expect(help?.atop).toBeGreaterThanOrEqual(0);
				expect(help?.atop).toBeLessThan(12);

				// The panel behind the popup frames it: one row of padding above and below, both
				// measured from the popup's current position rather than from where it was drawn.
				const backdropBottom = (backdrop?.atop ?? 0) + (backdrop?.height ?? 0);
				expect(backdrop?.atop).toBeGreaterThanOrEqual(0);
				expect(backdropBottom).toBeLessThanOrEqual(12);
				expect((popup?.atop ?? 0) - (backdrop?.atop ?? 0)).toBe(1);
				expect(backdropBottom).toBe(Math.min((popup?.atop ?? 0) + (popup?.height ?? 0) + 1, 12));

				// Every row that no longer fits is still reachable, and the footer says so.
				const maxOffset = (viewport?.getScrollHeight?.() ?? 0) - (viewport?.height ?? 0);
				expect(maxOffset).toBeGreaterThan(0);
				expect(help?.content).toContain("Scroll");
				for (let index = 0; index < maxOffset + 3; index += 1) pressKey(mutable.focused, "down");
				expect(viewport?.childBase).toBe(maxOffset);

				// Growing back re-clamps the offset rather than leaving content scrolled out of view.
				mutable.height = 24;
				mutable.emit("resize");
				await settleHelpPopup();
				const expanded = popupParts(screen);
				expect(expanded.popup?.height).toBe(getHelpPopupHeight(shortcutCount, 24));
				expect(expanded.viewport?.childBase).toBe(0);
				expect(expanded.help?.content).not.toContain("Scroll");

				pressKey(mutable.focused, "escape", "\x1b");
				await result;
			} finally {
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"scrolls wrapped shortcut descriptions to their last rendered line on a narrow terminal",
		async () => {
			const { screen, mutable } = createTestScreen(30, 24);
			try {
				const result = openHelpPopup(screen, "board");
				await settleHelpPopup();

				const { viewport, help } = popupParts(screen);
				const renderedRows = viewport?.getScrollHeight?.() ?? 0;
				// Descriptions wrap, so there are more rendered rows than shortcuts - the count the
				// scroll bound used to be derived from.
				expect(renderedRows).toBeGreaterThan(getHelpShortcuts("board").length);
				const maxOffset = renderedRows - (viewport?.height ?? 0);
				expect(maxOffset).toBeGreaterThan(0);
				expect(help?.content).toContain("Scroll");
				for (let index = 0; index < maxOffset + 3; index += 1) pressKey(mutable.focused, "down");
				expect(viewport?.childBase).toBe(maxOffset);

				pressKey(mutable.focused, "escape", "\x1b");
				await result;
			} finally {
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"stops reacting to terminal resizes once the popup is closed",
		async () => {
			const { screen, mutable } = createTestScreen(80, 24);
			try {
				// A single listener is stored as the raw function, so read the registration count
				// through `listeners` rather than `listenerCount`.
				const listenersBeforeOpen = mutable.listeners("resize").length;
				const result = openHelpPopup(screen);
				await settleHelpPopup();
				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen + 1);

				pressKey(mutable.focused, "escape", "\x1b");
				await result;
				expect(mutable.listeners("resize").length).toBe(listenersBeforeOpen);

				// A resize after the close must not reach the destroyed popup.
				mutable.height = 12;
				expect(() => mutable.emit("resize")).not.toThrow();
				expect(popupParts(screen).popup).toBeUndefined();
			} finally {
				screen.destroy();
			}
		},
		TEST_TIMEOUT,
	);
});
