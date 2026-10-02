import { afterEach, describe, expect, it } from "bun:test";
import { Command } from "commander";
import {
	addListWindowOptions,
	formatListWindowFooter,
	nextPageCommand,
	parseListWindow,
	parsePositiveIntegerOption,
	printListWindow,
	selectListWindow,
} from "../utils/list-window.ts";

/** A stand-in for a real list command, carrying the same paging options. */
function fakeCommand(requiredFlags: string[] = []): Command {
	const command = new Command("task list");
	addListWindowOptions(command);
	for (const flags of requiredFlags) {
		command.requiredOption(flags, "option whose next argument is its value");
	}
	return command;
}

/** A parsed window, bypassing option parsing. */
function windowOf(overrides: Partial<Parameters<typeof selectListWindow>[1]> = {}) {
	return {
		skip: 0,
		count: false,
		forcesText: false,
		commandArgs: [] as readonly string[],
		valueFlags: new Set<string>(),
		...overrides,
	};
}

const letters = ["a", "b", "c", "d", "e"];

describe("selectListWindow", () => {
	it("returns the whole list when no window option is given", () => {
		const page = selectListWindow(letters, windowOf());

		expect(page.items).toHaveLength(5);
		expect(page.total).toBe(5);
		expect(page.cut).toBe(false);
		expect(page.nextSkip).toBeNull();
	});

	it("cuts after the max-count and reports where the next window starts", () => {
		const page = selectListWindow(letters, windowOf({ skip: 0, maxCount: 2 }));

		expect(page.items).toEqual(["a", "b"]);
		expect(page.cut).toBe(true);
		expect(page.nextSkip).toBe(2);
	});

	it("treats a max-count that covers the list as complete", () => {
		const page = selectListWindow(letters, windowOf({ maxCount: 5 }));

		expect(page.items).toHaveLength(5);
		expect(page.cut).toBe(false);
		expect(page.nextSkip).toBeNull();
	});

	it("windows the middle of the list when skip and max-count are combined", () => {
		const page = selectListWindow(letters, windowOf({ skip: 2, maxCount: 2 }));

		expect(page.items).toEqual(["c", "d"]);
		expect(page.skip).toBe(2);
		expect(page.nextSkip).toBe(4);
	});

	it("keeps skipping past the end without inventing further windows", () => {
		const page = selectListWindow(letters, windowOf({ skip: 9 }));

		expect(page.items).toEqual([]);
		expect(page.total).toBe(5);
		expect(page.cut).toBe(true);
		expect(page.nextSkip).toBeNull();
	});

	it("joins consecutive windows into the complete output", () => {
		const collected: string[] = [];
		let skip = 0;
		for (;;) {
			const page = selectListWindow(letters, windowOf({ skip, maxCount: 2 }));
			collected.push(...page.items);
			if (page.nextSkip === null) break;
			skip = page.nextSkip;
		}

		expect(collected).toEqual(letters);
	});
});

describe("formatListWindowFooter", () => {
	it("prints nothing for a list the window did not cut", () => {
		expect(formatListWindowFooter(selectListWindow(letters, windowOf()), windowOf())).toBeNull();
		expect(formatListWindowFooter(selectListWindow(letters, windowOf({ maxCount: 5 })), windowOf())).toBeNull();
	});

	it("names the shown range, the total and the command for the next items", () => {
		const page = selectListWindow(letters, windowOf({ maxCount: 2 }));
		const window = windowOf({ commandArgs: ["task", "list", "--max-count", "2"] });

		expect(formatListWindowFooter(page, window)).toBe(
			"Showing 1-2 of 5 items. Next: backlog task list --max-count 2 --skip 2",
		);
	});

	it("drops the Next part on the last window", () => {
		const page = selectListWindow(letters, windowOf({ skip: 4, maxCount: 2 }));
		const window = windowOf({ commandArgs: ["task", "list", "--max-count", "2", "--skip", "4"] });

		expect(formatListWindowFooter(page, window)).toBe("Showing 5-5 of 5 items.");
	});

	it("prints a zero range for a skip past the end", () => {
		const page = selectListWindow(letters, windowOf({ skip: 7 }));

		expect(formatListWindowFooter(page, windowOf())).toBe("Showing 0 of 5 items.");
	});
});

describe("nextPageCommand", () => {
	it("appends the skip when the command had none", () => {
		const window = windowOf({ commandArgs: ["search", "auth", "--plain"] });

		expect(nextPageCommand(window, 3)).toBe("backlog search auth --plain --skip 3");
	});

	it("replaces a skip already typed in the equals form", () => {
		const window = windowOf({ commandArgs: ["memo", "list", "--skip=5"] });

		expect(nextPageCommand(window, 10)).toBe("backlog memo list --skip 10");
	});

	it("replaces a skip already typed as a separate value", () => {
		const window = windowOf({ commandArgs: ["memo", "list", "--skip", "5"] });

		expect(nextPageCommand(window, 10)).toBe("backlog memo list --skip 10");
	});

	it("leaves an argument that needs no quoting unquoted", () => {
		const window = windowOf({ commandArgs: ["search", "--type", "task:done"] });

		expect(nextPageCommand(window, 2)).toBe("backlog search --type task:done --skip 2");
	});

	it("keeps the value of a required option that happens to read like a flag", () => {
		const window = parseListWindow({ skip: "2" }, fakeCommand(["--search <query>"]), [
			"task",
			"list",
			"--search",
			"--plain",
			"--skip",
			"2",
		]);
		expect(window).not.toBeNull();

		expect(nextPageCommand(window!, 8)).toBe("backlog task list --search --plain --skip 8");
	});

	it("puts the new skip before a separator that ends the options", () => {
		const window = windowOf({ commandArgs: ["search", "--plain", "--", "--skip"] });

		expect(nextPageCommand(window, 4)).toBe("backlog search --plain --skip 4 -- --skip");
	});
});

describe("parseListWindow", () => {
	afterEach(() => {
		process.exitCode = 0;
	});

	it("rejects --count combined with --json", () => {
		expect(parseListWindow({ count: true, json: true }, fakeCommand(), [])).toBeNull();
		expect(process.exitCode).toBe(1);
	});

	it("rejects a --max-count that is not a positive integer", () => {
		for (const value of ["0", "-1", "2.5", "many"]) {
			expect(parseListWindow({ maxCount: value }, fakeCommand(), [])).toBeNull();
		}
		expect(process.exitCode).toBe(1);
	});

	it("rejects a negative --skip", () => {
		expect(parseListWindow({ skip: "-1" }, fakeCommand(), [])).toBeNull();
		expect(process.exitCode).toBe(1);
	});

	it("accepts a --skip of 0 and reports a window only when one was given", () => {
		const plain = parseListWindow({}, fakeCommand(), []);
		expect(plain?.forcesText).toBe(false);
		expect(plain?.skip).toBe(0);

		const startingAtZero = parseListWindow({ skip: "0" }, fakeCommand(), []);
		expect(startingAtZero?.forcesText).toBe(true);
		expect(startingAtZero?.skip).toBe(0);
	});

	it("reports the typed arguments so the footer can rebuild the command", () => {
		const args = ["task", "list", "--status", "To Do", "--max-count", "3"];
		const window = parseListWindow({ maxCount: "3" }, fakeCommand(), args);

		expect(window?.commandArgs).toEqual(args);
		expect(nextPageCommand(window!, 3)).toBe("backlog task list --status 'To Do' --max-count 3 --skip 3");
	});
});

describe("parsePositiveIntegerOption", () => {
	afterEach(() => {
		process.exitCode = 0;
	});

	it("reads a positive integer and tolerates surrounding spaces", () => {
		expect(parsePositiveIntegerOption("7", "--limit")).toBe(7);
		expect(parsePositiveIntegerOption(" 7 ", "--limit")).toBe(7);
	});

	it("reports why a value is not a positive integer", () => {
		for (const value of ["0", "-3", "1.5", "abc"]) {
			expect(parsePositiveIntegerOption(value, "--limit")).toBeNull();
		}
		expect(process.exitCode).toBe(1);
	});
});

describe("formatListWindowFooter", () => {
	it("names the shown range, the total and the command for the following items", () => {
		const window = windowOf({ maxCount: 2, commandArgs: ["task", "list"], valueFlags: new Set() });

		expect(formatListWindowFooter(selectListWindow(letters, window), window)).toBe(
			"Showing 1-2 of 5 items. Next: backlog task list --skip 2",
		);
	});

	it("prints no next command once the window reaches the end", () => {
		const window = windowOf({ maxCount: 5 });

		expect(formatListWindowFooter(selectListWindow(letters, window), window)).toBeNull();
	});

	it("prints nothing for a silent window, which is what --limit builds", () => {
		const window = windowOf({ maxCount: 2, silent: true });
		expect(window.silent).toBe(true);

		// The window still cuts, so a caller can filter what the listed items hold.
		expect(selectListWindow(letters, window).cut).toBe(true);
		expect(formatListWindowFooter(selectListWindow(letters, window), window)).toBeNull();
	});

	it("prints nothing when the window leaves no item out", () => {
		const window = windowOf({ maxCount: 5 });

		expect(formatListWindowFooter(selectListWindow(letters, window), window)).toBeNull();
	});
});

describe("printListWindow", () => {
	it("prints only the number for --count, as an uncolored string", () => {
		const logs: unknown[] = [];
		const original = console.log;
		console.log = (...args: unknown[]) => logs.push(args[0]);
		try {
			printListWindow(letters, windowOf({ count: true }), () => {
				throw new Error("--count must not print items");
			});
		} finally {
			console.log = original;
		}

		expect(logs).toEqual(["5"]);
	});

	it("prints the items and the footer of a cut window", () => {
		const logs: unknown[] = [];
		const original = console.log;
		console.log = (...args: unknown[]) => logs.push(args[0]);
		try {
			printListWindow(letters, windowOf({ maxCount: 2, commandArgs: ["task", "list", "--max-count", "2"] }), (items) =>
				logs.push(items),
			);
		} finally {
			console.log = original;
		}

		expect(logs).toEqual([["a", "b"], "Showing 1-2 of 5 items. Next: backlog task list --max-count 2 --skip 2"]);
	});

	it("still asks the printer about an empty list so the command can say nothing matched", () => {
		let printed = false;
		printListWindow([], windowOf(), () => {
			printed = true;
		});

		expect(printed).toBe(true);
	});
});
