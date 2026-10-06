import { stdout as output } from "node:process";
import type { BoxInterface, ListInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import {
	adjustDependenciesForInsertBetween,
	canMoveToUnsequenced,
	computeSequences,
	planMoveToSequence,
	planMoveToUnsequenced,
} from "../core/sequences.ts";
import type { Core } from "../index.ts";
import type { Sequence, Task } from "../types/index.ts";
import { createTaskPopup } from "./task-viewer-with-search.ts";
import { createScreen, formatTuiTitle, releaseSharedProgram } from "./tui.ts";

/** A blessed list we drive ourselves: the items change as the cursor moves between groups. */
type MutableList = ListInterface & {
	setItems?: (items: string[]) => void;
	select?: (index: number) => void;
};

export type SequencesViewData = { unsequenced: Task[]; sequences: Sequence[] };

/**
 * One row of the left pane: the Unsequenced bucket first, then every sequence in order.
 * `tasks` is the pane's own copy, sorted the way the right pane shows it (ordinal first,
 * then id), so the two panes can never disagree about what the Nth row is.
 */
export type SequenceRow = {
	kind: "unsequenced" | "sequence";
	/** -1 for the Unsequenced bucket, otherwise the sequence index. */
	index: number;
	key: string;
	label: string;
	tasks: Task[];
};

export type MoveTarget =
	| { kind: "unsequenced" }
	| { kind: "sequence"; seqIndex: number }
	| { kind: "between"; k: number };

/** Ordinal-first ordering, falling back to id: the order the right pane has always used. */
function sortSequenceTasks(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => {
		const ao = a.ordinal ?? Number.MAX_SAFE_INTEGER;
		const bo = b.ordinal ?? Number.MAX_SAFE_INTEGER;
		if (ao !== bo) return ao - bo;
		return a.id.localeCompare(b.id);
	});
}

export function buildSequenceRows(data: SequencesViewData): SequenceRow[] {
	const rows: SequenceRow[] = [];
	if (data.unsequenced.length > 0) {
		rows.push({
			kind: "unsequenced",
			index: -1,
			key: "unsequenced",
			label: `Unsequenced (${data.unsequenced.length})`,
			tasks: sortSequenceTasks(data.unsequenced),
		});
	}
	for (const seq of data.sequences) {
		rows.push({
			kind: "sequence",
			index: seq.index,
			key: `sequence:${seq.index}`,
			label: `Sequence ${seq.index} (${seq.tasks.length})`,
			tasks: sortSequenceTasks(seq.tasks),
		});
	}
	return rows;
}

/**
 * The places a task can be dropped: the Unsequenced bucket when it exists, every sequence,
 * and the gap between two consecutive sequences. No gap above the first or below the last
 * sequence, because those are the same thing as dropping onto that sequence.
 */
export function buildMoveTargets(rows: SequenceRow[]): MoveTarget[] {
	const targets: MoveTarget[] = [];
	if (rows.some((row) => row.kind === "unsequenced")) targets.push({ kind: "unsequenced" });
	const sequences = rows.filter((row) => row.kind === "sequence");
	sequences.forEach((row, i) => {
		targets.push({ kind: "sequence", seqIndex: row.index });
		if (i < sequences.length - 1) targets.push({ kind: "between", k: row.index });
	});
	return targets;
}

export function moveTargetLabel(target: MoveTarget): string {
	if (target.kind === "unsequenced") return "Unsequenced";
	if (target.kind === "sequence") return `Sequence ${target.seqIndex}`;
	return `Between Sequence ${target.k} and ${target.k + 1}`;
}

function summarizeIds(ids: string[]): string {
	if (ids.length <= 3) return ids.join(", ");
	return `${ids.slice(0, 3).join(", ")}, +${ids.length - 3} more`;
}

/**
 * Spells out what Enter would write for the highlighted task and target.
 *
 * Moving is easy to misread: the drop targets look like "put it in this row", but a sequence
 * is only the transitive layer its dependencies put it in, so the move rewrites the dependency
 * list (join semantics: replaced, not appended) and says nothing about where the task sits
 * inside the layer. The right pane is idle while the left pane owns the keyboard, so the
 * preview lives there instead of in the footer.
 */
export function buildMovePreview(input: {
	allTasks: Task[];
	data: SequencesViewData;
	rows: SequenceRow[];
	task: Task | undefined;
	target: MoveTarget | undefined;
}): string[] {
	const { allTasks, data, rows, task, target } = input;
	if (!task || !target) return [" Pick a task and a target."];
	const from = rows.find((row) => row.tasks.some((entry) => entry.id === task.id))?.label ?? "unknown group";
	const lines = [`Moving: ${task.id}`, `From:   ${from}`, `To:     ${moveTargetLabel(target)}`, "", "Enter writes:"];

	if (target.kind === "unsequenced") {
		if (!canMoveToUnsequenced(allTasks, task.id)) {
			lines.push("- blocked: it still has dependencies or dependents");
			lines.push("- clear those first; nothing is written");
		} else {
			lines.push(`- ${task.id}.dependencies -> []`);
			lines.push(`- ${task.id}.ordinal -> cleared`);
		}
	} else if (target.kind === "sequence") {
		const prev = data.sequences.find((seq) => seq.index === target.seqIndex - 1);
		if (prev) {
			const ids = prev.tasks.map((entry) => entry.id).filter((id) => id !== task.id);
			lines.push(`- dependencies -> all ${ids.length} of Sequence ${target.seqIndex - 1}`);
			if (ids.length > 0) lines.push(`  (${summarizeIds(ids)})`);
		} else {
			lines.push("- dependencies -> []");
			if (target.seqIndex === 1) lines.push("- ordinal -> 0 when unset (anchor)");
		}
		lines.push("- replaced, not appended (join semantics)");
	} else {
		const prev = data.sequences.find((seq) => seq.index === target.k);
		const next = data.sequences.find((seq) => seq.index === target.k + 1);
		if (prev) {
			const ids = prev.tasks.map((entry) => entry.id).filter((id) => id !== task.id);
			lines.push(`- dependencies -> all ${ids.length} of Sequence ${target.k}`);
			if (ids.length > 0) lines.push(`  (${summarizeIds(ids)})`);
		} else {
			lines.push("- dependencies -> []");
		}
		if (next) lines.push(`- every Sequence ${target.k + 1} task depends on ${task.id}`);
		else if (target.k === 0) lines.push("- ordinal -> 0 when unset (anchor)");
		lines.push("- a new sequence is inserted above it");
	}

	lines.push("", "This sets the layer, not the order in it:", "rows inside a layer follow ordinal.");
	return lines;
}

function clamp(value: number, total: number): number {
	if (total <= 0) return 0;
	return Math.max(0, Math.min(total - 1, value));
}

/**
 * Render the sequences view.
 * - Interactive: a left pane listing the buckets and sequences, a right pane listing the
 *   tasks of the highlighted one, matching the shape the milestone list uses.
 * - Headless (no TTY, CI, or BACKLOG_HEADLESS=1): the plain text listing, unchanged.
 */
export async function runSequencesView(
	data: SequencesViewData,
	core?: Core,
	options?: { projectName?: string },
): Promise<void> {
	// Build content string first so we can also support headless environments (CI/tests)
	const lines: string[] = [];
	if (data.unsequenced.length > 0) {
		lines.push("Unsequenced:");
		for (const t of data.unsequenced) lines.push(`  ${t.id} - ${t.title}`);
		lines.push("");
	}
	for (const seq of data.sequences) {
		lines.push(`Sequence ${seq.index}:`);
		for (const t of seq.tasks) {
			lines.push(`  ${t.id} - ${t.title}`);
		}
		lines.push("");
	}

	// Headless/CI fallback: when not a TTY or explicitly requested, just print text content
	const forceHeadless = process.env.BACKLOG_HEADLESS === "1" || process.env.CI === "1" || process.env.CI === "true";
	if (output.isTTY === false || forceHeadless) {
		console.log(lines.join("\n"));
		return;
	}

	let rows = buildSequenceRows(data);
	let moveTargets = buildMoveTargets(rows);
	/** Snapshot taken when move mode opens, so the preview checks eligibility on the same tasks Enter will. */
	let moveAllTasks: Task[] = [];
	let groupIndex = 0;
	let taskIndex = 0;
	let targetPos = 0;
	/** The left pane owns the keyboard until the user tabs or arrows into the task list. */
	let focused: "groups" | "tasks" = "groups";
	let moveMode = false;
	let popupOpen = false;
	let hint: string | null = null;
	/**
	 * `refresh` moves a list's cursor with `select`, and blessed answers every cursor move with a
	 * "select item" event. Without this guard the listener would call `refresh` again, which
	 * selects again, and the two drive each other until the stack blows.
	 */
	let syncingSelection = false;

	// A terminal that does not report its size leaves blessed with one column, which collapses
	// every percentage below. Fall back to a readable size instead of drawing nothing.
	const stream = process.stdout as unknown as { columns?: number; rows?: number };
	if (!stream.columns || stream.columns < 20) stream.columns = 80;
	if (!stream.rows || stream.rows < 5) stream.rows = 24;

	await new Promise<void>((resolve) => {
		const screen = createScreen({
			title: formatTuiTitle("Sequences", options?.projectName),
			smartCSR: true,
		});
		let closed = false;
		const close = () => {
			if (closed) return;
			closed = true;
			// The screen shares blessed's process-wide program, and that program is what holds
			// stdin in raw mode: only releasing it puts the terminal back, so quitting does not
			// leave the shell hanging. Same teardown the other list viewers use.
			screen.leave();
			screen.destroy();
			releaseSharedProgram();
			resolve();
		};

		const groupsPane = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "38%",
			height: "100%-1",
			border: { type: "line" },
			tags: false,
			style: { border: { fg: "yellow" } },
		});
		const groupsList = list({
			parent: groupsPane,
			top: 0,
			left: 0,
			width: "100%-2",
			height: "100%-2",
			items: [],
			keys: false,
			mouse: true,
			scrollable: true,
			tags: false,
			invertSelected: true,
			style: { selected: { inverse: true, bold: true } },
		}) as MutableList;

		const tasksPane = box({
			parent: screen,
			top: 0,
			left: "38%",
			width: "62%",
			height: "100%-1",
			border: { type: "line" },
			tags: false,
			style: { border: { fg: "gray" } },
		});
		const tasksList = list({
			parent: tasksPane,
			top: 0,
			left: 0,
			width: "100%-2",
			height: "100%-2",
			items: [],
			keys: false,
			mouse: true,
			scrollable: true,
			tags: false,
			invertSelected: false,
			style: { selected: { inverse: false, bold: true } },
		}) as MutableList;

		const footer = box({
			parent: screen,
			bottom: 0,
			left: 0,
			right: 0,
			height: 1,
			tags: false,
			style: { bg: "black", fg: "gray" },
		});

		const setListStyle = (target: MutableList, focusedStyle: boolean) => {
			const style = target.style as { selected?: { inverse?: boolean; bold?: boolean } } | undefined;
			if (style?.selected) {
				style.selected.inverse = focusedStyle;
				style.selected.bold = true;
			}
			const listOptions = target.options as { invertSelected?: boolean } | undefined;
			if (listOptions) listOptions.invertSelected = focusedStyle;
		};

		const setPaneFocus = (pane: BoxInterface, isFocused: boolean) => {
			const style = pane.style as { border?: { fg?: string } } | undefined;
			if (style?.border) style.border.fg = isFocused ? "yellow" : "gray";
		};

		function footerText(): string {
			if (hint) return ` ${hint} `;
			if (moveMode) {
				const target = moveTargets[targetPos];
				const suffix = target ? ` · Target: ${moveTargetLabel(target)}` : "";
				return ` Move mode: ↑/↓ target · Enter apply · Esc cancel${suffix} `;
			}
			const focusHint = focused === "groups" ? "→/Tab tasks" : "←/Tab sequences";
			return ` ↑/↓ navigate · ${focusHint} · Enter open · m move · q quit `;
		}

		function refresh() {
			syncingSelection = true;
			try {
				const row = rows[groupIndex];
				const tasks = row?.tasks ?? [];
				taskIndex = clamp(taskIndex, tasks.length);

				if (moveMode) {
					groupsPane.setLabel?.(" Move target ");
					groupsList.setItems?.(padToPaneHeight(moveTargets.map((target) => ` ${moveTargetLabel(target)}`)));
					groupsList.select?.(clamp(targetPos, moveTargets.length));
					// The right pane is idle while the left one owns the keyboard, so it carries
					// the preview of what Enter would write instead of a list nobody can reach.
					const preview = buildMovePreview({
						allTasks: moveAllTasks,
						data,
						rows,
						task: rows[groupIndex]?.tasks[taskIndex],
						target: moveTargets[targetPos],
					});
					tasksPane.setLabel?.(" What this move writes ");
					tasksList.setItems?.(padToPaneHeight(preview.map((line) => ` ${line}`)));
					tasksList.select?.(0);
				} else {
					const sequenceCount = rows.filter((entry) => entry.kind === "sequence").length;
					groupsPane.setLabel?.(` Sequences (${sequenceCount}) `);
					groupsList.setItems?.(padToPaneHeight(rows.map((entry) => ` ${entry.label}`)));
					groupsList.select?.(clamp(groupIndex, rows.length));
					tasksPane.setLabel?.(` ${row ? row.label : "No groups"} `);
					tasksList.setItems?.(padToPaneHeight(tasks.map((task) => ` ${task.id} - ${task.title}`)));
					tasksList.select?.(taskIndex);
				}

				// Move mode always drives the left pane; otherwise focus decides which pane is lit.
				const groupsFocused = moveMode || focused === "groups";
				setListStyle(groupsList, groupsFocused);
				setListStyle(tasksList, !moveMode && focused === "tasks");
				setPaneFocus(groupsPane, groupsFocused);
				setPaneFocus(tasksPane, !moveMode && focused === "tasks");

				footer.setContent(footerText());
				screen.render();
			} finally {
				syncingSelection = false;
			}
		}

		/**
		 * A list that shrinks leaves its old rows behind: blessed redraws the rows it has and
		 * never touches the ones below, so switching from a long group to a short one would
		 * keep the tail of the previous group on screen. Padding the items up to the pane's
		 * full height makes the list paint those rows as blanks instead.
		 */
		function padToPaneHeight(items: string[]): string[] {
			const screenHeight = typeof screen.height === "number" ? screen.height : 24;
			// One line for the footer, two for the pane's own border.
			const bodyHeight = Math.max(1, screenHeight - 3);
			if (items.length >= bodyHeight) return items;
			return [...items, ...Array(bodyHeight - items.length).fill(" ")];
		}

		/** Keep a broken key handler from taking the whole session down: show it in the footer. */
		function safe(handler: () => void | Promise<void>) {
			return () => {
				try {
					void Promise.resolve(handler()).catch((error: unknown) => {
						hint = error instanceof Error ? error.message : String(error);
						refresh();
					});
				} catch (error) {
					hint = error instanceof Error ? error.message : String(error);
					refresh();
				}
			};
		}

		function move(delta: number) {
			if (popupOpen) return;
			if (moveMode) {
				targetPos = clamp(targetPos + delta, moveTargets.length);
				refresh();
				return;
			}
			if (focused === "groups") {
				const nextIndex = clamp(groupIndex + delta, rows.length);
				if (nextIndex !== groupIndex) {
					groupIndex = nextIndex;
					taskIndex = 0;
				}
			} else {
				const row = rows[groupIndex];
				taskIndex = clamp(taskIndex + delta, row?.tasks.length ?? 0);
			}
			refresh();
		}

		async function openDetail() {
			if (!core || popupOpen) return;
			const row = rows[groupIndex];
			const task = row?.tasks[taskIndex];
			if (!task) return;
			popupOpen = true;
			const popup = await createTaskPopup(screen, task);
			if (!popup) {
				popupOpen = false;
				return;
			}
			const { contentArea, close: closePopup } = popup;
			contentArea.key(["escape", "q"], () => {
				popupOpen = false;
				closePopup();
				refresh();
			});
			screen.render();
		}

		async function applyMove() {
			if (!core) return;
			const row = rows[groupIndex];
			const task = row?.tasks[taskIndex];
			const target = moveTargets[targetPos];
			if (!task || !target) return;
			const allTasks = await core.queryTasks();
			if (target.kind === "unsequenced") {
				const res = planMoveToUnsequenced(allTasks, task.id);
				if (!res.ok) {
					hint = res.error;
					refresh();
					return;
				}
				if (res.changed.length > 0) {
					await core.updateTasksBulk(res.changed, `Move ${task.id} to Unsequenced`);
				}
			} else if (target.kind === "sequence") {
				const changed = planMoveToSequence(allTasks, data.sequences, task.id, target.seqIndex);
				if (changed.length > 0) {
					await core.updateTasksBulk(changed, `Update dependencies/order for move of ${task.id}`);
				}
			} else {
				const updated = adjustDependenciesForInsertBetween(allTasks, data.sequences, task.id, target.k);
				const byIdOrig = new Map(allTasks.map((entry) => [entry.id, entry]));
				const changed: Task[] = [];
				for (const candidate of updated) {
					const orig = byIdOrig.get(candidate.id);
					if (!orig) continue;
					const depsChanged = JSON.stringify(orig.dependencies) !== JSON.stringify(candidate.dependencies);
					const ordChanged = (orig.ordinal ?? null) !== (candidate.ordinal ?? null);
					if (depsChanged || ordChanged) changed.push(candidate);
				}
				if (changed.length > 0) {
					await core.updateTasksBulk(changed, `Insert new sequence via drop between for ${task.id}`);
				}
			}
			// Recompute from disk: the move rewrote dependencies, so the layers moved.
			const fresh = await core.queryTasks();
			const active = fresh.filter((entry) => (entry.status || "").toLowerCase() !== "done");
			const next = computeSequences(active);
			data.unsequenced = next.unsequenced;
			data.sequences = next.sequences;
			rows = buildSequenceRows(data);
			moveTargets = buildMoveTargets(rows);
			moveMode = false;
			const movedGroup = rows.findIndex((entry) => entry.tasks.some((entry2) => entry2.id === task.id));
			groupIndex = movedGroup >= 0 ? movedGroup : clamp(groupIndex, rows.length);
			const movedRow = rows[groupIndex];
			taskIndex = movedRow
				? Math.max(
						0,
						movedRow.tasks.findIndex((entry) => entry.id === task.id),
					)
				: 0;
			targetPos = clamp(targetPos, moveTargets.length);
			hint = `Moved ${task.id}`;
			refresh();
			setTimeout(() => {
				hint = null;
				refresh();
			}, 4000);
		}

		// A click on either pane moves that pane's cursor, so the two panes stay in step with
		// the mouse the same way they do with the arrow keys.
		groupsList.on("select item", (_item: unknown, index: unknown) => {
			if (syncingSelection || popupOpen || typeof index !== "number") return;
			if (moveMode) targetPos = clamp(index, moveTargets.length);
			else if (index !== groupIndex) {
				groupIndex = clamp(index, rows.length);
				taskIndex = 0;
			}
			refresh();
		});
		tasksList.on("select item", (_item: unknown, index: unknown) => {
			if (syncingSelection || popupOpen || moveMode || typeof index !== "number") return;
			taskIndex = clamp(index, rows[groupIndex]?.tasks.length ?? 0);
			refresh();
		});

		screen.key(
			["q", "C-c"],
			safe(() => {
				if (popupOpen) return;
				close();
			}),
		);
		screen.key(
			["escape"],
			safe(() => {
				// An open popup closes itself; otherwise Esc cancels move mode, then quits.
				if (popupOpen) return;
				if (moveMode) {
					moveMode = false;
					hint = null;
					refresh();
					return;
				}
				close();
			}),
		);
		screen.key(
			["up", "k"],
			safe(() => move(-1)),
		);
		screen.key(
			["down", "j"],
			safe(() => move(1)),
		);
		screen.key(
			["tab"],
			safe(() => {
				if (popupOpen || moveMode) return;
				focused = focused === "groups" ? "tasks" : "groups";
				refresh();
			}),
		);
		screen.key(
			["right"],
			safe(() => {
				if (popupOpen || moveMode || focused === "tasks") return;
				focused = "tasks";
				refresh();
			}),
		);
		screen.key(
			["left"],
			safe(() => {
				if (popupOpen || moveMode || focused === "groups") return;
				focused = "groups";
				refresh();
			}),
		);
		screen.key(
			["m", "M"],
			safe(async () => {
				if (popupOpen) return;
				const row = rows[groupIndex];
				if (!row?.tasks.length) return;
				moveMode = !moveMode;
				if (moveMode) {
					hint = null;
					focused = "groups";
					// Open on the target the task already sits in, so a no-op Enter is harmless.
					const current =
						row.kind === "unsequenced"
							? moveTargets.findIndex((target) => target.kind === "unsequenced")
							: moveTargets.findIndex((target) => target.kind === "sequence" && target.seqIndex === row.index);
					targetPos = current >= 0 ? current : 0;
					// Seed the preview from what is on screen and refine it once the full task
					// list arrives: the target has to be set before the first paint, or a key
					// pressed during the await would be undone when this handler resumes.
					moveAllTasks = rows.flatMap((entry) => entry.tasks);
					refresh();
					const snapshot = await core?.queryTasks();
					if (moveMode && snapshot) {
						moveAllTasks = snapshot;
						refresh();
					}
					return;
				}
				refresh();
			}),
		);
		screen.key(
			["enter"],
			safe(async () => {
				if (popupOpen) return;
				if (moveMode) {
					await applyMove();
					return;
				}
				if (focused === "groups") {
					focused = "tasks";
					refresh();
					return;
				}
				await openDetail();
			}),
		);

		refresh();
		if (focused === "groups") groupsList.focus();
		else tasksList.focus();
	});
}
