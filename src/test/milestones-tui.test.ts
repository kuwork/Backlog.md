import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Milestone, Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import {
	isValidMilestoneDate,
	type MilestoneFormValues,
	toMilestoneWriteOptions,
	validateMilestoneForm,
} from "../ui/components/milestone-form.ts";
import { renderMilestonesTui } from "../ui/milestones.ts";
import { createScreen } from "../ui/tui.ts";
import { filterTasksByMilestoneSearch } from "../utils/milestone-search.ts";
import { initializeTestProject, safeCleanup, waitUntil, withTimeout } from "./test-utils.ts";

type EmittingWidget = {
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
};
type TreeWidget = {
	type?: string;
	children?: TreeWidget[];
	items?: Array<{ content?: string }>;
	content?: string;
	label?: string;
	selected?: number;
	position?: { bottom?: number };
	style?: { border?: { fg?: string }; bg?: string };
};

const STATUSES = ["To Do", "In Progress", "Done"];

function makeTask(id: string, status: string, ordinal: number, milestone?: string): Task {
	return {
		id,
		title: `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
		ordinal,
		milestone,
	};
}

/**
 * Press a key the way a terminal delivers it. blessed turns a real keypress into the program's
 * `keypress` event, and the program's dispatcher re-emits `key <full>` on the screen and on the
 * focused widget. Emitting that same event reproduces the whole dispatch, which matters for the
 * popups: their keys are bound to the focused widget, not to the screen.
 */
function pressKey(widget: EmittingWidget, full: string, name = full.replace(/^S-/, "")): void {
	const key = { name, full, shift: full.startsWith("S-") };
	const program = (widget as unknown as { program?: EmittingWidget }).program ?? widget;
	program.emit("keypress", "", key);
}

/** Type a run of characters into whatever holds the focus, one keypress each. */
function typeText(widget: EmittingWidget, text: string): void {
	const program = (widget as unknown as { program?: EmittingWidget }).program ?? widget;
	for (const character of text) {
		program.emit("keypress", character, { name: character, full: character });
	}
}

/**
 * Whether an input is capturing keys. The search box and the prompts start reading input from a
 * focus handler; blessed only routes characters there once it does, so typing before that sends
 * them to the board's own shortcuts instead, where a stray `n` or `c` opens a popup.
 */
function isInputCapturing(screen: ScreenInterface): boolean {
	return Boolean((screen as unknown as { grabKeys?: boolean }).grabKeys);
}

/**
 * Type into the input that holds the keyboard. `readInput` reports the input as capturing keys a
 * tick before it attaches the listener that collects them, so a character sent in that gap is
 * dropped; each one is sent again until the input's value actually grows.
 */
async function typeIntoInput(screen: ScreenInterface & EmittingWidget, text: string): Promise<void> {
	const value = () => (screen as unknown as { focused?: { value?: string } }).focused?.value ?? "";
	const deadline = Date.now() + 2000;
	for (const character of text) {
		for (;;) {
			const before = value();
			typeText(screen, character);
			if (value() !== before) break;
			if (Date.now() > deadline) {
				throw new Error(`Could not type ${JSON.stringify(text)} into the input (it holds ${JSON.stringify(value())})`);
			}
			await Bun.sleep(25);
		}
	}
}

/** Every string the tree renders, so assertions do not depend on widget nesting. */
function allText(root: TreeWidget): string {
	const parts: string[] = [];
	const visit = (node: TreeWidget) => {
		if (typeof node.content === "string") parts.push(node.content);
		if (typeof node.label === "string") parts.push(node.label);
		for (const item of node.items ?? []) {
			if (typeof item.content === "string") parts.push(item.content);
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return parts.join("\n");
}

/** Item rows of every list on the screen, flattened in render order. */
function listRows(root: TreeWidget): string[] {
	const rows: string[] = [];
	const visit = (node: TreeWidget) => {
		if (node.type === "list") for (const item of node.items ?? []) rows.push(item.content ?? "");
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return rows;
}

/**
 * The sidebar list, identified by its unassigned row. The board's own lists hold task rows, so the
 * unassigned bucket is the one row that can only come from the milestone sidebar.
 */
function sidebarItems(root: TreeWidget): string[] {
	let found: string[] = [];
	const visit = (node: TreeWidget) => {
		if (node.type === "list") {
			const items = (node.items ?? []).map((item) => item.content ?? "");
			if (items.some((item) => item.includes("No milestone"))) found = items;
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

/** Index the sidebar list highlights. */
function sidebarCursor(root: TreeWidget): number | undefined {
	let found: number | undefined;
	const visit = (node: TreeWidget) => {
		if (node.type === "list" && typeof node.selected === "number") {
			const items = (node.items ?? []).map((item) => item.content ?? "");
			if (items.some((item) => item.includes("No milestone"))) found = node.selected;
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

function listCount(root: TreeWidget): number {
	let count = 0;
	const visit = (node: TreeWidget) => {
		if (node.type === "list") count += 1;
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return count;
}

/** The footer is the only box anchored to the bottom row of the screen. */
function footerText(root: TreeWidget): string {
	let found = "";
	const visit = (node: TreeWidget) => {
		if (node.type === "box" && node.position?.bottom === 0 && typeof node.content === "string") {
			found = node.content;
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

/**
 * Border colour of the frame around the columns, read from the frame itself. blessed renders a
 * label as a child box, so the frame is the parent of the node carrying the title text.
 */
function areaFrameBorder(root: TreeWidget): string | undefined {
	let found: string | undefined;
	const visit = (node: TreeWidget, parent?: TreeWidget) => {
		if (typeof node.content === "string" && node.content.includes("Tasks")) {
			found = node.style?.border?.fg ?? parent?.style?.border?.fg;
		}
		for (const child of node.children ?? []) visit(child, node);
	};
	visit(root);
	return found;
}

/** Border colour of the column box labelled `status`, e.g. "To Do (". */
function columnBorder(root: TreeWidget, status: string): string | undefined {
	let found: string | undefined;
	const visit = (node: TreeWidget, parent?: TreeWidget) => {
		const labelled =
			(typeof node.content === "string" && node.content.includes(status)) ||
			(typeof node.label === "string" && node.label.includes(status));
		if (labelled) {
			const box = node.style?.border ? node : parent;
			if (box?.style?.border) found = box.style.border.fg;
		}
		for (const child of node.children ?? []) visit(child, node);
	};
	visit(root);
	return found;
}

/** Whether the screen currently carries a popup backdrop. */
function hasBackdrop(root: TreeWidget): boolean {
	let found = false;
	const visit = (node: TreeWidget) => {
		if (node.style?.bg === "black") found = true;
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

let TEST_DIR: string;
let core: Core;
let alpha: Milestone;
let beta: Milestone;
let gamma: Milestone;

/**
 * Alpha holds work in two statuses, beta holds one open task, gamma holds only finished work
 * (so it is a completed milestone) and TASK-4 belongs to no milestone at all.
 */
beforeEach(async () => {
	TEST_DIR = await mkdtemp(join(tmpdir(), "milestones-tui-"));
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Milestones TUI");
	alpha = await core.filesystem.createMilestone("Alpha rollout");
	beta = await core.filesystem.createMilestone("Beta polish");
	gamma = await core.filesystem.createMilestone("Gamma shipped");
	await core.createTask(makeTask("TASK-1", "To Do", 1000, alpha.id), false);
	await core.createTask(makeTask("TASK-2", "In Progress", 2000, alpha.id), false);
	await core.createTask(makeTask("TASK-3", "To Do", 3000, beta.id), false);
	await core.createTask(makeTask("TASK-4", "Done", 4000), false);
	await core.createTask(makeTask("TASK-5", "Done", 5000, gamma.id), false);
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

async function withMilestonesTui(
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		text: () => string;
		rows: () => string[];
		sidebar: () => string[];
		footer: () => string;
		lists: () => number;
		/** How many times the screen has repainted, to catch a popup that never draws itself. */
		renders: () => number;
		/** Move the cursor onto the row containing `needle` and scope the board to it (Space). */
		selectRow: (needle: string) => void;
		quit: () => Promise<void>;
	}) => Promise<void> | void,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	let renders = 0;
	const renderScreen = screen.render.bind(screen);
	screen.render = () => {
		renders += 1;
		return renderScreen();
	};
	const tasks = await core.queryTasks({ includeCrossBranch: false });
	const milestones = await core.filesystem.listMilestones();
	let closed = false;
	let tui: Promise<void> | null = null;

	/** Quit through the sidebar's own key and wait for the screen to come down. */
	const quit = async () => {
		if (closed) return;
		closed = true;
		pressKey(screen, "q");
		if (tui) await withTimeout(tui, "milestones close", 2000);
	};

	try {
		tui = renderMilestonesTui({
			core,
			tasks,
			milestones,
			archivedMilestones: [],
			statuses: STATUSES,
			layout: "horizontal",
			maxColumnWidth: 20,
			screen,
		});
		await Bun.sleep(20);

		const sidebar = () => sidebarItems(screen as unknown as TreeWidget);
		const selectRow = (needle: string) => {
			const index = sidebar().findIndex((row) => row.includes(needle));
			expect(index).toBeGreaterThanOrEqual(0);
			// Walk the cursor onto the row, then scope the board to it: arrows only move.
			let cursor = sidebarCursor(screen as unknown as TreeWidget) ?? 0;
			const step = index > cursor ? "j" : "k";
			while (cursor !== index) {
				pressKey(screen, step);
				cursor += index > cursor ? 1 : -1;
			}
			pressKey(screen, "space");
		};

		await run({
			screen,
			text: () => allText(screen as unknown as TreeWidget),
			rows: () => listRows(screen as unknown as TreeWidget),
			sidebar,
			footer: () => footerText(screen as unknown as TreeWidget),
			lists: () => listCount(screen as unknown as TreeWidget),
			renders: () => renders,
			selectRow,
			quit,
		});
	} finally {
		// A failed assertion must never leave a mounted TUI behind: the next test builds its own
		// screen on the same shared blessed program, and a leaked one corrupts it.
		await quit().catch(() => {});
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

describe("milestones TUI", () => {
	it("lists every milestone beside a column per configured status", async () => {
		await withMilestonesTui(async ({ text, sidebar, footer, quit }) => {
			const rows = sidebar();
			// The unassigned bucket comes first, then every milestone in milestone-file order —
			// including the completed one, which is marked rather than dropped.
			expect(rows[0]).toContain("No milestone");
			expect(rows[1]).toContain("Alpha rollout");
			expect(rows[2]).toContain("Beta polish");
			expect(rows[3]).toContain("Gamma shipped");
			// The status marker mirrors the task list: open milestones carry a hollow circle,
			// completed ones a green check.
			expect(rows[1]).toContain("○");
			expect(rows[2]).toContain("○");
			expect(rows[3]).toContain("{green-fg}✔{/}");

			// The board is the real board: one column per configured status, inside the titled frame
			// the milestone view puts around the columns. The first row owns the keyboard, so the
			// counts are the unassigned bucket's. The summary's second number is the whole corpus,
			// so it is the one thing on screen that does not follow the scope or the filters.
			const rendered = text();
			expect(rendered).toContain("Tasks");
			expect(rendered).toContain("1/5 tasks");
			expect(rendered).toContain("To Do (0)");
			expect(rendered).toContain("In Progress (0)");
			expect(rendered).toContain("Done (1)");

			// Focus starts on the sidebar, so the footer carries the milestone hints.
			expect(footer()).toContain("[Space]");

			await quit();
		});
	});

	it("scopes the board to the highlighted milestone", async () => {
		await withMilestonesTui(async ({ text, sidebar, selectRow, quit }) => {
			// The first row is the unassigned bucket, so that is what the board opens on.
			expect(sidebar()[0]).toContain("No milestone");
			expect(text()).toContain("TASK-4");
			expect(text()).not.toContain("TASK-1");

			selectRow("Alpha rollout");
			await Bun.sleep(0);

			const scoped = text();
			expect(scoped).toContain("TASK-1");
			expect(scoped).toContain("TASK-2");
			expect(scoped).not.toContain("TASK-3");
			expect(scoped).not.toContain("TASK-4");
			expect(scoped).not.toContain("TASK-5");
			// The column set stays the board's own: all statuses remain, only the counts change.
			expect(scoped).toContain("To Do (1)");
			expect(scoped).toContain("In Progress (1)");
			// Two of the corpus's five tasks, and the total does not move with the scope.
			expect(scoped).toContain("2/5 tasks");
			// The frame names the milestone, so the columns stay identifiable from the filter bar.
			expect(scoped).toContain("Tasks · Alpha rollout");

			selectRow("Gamma shipped");
			await Bun.sleep(0);
			const gammaScoped = text();
			expect(gammaScoped).toContain("TASK-5");
			expect(gammaScoped).toContain("Tasks · Gamma shipped");

			await quit();
		});
	});

	it("counts the list by what the board's filters leave", async () => {
		await withMilestonesTui(async ({ screen, sidebar, text, selectRow, quit }) => {
			selectRow("Alpha rollout");
			await Bun.sleep(0);
			expect(sidebar()[1]).toContain("m-0 Alpha rollout · 2/2");
			expect(text()).toContain("2/5 tasks");

			// The board takes the keyboard, then the search box takes it from the board, and the
			// query is committed on the way back out. Each handoff is awaited by its own effect
			// rather than by a sleep, or a slow machine types into the board's shortcuts instead.
			pressKey(screen, "right");
			await waitUntil(
				() => footerText(screen as unknown as TreeWidget).includes("[Tab]"),
				"the board to take the keyboard",
				2000,
			);
			pressKey(screen, "/");
			await waitUntil(() => isInputCapturing(screen), "the search box to take the keyboard", 2000);
			await typeIntoInput(screen, "TASK-1");
			pressKey(screen, "down");
			await waitUntil(
				() => (sidebarItems(screen as unknown as TreeWidget)[1] ?? "").includes("1/2"),
				"the list to re-count for the query",
				2000,
			);

			// Only TASK-1 survives the search. Each row counts its own matches out of its own size:
			// the left number follows the query, the right one is the milestone's total and holds.
			const rows = sidebar();
			expect(rows[0]).toContain("No milestone · 0");
			expect(rows[1]).toContain("m-0 Alpha rollout · 1/2");
			expect(rows[2]).toContain("m-1 Beta polish · 0/1");
			// The first number follows the filters, the second is the corpus and holds still.
			expect(text()).toContain("1/5 tasks");

			await quit();
		});
	});

	it("counts every milestone, not only the one the board is scoped to", async () => {
		await withMilestonesTui(async ({ sidebar, quit }) => {
			// The board opens on the unassigned bucket, but each row's numbers are its own tasks:
			// counting what the columns show would leave every milestone reading 0/0. With nothing
			// filtered the left number is the whole milestone, and the right one is too.
			const rows = sidebar();
			expect(rows[0]).toContain("No milestone · 1");
			expect(rows[1]).toContain("m-0 Alpha rollout · 2/2");
			expect(rows[2]).toContain("m-1 Beta polish · 1/1");
			expect(rows[3]).toContain("m-2 Gamma shipped · 1/1");

			await quit();
		});
	});

	it("follows the header filters for milestones outside the board's scope", async () => {
		await withMilestonesTui(async ({ screen, sidebar, text, quit }) => {
			// Still scoped to the unassigned bucket, search for a task that belongs to Beta. The
			// columns have nothing to show, while Beta's own number follows the query.
			pressKey(screen, "right");
			await waitUntil(
				() => footerText(screen as unknown as TreeWidget).includes("[Tab]"),
				"the board to take the keyboard",
				2000,
			);
			pressKey(screen, "/");
			await waitUntil(() => isInputCapturing(screen), "the search box to take the keyboard", 2000);
			await typeIntoInput(screen, "TASK-3");
			pressKey(screen, "down");
			await waitUntil(() => allText(screen as unknown as TreeWidget).includes("0/5 tasks"), "the re-count", 2000);

			expect(text()).toContain("0/5 tasks");
			const rows = sidebar();
			expect(rows[0]).toContain("No milestone · 0");
			expect(rows[1]).toContain("m-0 Alpha rollout · 0/2");
			expect(rows[2]).toContain("m-1 Beta polish · 1/1");
			expect(rows[3]).toContain("m-2 Gamma shipped · 0/1");

			await quit();
		});
	});

	it("opens a completed milestone from the list like any other", async () => {
		await withMilestonesTui(async ({ screen, text, selectRow, quit }) => {
			selectRow("Gamma shipped");
			await Bun.sleep(0);
			pressKey(screen, "enter");
			await Bun.sleep(0);

			const withPopup = text();
			expect(withPopup).toContain("Progress:");
			expect(withPopup).toContain("Gamma shipped");

			pressKey(screen, "escape");
			await Bun.sleep(0);
			expect(text()).not.toContain("Progress:");

			await quit();
		});
	});

	it("moves focus to the board and back from the first column", async () => {
		await withMilestonesTui(async ({ screen, footer, quit }) => {
			const tree = () => screen as unknown as TreeWidget;
			// Focus starts on the sidebar, so the sidebar hints own the footer and nothing on the
			// right is lit — neither the frame nor the first column the board would otherwise mark.
			expect(footer()).toContain("[Space]");
			expect(areaFrameBorder(tree())).toBe("gray");
			expect(columnBorder(tree(), "To Do (")).toBe("gray");

			pressKey(screen, "right");
			await Bun.sleep(0);
			// The board's own footer takes over while the board holds the keyboard, and the highlight
			// follows the keyboard to the columns.
			expect(footer()).toContain("[Tab]");
			expect(areaFrameBorder(tree())).toBe("yellow");
			expect(columnBorder(tree(), "To Do (")).toBe("yellow");

			// Arrow keys now walk the board, not the sidebar, so the sidebar hints stay away.
			pressKey(screen, "j");
			await Bun.sleep(0);
			expect(footer()).toContain("[Tab]");
			expect(footer()).not.toContain("[Space]");

			// Left from the board's first column hands the keyboard back to the sidebar.
			pressKey(screen, "left");
			await Bun.sleep(0);
			expect(footer()).toContain("[Space]");
			expect(areaFrameBorder(tree())).toBe("gray");
			expect(columnBorder(tree(), "To Do (")).toBe("gray");

			await quit();
		});
	});

	it("opens a milestone detail popup that lists metadata but no tasks", async () => {
		await withMilestonesTui(async ({ screen, text, rows, lists, renders, selectRow, quit }) => {
			selectRow("Alpha rollout");
			await Bun.sleep(0);
			const rowsBefore = rows();
			const listsBefore = lists();
			const rendersBefore = renders();

			pressKey(screen, "enter");
			await Bun.sleep(0);

			const withPopup = text();
			expect(withPopup).toContain("Progress:");
			expect(withPopup).toContain("Alpha rollout");
			expect(withPopup).toContain("Details");
			// The popup is metadata only: it adds no list and no task row of its own.
			expect(lists()).toBe(listsBefore);
			expect(rows()).toEqual(rowsBefore);
			// It has to repaint itself on open — needing another keypress to appear is the bug —
			// and it dims the view behind it the way the task detail popup does.
			expect(renders()).toBeGreaterThan(rendersBefore);
			expect(hasBackdrop(screen as unknown as TreeWidget)).toBe(true);

			pressKey(screen, "escape");
			await Bun.sleep(0);
			expect(text()).not.toContain("Progress:");
			expect(hasBackdrop(screen as unknown as TreeWidget)).toBe(false);

			await quit();
		});
	});

	it("keeps the board's own task popup reachable from the board pane", async () => {
		await withMilestonesTui(async ({ screen, text, selectRow, quit }) => {
			selectRow("Alpha rollout");
			await Bun.sleep(0);

			pressKey(screen, "right");
			await Bun.sleep(0);
			pressKey(screen, "enter");
			await Bun.sleep(0);

			// The board's task popup carries the task, and the milestone-only Progress line is absent.
			const withPopup = text();
			expect(withPopup).toContain("TASK-1");
			expect(withPopup).toContain("Details");
			expect(withPopup).not.toContain("Progress:");

			pressKey(screen, "escape");
			await Bun.sleep(0);
			await quit();
		});
	});

	it("hands the terminal back on quit instead of leaving the shell hanging", async () => {
		await withMilestonesTui(async ({ screen, quit }) => {
			const program = (screen as unknown as { program: { destroyed?: boolean } }).program;
			expect(program.destroyed).not.toBe(true);

			await quit();

			// blessed restores stdin (leaves raw mode) only when its program is destroyed, and this
			// screen shares that program, so a quit that skips this release hangs the shell.
			expect(program.destroyed).toBe(true);
		});
	});

	it("keeps the scope while the cursor moves, and lets Space change it", async () => {
		await withMilestonesTui(async ({ screen, sidebar, footer, text, quit }) => {
			const cursor = () => sidebarCursor(screen as unknown as TreeWidget);
			// It opens scoped to the unassigned bucket with the cursor on it.
			expect(sidebar()[0]).toContain("▶ No milestone");
			expect(text()).toContain("Tasks · No milestone");

			// Walking down moves the cursor only: the marker, the board and the frame stay put.
			pressKey(screen, "j");
			await Bun.sleep(0);
			expect(cursor()).toBe(1);
			expect(sidebar()[1]).not.toContain("▶");
			expect(sidebar()[0]).toContain("▶ No milestone");
			expect(text()).toContain("Tasks · No milestone");

			// Space is what scopes the board.
			pressKey(screen, "space");
			await Bun.sleep(0);
			expect(sidebar()[0]).not.toContain("▶");
			expect(sidebar()[1]).toContain("▶ {default-fg}○{/} m-0 Alpha rollout");
			expect(text()).toContain("Tasks · Alpha rollout");

			// Up walks back to the top row, and one more leaves for the filter bar above the panes.
			pressKey(screen, "up");
			await Bun.sleep(0);
			expect(cursor()).toBe(0);
			pressKey(screen, "up");
			await Bun.sleep(0);
			// The bar holds the keyboard now, and the milestone it will filter is untouched.
			expect(footer()).toContain("Back to Board");
			expect(sidebar()[1]).toContain("▶ {default-fg}○{/} m-0 Alpha rollout");
			expect(text()).toContain("Tasks · Alpha rollout");

			// Down steps out of the bar back onto the board, which is where a quit is heard.
			pressKey(screen, "down");
			await Bun.sleep(0);
			await quit();
		});
	});

	it("opens the new-milestone form and leaves the list alone when cancelled", async () => {
		await withMilestonesTui(async ({ screen, text, quit }) => {
			pressKey(screen, "n");
			// Wait for the form to read input, or the Escape could reach the host and quit the view.
			await waitUntil(() => isInputCapturing(screen), "the form to read input", 2000);
			expect(text()).toContain("New Milestone");
			expect(text()).toContain("Next field");
			expect(text()).toContain("Create milestone");
			// The fields the popup displays are the fields the form asks for. The description is the
			// one multi-row field, so it carries its caption in its own border instead of a label box.
			for (const label of ["Title:", "Due:", "Planned from:", "Planned to:", "Actual from:", "Actual to:"]) {
				expect(text()).toContain(label);
			}
			expect(text()).toContain(" Description ");

			pressKey(screen, "escape");
			await waitUntil(() => !isInputCapturing(screen), "the form to release the keyboard", 2000);
			expect(text()).not.toContain("New Milestone");
			expect(await core.filesystem.listMilestones()).toHaveLength(3);

			await quit();
		});
	});

	it("creates the milestone typed into the form and selects it", async () => {
		await withMilestonesTui(async ({ screen, text, sidebar, quit }) => {
			pressKey(screen, "n");
			await waitUntil(() => isInputCapturing(screen), "the form to take the keyboard", 2000);
			await typeIntoInput(screen, "Delta hardening");
			pressKey(screen, "enter");
			await waitUntil(
				() => !allText(screen as unknown as TreeWidget).includes("New Milestone"),
				"the form to close",
				2000,
			);

			expect(text()).not.toContain("New Milestone");
			// Creating the milestone is asynchronous, so the row is what proves it landed.
			await waitUntil(
				() => sidebarItems(screen as unknown as TreeWidget).some((row) => row.includes("Delta hardening")),
				"the new milestone row",
				2000,
			);
			const created = (await core.filesystem.listMilestones()).find((entry) => entry.title === "Delta hardening");
			// A title on its own is enough; the description falls back to the milestone's own default.
			expect(created?.description).toBe("Milestone: Delta hardening");
			expect(sidebar().some((row) => row.includes("Delta hardening"))).toBe(true);

			await quit();
		});
	});

	it("writes the description and dates typed into the form", async () => {
		await withMilestonesTui(async ({ screen, quit }) => {
			pressKey(screen, "n");
			await waitUntil(() => isInputCapturing(screen), "the form to take the keyboard", 2000);
			await typeIntoInput(screen, "Delta hardening");
			// Tab walks the fields the way the help line says: title, description, then the dates.
			pressKey(screen, "tab");
			await typeIntoInput(screen, "Ships the beta");
			pressKey(screen, "tab");
			await typeIntoInput(screen, "2026-10-01");
			pressKey(screen, "tab");
			await typeIntoInput(screen, "2026-09-25");
			// Enter saves from the field the caret is on, so the remaining dates stay untouched.
			pressKey(screen, "enter");
			await waitUntil(
				() => !allText(screen as unknown as TreeWidget).includes("New Milestone"),
				"the form to close",
				2000,
			);

			// Creating the milestone is asynchronous, so its row appearing on the list is what
			// proves the write landed.
			await waitUntil(
				() => sidebarItems(screen as unknown as TreeWidget).some((row) => row.includes("Delta hardening")),
				"the new milestone row",
				2000,
			);
			const created = (await core.filesystem.listMilestones()).find((entry) => entry.title === "Delta hardening");
			expect(created?.description).toBe("Ships the beta");
			expect(created?.dueDate).toBe("2026-10-01");
			expect(created?.plannedStart).toBe("2026-09-25");
			// A field left empty stays empty rather than becoming a placeholder date.
			expect(created?.actualStart).toBeUndefined();
			expect(created?.actualEnd).toBeUndefined();

			await quit();
		});
	});

	it("edits a milestone's dates from its detail popup", async () => {
		await withMilestonesTui(async ({ screen, text, selectRow, quit }) => {
			selectRow("Alpha rollout");
			await Bun.sleep(0);
			pressKey(screen, "enter");
			await Bun.sleep(0);
			expect(text()).toContain("Progress:");

			// The popup advertises the editor and hands over to it.
			expect(text()).toContain("E Edit");
			pressKey(screen, "e");
			await waitUntil(() => isInputCapturing(screen), "the form to take the keyboard", 2000);
			expect(text()).toContain("Edit Milestone");
			// The form opens on what the milestone already says, so nothing is silently rewritten.
			expect(text()).toContain("Milestone: Alpha rollout");

			// The description keeps the caret first; one Tab reaches Due.
			pressKey(screen, "tab");
			await typeIntoInput(screen, "2026-12-31");
			pressKey(screen, "enter");
			await waitUntil(() => !isInputCapturing(screen), "the form to close", 2000);

			// The wrap-up hint is the visible proof the write finished, so nothing is read too early.
			await waitUntil(
				() => allText(screen as unknown as TreeWidget).includes("Updated milestone Alpha rollout"),
				"the update to land",
				2000,
			);
			const updated = (await core.filesystem.listMilestones()).find((entry) => entry.id === alpha.id);
			expect(updated?.dueDate).toBe("2026-12-31");
			expect(updated?.description).toBe("Milestone: Alpha rollout");
			// The list is still the list, and the view is still alive after the form came down.
			expect(text()).toContain("Alpha rollout");

			await quit();
		});
	});

	it("refuses a description-less create that has no title at all", async () => {
		await withMilestonesTui(async ({ screen, text, quit }) => {
			pressKey(screen, "n");
			await waitUntil(() => isInputCapturing(screen), "the form to take the keyboard", 2000);
			// Enter on an empty title reports the problem and keeps the form up for the fix.
			pressKey(screen, "enter");
			await Bun.sleep(0);
			expect(text()).toContain("Title cannot be empty.");
			expect(text()).toContain("New Milestone");

			pressKey(screen, "escape");
			await waitUntil(() => !isInputCapturing(screen), "the form to release the keyboard", 2000);
			expect(await core.filesystem.listMilestones()).toHaveLength(3);

			await quit();
		});
	});
});

describe("milestone form contract", () => {
	const values = (overrides: Partial<MilestoneFormValues> = {}): MilestoneFormValues => ({
		title: "Delta",
		description: "",
		dueDate: "",
		plannedStart: "",
		plannedEnd: "",
		actualStart: "",
		actualEnd: "",
		...overrides,
	});

	it("takes a plain date or a date with a time, and refuses anything else", () => {
		expect(isValidMilestoneDate("2026-10-01")).toBe(true);
		expect(isValidMilestoneDate("2026-10-01 09:30")).toBe(true);
		expect(isValidMilestoneDate("2026-10-01T09:30")).toBe(true);
		for (const bad of ["01/10/2026", "2026-10", "next week", "2026-10-01 9"]) {
			expect(isValidMilestoneDate(bad)).toBe(false);
		}
	});

	it("names the field it is complaining about, and only for a filled one", () => {
		expect(validateMilestoneForm(values({ dueDate: "soon" }), { mode: "edit" })).toBe(
			"Due must be YYYY-MM-DD (or YYYY-MM-DD HH:mm).",
		);
		expect(validateMilestoneForm(values({ actualEnd: "later" }), { mode: "edit" })).toBe(
			"Actual to must be YYYY-MM-DD (or YYYY-MM-DD HH:mm).",
		);
		// Empty is how a date is cleared, not a mistake.
		expect(validateMilestoneForm(values(), { mode: "edit" })).toBeNull();
	});

	it("requires a new title that is not already taken, and asks nothing of an edit", () => {
		expect(validateMilestoneForm(values({ title: "  " }), { mode: "create" })).toBe("Title cannot be empty.");
		expect(
			validateMilestoneForm(values({ title: "Alpha rollout" }), { mode: "create", existingTitles: ["Alpha rollout"] }),
		).toBe("A milestone with that title already exists.");
		expect(validateMilestoneForm(values({ title: "Alpha rollout" }), { mode: "edit" })).toBeNull();
	});

	it("trims every field so an emptied one clears rather than leaves whitespace", () => {
		expect(
			toMilestoneWriteOptions(
				values({ description: "  Ships the beta  ", dueDate: " 2026-10-01 ", actualStart: "   " }),
			),
		).toEqual({
			description: "Ships the beta",
			dueDate: "2026-10-01",
			plannedStart: "",
			plannedEnd: "",
			actualStart: "",
			actualEnd: "",
		});
	});
});

describe("milestones TUI search contract", () => {
	/**
	 * The header search matches like the web milestone page (exact id, then substring of id or
	 * title, then the shared fuzzy index) and stays applied when the milestone scope changes.
	 */
	async function withScopedBoard(
		run: (context: {
			screen: ScreenInterface & EmittingWidget;
			text: () => string;
			rows: () => string[];
			push: (tasks: Task[]) => void;
			quit: () => Promise<void>;
		}) => Promise<void> | void,
		searchQuery = "TASK-2",
	): Promise<void> {
		const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
		const alphaTasks = [makeTask("TASK-1", "To Do", 1000, "m-1"), makeTask("TASK-2", "In Progress", 2000, "m-1")];
		let pushScope: ((tasks: Task[], statuses: string[]) => void) | undefined;
		let closed = false;
		let board: Promise<void> | null = null;

		const quit = async () => {
			if (closed) return;
			closed = true;
			pressKey(screen, "q");
			if (board) await withTimeout(board, "board close", 2000);
		};

		try {
			board = renderBoardTui(alphaTasks, STATUSES, "horizontal", 20, {
				core,
				screen,
				filters: {
					searchQuery,
					priorityFilter: "",
					labelFilter: [],
					milestoneFilter: "",
				},
				embed: {
					searchMatch: (tasks, query) => filterTasksByMilestoneSearch(tasks, query),
					taskSummary: true,
				},
				subscribeUpdates: (update) => {
					pushScope = update;
				},
			});
			await Bun.sleep(20);

			await run({
				screen,
				text: () => allText(screen as unknown as TreeWidget),
				rows: () => listRows(screen as unknown as TreeWidget),
				push: (tasks) => pushScope?.(tasks, STATUSES),
				quit,
			});
		} finally {
			await quit().catch(() => {});
			screen.destroy();
			if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
			else Reflect.deleteProperty(process.stdout, "isTTY");
		}
	}

	it("matches an exact task id over the fuzzy index", async () => {
		await withScopedBoard(async ({ text, rows, quit }) => {
			const rendered = rows().join("\n");
			expect(rendered).toContain("TASK-2");
			expect(rendered).not.toContain("TASK-1");
			// The filter bar's summary counts what the search leaves of the scope.
			expect(text()).toContain("1/2 tasks");
			await quit();
		});
	});

	it("keeps the active query when the milestone scope changes", async () => {
		// The next milestone holds one task the latched query matches by title and one it does
		// not, so the assertion holds only while the query is still in force.
		const polish = { ...makeTask("TASK-3", "To Do", 3000, "m-2"), title: "Polish the release notes" };
		const installer = { ...makeTask("TASK-4", "Done", 4000, "m-2"), title: "Ship the installer" };
		await withScopedBoard(async ({ rows, push, quit }) => {
			push([polish, installer]);
			await Bun.sleep(20);

			const rendered = rows().join("\n");
			expect(rendered).toContain("TASK-3");
			expect(rendered).not.toContain("TASK-4");

			await quit();
		}, "polish");
	});
});
