import { describe, expect, it } from "bun:test";
import { getTerminalStatus, isTerminalStatus, isTerminalStatusName } from "../utils/terminal-status.ts";

describe("terminal status helpers", () => {
	it("uses the final configured status as terminal", () => {
		expect(getTerminalStatus(["To Do", "Review", "Closed"])).toBe("Closed");
	});

	it("compares terminal statuses case-insensitively for URL and user input values", () => {
		expect(isTerminalStatus("closed", ["To Do", "Review", "Closed"])).toBe(true);
		expect(isTerminalStatus("CLOSED", ["To Do", "Review", "Closed"])).toBe(true);
		expect(isTerminalStatus("review", ["To Do", "Review", "Closed"])).toBe(false);
	});

	it("preserves internal spaces when comparing status names", () => {
		expect(isTerminalStatus("InProgress", ["To Do", "In Progress", "InProgress"])).toBe(true);
		expect(isTerminalStatus("In Progress", ["To Do", "In Progress", "InProgress"])).toBe(false);
	});

	// Regression: a multi-terminal set is a derived value. Re-deriving it collapsed ["Done",
	// "Dropped"] to the last column, so every Done card lost its actual-end stamp.
	it("matches an already-derived multi-terminal set without re-deriving it", () => {
		const terminals = ["Done", "Dropped"];
		expect(isTerminalStatusName("Done", terminals)).toBe(true);
		expect(isTerminalStatusName("Dropped", terminals)).toBe(true);
		expect(isTerminalStatusName("done", terminals)).toBe(true);
		expect(isTerminalStatusName("In Review", terminals)).toBe(false);
		expect(isTerminalStatusName("Done", [])).toBe(false);
		expect(isTerminalStatusName("Done", undefined)).toBe(false);
	});
});
