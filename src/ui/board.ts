import type { BoxInterface, ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import {
	type BoardLayout,
	buildKanbanStatusGroups,
	generateKanbanBoardWithMetadata,
	generateMilestoneGroupedBoard,
} from "../board.ts";
import { type Core, createRuntimeCore } from "../core/backlog.ts";
import type { Milestone, Task, TaskCreateInput } from "../types/index.ts";
import { copyToClipboard } from "../utils/clipboard.ts";
import { areLabelSelectionsEqual, collectAvailableLabels } from "../utils/label-filter.ts";
import {
	createMilestoneFilterValueResolver,
	type MilestoneFilterValueResolver,
	NO_MILESTONE_FILTER_LABEL,
	NO_MILESTONE_FILTER_VALUE,
} from "../utils/milestone-filter.ts";
import { applySharedTaskFilters, createTaskSearchIndex, type LabelMatchMode } from "../utils/task-search.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { formatAcceptanceCriteriaProgress } from "./acceptance-criteria-progress.ts";
import { openConfirmPopup } from "./components/confirm-popup.ts";
import {
	createFilterHeader,
	type FilterControlId,
	type FilterHeader,
	type FilterState,
} from "./components/filter-header.ts";
import { openMultiSelectFilterPopup, openSingleSelectFilterPopup } from "./components/filter-popup.ts";
import type { BoundaryNavigationKey } from "./components/generic-list.ts";
import { openHelpPopup } from "./components/help-popup.ts";
import { openTaskComposer, type TaskComposerOptions } from "./components/task-composer.ts";
import { BOARD_FOOTER_CONTENT, formatFooterContent } from "./footer-content.ts";
import { getStatusIcon } from "./status-icon.ts";
import {
	createTaskPopup,
	resolveListBoundaryNavigation,
	resolveSearchExitTargetIndex,
} from "./task-viewer-with-search.ts";
import { createScreen, formatTuiTitle } from "./tui.ts";
import { stripBlessedFgTags } from "./utils/strip-tags.ts";

export type ColumnData = {
	status: string;
	tasks: Task[];
};

/** The board header's filters: what a caller seeds the board with, and what it reports back. */
export type BoardFilterState = {
	searchQuery: string;
	statusExcludedFilter: string[];
	priorityFilter: string;
	labelFilter: string[];
	labelMatch?: LabelMatchMode;
	milestoneFilter: string;
	limit?: number;
};

/** Whether the header's filter pipeline narrows anything at all. */
function hasBoardFilters(filters: BoardFilterState): boolean {
	return Boolean(
		filters.searchQuery.trim() ||
			filters.statusExcludedFilter.length > 0 ||
			filters.priorityFilter ||
			filters.labelFilter.length > 0 ||
			filters.milestoneFilter ||
			filters.limit !== undefined,
	);
}

/**
 * Apply the board header's filters to a task set. The board uses this for its own columns; a host
 * embedded in the board uses it to ask the same question of a different task set — the milestone
 * list counts every milestone, not only the one the columns are scoped to — so the filter
 * semantics, a host-supplied search match included, live in exactly one place.
 */
export function filterBoardTasks(
	tasks: Task[],
	filters: BoardFilterState,
	options?: {
		searchMatch?: (tasks: Task[], query: string) => Task[];
		resolveMilestoneLabel?: MilestoneFilterValueResolver;
	},
): Task[] {
	if (!hasBoardFilters(filters)) return [...tasks];

	// A host can own the search box's matching semantics; the query is then consumed here and the
	// rest of the shared filter pipeline runs on the corpus that search narrowed. With no query
	// left for the pipeline to run, it needs no search index either.
	const hostSearchMatch = options?.searchMatch;
	const query = filters.searchQuery;
	const searchScope = hostSearchMatch && query.trim() ? hostSearchMatch(tasks, query) : tasks;
	const searchIndex = hostSearchMatch ? undefined : createTaskSearchIndex(searchScope);
	const matched = applySharedTaskFilters(
		searchScope,
		{
			query: hostSearchMatch ? "" : query,
			statusExcluded: filters.statusExcludedFilter,
			priority: filters.priorityFilter as "high" | "medium" | "low" | undefined,
			labels: filters.labelFilter,
			labelMatch: filters.labelMatch,
			milestone: filters.milestoneFilter || undefined,
			resolveMilestoneLabel: options?.resolveMilestoneLabel,
			scoreThreshold: 0.45,
		},
		searchIndex,
	);
	return filters.limit !== undefined ? matched.slice(0, filters.limit) : matched;
}

type MutableList = ListInterface & {
	selected?: number;
	setItem?: (index: number, content: string) => void;
};

type ColumnView = {
	status: string;
	tasks: Task[];
	list: ListInterface;
	box: BoxInterface;
	richItems: string[];
	plainItems: string[];
	highlightedIndex?: number;
};

function isDoneStatus(status: string): boolean {
	const normalized = status.trim().toLowerCase();
	return normalized === "done" || normalized === "completed" || normalized === "complete";
}

function buildColumnTasks(status: string, items: Task[], byId: Map<string, Task>): Task[] {
	const topLevel: Task[] = [];
	const childrenByParent = new Map<string, Task[]>();
	const sorted = items.slice().sort((a, b) => {
		// Use ordinal for custom sorting if available
		const aOrd = a.ordinal;
		const bOrd = b.ordinal;

		// If both have ordinals, compare them
		if (typeof aOrd === "number" && typeof bOrd === "number") {
			if (aOrd !== bOrd) return aOrd - bOrd;
		} else if (typeof aOrd === "number") {
			// Only A has ordinal -> A comes first
			return -1;
		} else if (typeof bOrd === "number") {
			// Only B has ordinal -> B comes first
			return 1;
		}

		const columnIsDone = isDoneStatus(status);
		if (columnIsDone) {
			return compareTaskIds(b.id, a.id);
		}

		return compareTaskIds(a.id, b.id);
	});

	for (const task of sorted) {
		const parent = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
		if (parent && parent.status === task.status) {
			const existing = childrenByParent.get(parent.id) ?? [];
			existing.push(task);
			childrenByParent.set(parent.id, existing);
			continue;
		}
		topLevel.push(task);
	}

	const ordered: Task[] = [];
	for (const task of topLevel) {
		ordered.push(task);
		const subs = childrenByParent.get(task.id) ?? [];
		subs.sort((a, b) => compareTaskIds(a.id, b.id));
		ordered.push(...subs);
	}

	return ordered;
}

export function prepareBoardColumns(tasks: Task[], statuses: string[]): ColumnData[] {
	const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups(tasks, statuses);
	const byId = new Map<string, Task>(tasks.map((task) => [task.id, task]));

	return orderedStatuses.map((status) => {
		const items = groupedTasks.get(status) ?? [];
		const orderedTasks = buildColumnTasks(status, items, byId);
		return { status, tasks: orderedTasks };
	});
}

export function formatTaskListItem(task: Task, isMoving = false, availableWidth = Number.POSITIVE_INFINITY): string {
	const assignee = task.assignee?.[0]
		? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
		: "";
	const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
	const isCrossBranch = Boolean((task as Task & { branch?: string }).branch);
	const branch = isCrossBranch ? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}` : "";
	const progress = formatAcceptanceCriteriaProgress(task, availableWidth);
	const progressPrefix = progress ? `${progress} ` : "";

	// Cross-branch tasks are dimmed to indicate read-only status
	const content = `${progressPrefix}{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}${branch}`;
	if (isMoving) {
		return `{magenta-fg}► ${content}{/}`;
	}
	if (isCrossBranch) {
		return `{gray-fg}${content}{/}`;
	}
	return content;
}

function buildRenderedTaskListItems(
	tasks: Task[],
	movingTaskIds?: ReadonlySet<string>,
	availableWidth = Number.POSITIVE_INFINITY,
): { rich: string[]; plain: string[] } {
	const rich = tasks.map((task) => formatTaskListItem(task, movingTaskIds?.has(task.id) ?? false, availableWidth));
	return {
		rich,
		plain: rich.map((item) => stripBlessedFgTags(item)),
	};
}

function formatColumnLabel(status: string, count: number): string {
	return `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${count})\u00A0`;
}

/**
 * Board columns to render: with `hideEmptyColumns` enabled, columns without tasks are
 * dropped. A move keeps every column so all drop targets stay reachable, and a board
 * where every column is empty keeps them all so the board never renders blank.
 */
export function filterVisibleColumns(data: ColumnData[], hideEmptyColumns: boolean, isMoving: boolean): ColumnData[] {
	if (!hideEmptyColumns || isMoving) {
		return data;
	}
	const nonEmpty = data.filter((column) => column.tasks.length > 0);
	return nonEmpty.length > 0 ? nonEmpty : data;
}

export function upsertBoardTask(tasks: readonly Task[], task: Task): Task[] {
	const existingIndex = tasks.findIndex((candidate) => candidate.id === task.id);
	if (existingIndex === -1) return [...tasks, task];
	const next = [...tasks];
	next[existingIndex] = task;
	return next;
}

export function getCreatedTaskBoardOutcome(
	task: Task,
	visible: boolean,
): { focusTaskId?: string; message: string; tone: "green" | "yellow" } {
	if (task.status.trim().toLowerCase() === "draft") {
		return {
			message: `Created ${task.id} as a draft. Drafts are not shown on the task board.`,
			tone: "yellow",
		};
	}
	if (!visible) {
		return {
			message: `Created ${task.id}, but it is hidden by the current board filters.`,
			tone: "yellow",
		};
	}
	return { focusTaskId: task.id, message: `Created ${task.id}.`, tone: "green" };
}

export function shouldRebuildColumns(current: ColumnData[], next: ColumnData[]): boolean {
	if (current.length !== next.length) {
		return true;
	}
	for (let index = 0; index < next.length; index += 1) {
		const nextColumn = next[index];
		if (!nextColumn) return true;
		const prevColumn = current[index];
		if (!prevColumn) return true;
		if (prevColumn.status !== nextColumn.status) return true;
		if (prevColumn.tasks.length !== nextColumn.tasks.length) return true;
		for (let taskIdx = 0; taskIdx < nextColumn.tasks.length; taskIdx += 1) {
			const prevTask = prevColumn.tasks[taskIdx];
			const nextTask = nextColumn.tasks[taskIdx];
			if (!prevTask || !nextTask) {
				return true;
			}
			if (prevTask.id !== nextTask.id) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Imperative handle the board hands to an embedding host so the host can take the keyboard
 * back (after its own pane) and refresh the board chrome after changing its own layout.
 */
export type BoardHandle = {
	/** Put the keyboard back on the board's current column. */
	focusBoard: () => void;
	/** Put the keyboard on the filter bar's first control, the way `/` does. */
	focusFilters: () => void;
	/** Re-run the board layout and footer rendering. */
	syncChrome: () => void;
};

/**
 * Embed the board inside a host TUI (e.g. the milestone list viewer).
 *
 * The host owns the keyboard whenever {@link BoardEmbedOptions.isKeyScopeActive} returns
 * false, renders its own sidebar through {@link BoardEmbedOptions.sidePane}, and decides
 * what quitting means. Without this option the board behaves exactly as before.
 */
export type BoardEmbedOptions = {
	/**
	 * Host-rendered sidebar. The board reserves this much horizontal space for it, keeps it
	 * aligned with the board's own chrome, and hands focus back at the left boundary.
	 */
	sidePane?: {
		/** Sidebar width as a percentage of the terminal, e.g. `"28%"`. */
		width: string;
		/** Build the sidebar inside the box the board reserves for it. */
		render: (parent: BoxInterface) => void;
	};
	/** Board key bindings stand down while this returns false. Defaults to always active. */
	isKeyScopeActive?: () => boolean;
	/**
	 * Matching semantics for the header's search box. Hosts whose surface has its own search
	 * contract (the milestone view mirrors the web milestone page) supply it here; the rest of
	 * the shared filter pipeline still applies on top.
	 */
	searchMatch?: (tasks: Task[], query: string) => Task[];
	/** Footer text while the host owns the keyboard; return null to let the board render its own. */
	footerHint?: () => string | null;
	/**
	 * Title for a frame drawn around the board's own columns region. Read whenever the board
	 * repaints its chrome, so a host can name what the columns currently hold.
	 */
	areaLabel?: () => string;
	/**
	 * Called with the tasks the board is showing whenever that set changes, so a host can fold the
	 * board's live task data back into its own view. The filters arrive complete through the outer
	 * `onFilterChange`; this is the task-data channel.
	 */
	onVisibleTasks?: (tasks: Task[]) => void;
	/**
	 * Show a right-aligned `<shown>/<total> tasks` summary at the end of the filter bar's title
	 * line, so how much of the totalled corpus the columns hold is visible at a glance.
	 */
	taskSummary?: boolean;
	/**
	 * The total that summary counts against. Defaults to the board's own scope; a host whose filter
	 * bar filters a wider corpus — the milestone list filters every milestone at once — passes that
	 * corpus's size, so the second number stays put while the first follows the filters.
	 */
	summaryTotal?: () => number;
	/** The user asked to leave the board to the left; the host takes focus. */
	onExitLeft?: () => void;
	/** The user asked to quit; the host decides whether to close the whole TUI. */
	onQuit?: () => void;
	/** Called once the board is mounted and ready. */
	onReady?: (handle: BoardHandle) => void;
};

/**
 * Render tasks in an interactive TUI when stdout is a TTY.
 * Falls back to plain-text board when not in a terminal
 * (e.g. piping output to a file or running in CI).
 */
export async function renderBoardTui(
	initialTasks: Task[],
	statuses: string[],
	_layout: BoardLayout,
	_maxColumnWidth: number,
	options?: {
		/** Core instance the board mutates through. Falls back to the runtime working directory. */
		core?: Core;
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		onTaskSelect?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
		subscribeUpdates?: (update: (nextTasks: Task[], nextStatuses: string[]) => void) => void;
		filters?: {
			searchQuery: string;
			statusExcludedFilter?: string[];
			priorityFilter: string;
			labelFilter: string[];
			labelMatch?: LabelMatchMode;
			milestoneFilter: string;
			limit?: number;
		};
		availableLabels?: string[];
		availableMilestones?: string[];
		onFilterChange?: (filters: BoardFilterState) => void;
		milestoneMode?: boolean;
		milestoneEntities?: Milestone[];
		hideEmptyColumns?: boolean;
		projectName?: string;
		createTask?: (input: TaskCreateInput) => Promise<Task>;
		taskComposer?: (options: TaskComposerOptions) => Promise<Task | null>;
		priorities?: readonly string[];
		/** Filter controls to render in the header. Hosts that offer their own milestone picker drop it here. */
		visibleFilters?: FilterControlId[];
		/** Embed the board inside a host TUI. Omit for the standalone board. */
		embed?: BoardEmbedOptions;
		screen?: ScreenInterface;
	},
): Promise<void> {
	if (!process.stdout.isTTY) {
		// The piped board is the same view, so it hides the same columns the TUI hides.
		// Milestone lanes filter on the same board-wide emptiness the browser lanes use.
		const visibleStatuses = options?.hideEmptyColumns
			? filterVisibleColumns(prepareBoardColumns(initialTasks, statuses), true, false).map((column) => column.status)
			: statuses;
		const projectName = options?.projectName?.trim() || "Project";
		if (options?.milestoneMode) {
			console.log(
				generateMilestoneGroupedBoard(initialTasks, visibleStatuses, options.milestoneEntities ?? [], projectName),
			);
		} else {
			console.log(generateKanbanBoardWithMetadata(initialTasks, visibleStatuses, projectName));
		}
		return;
	}

	const initialColumns = prepareBoardColumns(initialTasks, statuses);
	if (initialColumns.length === 0) {
		console.log("No tasks available for the Kanban board.");
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = options?.screen ?? createScreen({ title: formatTuiTitle("Board", options?.projectName) });
		const container = box({
			parent: screen,
			width: "100%",
			height: "100%",
		});
		// The columns region is framed so an embedding host can title it, and the frame is what
		// carries the geometry. A percentage width resolves against the frame's own width, which
		// is its inner width once it has a border, so the frame never overlaps the columns.
		const areaFrame = box({
			parent: container,
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			...(options?.embed?.areaLabel
				? {
						border: { type: "line" as const },
						style: { border: { fg: "yellow" } },
						label: ` ${options.embed.areaLabel()} `,
					}
				: {}),
		});
		const boardArea = box({
			parent: areaFrame,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
		});

		let currentTasks = initialTasks;
		let columns: ColumnView[] = [];
		let currentColumnsData: ColumnData[] = [];
		let currentStatuses = initialColumns.map((column) => column.status);
		let hideEmptyColumns = options?.hideEmptyColumns ?? false;
		let pendingSettingWrite: Promise<void> | null = null;
		let currentCol = 0;
		let popupOpen = false;
		let currentFocus: "board" | "filters" = "board";
		let filterPopupOpen = false;
		let modalOpen = false;
		let taskCreationOpen = false;
		let taskCreationPendingUpdate = false;
		let configuredWorkflowStatuses = [...currentStatuses];
		let pendingSearchWrap: "to-first" | "to-last" | null = null;
		let programmaticColumnSelection = false;
		let fallbackCore: Core | null = null;
		const embed = options?.embed;
		/** False while an embedding host's own pane owns the keyboard. */
		const isScopeActive = () => embed?.isKeyScopeActive?.() ?? true;
		/**
		 * Single guard for every board key binding: an open modal, the focus header, or an
		 * embedding host holding the keyboard each stand the board's own keys down.
		 */
		const keysActive = () =>
			!popupOpen && !filterPopupOpen && !modalOpen && currentFocus !== "filters" && isScopeActive();
		// Board mutations reuse the caller's Core so every surface reads the same project root.
		const getCore = async (): Promise<Core> => {
			if (options?.core) return options.core;
			fallbackCore ??= await createRuntimeCore({ enableWatchers: true });
			return fallbackCore;
		};
		const sharedFilters = {
			searchQuery: options?.filters?.searchQuery ?? "",
			statusExcludedFilter: [...(options?.filters?.statusExcludedFilter ?? [])],
			priorityFilter: options?.filters?.priorityFilter ?? "",
			labelFilter: [...(options?.filters?.labelFilter ?? [])],
			labelMatch: options?.filters?.labelMatch ?? "any",
			milestoneFilter: options?.filters?.milestoneFilter ?? "",
			limit: options?.filters?.limit,
		};
		const runWithModalGuard = async <T>(operation: () => Promise<T>): Promise<T> => {
			modalOpen = true;
			try {
				return await operation();
			} finally {
				modalOpen = false;
			}
		};
		let configuredLabels = collectAvailableLabels(initialTasks, options?.availableLabels ?? []);
		let availableMilestones = [...(options?.availableMilestones ?? [])];
		const resolveMilestoneLabel = createMilestoneFilterValueResolver(options?.milestoneEntities ?? []);
		availableMilestones = Array.from(
			new Set([
				...availableMilestones,
				...initialTasks
					.map((task) => task.milestone?.trim())
					.filter((milestone): milestone is string => Boolean(milestone && milestone.length > 0))
					.map((milestone) => resolveMilestoneLabel(milestone)),
			]),
		).sort((a, b) => a.localeCompare(b));

		let filterHeader: FilterHeader | null = null;
		const hasActiveSharedFilters = () => hasBoardFilters(sharedFilters);
		const emitFilterChange = () => {
			options?.onFilterChange?.({
				searchQuery: sharedFilters.searchQuery,
				statusExcludedFilter: [...sharedFilters.statusExcludedFilter],
				priorityFilter: sharedFilters.priorityFilter,
				labelFilter: [...sharedFilters.labelFilter],
				labelMatch: sharedFilters.labelMatch,
				milestoneFilter: sharedFilters.milestoneFilter,
				limit: sharedFilters.limit,
			});
		};
		/** The board's tasks as the header filters leave them. */
		const getFilteredTasks = (): Task[] =>
			filterBoardTasks(currentTasks, sharedFilters, { searchMatch: embed?.searchMatch, resolveMilestoneLabel });

		/**
		 * `<shown>/<total> tasks` for the filter bar's title line: what the columns hold against the
		 * total the host counts, that total being the board's own scope unless the host says
		 * otherwise. Only hosts that ask for a summary ever see it.
		 */
		const taskSummaryText = (shown: number): string =>
			`${shown}/${embed?.summaryTotal?.() ?? currentTasks.length} tasks`;

		// Move mode state
		type MoveOperation = {
			taskId: string;
			originalStatus: string;
			originalIndex: number;
			targetStatus: string;
			targetIndex: number;
			/** Tasks recruited into the move set with M; never contains the grabbed task. */
			selectedIds: string[];
			/**
			 * Recruitment highlight walked with Shift+Up/Down. While set, recruited tasks stay
			 * in place and the preview shows only the grabbed task's ghost; a plain arrow
			 * collapses it back to the ghost and previews the whole set as one block.
			 */
			highlightTaskId: string | null;
		};
		let moveOp: MoveOperation | null = null;

		/** Every task the operation moves on confirm: the grabbed task plus the recruited set. */
		const getMoveSetIds = (operation: MoveOperation): string[] => [operation.taskId, ...operation.selectedIds];

		/**
		 * Tasks removed from their columns by the current preview. While the recruitment
		 * highlight is active only the grabbed task lifts out; once it collapses the whole
		 * set previews as a block at the target position.
		 */
		const getPreviewMovingIds = (operation: MoveOperation): string[] =>
			operation.highlightTaskId ? [operation.taskId] : getMoveSetIds(operation);

		/**
		 * Re-anchor an insertion index when the set of lifted-out tasks changes: the index
		 * follows the first task at or below it that both views share, so the ghost stays
		 * visually put when recruits collapse into or pop out of the preview.
		 */
		const mapInsertionIndex = (fromBase: string[], toBase: string[], index: number): number => {
			for (let i = Math.max(0, index); i < fromBase.length; i++) {
				const anchor = fromBase[i];
				if (anchor === undefined) break;
				const position = toBase.indexOf(anchor);
				if (position !== -1) return position;
			}
			return toBase.length;
		};

		/** The target column's real task ids minus `excludeIds`: the base the ghost inserts into. */
		const getInsertionBase = (targetStatus: string, excludeIds: string[]): string[] => {
			const excluded = new Set(excludeIds);
			const column = prepareBoardColumns(getFilteredTasks(), currentStatuses).find(
				(candidate) => candidate.status === targetStatus,
			);
			return (column?.tasks ?? []).filter((task) => !excluded.has(task.id)).map((task) => task.id);
		};

		/** Mutate the move selection/highlight while keeping targetIndex anchored to the same spot. */
		const updateMoveSelection = (operation: MoveOperation, mutate: () => void): void => {
			const before = getInsertionBase(operation.targetStatus, getPreviewMovingIds(operation));
			mutate();
			const after = getInsertionBase(operation.targetStatus, getPreviewMovingIds(operation));
			operation.targetIndex = mapInsertionIndex(before, after, operation.targetIndex);
		};

		/**
		 * A plain arrow while the recruitment highlight is active collapses it back to the
		 * ghost, switching the preview to the whole set landing as one block. Returns true
		 * when the keypress was consumed by the collapse.
		 */
		const collapseHighlight = (): boolean => {
			if (!moveOp?.highlightTaskId) return false;
			const operation = moveOp;
			updateMoveSelection(operation, () => {
				operation.highlightTaskId = null;
			});
			renderView();
			return true;
		};

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			tags: true,
			wrap: true,
			content: "",
		});
		let transientFooterContent: string | null = null;
		let footerRestoreTimer: ReturnType<typeof setTimeout> | null = null;
		const clearFooterTimer = () => {
			if (!footerRestoreTimer) return;
			clearTimeout(footerRestoreTimer);
			footerRestoreTimer = null;
		};
		const getTerminalWidth = () => (typeof screen.width === "number" ? screen.width : 80);
		const getFooterHeight = () => (typeof footerBox.height === "number" ? footerBox.height : 1);
		const setFooterContent = (content: string) => {
			const formatted = formatFooterContent(content, getTerminalWidth());
			footerBox.height = formatted.height;
			footerBox.setContent(formatted.content);
		};

		const clearColumns = () => {
			for (const column of columns) {
				column.box.destroy();
			}
			columns = [];
		};

		const columnWidthFor = (count: number) => Math.max(1, Math.floor(100 / Math.max(1, count)));

		const getSelectedRowIndex = (column: ColumnView): number => {
			const selected = (column.list as MutableList).selected ?? 0;
			return Math.max(0, Math.min(selected, Math.max(0, column.tasks.length - 1)));
		};

		const setColumnItemContent = (column: ColumnView, index: number, usePlain: boolean) => {
			if (index < 0 || index >= column.tasks.length) return;
			const content = usePlain ? column.plainItems[index] : column.richItems[index];
			if (!content) return;
			(column.list as MutableList).setItem?.(index, content);
		};

		const syncColumnSelectionDisplay = (column: ColumnView | undefined, active: boolean) => {
			if (!column) return;
			const nextHighlightedIndex = active && column.tasks.length > 0 ? getSelectedRowIndex(column) : undefined;
			if (column.highlightedIndex !== undefined && column.highlightedIndex !== nextHighlightedIndex) {
				setColumnItemContent(column, column.highlightedIndex, false);
			}
			if (nextHighlightedIndex !== undefined) {
				setColumnItemContent(column, nextHighlightedIndex, true);
			}
			column.highlightedIndex = nextHighlightedIndex;
		};

		const selectColumnRow = (column: ColumnView, index: number, active: boolean) => {
			if (column.tasks.length === 0) {
				syncColumnSelectionDisplay(column, false);
				return;
			}
			const nextIndex = Math.max(0, Math.min(index, column.tasks.length - 1));
			programmaticColumnSelection = true;
			try {
				column.list.select(nextIndex);
			} finally {
				programmaticColumnSelection = false;
			}
			(column.list as MutableList).selected = nextIndex;
			syncColumnSelectionDisplay(column, active);
		};

		const getFormattedItems = (tasks: Task[], columnCount = 1) => {
			const terminalWidth = getTerminalWidth();
			const availableWidth = Math.max(1, Math.floor(terminalWidth / Math.max(1, columnCount)) - 4);
			return buildRenderedTaskListItems(tasks, moveOp ? new Set(getMoveSetIds(moveOp)) : undefined, availableWidth);
		};

		const createColumnViews = (data: ColumnData[]) => {
			clearColumns();
			const widthPercent = columnWidthFor(data.length);
			data.forEach((columnData, idx) => {
				const left = idx * widthPercent;
				const isLast = idx === data.length - 1;
				const width = isLast ? `${Math.max(0, 100 - left)}%` : `${widthPercent}%`;
				const columnBox = box({
					parent: boardArea,
					left: `${left}%`,
					top: 0,
					width,
					height: "100%",
					border: { type: "line" },
					style: { border: { fg: "gray" } },
					label: formatColumnLabel(columnData.status, columnData.tasks.length),
				});

				const taskList = list({
					parent: columnBox,
					top: 1,
					left: 1,
					width: "100%-4",
					height: "100%-3",
					keys: false,
					mouse: true,
					scrollable: true,
					tags: true,
					style: { selected: {} },
				});

				const renderedItems = getFormattedItems(columnData.tasks, data.length);
				taskList.setItems(renderedItems.rich);
				columns.push({
					status: columnData.status,
					tasks: columnData.tasks,
					list: taskList,
					box: columnBox,
					richItems: renderedItems.rich,
					plainItems: renderedItems.plain,
				});

				taskList.on("select item", (_item: unknown, selected: unknown) => {
					if (programmaticColumnSelection || popupOpen || filterPopupOpen || modalOpen) return;
					const column = columns[idx];
					if (!column) return;
					if (currentCol !== idx) {
						setColumnActiveState(columns[currentCol], false);
						currentCol = idx;
					}
					(column.list as MutableList).selected = typeof selected === "number" ? selected : getSelectedRowIndex(column);
					currentFocus = "board";
					setColumnActiveState(column, true);
					filterHeader?.setBorderColor("cyan");
					updateFooter();
					screen.render();
				});

				taskList.on("focus", () => {
					if (popupOpen || filterPopupOpen || modalOpen) return;
					if (currentCol !== idx) {
						setColumnActiveState(columns[currentCol], false);
						currentCol = idx;
					}
					setColumnActiveState(columns[currentCol], true);
					currentFocus = "board";
					filterHeader?.setBorderColor("cyan");
					updateFooter();
					screen.render();
				});
			});
		};

		/**
		 * The focused column's border is the board's own focus cue, so it is lit only while the
		 * board holds the keyboard: an embedding host's pane must never leave a column lit.
		 */
		const columnBorderColor = (index: number): string => (isScopeActive() && index === currentCol ? "yellow" : "gray");

		/** Re-derive every column border, for the cases where only the keyboard scope changed. */
		const syncColumnFocusStyle = () => {
			columns.forEach((column, index) => {
				const boxStyle = column.box.style as { border?: { fg?: string } };
				if (boxStyle.border) boxStyle.border.fg = columnBorderColor(index);
			});
		};

		const setColumnActiveState = (column: ColumnView | undefined, active: boolean) => {
			if (!column) return;
			const listStyle = column.list.style as {
				selected?: { bg?: string; fg?: string; inverse?: boolean; bold?: boolean };
			};
			if (listStyle.selected) {
				if (active) {
					listStyle.selected.inverse = true;
					listStyle.selected.bold = !moveOp;
					listStyle.selected.bg = moveOp ? "cyan" : undefined;
					listStyle.selected.fg = moveOp ? "black" : undefined;
				} else {
					listStyle.selected.inverse = false;
					listStyle.selected.bold = false;
					listStyle.selected.bg = undefined;
					listStyle.selected.fg = undefined;
				}
			}
			const boxStyle = column.box.style as { border?: { fg?: string } };
			if (boxStyle.border) boxStyle.border.fg = columnBorderColor(columns.indexOf(column));
			syncColumnSelectionDisplay(column, active);
		};

		const getSelectedTaskId = (): string | undefined => {
			const column = columns[currentCol];
			if (!column) return undefined;
			const selectedIndex = column.list.selected ?? 0;
			return column.tasks[selectedIndex]?.id;
		};

		const focusColumn = (idx: number, preferredRow?: number, activate = true) => {
			if (popupOpen || modalOpen) return;
			if (idx < 0 || idx >= columns.length) return;
			const previous = columns[currentCol];
			setColumnActiveState(previous, false);

			currentCol = idx;
			const current = columns[currentCol];
			if (!current) return;

			const total = current.tasks.length;
			if (total > 0) {
				const previousSelected = typeof previous?.list.selected === "number" ? previous.list.selected : 0;
				const target = preferredRow !== undefined ? preferredRow : Math.min(previousSelected, total - 1);
				selectColumnRow(current, target, activate);
			}

			if (activate) {
				current.list.focus();
				setColumnActiveState(current, true);
				currentFocus = "board";
			} else {
				setColumnActiveState(current, false);
			}
			screen.render();
		};

		const restoreSelection = (taskId?: string) => {
			const activate = currentFocus !== "filters";
			if (columns.length === 0) return;
			if (taskId) {
				for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
					const column = columns[colIdx];
					if (!column) continue;
					const taskIndex = column.tasks.findIndex((task) => task.id === taskId);
					if (taskIndex !== -1) {
						focusColumn(colIdx, taskIndex, activate);
						return;
					}
				}
			}
			const safeIndex = Math.min(columns.length - 1, Math.max(0, currentCol));
			focusColumn(safeIndex, undefined, activate);
		};

		const applyColumnData = (data: ColumnData[], selectedTaskId?: string) => {
			currentColumnsData = data;
			data.forEach((columnData, idx) => {
				const column = columns[idx];
				if (!column) return;
				column.status = columnData.status;
				column.tasks = columnData.tasks;
				const renderedItems = getFormattedItems(columnData.tasks, data.length);
				column.richItems = renderedItems.rich;
				column.plainItems = renderedItems.plain;
				column.highlightedIndex = undefined;
				column.list.setItems(renderedItems.rich);
				column.box.setLabel?.(formatColumnLabel(columnData.status, columnData.tasks.length));
			});
			restoreSelection(selectedTaskId);
		};

		const rebuildColumns = (data: ColumnData[], selectedTaskId?: string) => {
			currentColumnsData = data;
			createColumnViews(data);
			restoreSelection(selectedTaskId);
		};

		// Pure function to calculate the projected board state
		const getProjectedColumns = (allTasks: Task[], operation: MoveOperation | null): ColumnData[] => {
			if (!operation) {
				return prepareBoardColumns(allTasks, currentStatuses);
			}

			const movingTask = allTasks.find((t) => t.id === operation.taskId);
			if (!movingTask) {
				return prepareBoardColumns(allTasks, currentStatuses);
			}

			// 1. Lift the previewed tasks out of their columns, keeping board display order
			//    so a collapsed set lands as one block in the order it appears on the board.
			const movingIds = new Set(getPreviewMovingIds(operation));
			const blockTasks: Task[] = [];
			for (const column of prepareBoardColumns(allTasks, currentStatuses)) {
				for (const task of column.tasks) {
					if (movingIds.has(task.id)) blockTasks.push(task);
				}
			}

			// 2. Prepare columns without the moving tasks
			const columns = prepareBoardColumns(
				allTasks.filter((t) => !movingIds.has(t.id)),
				currentStatuses,
			);

			// 3. Insert the moving block into the target column at the target index
			const targetColumn = columns.find((c) => c.status === operation.targetStatus);
			if (targetColumn) {
				// Create "ghost" tasks with updated status
				const ghostTasks = blockTasks.map((task) => ({ ...task, status: operation.targetStatus }));

				// Clamp index to valid bounds
				const safeIndex = Math.max(0, Math.min(operation.targetIndex, targetColumn.tasks.length));
				targetColumn.tasks.splice(safeIndex, 0, ...ghostTasks);
			}

			return columns;
		};

		const focusFilterControl = (filterId: "search" | "priority" | "milestone" | "labels") => {
			if (!filterHeader) return;
			switch (filterId) {
				case "search":
					filterHeader.focusSearch();
					break;
				case "priority":
					filterHeader.focusPriority();
					break;
				case "milestone":
					filterHeader.focusMilestone();
					break;
				case "labels":
					filterHeader.focusLabels();
					break;
			}
		};

		const openFilterPicker = async (filterId: "priority" | "milestone" | "labels") => {
			if (filterPopupOpen || modalOpen || moveOp || !filterHeader) {
				return;
			}
			filterPopupOpen = true;
			try {
				if (filterId === "labels") {
					const nextLabels = await openMultiSelectFilterPopup({
						screen,
						title: "Label Filter",
						items: [...configuredLabels].sort((a, b) => a.localeCompare(b)),
						selectedItems: sharedFilters.labelFilter,
					});
					if (nextLabels !== null) {
						sharedFilters.labelFilter = nextLabels;
						sharedFilters.labelMatch = "any";
						filterHeader.setFilters({ labels: nextLabels });
						emitFilterChange();
						renderView();
					}
					return;
				}

				if (filterId === "priority") {
					const priorities = ["high", "medium", "low"];
					const selected = await openSingleSelectFilterPopup({
						screen,
						title: "Priority Filter",
						selectedValue: sharedFilters.priorityFilter,
						choices: [
							{ label: "All", value: "" },
							...priorities.map((priority) => ({ label: priority, value: priority })),
						],
					});
					if (selected !== null) {
						sharedFilters.priorityFilter = selected;
						filterHeader.setFilters({ priority: selected });
						emitFilterChange();
						renderView();
					}
					return;
				}

				const selected = await openSingleSelectFilterPopup({
					screen,
					title: "Milestone Filter",
					selectedValue: sharedFilters.milestoneFilter,
					choices: [
						{ label: "All", value: "" },
						{ label: NO_MILESTONE_FILTER_LABEL, value: NO_MILESTONE_FILTER_VALUE },
						...availableMilestones.map((value) => ({ label: value, value })),
					],
				});
				if (selected !== null) {
					sharedFilters.milestoneFilter = selected;
					filterHeader.setFilters({ milestone: selected });
					emitFilterChange();
					renderView();
				}
			} finally {
				filterPopupOpen = false;
				focusFilterControl(filterId);
				screen.render();
			}
		};

		filterHeader = createFilterHeader({
			parent: container,
			statuses: [],
			availableLabels: configuredLabels,
			availableMilestones,
			visibleFilters: options?.visibleFilters ?? ["search", "priority", "milestone", "labels"],
			summary: embed?.taskSummary ? taskSummaryText(getFilteredTasks().length) : undefined,
			initialFilters: {
				search: sharedFilters.searchQuery,
				priority: sharedFilters.priorityFilter,
				labels: sharedFilters.labelFilter,
				milestone: sharedFilters.milestoneFilter,
			},
			onFilterChange: (filters: FilterState) => {
				const labelsChanged = !areLabelSelectionsEqual(sharedFilters.labelFilter, filters.labels);
				sharedFilters.searchQuery = filters.search;
				sharedFilters.priorityFilter = filters.priority;
				sharedFilters.labelFilter = filters.labels;
				if (labelsChanged) {
					sharedFilters.labelMatch = "any";
				}
				sharedFilters.milestoneFilter = filters.milestone;
				emitFilterChange();
				renderView();
			},
			onFilterPickerOpen: (filterId) => {
				if (filterId === "status") {
					return;
				}
				void openFilterPicker(filterId);
			},
		});
		filterHeader.setFocusChangeHandler((focus) => {
			if (focus !== null) {
				currentFocus = "filters";
				setColumnActiveState(columns[currentCol], false);
				updateFooter();
				screen.render();
			}
		});
		filterHeader.setExitRequestHandler((direction) => {
			const currentColumn = columns[currentCol];
			const selected = currentColumn?.list.selected;
			const currentIndex = typeof selected === "number" ? selected : undefined;
			const totalTasks = currentColumn?.tasks.length ?? 0;
			const targetIndex = resolveSearchExitTargetIndex(direction, pendingSearchWrap, totalTasks, currentIndex);
			pendingSearchWrap = null;
			focusColumn(currentCol, targetIndex);
			updateFooter();
		});
		// An embedding host renders its own sidebar. The board reserves that column, keeps it
		// aligned with the board's own chrome (below the header, above the footer) and insets
		// the columns by it, so the host never has to know the board's header height.
		const sidebarWidth = embed?.sidePane?.width ?? null;
		const sidebarPercent = sidebarWidth ? Number.parseFloat(sidebarWidth) : Number.NaN;
		const sidebarLayout = sidebarWidth && Number.isFinite(sidebarPercent) ? sidebarWidth : null;
		const sideBox = sidebarLayout
			? box({
					parent: container,
					top: 0,
					left: 0,
					width: sidebarLayout,
					height: "100%",
				})
			: null;
		if (sideBox) {
			embed?.sidePane?.render(sideBox);
		}
		const boardAreaLeft = sidebarLayout ?? 0;
		const boardAreaWidth = sidebarLayout ? `${Math.max(0, 100 - sidebarPercent)}%` : "100%";

		const syncBoardAreaLayout = () => {
			const headerHeight = filterHeader?.getHeight() ?? 0;
			const chromeHeight = headerHeight + getFooterHeight();
			areaFrame.top = headerHeight;
			areaFrame.height = `100%-${chromeHeight}`;
			areaFrame.left = boardAreaLeft;
			areaFrame.width = boardAreaWidth;
			if (sideBox) {
				sideBox.top = headerHeight;
				sideBox.height = `100%-${chromeHeight}`;
			}
		};
		syncBoardAreaLayout();

		/**
		 * The frame around the columns carries the board's own chrome: its title and the focus
		 * colour. Both are re-derived whenever the chrome is refreshed, so only the pane that
		 * holds the keyboard is highlighted and the title follows whatever the host scopes to.
		 */
		let areaLabelText = "";
		const syncAreaFrameStyle = () => {
			const style = areaFrame.style as { border?: { fg?: string } };
			if (style.border) style.border.fg = isScopeActive() ? "yellow" : "gray";
			const label = embed?.areaLabel?.();
			if (label !== undefined && label !== areaLabelText) {
				areaLabelText = label;
				areaFrame.setLabel?.(` ${label} `);
			}
		};

		const updateFooter = () => {
			syncAreaFrameStyle();
			syncColumnFocusStyle();
			if (transientFooterContent) {
				setFooterContent(transientFooterContent);
				syncBoardAreaLayout();
				return;
			}
			const hostHint = embed?.footerHint?.();
			if (hostHint) {
				setFooterContent(hostHint);
				syncBoardAreaLayout();
				return;
			}
			if (currentFocus === "filters") {
				const filterFocus = filterHeader?.getCurrentFocus();
				if (filterFocus === "search") {
					setFooterContent(
						" {cyan-fg}[←/→]{/} Cursor (edge=Prev/Next) | {cyan-fg}[↑/↓]{/} Back to Board | {cyan-fg}[Esc]{/} Cancel | {gray-fg}(Live search){/}",
					);
					syncBoardAreaLayout();
					return;
				}
				setFooterContent(
					" {cyan-fg}[Enter/Space]{/} Open Picker | {cyan-fg}[←/→]{/} Prev/Next | {cyan-fg}[Esc]{/} Back",
				);
				syncBoardAreaLayout();
				return;
			}
			if (moveOp) {
				setFooterContent(
					" {green-fg}MOVE MODE{/} | {cyan-fg}[←→]{/} Change Column | {cyan-fg}[↑↓]{/} Reorder | {cyan-fg}[Shift+↑↓]{/} Highlight | {cyan-fg}[Shift+M]{/} Select | {cyan-fg}[Enter]{/} Confirm | {cyan-fg}[Esc]{/} Cancel",
				);
			} else {
				const base = BOARD_FOOTER_CONTENT;
				setFooterContent(hasActiveSharedFilters() ? `${base} | {yellow-fg}Filtered{/}` : base);
			}
			syncBoardAreaLayout();
		};

		const showTransientFooter = (message: string, durationMs = 3000) => {
			transientFooterContent = message;
			clearFooterTimer();
			updateFooter();
			screen.render();
			footerRestoreTimer = setTimeout(() => {
				transientFooterContent = null;
				footerRestoreTimer = null;
				updateFooter();
				screen.render();
			}, durationMs);
		};

		/**
		 * Tear the board down, optionally handing off to another view before resolving.
		 * First request wins: while a pending write delays the close, further exit actions
		 * (e.g. Tab then q) join the same closing promise instead of running a second
		 * teardown or replacing the first request's handoff.
		 */
		let closingBoard: Promise<void> | null = null;
		const closeBoard = (beforeResolve?: () => Promise<unknown>): Promise<void> => {
			closingBoard ??= (async () => {
				// A Shift+H write can still be in flight, and the caller may exit the process
				// as soon as the board resolves, which would drop the setting.
				if (pendingSettingWrite) await pendingSettingWrite;
				// Same for a confirmed move: quitting right after Enter must not let the
				// process exit before the write the user confirmed has persisted.
				if (pendingMoveWrite) await pendingMoveWrite;
				clearFooterTimer();
				screen.destroy();
				await beforeResolve?.();
				resolve();
			})();
			return closingBoard;
		};

		const renderView = (preferredTaskId?: string) => {
			const filteredTasks = getFilteredTasks();
			const projectedData = getProjectedColumns(filteredTasks, moveOp);

			// If we are moving, we want to select the recruitment highlight when it is
			// active, and the moving task's ghost otherwise
			const selectedId = preferredTaskId ?? (moveOp ? (moveOp.highlightTaskId ?? moveOp.taskId) : getSelectedTaskId());

			// Track every projected status, not only the rendered ones, so hiding empty
			// columns cannot narrow the move targets or the next projection.
			if (projectedData.length > 0) {
				currentStatuses = projectedData.map((column) => column.status);
			}
			const dataForColumns = filterVisibleColumns(projectedData, hideEmptyColumns, Boolean(moveOp));

			if (dataForColumns.length === 0) {
				const fallbackStatus = currentStatuses[0] ?? "No Status";
				rebuildColumns([{ status: fallbackStatus, tasks: [] }], selectedId);
			} else if (shouldRebuildColumns(currentColumnsData, dataForColumns)) {
				rebuildColumns(dataForColumns, selectedId);
			} else {
				applyColumnData(dataForColumns, selectedId);
			}

			if (embed?.taskSummary) {
				filterHeader?.setSummary(taskSummaryText(filteredTasks.length));
			}
			embed?.onVisibleTasks?.(filteredTasks);
			updateFooter();
			screen.render();
		};

		renderView();
		const firstColumn = columns[0];
		if (firstColumn) {
			currentCol = 0;
			if (firstColumn.tasks.length > 0) {
				selectColumnRow(firstColumn, 0, true);
			}
			setColumnActiveState(firstColumn, true);
			firstColumn.list.focus();
		}

		embed?.onReady?.({
			focusBoard: () => {
				focusColumn(currentCol);
				updateFooter();
				screen.render();
			},
			focusFilters: () => {
				pendingSearchWrap = null;
				focusFilterControl("search");
				updateFooter();
				screen.render();
			},
			syncChrome: () => {
				syncBoardAreaLayout();
				updateFooter();
				screen.render();
			},
		});

		const updateBoard = (nextTasks: Task[], nextStatuses: string[]) => {
			// While the task composer is open, defer board refreshes so the
			// composer's own rendering is not clobbered; the refresh is applied
			// once the composer closes.
			if (taskCreationOpen) {
				taskCreationPendingUpdate = true;
				return;
			}
			// Update source of truth
			currentTasks = nextTasks;
			// Only update statuses if they changed (rare in TUI)
			if (nextStatuses.length > 0) {
				currentStatuses = nextStatuses;
				configuredWorkflowStatuses = [...nextStatuses];
			}
			configuredLabels = collectAvailableLabels(currentTasks, options?.availableLabels ?? []);
			availableMilestones = Array.from(
				new Set([
					...(options?.availableMilestones ?? []),
					...currentTasks
						.map((task) => task.milestone?.trim())
						.filter((milestone): milestone is string => Boolean(milestone && milestone.length > 0))
						.map((milestone) => resolveMilestoneLabel(milestone)),
				]),
			).sort((a, b) => a.localeCompare(b));

			renderView();
		};

		options?.subscribeUpdates?.(updateBoard);

		screen.on("resize", () => {
			filterHeader?.rebuild();
			syncBoardAreaLayout();
			renderView();
		});

		// Helper to get target column size (excluding the moving task if it's currently there)
		const getTargetColumnSize = (status: string): number => {
			const columnData = currentColumnsData.find((c) => c.status === status);
			if (!columnData) return 0;
			// If the moving task is currently in this column, we need to account for it
			if (moveOp && moveOp.targetStatus === status) {
				// The task is already "in" this column in the projected view
				return columnData.tasks.length;
			}
			// Otherwise, the task will be added to this column
			return columnData.tasks.length;
		};

		screen.key(["n", "N", "S-n"], async () => {
			if (!keysActive() || moveOp) return;
			taskCreationOpen = true;
			let task: Task | null = null;
			let creationError: unknown;
			let hadPendingUpdate = false;
			try {
				task = await runWithModalGuard(() =>
					(options?.taskComposer ?? openTaskComposer)({
						screen,
						statuses: configuredWorkflowStatuses,
						priorities: options?.priorities,
						persist: async (input) => {
							if (options?.createTask) return options.createTask(input);
							const core = await getCore();
							const config = await core.fs.loadConfig();
							return (await core.createTaskFromInput(input, config?.autoCommit ?? false)).task;
						},
					}),
				);
			} catch (error) {
				creationError = error;
			} finally {
				taskCreationOpen = false;
				hadPendingUpdate = taskCreationPendingUpdate;
				taskCreationPendingUpdate = false;
			}

			if (creationError) {
				const message = creationError instanceof Error ? creationError.message : "Unknown error";
				showTransientFooter(` {red-fg}Error opening task composer: ${message}{/}`, 3000);
				if (hadPendingUpdate) renderView();
				else screen.render();
				return;
			}
			if (!task) {
				if (hadPendingUpdate) renderView();
				else focusColumn(currentCol);
				return;
			}

			const draft = task.status.trim().toLowerCase() === "draft";
			if (!draft) currentTasks = upsertBoardTask(currentTasks, task);
			const visible = !draft && getFilteredTasks().some((candidate) => candidate.id === task.id);
			const outcome = getCreatedTaskBoardOutcome(task, visible);
			showTransientFooter(` {${outcome.tone}-fg}${outcome.message}{/}`, 6000);
			renderView(outcome.focusTaskId);
		});

		screen.key(["/", "C-f"], () => {
			if (!keysActive() || moveOp) return;
			pendingSearchWrap = null;
			focusFilterControl("search");
			updateFooter();
		});

		screen.key(["p", "P"], () => {
			if (!keysActive() || moveOp) return;
			void openFilterPicker("priority");
		});

		screen.key(["f", "F"], () => {
			if (!keysActive() || moveOp) return;
			void openFilterPicker("labels");
		});

		screen.key(["i", "I"], () => {
			if (!keysActive() || moveOp) return;
			void openFilterPicker("milestone");
		});

		screen.key(["left", "h"], () => {
			if (!keysActive()) return;
			if (moveOp) {
				if (movePending) return;
				if (collapseHighlight()) return;
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex > 0) {
					const prevStatus = currentStatuses[currentStatusIndex - 1];
					if (prevStatus) {
						const prevColumnSize = getTargetColumnSize(prevStatus);
						moveOp.targetStatus = prevStatus;
						// Clamp index to valid range for new column (0 to size, where size means append at end)
						moveOp.targetIndex = Math.min(moveOp.targetIndex, prevColumnSize);
						renderView();
					}
				}
			} else if (embed && currentCol === 0) {
				// The first column's left edge is the board's boundary: the host pane rendered
				// to the left takes the keyboard back.
				embed.onExitLeft?.();
			} else {
				focusColumn(currentCol - 1);
			}
		});

		screen.key(["right", "l"], () => {
			if (!keysActive()) return;
			if (moveOp) {
				if (movePending) return;
				if (collapseHighlight()) return;
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex < currentStatuses.length - 1) {
					const nextStatus = currentStatuses[currentStatusIndex + 1];
					if (nextStatus) {
						const nextColumnSize = getTargetColumnSize(nextStatus);
						moveOp.targetStatus = nextStatus;
						// Clamp index to valid range for new column
						moveOp.targetIndex = Math.min(moveOp.targetIndex, nextColumnSize);
						renderView();
					}
				}
			} else {
				focusColumn(currentCol + 1);
			}
		});

		const moveBoardSelection = (direction: "up" | "down", key: BoundaryNavigationKey) => {
			if (!keysActive()) return;

			const column = columns[currentCol];
			if (moveOp) {
				if (movePending) return;
				if (collapseHighlight()) return;
				if (direction === "up") {
					if (moveOp.targetIndex > 0) {
						moveOp.targetIndex--;
						renderView();
					}
					return;
				}
				// We need to check the projected length to know if we can move down
				// The current rendered column has the correct length including the ghost block
				if (column && moveOp.targetIndex < column.tasks.length - getPreviewMovingIds(moveOp).length) {
					moveOp.targetIndex++;
					renderView();
				}
				return;
			}

			if (!column) return;
			const selected = column.list.selected ?? 0;
			const total = column.tasks.length;
			const navigation = resolveListBoundaryNavigation(direction, selected, total, key);
			if (navigation === "stay") return;
			if (navigation === "search") {
				if (total === 0) {
					// An empty column has no row to return to, so leaving search selects nothing.
					pendingSearchWrap = null;
				} else {
					pendingSearchWrap = direction === "up" ? "to-last" : "to-first";
				}
				focusFilterControl("search");
				updateFooter();
				screen.render();
				return;
			}
			selectColumnRow(column, direction === "up" ? selected - 1 : selected + 1, true);
			screen.render();
		};

		screen.key(["up"], () => moveBoardSelection("up", "arrow"));
		screen.key(["k"], () => moveBoardSelection("up", "vim"));
		screen.key(["down"], () => moveBoardSelection("down", "arrow"));
		screen.key(["j"], () => moveBoardSelection("down", "vim"));

		const openTaskEditor = async (task: Task) => {
			try {
				const core = await getCore();
				const result = await core.editTaskInTui(task.id, screen, task);
				if (result.reason === "read_only") {
					const branchInfo = result.task?.branch ? ` from branch "${result.task.branch}"` : "";
					showTransientFooter(` {red-fg}Cannot edit task${branchInfo}.{/}`);
					return;
				}
				if (result.reason === "editor_failed") {
					showTransientFooter(" {red-fg}Editor exited with an error; task was not modified.{/}");
					return;
				}
				if (result.reason === "not_found") {
					showTransientFooter(` {red-fg}Task ${task.id} not found on this branch.{/}`);
					return;
				}

				if (result.task) {
					currentTasks = currentTasks.map((existingTask) =>
						existingTask.id === task.id ? result.task || existingTask : existingTask,
					);
				}

				if (result.changed) {
					renderView();
					showTransientFooter(` {green-fg}Task ${result.task?.id ?? task.id} marked modified.{/}`);
					return;
				}

				renderView();
				showTransientFooter(` {gray-fg}No changes detected for ${result.task?.id ?? task.id}.{/}`);
			} catch (_error) {
				showTransientFooter(" {red-fg}Failed to open editor.{/}");
			}
		};

		screen.key(["enter"], async () => {
			if (!keysActive()) return;

			// In move mode, Enter confirms the move
			if (moveOp) {
				await performTaskMove();
				return;
			}

			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
			if (!task) return;
			popupOpen = true;

			const popup = await createTaskPopup(screen, task, resolveMilestoneLabel);
			if (!popup) {
				popupOpen = false;
				return;
			}

			const { contentArea, close } = popup;
			contentArea.key(["escape", "q"], () => {
				popupOpen = false;
				close();
				focusColumn(currentCol);
			});

			contentArea.key(["e", "E", "S-e"], async () => {
				await openTaskEditor(task);
			});

			contentArea.key(["y", "Y"], async () => {
				const success = await copyToClipboard(task.id);
				if (success) {
					showTransientFooter(` {green-fg}Copied ${task.id} to clipboard{/}`);
				} else {
					showTransientFooter(" {red-fg}Failed to copy to clipboard{/}");
				}
			});

			contentArea.key(["c", "C"], async () => {
				if (task.branch) {
					showTransientFooter(` {red-fg}Cannot complete task from branch "${task.branch}".{/}`);
					return;
				}

				const confirmed = await runWithModalGuard(() =>
					openConfirmPopup({
						screen,
						title: "Complete Task",
						message: `Mark task {bold}${task.id}{/bold} as completed?\n{gray-fg}${task.title}{/}`,
					}),
				);

				if (confirmed) {
					try {
						const core = await getCore();
						const config = await core.fs.loadConfig();
						const success = await core.completeTask(task.id, config?.autoCommit ?? false);

						if (success) {
							currentTasks = currentTasks.filter((t) => t.id !== task.id);
							showTransientFooter(` {green-fg}Completed ${task.id}{/}`);
							close();
							popupOpen = false;
							renderView();
						} else {
							showTransientFooter(` {red-fg}Failed to complete ${task.id}{/}`);
						}
					} catch (error) {
						showTransientFooter(
							` {red-fg}Error completing task: ${error instanceof Error ? error.message : "Unknown error"}{/}`,
						);
					}
				}
			});

			contentArea.key(["a", "A"], async () => {
				if (task.branch) {
					showTransientFooter(` {red-fg}Cannot archive task from branch "${task.branch}".{/}`);
					return;
				}

				const confirmed = await runWithModalGuard(() =>
					openConfirmPopup({
						screen,
						title: "Archive Task",
						message: `Archive task {bold}${task.id}{/bold}?\n{gray-fg}${task.title}{/}`,
					}),
				);

				if (confirmed) {
					try {
						const core = await getCore();
						const config = await core.fs.loadConfig();
						let cleanedTaskIds: string[] = [];
						const success = await core.archiveTask(task.id, config?.autoCommit ?? false, {
							onVacatedIdCleanup: (ids) => {
								cleanedTaskIds = ids;
							},
						});

						if (success) {
							currentTasks = currentTasks.filter((t) => t.id !== task.id);
							let footer = ` {green-fg}Archived ${task.id}{/}`;
							if (cleanedTaskIds.length > 0) {
								footer += ` {gray-fg}Removed references from ${cleanedTaskIds.join(", ")}{/}`;
							}
							showTransientFooter(footer);
							close();
							popupOpen = false;
							renderView();
						} else {
							showTransientFooter(` {red-fg}Failed to archive ${task.id}{/}`);
						}
					} catch (error) {
						showTransientFooter(
							` {red-fg}Error archiving task: ${error instanceof Error ? error.message : "Unknown error"}{/}`,
						);
					}
				}
			});

			screen.render();
		});

		screen.key(["e", "E", "S-e"], async () => {
			if (!keysActive()) return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
			if (!task) return;
			await openTaskEditor(task);
		});

		// A second Enter while the confirm is writing must not start a second move.
		let movePending = false;
		// The confirmed write in flight; closeBoard awaits it (like pendingSettingWrite)
		// because the caller may process.exit as soon as the board resolves.
		let pendingMoveWrite: Promise<void> | null = null;
		/** Mark a confirm write as in flight; the returned settle runs in its finally. */
		const beginMoveWrite = (): (() => void) => {
			movePending = true;
			let settle: () => void = () => {};
			pendingMoveWrite = new Promise<void>((resolvePendingWrite) => {
				settle = resolvePendingWrite;
			});
			return settle;
		};

		/** Confirm a move with recruited tasks: the whole set lands as one block at the preview position. */
		const performSetMove = async () => {
			if (!moveOp || movePending) return;
			const operation = moveOp;

			// Snapshot the confirmed placement synchronously, before any await: a watcher
			// update replacing currentTasks while the write is being prepared must affect
			// the board, never the batch the user confirmed.
			const projectedData = getProjectedColumns(currentTasks, operation);
			const targetColumn = projectedData.find((c) => c.status === operation.targetStatus);

			if (!targetColumn) {
				moveOp = null;
				renderView();
				return;
			}

			const orderedTaskIds = targetColumn.tasks.map((task) => task.id);
			const taskIds = getMoveSetIds(operation);
			const targetStatus = operation.targetStatus;

			// No-op guard: the set already sits exactly where the preview lands it.
			const realColumn = prepareBoardColumns(currentTasks, currentStatuses).find(
				(c) => c.status === operation.targetStatus,
			);
			const realIds = (realColumn?.tasks ?? []).map((task) => task.id);
			if (realIds.length === orderedTaskIds.length && realIds.every((id, index) => id === orderedTaskIds[index])) {
				moveOp = null;
				renderView();
				return;
			}

			const settleMoveWrite = beginMoveWrite();
			try {
				const core = await getCore();
				const config = await core.fs.loadConfig();

				const { movedTasks, changedTasks, failures } = await core.moveTasksToStatus({
					taskIds,
					targetStatus,
					orderedTaskIds,
					autoCommit: config?.autoCommit ?? false,
				});

				// Update local state with all moved and changed tasks (includes ordinal updates)
				const changedTasksMap = new Map(changedTasks.map((t) => [t.id, t]));
				for (const task of movedTasks) changedTasksMap.set(task.id, task);
				currentTasks = currentTasks.map((t) => changedTasksMap.get(t.id) ?? t);

				moveOp = null;
				renderView();

				if (failures.length > 0) {
					const details = failures.map((failure) => `${failure.taskId}: ${failure.reason}`).join("; ");
					showTransientFooter(` {red-fg}Could not move ${failures.length} of the selected tasks - ${details}{/}`, 6000);
				}
			} catch (error) {
				// On error, cancel the move and restore original positions
				if (process.env.DEBUG) {
					console.error("Move failed:", error);
				}
				moveOp = null;
				renderView();
			} finally {
				movePending = false;
				settleMoveWrite();
			}
		};

		const performTaskMove = async () => {
			if (!moveOp || movePending) return;

			// A confirm while the recruitment highlight is active first collapses it and
			// renders the block preview, so the user always sees the exact order that a
			// second confirm will persist - the projection is the single source of truth.
			if (moveOp.selectedIds.length > 0 && moveOp.highlightTaskId) {
				collapseHighlight();
				return;
			}

			if (moveOp.selectedIds.length > 0) {
				await performSetMove();
				return;
			}

			// Check if any actual change occurred
			const noChange = moveOp.targetStatus === moveOp.originalStatus && moveOp.targetIndex === moveOp.originalIndex;

			if (noChange) {
				// No change, just exit move mode
				moveOp = null;
				renderView();
				return;
			}

			// Snapshot the confirmed placement synchronously, before any await: a watcher
			// update replacing currentTasks while the write is being prepared must affect
			// the board, never the move the user confirmed.
			const projectedData = getProjectedColumns(currentTasks, moveOp);
			const targetColumn = projectedData.find((c) => c.status === moveOp?.targetStatus);

			if (!targetColumn) {
				moveOp = null;
				renderView();
				return;
			}

			const orderedTaskIds = targetColumn.tasks.map((task) => task.id);
			const taskId = moveOp.taskId;
			const targetStatus = moveOp.targetStatus;

			const settleMoveWrite = beginMoveWrite();
			try {
				const core = await getCore();
				const config = await core.fs.loadConfig();

				// Persist the move using core API
				const { updatedTask, changedTasks } = await core.reorderTask({
					taskId,
					targetStatus,
					orderedTaskIds,
					autoCommit: config?.autoCommit ?? false,
				});
				// Update local state with all changed tasks (includes ordinal updates)
				const changedTasksMap = new Map(changedTasks.map((t) => [t.id, t]));
				changedTasksMap.set(updatedTask.id, updatedTask);
				currentTasks = currentTasks.map((t) => changedTasksMap.get(t.id) ?? t);

				// Exit move mode
				moveOp = null;

				// Render with updated local state
				renderView();
			} catch (error) {
				// On error, cancel the move and restore original position
				if (process.env.DEBUG) {
					console.error("Move failed:", error);
				}
				moveOp = null;
				renderView();
			} finally {
				movePending = false;
				settleMoveWrite();
			}
		};
		const cancelMove = () => {
			// Once the confirm write is in flight the move can no longer be called off, so a
			// late Escape must not make the board look canceled while the write still lands.
			if (!moveOp || movePending) return;

			// Exit move mode - pure state reset
			moveOp = null;

			renderView();
		};

		const enterMoveMode = () => {
			const hasMoveBlockingFilters = Boolean(
				sharedFilters.searchQuery.trim() ||
					sharedFilters.priorityFilter ||
					sharedFilters.labelFilter.length > 0 ||
					sharedFilters.milestoneFilter ||
					sharedFilters.limit !== undefined,
			);
			if (hasMoveBlockingFilters) {
				showTransientFooter(" {yellow-fg}Clear filters before moving tasks.{/}");
				return;
			}

			const column = columns[currentCol];
			if (!column) return;
			const taskIndex = column.list.selected ?? 0;
			const task = column.tasks[taskIndex];
			if (!task) return;

			// Prevent move mode for cross-branch tasks
			if (task.branch) {
				showTransientFooter(` {red-fg}Cannot move task from branch "${task.branch}".{/}`);
				return;
			}

			// Enter move mode - store original position for cancel
			moveOp = {
				taskId: task.id,
				originalStatus: column.status,
				originalIndex: taskIndex,
				targetStatus: column.status,
				targetIndex: taskIndex,
				selectedIds: [],
				highlightTaskId: null,
			};

			renderView();
		};

		/**
		 * Shift+Up/Down walk the recruitment highlight through the target column's tasks
		 * without moving the grabbed task. While the highlight is active, recruited tasks
		 * stay in their original places and the preview shows only the grabbed task's ghost.
		 */
		const walkRecruitHighlight = (direction: "up" | "down") => {
			if (!keysActive()) return;
			// The move set and target freeze once the confirm write is in flight.
			if (!moveOp || movePending) return;
			const operation = moveOp;

			// While the preview shows the collapsed block, the ghost index counts a column
			// without the whole set; re-anchor it against the recruitment view (recruits back
			// in place) before walking. Committed only if the walk actually highlights a task.
			const recruitIndex =
				!operation.highlightTaskId && operation.selectedIds.length > 0
					? mapInsertionIndex(
							getInsertionBase(operation.targetStatus, getMoveSetIds(operation)),
							getInsertionBase(operation.targetStatus, [operation.taskId]),
							operation.targetIndex,
						)
					: operation.targetIndex;

			// Recruitment-view rows of the target column: the column without the grabbed task,
			// with its ghost spliced back in at the target position.
			const rows = getInsertionBase(operation.targetStatus, [operation.taskId]);
			const ghostIndex = Math.max(0, Math.min(recruitIndex, rows.length));
			rows.splice(ghostIndex, 0, operation.taskId);

			const from = operation.highlightTaskId ? rows.indexOf(operation.highlightTaskId) : ghostIndex;
			const step = direction === "down" ? 1 : -1;
			let next = (from === -1 ? ghostIndex : from) + step;
			// The ghost row is the grabbed task itself; the highlight walks past it.
			while (rows[next] === operation.taskId) next += step;
			const nextId = rows[next];
			if (nextId === undefined) return;

			operation.highlightTaskId = nextId;
			operation.targetIndex = recruitIndex;
			renderView();
		};

		screen.key(["S-up"], () => walkRecruitHighlight("up"));
		screen.key(["S-down"], () => walkRecruitHighlight("down"));

		/**
		 * M toggles a task in or out of the move set. It acts on the recruitment highlight
		 * when one is active; without one (terminals where shift-arrows never arrive), it
		 * recruits the nearest unrecruited task below the grabbed row (above at the bottom
		 * of a column). The fallback skips tasks already in the set - the collapsed block
		 * keeps recruits adjacent to the grabbed task, so pointing at the nearest neighbor
		 * would only ever toggle the first recruit off - which keeps repeated M presses
		 * growing the set and the flow fully usable with plain arrows and M alone;
		 * un-recruiting needs the shift-arrow highlight or Esc.
		 */
		const toggleRecruitSelection = () => {
			// The move set and target freeze once the confirm write is in flight.
			if (!moveOp || movePending) return;
			const operation = moveOp;

			let candidateId: string | undefined;
			if (operation.highlightTaskId) {
				candidateId = operation.highlightTaskId;
			} else {
				const column = columns.find((candidate) => candidate.status === operation.targetStatus);
				const rows = column?.tasks ?? [];
				const grabbedRow = rows.findIndex((task) => task.id === operation.taskId);
				if (grabbedRow !== -1) {
					const recruited = new Set(operation.selectedIds);
					// Cross-branch tasks can never join the set, so the walk skips them the same
					// way it skips recruits - a read-only neighbor must not dead-end the fallback.
					const nearestRecruitable = (from: number, step: number): string | undefined => {
						for (let index = from; index >= 0 && index < rows.length; index += step) {
							const row = rows[index];
							if (row && row.id !== operation.taskId && !recruited.has(row.id) && !row.branch) return row.id;
						}
						return undefined;
					};
					candidateId = nearestRecruitable(grabbedRow + 1, 1) ?? nearestRecruitable(grabbedRow - 1, -1);
				}
			}
			const targetId = candidateId;
			if (!targetId || targetId === operation.taskId) {
				showTransientFooter(" {yellow-fg}No task to select here.{/}");
				return;
			}

			// Cross-branch tasks cannot move, so they cannot be recruited either
			const targetTask = currentTasks.find((task) => task.id === targetId);
			if (targetTask?.branch) {
				showTransientFooter(` {red-fg}Cannot move task from branch "${targetTask.branch}".{/}`);
				return;
			}

			updateMoveSelection(operation, () => {
				operation.selectedIds = operation.selectedIds.includes(targetId)
					? operation.selectedIds.filter((id) => id !== targetId)
					: [...operation.selectedIds, targetId];
			});
			renderView();
		};

		screen.key(["m"], async () => {
			if (!keysActive()) return;
			if (!moveOp) {
				enterMoveMode();
			} else {
				// Confirm move (same as Enter in move mode)
				await performTaskMove();
			}
		});

		screen.key(["M", "S-m"], () => {
			if (!keysActive()) return;
			if (!moveOp) {
				enterMoveMode();
			} else {
				toggleRecruitSelection();
			}
		});

		screen.key(["tab"], async () => {
			if (!keysActive()) return;
			const column = columns[currentCol];
			if (column) {
				const idx = column.list.selected ?? 0;
				if (idx >= 0 && idx < column.tasks.length) {
					const task = column.tasks[idx];
					if (task) options?.onTaskSelect?.(task);
				}
			}

			if (options?.onTabPress) {
				await closeBoard(options.onTabPress);
				return;
			}

			const viewSwitcher = options?.viewSwitcher;
			if (viewSwitcher) {
				await closeBoard(() => viewSwitcher.switchView());
			}
		});

		screen.key(["?"], async () => {
			if (!keysActive() || moveOp) return;
			await runWithModalGuard(() => openHelpPopup(screen));
		});

		screen.key(["y", "Y"], async () => {
			if (!keysActive()) return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			const task = column.tasks[idx];
			if (!task) return;

			const success = await copyToClipboard(task.id);
			if (success) {
				showTransientFooter(` {green-fg}Copied ${task.id} to clipboard{/}`);
			} else {
				showTransientFooter(" {red-fg}Failed to copy to clipboard{/}");
			}
		});

		screen.key(["c", "C"], async () => {
			if (!keysActive() || moveOp) return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			const task = column.tasks[idx];
			if (!task) return;

			if (task.branch) {
				showTransientFooter(` {red-fg}Cannot complete task from branch "${task.branch}".{/}`);
				return;
			}

			const confirmed = await runWithModalGuard(() =>
				openConfirmPopup({
					screen,
					title: "Complete Task",
					message: `Mark task {bold}${task.id}{/bold} as completed?\n{gray-fg}${task.title}{/}`,
				}),
			);

			if (confirmed) {
				try {
					const core = await getCore();
					const config = await core.fs.loadConfig();
					const success = await core.completeTask(task.id, config?.autoCommit ?? false);

					if (success) {
						currentTasks = currentTasks.filter((t) => t.id !== task.id);
						showTransientFooter(` {green-fg}Completed ${task.id}{/}`);
						renderView();
					} else {
						showTransientFooter(` {red-fg}Failed to complete ${task.id}{/}`);
					}
				} catch (error) {
					showTransientFooter(
						` {red-fg}Error completing task: ${error instanceof Error ? error.message : "Unknown error"}{/}`,
					);
				}
			}
		});

		screen.key(["a", "A"], async () => {
			if (!keysActive() || moveOp) return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			const task = column.tasks[idx];
			if (!task) return;

			if (task.branch) {
				showTransientFooter(` {red-fg}Cannot archive task from branch "${task.branch}".{/}`);
				return;
			}

			const confirmed = await runWithModalGuard(() =>
				openConfirmPopup({
					screen,
					title: "Archive Task",
					message: `Archive task {bold}${task.id}{/bold}?\n{gray-fg}${task.title}{/}`,
				}),
			);

			if (confirmed) {
				try {
					const core = await getCore();
					const config = await core.fs.loadConfig();
					let cleanedTaskIds: string[] = [];
					const success = await core.archiveTask(task.id, config?.autoCommit ?? false, {
						onVacatedIdCleanup: (ids) => {
							cleanedTaskIds = ids;
						},
					});

					if (success) {
						currentTasks = currentTasks.filter((t) => t.id !== task.id);
						let footer = ` {green-fg}Archived ${task.id}{/}`;
						if (cleanedTaskIds.length > 0) {
							footer += ` {gray-fg}Removed references from ${cleanedTaskIds.join(", ")}{/}`;
						}
						showTransientFooter(footer);
						renderView();
					} else {
						showTransientFooter(` {red-fg}Failed to archive ${task.id}{/}`);
					}
				} catch (error) {
					showTransientFooter(
						` {red-fg}Error archiving task: ${error instanceof Error ? error.message : "Unknown error"}{/}`,
					);
				}
			}
		});

		const toggleHideEmptyColumns = async () => {
			const previous = hideEmptyColumns;
			hideEmptyColumns = !hideEmptyColumns;
			renderView();

			try {
				const core = await getCore();
				const config = await core.fs.loadConfig();
				if (!config) {
					throw new Error("No config found");
				}
				await core.fs.saveConfig({ ...config, hideEmptyColumns });
			} catch (error) {
				hideEmptyColumns = previous;
				renderView();
				showTransientFooter(
					` {red-fg}Error saving hide empty columns setting: ${error instanceof Error ? error.message : "Unknown error"}{/}`,
				);
				return;
			}
			showTransientFooter(
				hideEmptyColumns ? " {green-fg}Hiding empty columns{/}" : " {green-fg}Showing empty columns{/}",
			);
		};

		// Shift+H writes the shared hideEmptyColumns setting, so the board, the browser
		// board and `backlog config` all read the same preference.
		screen.key(["S-h"], () => {
			if (!keysActive() || moveOp) return;
			// Ignore toggles while a write is in flight: overlapping load/save
			// cycles would write back stale config snapshots (lost updates).
			if (pendingSettingWrite) return;
			pendingSettingWrite = toggleHideEmptyColumns()
				// The toggle reports its own failures; this only keeps the exit path awaitable.
				.catch(() => {})
				.finally(() => {
					pendingSettingWrite = null;
				});
		});

		screen.key(["q", "C-c"], async () => {
			if (!keysActive()) return;
			// An embedding host owns teardown, and may want to close more than the board. A host
			// that supplies no quit hook leaves the board to close itself.
			if (embed?.onQuit) {
				embed.onQuit();
				return;
			}
			await closeBoard();
		});

		screen.key(["escape"], async () => {
			if (popupOpen || filterPopupOpen || modalOpen) return;
			if (currentFocus === "filters") {
				focusColumn(currentCol);
				updateFooter();
				return;
			}
			// The focus-header case returned above, so an inactive scope here means the host owns the keys.
			if (!isScopeActive()) return;
			// In move mode, ESC cancels and restores original position
			if (moveOp) {
				cancelMove();
				return;
			}

			if (embed?.onQuit) {
				embed.onQuit();
				return;
			}
			await closeBoard();
		});

		screen.render();
	});
}
