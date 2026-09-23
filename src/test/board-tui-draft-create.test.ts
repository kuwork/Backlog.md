import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { getCreatedTaskBoardOutcome, renderBoardTui } from "../ui/board.ts";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";
import { openTaskComposer, type TaskComposerOptions } from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { createTaskFromBoard } from "../ui/unified-view.ts";
import { initializeTestProject, retry, safeCleanup, withTimeout } from "./test-utils.ts";

type EmittingWidget = {
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
};
type TreeWidget = {
	type?: string;
	children?: TreeWidget[];
	items?: Array<{ content?: string }>;
	content?: string;
	position?: { bottom?: number };
};

const STATUSES = ["To Do", "In Progress", "Done"];

function createTask(id: string, status: string, title: string): Task {
	return {
		id,
		title,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
		ordinal: 1000,
	};
}

/** Press a key the way blessed delivers it: keypress plus the `key <full>` event. */
function pressKey(widget: EmittingWidget, full: string, name = full.replace(/^S-/, "")): void {
	const key = { name, full, shift: full.startsWith("S-") };
	widget.emit("keypress", "", key);
	widget.emit(`key ${full}`, "", key);
}

function renderedRows(root: TreeWidget): string[] {
	const rows: string[] = [];
	const visit = (node: TreeWidget) => {
		if (node.type === "list") {
			for (const item of node.items ?? []) rows.push(item.content ?? "");
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return rows;
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

let TEST_DIR: string;
let core: Core;

beforeEach(async () => {
	// Outside the repository on purpose: a store refresh inside it walks up to this project's git
	// remote and makes the persistence assertions race that work.
	TEST_DIR = await mkdtemp(join(tmpdir(), "board-tui-draft-create-"));
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Board TUI Draft Create");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

/**
 * Run the board with a stand-in create window, so the test can read exactly which status choices
 * the board handed the composer and drive the real persist path from there.
 */
async function withDraftBoard(
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		rows: () => string[];
		footer: () => string;
		composerStatuses: () => string[] | undefined;
		composerEntity: () => string | undefined;
		quit: () => Promise<void>;
	}) => Promise<void> | void,
	options: { draftSession?: boolean; status?: string; drafts?: Task[] },
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	// Seeded into the first configured column, which is where the board's cursor starts - the same
	// shape the drifted drafts in this repository have.
	const drafts = options.drafts ?? [createTask("DRAFT-7", "To Do", "An existing draft")];
	let seenStatuses: string[] | undefined;
	let seenEntity: string | undefined;
	try {
		const boardPromise = renderBoardTui(drafts, STATUSES, "horizontal", 20, {
			screen,
			core,
			draftSession: options.draftSession,
			createTask: async (input: TaskCreateInput) => (await core.createTaskFromInput(input, false)).task,
			taskComposer: async (composerOptions: TaskComposerOptions) => {
				seenStatuses = composerOptions.statuses ? [...composerOptions.statuses] : undefined;
				seenEntity = composerOptions.entity;
				const status = options.status ?? composerOptions.statuses?.[0] ?? "To Do";
				return await composerOptions.persist({ title: "Created from the window", status });
			},
		});
		await Bun.sleep(20);
		if (drafts.length > 0) {
			// Wait until the board has rendered the session's rows before pressing any key, the way a
			// reader sees them first.
			await retry(
				() => {
					const rendered = renderedRows(screen as unknown as TreeWidget);
					if (!rendered.some((row) => row.includes(drafts[0]?.id ?? ""))) {
						throw new Error("board rows not ready: " + JSON.stringify(rendered));
					}
					return Promise.resolve(true);
				},
				40,
				250,
			);
		}
		let closed = false;
		const quit = async () => {
			if (closed) return;
			closed = true;
			pressKey(screen, "q");
			await withTimeout(boardPromise, "board close", 5000);
		};
		await run({
			screen,
			rows: () => renderedRows(screen as unknown as TreeWidget),
			footer: () => footerText(screen as unknown as TreeWidget),
			composerStatuses: () => seenStatuses,
			composerEntity: () => seenEntity,
			quit,
		});
		await quit();
	} finally {
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

const waitForFooter = async (footer: () => string, expected: string) => {
	await retry(
		() => {
			if (!footer().includes(expected)) throw new Error(`footer is ${JSON.stringify(footer())}`);
			return Promise.resolve(true);
		},
		40,
		250,
	);
};

describe("TUI board draft creation window", () => {
	it("opens the create window pinned to Draft in a drafts session", async () => {
		await withDraftBoard(
			async ({ screen, rows, footer, composerStatuses, composerEntity }) => {
				pressKey(screen, "n");

				await waitForFooter(footer, "Created DRAFT-1.");
				// One choice: the window is the task composer with the status this session owns, and it
				// is told what it creates so its own title and action name a draft.
				expect(composerStatuses()).toEqual(["Draft"]);
				expect(composerEntity()).toBe("draft");
				// The draft joins the session it was created in, so it is rendered beside the existing one.
				await retry(
					() => {
						const rendered = rows();
						if (!rendered.some((row) => row.includes("DRAFT-1"))) {
							throw new Error(`rendered rows: ${JSON.stringify(rendered)}`);
						}
						return Promise.resolve(true);
					},
					40,
					250,
				);
				expect(footer()).not.toContain("Drafts are not shown");
			},
			{ draftSession: true },
		);
	});

	it("keeps the configured statuses and reports a draft as not shown in a task session", async () => {
		await withDraftBoard(
			async ({ screen, rows, footer, composerStatuses, composerEntity }) => {
				pressKey(screen, "n");

				await waitForFooter(footer, "Drafts are not shown on the task board.");
				// A task session is not pinned to one choice: the window offers the session's own
				// statuses, so a draft is something the reader has to ask for there.
				expect(composerStatuses()).toEqual(STATUSES);
				expect(composerEntity()).toBe("task");
				expect(footer()).toContain("Created DRAFT-1");
				expect(rows().some((row) => row.includes("DRAFT-1"))).toBe(false);
			},
			{ status: "Draft" },
		);
	});

	it("opens the window with no row under the cursor in either session", async () => {
		// A task session makes a task out of nothing, and a drafts session is the same: neither reads
		// the row under the cursor, so an empty board can still create. What the window's status field
		// holds is what decides the column the record lands in.
		await withDraftBoard(
			async ({ screen, footer, composerStatuses, composerEntity }) => {
				pressKey(screen, "n");

				await waitForFooter(footer, "Created TASK-1.");
				expect(composerStatuses()).toEqual(STATUSES);
				expect(composerEntity()).toBe("task");
			},
			{ drafts: [] },
		);

		await withDraftBoard(
			async ({ screen, rows, footer, composerStatuses, composerEntity }) => {
				pressKey(screen, "n");

				// Pinned to the one status this session owns, which is the column the draft lands in.
				await waitForFooter(footer, "Created DRAFT-1.");
				expect(composerStatuses()).toEqual(["Draft"]);
				expect(composerEntity()).toBe("draft");
				await retry(
					() => {
						const rendered = rows();
						if (!rendered.some((row) => row.includes("DRAFT-1"))) {
							throw new Error(`rendered rows: ${JSON.stringify(rendered)}`);
						}
						return Promise.resolve(true);
					},
					40,
					250,
				);
				expect(footer()).not.toContain("Drafts are not shown");
			},
			{ draftSession: true, drafts: [] },
		);
	});
});

describe("created draft outcome", () => {
	it("reports a draft created in a drafts session as created, and in a task session as not shown", () => {
		const draft = createTask("DRAFT-1", "Draft", "Fresh draft");

		const taskSession = getCreatedTaskBoardOutcome(draft, false);
		expect(taskSession.message).toBe("Created DRAFT-1 as a draft. Drafts are not shown on the task board.");
		expect(taskSession.focusTaskId).toBeUndefined();

		const draftSession = getCreatedTaskBoardOutcome(draft, true, true);
		expect(draftSession.message).toBe("Created DRAFT-1.");
		expect(draftSession.tone).toBe("green");
		expect(draftSession.focusTaskId).toBe("DRAFT-1");
	});

	it("names the create action for the session in the help list", () => {
		const draftHelp = getHelpShortcuts("draft-board").map((shortcut) => shortcut.desc);
		const taskHelp = getHelpShortcuts("board").map((shortcut) => shortcut.desc);

		expect(draftHelp).toContain("Create draft");
		expect(draftHelp).not.toContain("Create task");
		expect(taskHelp).toContain("Create task");
		expect(taskHelp).not.toContain("Create draft");
	});

	it("publishes a created draft into the session only from a drafts session", async () => {
		const published: string[] = [];
		const publish = (task: Task) => {
			published.push(task.id);
		};

		await createTaskFromBoard(core, { title: "Session draft", status: "Draft" }, publish, true);
		expect(published).toEqual(["DRAFT-1"]);

		// A task session keeps its own data clean, but still publishes the records that belong to it.
		await createTaskFromBoard(core, { title: "Task session draft", status: "Draft" }, publish);
		expect(published).toEqual(["DRAFT-1"]);
		await createTaskFromBoard(core, { title: "Real task", status: "To Do" }, publish);
		expect(published).toEqual(["DRAFT-1", "TASK-1"]);
	});
});

type LabeledWidget = TreeWidget & { options?: { label?: string } };

function collectWidgets(node: { children?: unknown[] }, out: LabeledWidget[] = []): LabeledWidget[] {
	for (const child of node.children ?? []) {
		const widget = child as LabeledWidget;
		out.push(widget);
		if (widget.children) collectWidgets(widget, out);
	}
	return out;
}

/**
 * Opens the real composer so the case can read the strings the window shows, then closes it through
 * Escape so both the widget tree and the returned promise unwind.
 */
async function withRealComposer(
	entity: "task" | "draft" | undefined,
	run: (widgets: LabeledWidget[]) => void,
): Promise<void> {
	const screen = createScreen({ smartCSR: false });
	Object.defineProperty(screen, "width", { configurable: true, value: 80, writable: true });
	Object.defineProperty(screen, "height", { configurable: true, value: 24, writable: true });
	const resultPromise = openTaskComposer({
		screen,
		statuses: ["Draft"],
		entity,
		persist: async () => createTask("DRAFT-1", "Draft", "Stub"),
	});
	try {
		// The composer mounts its widgets asynchronously, so let both focus hops settle.
		await new Promise<void>((resolve) => setImmediate(resolve));
		await new Promise<void>((resolve) => setImmediate(resolve));
		run(collectWidgets(screen as unknown as { children?: unknown[] }));
	} finally {
		const focused = (screen as unknown as { focused?: EmittingWidget }).focused;
		pressKey(focused ?? (screen as unknown as EmittingWidget), "escape");
		await withTimeout(resultPromise, "composer close", 2000);
		screen.destroy();
	}
}

describe("create window wording", () => {
	it("names the title and the action for what the window creates", async () => {
		await withRealComposer("draft", (widgets) => {
			expect(widgets.some((widget) => widget.options?.label === " Create Draft ")).toBe(true);
			expect(widgets.some((widget) => widget.content === "Create draft")).toBe(true);
			expect(widgets.some((widget) => widget.content === "Create task")).toBe(false);
		});

		await withRealComposer(undefined, (widgets) => {
			expect(widgets.some((widget) => widget.options?.label === " Create Task ")).toBe(true);
			expect(widgets.some((widget) => widget.content === "Create task")).toBe(true);
			expect(widgets.some((widget) => widget.content === "Create draft")).toBe(false);
		});
	});
});
