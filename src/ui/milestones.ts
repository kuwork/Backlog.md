/**
 * Interactive milestone browser.
 *
 * Left: the milestone list. Right: the real kanban board for the selected milestone.
 * The board is `renderBoardTui` running in embed mode, so every board control — move mode,
 * edit, complete/archive, search/priority/label filters, empty-column handling and the
 * number of status columns — behaves exactly as it does in `backlog task list`. The only
 * difference is that the selected milestone decides which tasks the columns show.
 *
 * The filter bar belongs to the board and spans the full width above both panes; the board's
 * milestone filter is dropped because the sidebar is the milestone picker. Those filters are
 * global here: they narrow the columns, the bar's own summary and every count in the list.
 */

import { stdout as output } from "node:process";
import type { BoxInterface, ListInterface, ScreenInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, line, list, scrollabletext } from "neo-neo-bblessed";
import type { BoardLayout } from "../board.ts";
import type { Core } from "../core/backlog.ts";
import { buildMilestoneBuckets, collectArchivedMilestoneKeys, milestoneKey } from "../core/milestones.ts";
import { formatDateForDisplay } from "../formatters/task-plain-text.ts";
import type { Milestone, MilestoneBucket, Task } from "../types/index.ts";
import { collectAvailableLabels } from "../utils/label-filter.ts";
import { matchMilestoneSearchTaskIds } from "../utils/milestone-search.ts";
import { type BoardFilterState, type BoardHandle, filterBoardTasks, renderBoardTui } from "./board.ts";
import { resolveDimension, resolvePosition } from "./components/filter-popup.ts";
import { openHelpPopup } from "./components/help-popup.ts";
import { type MilestoneFormValues, openMilestoneForm, toMilestoneWriteOptions } from "./components/milestone-form.ts";
import { formatHeading } from "./heading.ts";
import { getStatusStyle, wrapStatusColor } from "./status-icon.ts";
import { createScreen, formatTuiTitle, releaseSharedProgram } from "./tui.ts";

export type MilestonesTuiOptions = {
	core: Core;
	tasks: Task[];
	milestones: Milestone[];
	archivedMilestones: Milestone[];
	statuses: string[];
	layout: BoardLayout;
	maxColumnWidth: number;
	projectName?: string;
	hideEmptyColumns?: boolean;
	/** Injected in tests; the CLI lets the board create its own screen. */
	screen?: ScreenInterface;
};

/**
 * Sidebar rows: every milestone plus the unassigned bucket. Only real milestones open a
 * detail popup.
 */
type SidebarRow = {
	kind: "milestone" | "no-milestone";
	key: string;
	label: string;
	bucket?: MilestoneBucket;
	milestone?: Milestone;
};

/** Sidebar share of the terminal width; the board insets its columns by the rest. */
const SIDEBAR_WIDTH = "30%";

const SIDEBAR_FOOTER_CONTENT =
	" {cyan-fg}[↑↓/jk]{/} Move | {cyan-fg}[Space]{/} Select | {cyan-fg}[Enter]{/} Details | {cyan-fg}[↑]{/} Filters | {cyan-fg}[→/l]{/} Board | {cyan-fg}[N]{/} New | {cyan-fg}[?]{/} Help | {cyan-fg}[q]{/} Quit";

type MutableList = ListInterface & { selected?: number; setItem?: (index: number, content: string) => void };

function clampSelection(index: number, total: number): number {
	return Math.max(0, Math.min(index, Math.max(0, total - 1)));
}

/**
 * Compact sidebar label: status marker, identifier, title, and two numbers from two different
 * sources — the tasks the header filters leave, out of the milestone's own size. Only the left
 * number moves with a filter; the right one is the milestone's total and stays put. Everything that
 * describes the milestone itself (its title, its status marker) comes from the full bucket.
 *
 * The marker mirrors the task list: a hollow circle while the milestone has open work, a green
 * check once it is done.
 */
function formatRowLabel(bucket: MilestoneBucket, shown: MilestoneBucket): string {
	const id = bucket.milestone ?? "No milestone";
	const style = getStatusStyle(bucket.isCompleted ? "Done" : "To Do");
	const marker = `${wrapStatusColor(style.icon, style.color)} `;
	return `${marker}${id} ${bucket.label} · ${shown.total}/${bucket.total}`;
}

/**
 * Read-only milestone detail popup: milestone metadata only. The milestone's tasks are
 * deliberately absent — the board beside the list already shows them.
 *
 * Everything it shows comes from the milestone's own markdown file: the frontmatter dates
 * (`due_date`, `planned_start`/`planned_end`, `actual_start`/`actual_end`) and the body of its
 * `## Description` section. `E` hands the description and the dates back to the form that wrote
 * them, which is why the popup resolves with the reason it went away.
 */
export type MilestonePopupOutcome = "close" | "edit";

export async function createMilestonePopup(
	screen: ScreenInterface,
	milestone: Milestone,
	bucket: MilestoneBucket | undefined,
): Promise<{ close: () => void; closed: Promise<MilestonePopupOutcome> } | null> {
	if (output.isTTY === false) return null;

	const popup = box({
		parent: screen,
		top: "center",
		left: "center",
		width: "80%",
		height: "70%",
		border: "line",
		style: { border: { fg: "yellow" } },
		keys: true,
		tags: true,
		autoPadding: true,
	});

	// The backdrop dims the view behind the popup, exactly as the task detail popup does.
	const background = box({
		parent: screen,
		top: 0,
		left: 0,
		width: 1,
		height: 1,
		style: { bg: "black" },
	});

	// The popup centers itself with top/left "center", which the renderer re-resolves at draw time,
	// but the backdrop is placed with absolute coordinates, so both are recomputed from the live
	// terminal size on open and on every resize. The render here is also what makes the popup
	// appear: nothing else repaints the screen after Enter opens it.
	const applyLayout = () => {
		const screenWidth = typeof screen.width === "number" ? screen.width : 120;
		const screenHeight = typeof screen.height === "number" ? screen.height : 40;
		const popupWidth = resolveDimension("80%", screenWidth);
		const popupHeight = resolveDimension("70%", screenHeight);
		const popupTop = resolvePosition("center", screenHeight, popupHeight);
		const popupLeft = resolvePosition("center", screenWidth, popupWidth);
		background.top = Math.max(0, popupTop - 1);
		background.left = Math.max(0, popupLeft - 2);
		background.width = Math.min(screenWidth, popupWidth + 4);
		background.height = Math.min(screenHeight, popupHeight + 2);
		popup.setFront?.();
		screen.render();
	};

	let settled = false;
	const onResize = () => {
		if (!settled) applyLayout();
	};
	applyLayout();
	screen.on("resize", onResize);

	const headerLines = [
		` {bold}{blue-fg}${milestone.id}{/blue-fg}{/bold} - ${milestone.title}`,
		`{bold}Progress:{/bold} ${bucket ? `${bucket.doneCount}/${bucket.total} done (${bucket.progress}%)` : "no tasks"}`,
	];
	box({
		parent: popup,
		top: 0,
		left: 1,
		right: 1,
		height: headerLines.length,
		tags: true,
		wrap: true,
		content: headerLines.join("\n"),
	});
	line({ parent: popup, top: headerLines.length, left: 1, right: 1, orientation: "horizontal", style: { fg: "gray" } });
	box({
		parent: popup,
		content: " Esc ",
		top: -1,
		right: 1,
		width: 5,
		height: 1,
		style: { inverse: true, bold: true },
	});
	box({
		parent: popup,
		content: " E Edit ",
		top: -1,
		right: 7,
		width: 8,
		height: 1,
		style: { inverse: true, bold: true },
	});

	const metadata: string[] = [];
	const pushDate = (label: string, value?: string) => {
		if (value) metadata.push(`{bold}${label}:{/bold} ${formatDateForDisplay(value)}`);
	};
	pushDate("Created", milestone.createdDate);
	pushDate("Updated", milestone.updatedDate);
	pushDate("Due", milestone.dueDate);
	if (milestone.plannedStart || milestone.plannedEnd) {
		metadata.push(
			`{bold}Planned:{/bold} ${formatDateForDisplay(milestone.plannedStart ?? "") || "-"} → ${formatDateForDisplay(milestone.plannedEnd ?? "") || "-"}`,
		);
	}
	if (milestone.actualStart || milestone.actualEnd) {
		metadata.push(
			`{bold}Actual:{/bold} ${formatDateForDisplay(milestone.actualStart ?? "") || "-"} → ${formatDateForDisplay(milestone.actualEnd ?? "") || "-"}`,
		);
	}

	const body: string[] = [];
	body.push(formatHeading("Details", 2));
	body.push(metadata.length > 0 ? metadata.join("\n") : "{gray-fg}(no dates recorded){/}");
	body.push("");
	if (milestone.description.trim()) {
		body.push(formatHeading("Description", 2));
		body.push(milestone.description.trim());
		body.push("");
	}
	if (milestone.documentation?.length) {
		body.push(formatHeading("Documentation", 2));
		for (const entry of milestone.documentation) body.push(` - ${entry}`);
	}

	const contentArea = scrollabletext({
		parent: popup,
		top: headerLines.length + 1,
		left: 1,
		right: 1,
		bottom: 1,
		keys: true,
		vi: true,
		mouse: true,
		tags: true,
		wrap: true,
		padding: { left: 1, right: 1 },
		content: body.join("\n"),
	}) as ScrollableTextInterface;

	let resolveClosed: (outcome: MilestonePopupOutcome) => void = () => {};
	const closed = new Promise<MilestonePopupOutcome>((resolvePromise) => {
		resolveClosed = resolvePromise;
	});
	const closePopup = (outcome: MilestonePopupOutcome = "close") => {
		if (settled) return;
		settled = true;
		(
			screen as ScreenInterface & {
				removeListener(event: string, listener: (...args: unknown[]) => void): void;
			}
		).removeListener("resize", onResize);
		popup.destroy();
		background.destroy();
		screen.render();
		resolveClosed(outcome);
	};

	// blessed delivers a key to the focused widget, so the close keys have to sit on the
	// scrolled body the popup focuses; the popup-level binding only covers the keys pressed
	// before that focus lands.
	popup.key(["escape", "q", "C-c"], () => {
		closePopup();
		return false;
	});
	contentArea.key(["escape", "q", "C-c"], () => {
		closePopup();
		return false;
	});
	// `e` leaves the popup to the form that edits what it shows; the host opens it once this
	// popup is down, so the two modals never overlap.
	popup.key(["e"], () => {
		closePopup("edit");
		return false;
	});
	contentArea.key(["e"], () => {
		closePopup("edit");
		return false;
	});

	setImmediate(() => {
		contentArea.focus();
		screen.render();
	});

	return { close: closePopup, closed };
}

/**
 * Interactive milestone list + board. Resolves when the user quits.
 */
export async function renderMilestonesTui(options: MilestonesTuiOptions): Promise<void> {
	const { core, statuses } = options;
	let milestones = options.milestones;
	let rows: SidebarRow[] = [];
	let selectedIndex = 0;
	let sideFocused = true;
	let popupOpen = false;
	let hint: string | null = null;
	let hintTimer: ReturnType<typeof setTimeout> | null = null;
	let boardHandle: BoardHandle | null = null;
	let pushScope: ((tasks: Task[], statuses: string[]) => void) | null = null;
	/**
	 * The task data the list counts: the caller's snapshot, folded up to date from what the board
	 * reports. The tasks the board shows are the only ones this view can edit.
	 */
	let corpus: Task[] = options.tasks;
	/** The board header's filters. They are global here, so every row's numbers follow them. */
	let headerFilters: BoardFilterState | null = null;
	/** `corpus` after those filters; the numbers beside each milestone are counted from these. */
	let countedTasks: Task[] | null = null;
	/** The row whose milestone the board is scoped to. The cursor moves without changing it. */
	let appliedKey: string | null = null;
	/** A board that dies takes the host with it; the error is rethrown once the screen is down. */
	let boardFailure: unknown = null;

	await new Promise<void>((resolve) => {
		const screen = options.screen ?? createScreen({ title: formatTuiTitle("Milestones", options.projectName) });
		let closed = false;
		const close = () => {
			if (closed) return;
			closed = true;
			if (hintTimer) clearTimeout(hintTimer);
			// The screen shares blessed's process-wide program, and that program is what holds stdin
			// in raw mode: only destroying it puts the terminal back, so the shell is not left
			// hanging on a quit. This is the same teardown the other list viewers use.
			screen.leave();
			screen.destroy();
			releaseSharedProgram();
			resolve();
		};

		const findEntity = (bucket: MilestoneBucket): Milestone | undefined => {
			const key = bucket.milestone ? milestoneKey(bucket.milestone) : null;
			if (!key) return undefined;
			return [...milestones, ...options.archivedMilestones].find((entry) => milestoneKey(entry.id) === key);
		};

		/**
		 * `buildMilestoneBuckets` already yields the order the list wants: the unassigned bucket
		 * first, then every milestone in milestone-file order. Completed milestones stay in place
		 * and carry a marker rather than being dropped, so no milestone is ever hidden here.
		 *
		 * Rows always come from the whole corpus — selecting a milestone has to reach all of its
		 * work — while the numbers come from the same buckets over the tasks the header filters
		 * keep. Those filters are global, the board's scope is not one of them, so a row's numbers
		 * say what selecting it would put on the board whatever is selected right now. The scoped
		 * row is marked, because the cursor can sit somewhere else: it moves freely, and Space is
		 * what scopes the board.
		 */
		const rebuildRows = () => {
			const archivedMilestoneIds = collectArchivedMilestoneKeys(options.archivedMilestones, milestones);
			const bucketOptions = { archivedMilestoneIds, archivedMilestones: options.archivedMilestones };
			const buckets = buildMilestoneBuckets(corpus, milestones, statuses, bucketOptions);
			const counted = new Map(
				buildMilestoneBuckets(countedTasks ?? corpus, milestones, statuses, bucketOptions).map((bucket) => [
					bucket.key,
					bucket,
				]),
			);
			rows = buckets.map((bucket): SidebarRow => {
				const shown = counted.get(bucket.key) ?? bucket;
				const scope = bucket.key === appliedKey ? "▶ " : "";
				return bucket.isNoMilestone
					? {
							kind: "no-milestone",
							key: bucket.key,
							label: `${scope}No milestone · ${shown.total}`,
							bucket,
						}
					: {
							kind: "milestone",
							key: bucket.key,
							label: `${scope}${formatRowLabel(bucket, shown)}`,
							bucket,
							milestone: findEntity(bucket),
						};
			});
		};

		rebuildRows();
		// The list opens on the unassigned bucket, and that is also what the board is scoped to.
		appliedKey = rows[0]?.key ?? null;

		// The sidebar list is created inside the box the board reserves for it, so the board
		// owns the geometry and the sidebar always lines up with the columns. A board that has
		// nothing to lay out never gets there, so every sidebar call tolerates its absence.
		let sidebarList: MutableList | null = null;
		let pane: BoxInterface | null = null;
		/** Built by the board, so it is only there once the board has laid the side column out. */
		const getSidebar = (): MutableList | null => sidebarList;
		const buildSidebar = (parent: BoxInterface) => {
			pane = box({
				parent,
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				border: { type: "line" },
				style: { border: { fg: "yellow" } },
				label: " Milestones ",
			});
			sidebarList = list({
				parent: pane,
				top: 1,
				left: 1,
				width: "100%-4",
				height: "100%-3",
				items: rows.map((row) => row.label),
				keys: false,
				mouse: true,
				scrollable: true,
				tags: true,
				// The cursor row stays the list's selected item even when focus moves to
				// the board. While the sidebar is focused, blessed's selected-item rule
				// (kept on via invertSelected) renders the row's check in the highlight's
				// plain color; once unfocused the flag drops so the green check returns.
				// setSidebarFocusStyle toggles it with focus.
				invertSelected: true,
				style: { selected: { inverse: true, bold: true } },
			}) as MutableList;
		};

		const setSidebarFocusStyle = (focused: boolean) => {
			if (!sidebarList || !pane) return;
			const style = sidebarList.style as { selected?: { inverse?: boolean; bold?: boolean } };
			if (style.selected) {
				style.selected.inverse = focused;
				style.selected.bold = focused;
			}
			// While the sidebar holds the keyboard its selected row shows as an inverse
			// highlight and blessed's selected-item rule keeps that row's check the
			// highlight's plain color. Once focus leaves, the row is visually plain but
			// still the list's selected item, so the rule must stand down or the green
			// check would stay suppressed for as long as the cursor sits on the row.
			const listOptions = sidebarList.options as { invertSelected?: boolean };
			listOptions.invertSelected = focused;
			const borderStyle = pane.style as { border?: { fg?: string } };
			if (borderStyle.border) borderStyle.border.fg = focused ? "yellow" : "gray";
		};

		const refreshSidebar = (index: number) => {
			selectedIndex = clampSelection(index, rows.length);
			const list = getSidebar();
			if (!list) return;
			list.setItems?.(rows.map((row) => row.label));
			list.select(selectedIndex);
			pane?.setLabel?.(` Milestones (${rows.filter((row) => row.kind === "milestone").length}) `);
			setSidebarFocusStyle(sideFocused);
		};

		const showHint = (message: string, durationMs = 4000) => {
			hint = message;
			if (hintTimer) clearTimeout(hintTimer);
			boardHandle?.syncChrome();
			hintTimer = setTimeout(() => {
				hint = null;
				hintTimer = null;
				boardHandle?.syncChrome();
			}, durationMs);
		};

		const selectedRow = () => rows[selectedIndex];
		const appliedRow = () => rows.find((row) => row.key === appliedKey);

		/** Point the board at the row that is in scope; its own filters narrow that further. */
		const applyScope = () => {
			const row = appliedRow();
			pushScope?.(row?.bucket ? row.bucket.tasks : corpus, statuses);
		};

		/**
		 * The header's search box matches tasks exactly like the web milestone page: the query is
		 * resolved against the whole corpus and each surface then keeps the matches it can show, so
		 * the board's columns and the numbers in the list always agree. Resolving it against the
		 * board's own scope instead would let a weak fuzzy hit through in a small milestone.
		 */
		const searchMatch = (tasks: Task[], query: string) => {
			const matched = matchMilestoneSearchTaskIds(corpus, query);
			return tasks.filter((task) => matched.has(task.id));
		};

		/**
		 * Re-count the list from the corpus and the header filters, repainting only when a number
		 * actually moved: an ordinary board repaint must not churn the list's items, and with them
		 * the cursor and the scroll position.
		 */
		const refreshCounts = () => {
			countedTasks = headerFilters ? filterBoardTasks(corpus, headerFilters, { searchMatch }) : corpus;
			const before = rows.map((row) => row.label);
			rebuildRows();
			if (rows.length === before.length && rows.every((row, index) => row.label === before[index])) return;
			refreshSidebar(selectedIndex);
			screen.render();
		};

		/**
		 * Fold the tasks the board reports back into the corpus, then re-count. The board is the only
		 * place this view edits tasks, so what it shows is the freshest data there is; a report that
		 * carries nothing new costs nothing.
		 */
		const syncFromBoard = (fresh: Task[]) => {
			const byId = new Map(corpus.map((task) => [task.id, task]));
			let changed = false;
			for (const task of fresh) {
				if (byId.get(task.id) === task) continue;
				byId.set(task.id, task);
				changed = true;
			}
			if (!changed) return;
			corpus = [...byId.values()];
			refreshCounts();
		};

		/**
		 * Name the milestone the board is scoped to, so the columns stay identifiable while the
		 * keyboard is up in the filter bar picking a priority.
		 */
		const areaLabel = () => {
			const bucket = appliedRow()?.bucket;
			if (!bucket) return "Tasks";
			return `Tasks · ${bucket.isNoMilestone ? "No milestone" : bucket.label}`;
		};

		/**
		 * Move the cursor without disturbing the scope. Keeping the two apart is what lets the user
		 * walk up past the top of the list into the filter bar and change a filter while the columns
		 * keep showing the milestone they were looking at.
		 */
		const moveSelection = (delta: number) => {
			const next = clampSelection(selectedIndex + delta, rows.length);
			if (next === selectedIndex) return;
			selectedIndex = next;
			getSidebar()?.select(selectedIndex);
			screen.render();
		};

		/** Scope the board to the highlighted row (Space). */
		const selectHighlighted = () => {
			const row = selectedRow();
			if (!row || row.key === appliedKey) return;
			appliedKey = row.key;
			rebuildRows();
			refreshSidebar(selectedIndex);
			applyScope();
			screen.render();
		};

		const openDetail = async (row: SidebarRow | undefined) => {
			if (!row || row.kind !== "milestone" || !row.milestone) return;
			const milestone = row.milestone;
			popupOpen = true;
			let outcome: MilestonePopupOutcome = "close";
			try {
				const popup = await createMilestonePopup(screen, milestone, row.bucket);
				if (!popup) return;
				outcome = await popup.closed;
			} finally {
				popupOpen = false;
				boardHandle?.syncChrome();
				screen.render();
			}
			// `e` in the popup asks for the editor; it opens only once the popup is down, so the two
			// modals never hold the keyboard at the same time.
			if (outcome === "edit") await editMilestoneInteractive(milestone);
		};

		const hostKeysActive = () => sideFocused && !popupOpen;

		const leaveToBoard = () => {
			sideFocused = false;
			setSidebarFocusStyle(false);
			boardHandle?.focusBoard();
			screen.render();
		};

		/**
		 * Leave the list upward into the filter bar. The cursor keeps its place and the scope is
		 * untouched, so walking up to change a priority cannot silently re-point the columns.
		 */
		const leaveToFilters = () => {
			sideFocused = false;
			setSidebarFocusStyle(false);
			boardHandle?.focusFilters();
			screen.render();
		};

		/**
		 * Rebuild the rows from the milestone files the caller just re-read, and put the cursor back
		 * on `key`. A milestone the user only just created is not in the old list, so the cursor is
		 * placed from the fresh one.
		 */
		const reloadMilestones = (key: string | null) => {
			rebuildRows();
			selectedIndex = Math.max(
				0,
				rows.findIndex((row) => row.key === key),
			);
			refreshSidebar(selectedIndex);
			applyScope();
			screen.render();
		};

		const createMilestoneInteractive = async () => {
			popupOpen = true;
			let values: MilestoneFormValues | null = null;
			try {
				values = await openMilestoneForm({
					screen,
					mode: "create",
					existingTitles: milestones.map((milestone) => milestone.title),
				});
			} finally {
				popupOpen = false;
			}
			if (!values) {
				boardHandle?.syncChrome();
				return;
			}
			const title = values.title.trim();
			try {
				await core.filesystem.createMilestone(title, toMilestoneWriteOptions(values));
			} catch (error) {
				showHint(` {red-fg}Could not create milestone: ${error instanceof Error ? error.message : "unknown error"}{/}`);
				return;
			}
			milestones = await core.filesystem.listMilestones();
			// A milestone the user just created is the one they want to look at: put the cursor on it
			// and scope the board to it.
			const created = milestones.find((milestone) => milestone.title === title);
			if (created) appliedKey = milestoneKey(created.id);
			reloadMilestones(appliedKey);
			showHint(` {green-fg}Created milestone ${title}{/}`);
		};

		/**
		 * Change a milestone's description and dates. The title is not on offer: the milestone file
		 * is named after it, so renaming moves a file and stays with `backlog milestone edit`.
		 */
		const editMilestoneInteractive = async (milestone: Milestone) => {
			popupOpen = true;
			let values: MilestoneFormValues | null = null;
			try {
				values = await openMilestoneForm({ screen, mode: "edit", milestone });
			} finally {
				popupOpen = false;
			}
			if (!values) {
				boardHandle?.syncChrome();
				return;
			}
			// The title goes in unchanged, so nothing moves and no commit is made from here: this view
			// writes milestone files the way its own create path does, and leaves committing to the
			// CLI/MCP surfaces that own it (an in-place edit would otherwise be committed as a rename).
			const result = await core.updateMilestone(milestone.id, milestone.title, toMilestoneWriteOptions(values), false);
			if (!result.success) {
				showHint(` {red-fg}Could not update milestone ${milestone.id}{/}`);
				return;
			}
			milestones = await core.filesystem.listMilestones();
			reloadMilestones(milestoneKey(milestone.id));
			showHint(` {green-fg}Updated milestone ${milestone.title}{/}`);
		};

		/** A new board task belongs to the milestone the board is scoped to, not to the cursor. */
		const taskTargetMilestone = (): string | undefined => {
			const row = appliedRow();
			return row?.kind === "milestone" ? (row.bucket?.milestone ?? undefined) : undefined;
		};

		// The board's first render uses the tasks passed here; later scope changes go through
		// the update hook the board subscribes to (it is only bound after that first render).
		const initialBucket = appliedRow()?.bucket;
		const initialTasks = initialBucket ? initialBucket.tasks : corpus;

		// The board runs embedded, so it never closes itself: this host owns teardown. Its promise
		// therefore only settles when that teardown happens, and this handler is what keeps a board
		// that dies on the way up from becoming an unhandled rejection behind a mounted host.
		renderBoardTui(initialTasks, statuses, options.layout, options.maxColumnWidth, {
			core,
			screen,
			projectName: options.projectName,
			hideEmptyColumns: options.hideEmptyColumns,
			availableLabels: collectAvailableLabels(options.tasks),
			// The sidebar is the milestone picker, so the header keeps the board's other filters.
			visibleFilters: ["search", "priority", "labels"],
			// The header's filters are global, so the list's numbers have to hear about them even
			// when the board is scoped to a different milestone.
			onFilterChange: (filters) => {
				headerFilters = filters;
				refreshCounts();
			},
			subscribeUpdates: (update) => {
				pushScope = update;
			},
			createTask: async (input) => {
				const config = await core.filesystem.loadConfig();
				const milestoneId = taskTargetMilestone();
				const withMilestone = milestoneId ? { ...input, milestone: milestoneId } : input;
				return (await core.createTaskFromInput(withMilestone, config?.autoCommit ?? false)).task;
			},
			embed: {
				sidePane: {
					width: SIDEBAR_WIDTH,
					render: buildSidebar,
				},
				isKeyScopeActive: () => !sideFocused && !popupOpen,
				searchMatch,
				areaLabel,
				onVisibleTasks: syncFromBoard,
				taskSummary: true,
				// The bar's filters are global, so the summary counts against every task this view
				// holds and the second number holds still while the first follows the filters.
				summaryTotal: () => corpus.length,
				footerHint: () => (hint ? hint : sideFocused ? SIDEBAR_FOOTER_CONTENT : null),
				onExitLeft: () => {
					sideFocused = true;
					setSidebarFocusStyle(true);
					getSidebar()?.focus();
					boardHandle?.syncChrome();
					screen.render();
				},
				onQuit: () => close(),
				onReady: (handle) => {
					boardHandle = handle;
				},
			},
		}).catch((error) => {
			boardFailure = error;
			close();
		});

		// The board subscribes to its update hook after its first render, so the initial scope
		// already arrives through the task list passed above; only later changes go through it.
		refreshSidebar(selectedIndex);
		setSidebarFocusStyle(true);
		getSidebar()?.focus();

		// Up from the top row leaves the list for the filter bar above it, the way its own keys do:
		// the scope is what the user set with Space, so passing through must not change it.
		screen.key(["up", "k"], () => {
			if (!hostKeysActive()) return;
			if (selectedIndex === 0) {
				leaveToFilters();
				return;
			}
			moveSelection(-1);
		});
		screen.key(["down", "j"], () => {
			if (!hostKeysActive()) return;
			moveSelection(1);
		});
		screen.key(["space"], () => {
			if (!hostKeysActive()) return;
			selectHighlighted();
		});
		screen.key(["enter"], async () => {
			if (!hostKeysActive()) return;
			await openDetail(selectedRow());
		});
		screen.key(["right", "l"], () => {
			if (!hostKeysActive()) return;
			leaveToBoard();
		});
		screen.key(["n", "N", "S-n"], async () => {
			if (!hostKeysActive()) return;
			await createMilestoneInteractive();
		});
		screen.key(["?"], async () => {
			if (!hostKeysActive()) return;
			popupOpen = true;
			try {
				await openHelpPopup(screen, "milestones");
			} finally {
				popupOpen = false;
				boardHandle?.syncChrome();
				screen.render();
			}
		});
		// While the board holds the keyboard it owns q/Esc (move-mode cancel, task popups) and
		// hands a real quit back through onQuit.
		screen.key(["q", "C-c", "escape"], () => {
			if (!hostKeysActive()) return;
			close();
		});

		screen.render();
	});

	// A board that fell over has already taken the screen down with it; surface the cause.
	if (boardFailure) throw boardFailure;
}
