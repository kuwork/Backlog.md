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

		expect(keys).toContain("s");
		expect(keys).toContain("l");
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
});
