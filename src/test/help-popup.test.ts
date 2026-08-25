import { describe, expect, it } from "bun:test";
import { getHelpPopupHeight, getHelpShortcuts } from "../ui/components/help-popup.ts";

const keysFor = (context: "board" | "task-list") => getHelpShortcuts(context).map((shortcut) => shortcut.key);

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

	it("sizes the help popup to fit its shortcuts within the screen", () => {
		// 16 board shortcuts + 4 chrome rows fits in a 30-row screen.
		expect(getHelpPopupHeight(16, 30)).toBe(20);
		// A short screen caps the popup height below the content count.
		expect(getHelpPopupHeight(16, 10)).toBe(8);
		// The popup never drops below a minimum usable height.
		expect(getHelpPopupHeight(1, 30)).toBe(5);
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
