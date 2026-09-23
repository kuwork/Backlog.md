import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { initializeTestProject, safeCleanup } from "./test-utils.ts";

/**
 * The board's task popup renders its content once, from the record it was opened with, so these
 * cases pin the three ways it has to follow the record afterwards: a rebuild when the content
 * changed, a close with a notice when the record left the board, and nothing at all when the
 * watcher echoes content that did not change.
 */

const STATUSES = ["To Do", "In Progress", "Done"];

type EmittingWidget = {
	type?: string;
	content?: string;
	children?: Widget[];
	items?: Array<{ content?: string }>;
	position?: { bottom?: number };
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
	destroy?: () => void;
};
type Widget = EmittingWidget;

function makeTask(id: string, status: string, ordinal: number, description: string, title?: string): Task {
	return {
		id,
		title: title ?? `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description,
		ordinal,
	};
}

/** Press a key through the path blessed uses on a real keypress: keypress plus `key <full>`. */
function pressKey(widget: EmittingWidget, full: string, name = full): void {
	const key = { name, full, shift: full.startsWith("S-") };
	widget.emit("keypress", "", key);
	widget.emit(`key ${full}`, "", key);
}

/** Every string a widget subtree carries — the popup body lives in one of these. */
function screenText(root: Widget): string {
	const chunks: string[] = [];
	const visit = (node: Widget) => {
		if (typeof node.content === "string") chunks.push(node.content);
		for (const item of node.items ?? []) if (typeof item.content === "string") chunks.push(item.content);
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return chunks.join("\n");
}

/** The footer is the only box anchored to the bottom row of the screen. */
function footerText(root: Widget): string {
	let found = "";
	const visit = (node: Widget) => {
		if (node.type === "box" && node.position?.bottom === 0 && typeof node.content === "string") found = node.content;
		for (const child of node.children ?? []) visit(child);
	};
	visit(root);
	return found;
}

async function waitFor(predicate: () => boolean, label: string, attempts = 60): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(25);
	}
	throw new Error(`Timed out waiting for ${label}`);
}

/** A core stand-in: the board only reaches for the methods a pressed key needs. */
function stubCore(overrides: Record<string, unknown> = {}): Core {
	return {
		editTaskInTui: async () => ({ task: undefined, changed: false, entity: "task" }),
		...overrides,
	} as unknown as Core;
}

let cleanup: (() => Promise<void> | void) | null = null;

afterEach(async () => {
	await cleanup?.();
	cleanup = null;
});

async function withBoard(
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		text: () => string;
		footer: () => string;
		focused: () => EmittingWidget | undefined;
		update: (nextTasks: Task[]) => void;
	}) => Promise<void>,
	options: {
		tasks: Task[];
		core?: Core;
		/** Start the real watcher for the given session: tasks, or drafts for a drafts session. */
		watch?: "tasks" | "drafts";
		draftSession?: boolean;
		statuses?: string[];
	},
): Promise<void> {
	const statuses = options.statuses ?? STATUSES;
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	let pushUpdate: ((nextTasks: Task[], nextStatuses: string[]) => void) | undefined;
	let watcher: { stop: () => void } | null = null;
	let closed = false;

	const boardPromise = renderBoardTui(options.tasks, statuses, "horizontal", 20, {
		screen,
		core: options.core ?? stubCore(),
		draftSession: options.draftSession,
		subscribeUpdates: (updateFn) => {
			pushUpdate = updateFn;
			if (!options.watch || !options.core) return;
			// The unified view wires the board straight to the task watcher; the same wiring here
			// lets a case change the task on disk and watch the popup follow it.
			const replace = (task: Task) => options.tasks.map((current) => (current.id === task.id ? task : current));
			watcher = watchTasks(
				options.core,
				{
					onTaskChanged: (task) => updateFn(replace(task), statuses),
					onTaskRemoved: (taskId) =>
						updateFn(
							options.tasks.filter((task) => task.id !== taskId),
							statuses,
						),
				},
				options.tasks,
				{ drafts: options.watch === "drafts" },
			);
		},
	});

	const quit = async () => {
		if (closed) return;
		closed = true;
		try {
			const focused = (screen as unknown as { focused?: EmittingWidget }).focused;
			if (focused) pressKey(focused, "escape");
			await Bun.sleep(30);
			pressKey(screen, "q");
		} catch {
			// The screen may already be torn down by the case itself.
		}
		watcher?.stop();
		await Promise.race([boardPromise.then(() => undefined).catch(() => undefined), Bun.sleep(400)]);
		screen.destroy?.();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
	};
	cleanup = quit;

	await waitFor(() => typeof pushUpdate === "function", "the board to subscribe for updates");
	await run({
		screen,
		text: () => screenText(screen as unknown as Widget),
		footer: () => footerText(screen as unknown as Widget),
		focused: () => (screen as unknown as { focused?: EmittingWidget }).focused,
		update: (nextTasks: Task[]) => pushUpdate?.(nextTasks, statuses),
	});
	await quit();
}

/**
 * Open the popup on the first row and wait until its own content area owns the keyboard. Waiting on
 * "something is focused" is not enough: the column list is focused from mount and only yields to
 * the popup a tick later, which is why the key presses have to target the area carrying the text.
 */
async function openPopupOnFirstRow(screen: ScreenInterface & EmittingWidget, marker: string): Promise<EmittingWidget> {
	pressKey(screen, "enter");
	const focused = () => (screen as unknown as { focused?: EmittingWidget }).focused;
	await waitFor(() => {
		const current = focused();
		return Boolean(current && typeof current.content === "string" && current.content.includes(marker));
	}, "the popup content area to take focus");
	return focused() as EmittingWidget;
}

describe("board popup sync", () => {
	it("rebuilds the popup when the task behind it changes", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const second = makeTask("TASK-2", "To Do", 2000, "MARKER-OTHER");

		await withBoard(
			async ({ screen, text, update }) => {
				await openPopupOnFirstRow(screen, "MARKER-OPENED");

				update([{ ...first, description: "MARKER-EDITED", title: "Edited title" }, second]);
				await waitFor(() => text().includes("MARKER-EDITED"), "the popup to show the new content");

				expect(text()).not.toContain("MARKER-OPENED");
				expect(text()).not.toContain("Title for TASK-1");
				expect(text()).toContain("Edited title");
			},
			{ tasks: [first, second] },
		);
	});

	it("closes the popup with a notice when the task leaves the board", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const second = makeTask("TASK-2", "To Do", 2000, "MARKER-OTHER");

		await withBoard(
			async ({ screen, text, footer, focused, update }) => {
				await openPopupOnFirstRow(screen, "MARKER-OPENED");

				update([second]);
				await waitFor(() => footer().includes("is no longer on the board"), "the popup to close with a notice");

				expect(footer()).toContain("Task TASK-1 is no longer on the board.");
				expect(text()).not.toContain("MARKER-OPENED");
				// The lane that held the record may be gone too: focus has to land somewhere usable.
				await waitFor(() => focused()?.type === "list", "the board to take the keyboard back");
			},
			{ tasks: [first, second] },
		);
	});

	it("rebuilds the popup after an in-popup edit", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const edited = makeTask("TASK-1", "To Do", 1000, "MARKER-EDITED", "Edited title");
		const core = stubCore({ editTaskInTui: async () => ({ task: edited, changed: true, entity: "task" }) });

		await withBoard(
			async ({ screen, text }) => {
				const popupContent = await openPopupOnFirstRow(screen, "MARKER-OPENED");

				pressKey(popupContent, "e");
				await waitFor(() => text().includes("MARKER-EDITED"), "the popup to show the edited content");

				expect(text()).not.toContain("MARKER-OPENED");
			},
			{ tasks: [first], core },
		);
	});

	it("keeps the open popup when the watcher echoes unchanged content", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const second = makeTask("TASK-2", "To Do", 2000, "MARKER-OTHER");

		await withBoard(
			async ({ screen, text, focused, update }) => {
				const popupBefore = await openPopupOnFirstRow(screen, "MARKER-OPENED");

				// The watcher republishes the same content after an in-popup edit: rebuilding here is
				// what makes the popup flicker, so the signature has to make this a no-op.
				update([{ ...first }, { ...second }]);
				await Bun.sleep(150);

				expect(text()).toContain("MARKER-OPENED");
				expect(focused()).toBe(popupBefore);
			},
			{ tasks: [first, second] },
		);
	});

	it("defers the popup rebuild while a confirmation dialog is open", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const second = makeTask("TASK-2", "To Do", 2000, "MARKER-OTHER");
		const core = stubCore({
			fs: { loadConfig: async () => ({ autoCommit: false }) },
			completeTask: async () => true,
		});

		await withBoard(
			async ({ screen, text, focused, update }) => {
				const popupContent = await openPopupOnFirstRow(screen, "MARKER-OPENED");

				pressKey(popupContent, "c");
				await waitFor(() => focused() !== popupContent, "the confirmation dialog to take focus");
				const dialog = focused();

				// The board keeps feeding updates while the dialog is up; rebuilding the popup here
				// would pull the focus the dialog needs, so the refresh has to wait.
				update([{ ...first, description: "MARKER-EDITED" }, second]);
				await Bun.sleep(150);
				expect(focused()).toBe(dialog);
				expect(text()).toContain("MARKER-OPENED");

				pressKey(dialog ?? screen, "escape");
				await waitFor(() => text().includes("MARKER-EDITED"), "the deferred refresh to land");
				expect(text()).not.toContain("MARKER-OPENED");
			},
			{ tasks: [first, second], core },
		);
	});
	it("refreshes the popup from a change made outside the process", async () => {
		const first = makeTask("TASK-1", "To Do", 1000, "MARKER-OPENED");
		const second = makeTask("TASK-2", "To Do", 2000, "MARKER-OTHER");
		const dir = await mkdtemp(join(tmpdir(), "board-popup-watch-"));
		const core = new Core(dir);
		await initializeTestProject(core, "Board Popup Watch");
		await core.createTask(first, false);
		await core.createTask(second, false);

		try {
			await withBoard(
				async ({ screen, text }) => {
					await openPopupOnFirstRow(screen, "MARKER-OPENED");

					// What the web UI does from its own process: rewrite the task file on disk and let
					// the watcher publish it. This is the report the fix exists for.
					const tasksDir = join(dir, "backlog", "tasks");
					const file = (await readdir(tasksDir)).find((name) => name.startsWith("task-1 "));
					expect(file).toBeDefined();
					const path = join(tasksDir, file as string);
					const before = await readFile(path, "utf8");
					await writeFile(path, before.replace("MARKER-OPENED", "MARKER-EDITED"), "utf8");

					await waitFor(() => text().includes("MARKER-EDITED"), "the watcher to refresh the popup", 200);
					expect(text()).not.toContain("MARKER-OPENED");
				},
				{ tasks: [first, second], core, watch: "tasks" },
			);
		} finally {
			await safeCleanup(dir);
		}
	});
	it("follows a draft rewritten outside the session and closes the popup when it is promoted", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-popup-drafts-"));
		const core = new Core(dir);
		await initializeTestProject(core, "Board Popup Drafts");
		await mkdir(core.filesystem.draftsDir, { recursive: true });
		const draftPath = join(core.filesystem.draftsDir, "draft-1 - Draft-one.md");
		const draftSource = (marker: string) =>
			`---\nid: draft-1\ntitle: Draft one\nstatus: Draft\ncreated_date: '2026-09-23 11:00'\n---\n\n## Description\n\n${marker}\n`;
		await writeFile(draftPath, draftSource("MARKER-OPENED"), "utf8");
		const seeded = await core.filesystem.loadDraft("draft-1");
		if (!seeded) throw new Error("Expected the seeded draft");

		try {
			await withBoard(
				async ({ screen, text, footer }) => {
					await openPopupOnFirstRow(screen, "MARKER-OPENED");

					// Another process (CLI, web UI, editor) rewrites the draft on disk.
					await writeFile(draftPath, draftSource("MARKER-EDITED"), "utf8");
					await waitFor(() => text().includes("MARKER-EDITED"), "the drafts watcher to refresh the popup", 200);
					expect(text()).not.toContain("MARKER-OPENED");

					// A promotion moves the file out of the drafts folder: the popup has to go with it.
					await core.promoteDraft("draft-1", false);
					await waitFor(() => footer().includes("is no longer on the board"), "the popup to close on promote", 200);
					expect(footer()).toContain("Draft DRAFT-1 is no longer on the board.");
					expect(text()).not.toContain("MARKER-EDITED");
				},
				{ tasks: [seeded], statuses: ["Draft"], draftSession: true, core, watch: "drafts" },
			);
		} finally {
			await safeCleanup(dir);
		}
	});
});
