import type { ScreenInterface } from "neo-neo-bblessed";
import { createPopupChrome, createScrollableViewport } from "./filter-popup.ts";

export type HelpPopupContext = "board" | "task-list" | "decision-list" | "document-list";

type Shortcut = {
	key: string;
	desc: string;
};

// Letters are uppercase key indicators, matching the footer: `P` means "press the P key",
// not Shift+P. The bound key is the lowercase letter.
const BOARD_SHORTCUTS: Shortcut[] = [
	{ key: "Tab", desc: "Switch View (Kanban/List)" },
	{ key: "N", desc: "Create task" },
	{ key: "/", desc: "Search tasks" },
	{ key: "P", desc: "Filter by Priority" },
	{ key: "I", desc: "Filter by Milestone" },
	{ key: "F", desc: "Filter by Labels" },
	{ key: "←→", desc: "Navigate columns" },
	{ key: "↑↓", desc: "Navigate tasks" },
	{ key: "Enter", desc: "View task details" },
	{ key: "E", desc: "Edit task" },
	{ key: "M", desc: "Move tasks (Shift+M selects more in move mode)" },
	{ key: "C", desc: "Complete task" },
	{ key: "A", desc: "Archive task" },
	{ key: "H", desc: "Hide/show empty columns" },
	{ key: "Y", desc: "Yank (Copy) task ID" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

const TASK_LIST_SHORTCUTS: Shortcut[] = [
	{ key: "Tab", desc: "Switch View (Kanban/List)" },
	{ key: "/", desc: "Search tasks" },
	{ key: "S", desc: "Filter by Status" },
	{ key: "P", desc: "Filter by Priority" },
	{ key: "I", desc: "Filter by Milestone" },
	{ key: "L", desc: "Filter by Labels" },
	{ key: "↑↓", desc: "Navigate tasks" },
	{ key: "←→", desc: "Switch between list and details" },
	{ key: "Enter", desc: "Focus task details" },
	{ key: "E", desc: "Edit task" },
	{ key: "C", desc: "Complete task" },
	{ key: "A", desc: "Archive task" },
	{ key: "Y", desc: "Yank (Copy) task ID" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

const DECISION_LIST_SHORTCUTS: Shortcut[] = [
	{ key: "←→", desc: "Switch between list and details" },
	{ key: "↑↓", desc: "Navigate decisions" },
	{ key: "j/k", desc: "Navigate decisions" },
	{ key: "PgUp/PgDn", desc: "Scroll detail page" },
	{ key: "Home/End", desc: "Jump to top/bottom of detail" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

const DOCUMENT_LIST_SHORTCUTS: Shortcut[] = [
	{ key: "←→", desc: "Switch between list and details" },
	{ key: "↑↓", desc: "Navigate documents" },
	{ key: "j/k", desc: "Navigate documents" },
	{ key: "PgUp/PgDn", desc: "Scroll detail page" },
	{ key: "Home/End", desc: "Jump to top/bottom of detail" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

export function getHelpShortcuts(context: HelpPopupContext = "board"): Shortcut[] {
	switch (context) {
		case "task-list":
			return TASK_LIST_SHORTCUTS;
		case "decision-list":
			return DECISION_LIST_SHORTCUTS;
		case "document-list":
			return DOCUMENT_LIST_SHORTCUTS;
		default:
			return BOARD_SHORTCUTS;
	}
}

/** Popup rows spent on borders, the top spacer and the help line, leaving one row per shortcut. */
const HELP_POPUP_CHROME_ROWS = 4;
const HELP_POPUP_WIDTH = 60;

function getHelpText(scrolls: boolean): string {
	return scrolls ? " {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[Esc/q]{/} Close Help" : " {cyan-fg}[Esc/q]{/} Close Help";
}

export function getHelpPopupHeight(shortcutCount: number, screenHeight: number): number {
	const boundedScreenHeight = Math.max(1, screenHeight);
	const preferredHeight = Math.max(5, Math.min(shortcutCount + HELP_POPUP_CHROME_ROWS, boundedScreenHeight - 2));
	return Math.min(boundedScreenHeight, preferredHeight);
}

export async function openHelpPopup(screen: ScreenInterface, context: HelpPopupContext = "board"): Promise<void> {
	return new Promise<void>((resolve) => {
		let settled = false;
		const shortcuts = getHelpShortcuts(context);
		let popupHeight = getHelpPopupHeight(shortcuts.length, screen.height);
		const { popup, close, reflow } = createPopupChrome({
			screen,
			title: "Keyboard Shortcuts",
			helpText: getHelpText(false),
			width: HELP_POPUP_WIDTH,
			height: popupHeight,
		});

		const content = shortcuts.map((s) => `{cyan-fg}[${s.key.padStart(5)}]{/} ${s.desc}`).join("\n");

		// Terminals too short for every shortcut keep the remaining rows reachable by scrolling.
		const contentBox = createScrollableViewport({
			parent: popup,
			top: 1,
			left: 2,
			right: 2,
			bottom: 1,
			content,
			tags: true,
		});

		// The renderer already holds the wrapped row count, so scrolling follows what is drawn
		// rather than the logical shortcut count.
		const getMaxScrollOffset = () => {
			const visibleRows =
				typeof contentBox.height === "number" ? contentBox.height : popupHeight - HELP_POPUP_CHROME_ROWS;
			return Math.max(0, contentBox.getScrollHeight() - Math.max(1, visibleRows));
		};
		const applyLayout = () => {
			popupHeight = getHelpPopupHeight(shortcuts.length, screen.height);
			reflow(HELP_POPUP_WIDTH, popupHeight);
			// Rendering reparses the content at its new width, so the row count read below is the
			// wrapped, tag-stripped one the user actually sees.
			screen.render();
			const maxOffset = getMaxScrollOffset();
			contentBox.childBase = Math.min(maxOffset, Math.max(0, contentBox.childBase));
			reflow(HELP_POPUP_WIDTH, popupHeight, getHelpText(maxOffset > 0));
			screen.render();
		};
		const onResize = () => {
			if (!settled) applyLayout();
		};

		const finish = () => {
			if (settled) return;
			settled = true;
			(
				screen as ScreenInterface & {
					removeListener(event: string, listener: (...args: unknown[]) => void): void;
				}
			).removeListener("resize", onResize);
			close();
			screen.render();
			resolve();
		};

		popup.key(["escape", "q", "Q", "?"], () => {
			finish();
			return false;
		});

		const scrollBy = (delta: number) => {
			const maxOffset = getMaxScrollOffset();
			contentBox.childBase = Math.min(maxOffset, Math.max(0, contentBox.childBase + delta));
			screen.render();
			return false;
		};
		popup.key(["up"], () => scrollBy(-1));
		popup.key(["down"], () => scrollBy(1));
		screen.on("resize", onResize);

		setImmediate(() => {
			if (settled) return;
			popup.focus();
			applyLayout();
		});
	});
}
