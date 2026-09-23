import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import * as neoBblessed from "neo-neo-bblessed";
import { box, textbox } from "neo-neo-bblessed";
import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { Task, TaskCreateInput } from "../../types/index.ts";

// The bundled d.ts does not expose textarea to the type system (bun resolution gap),
// but the runtime export exists; typed as a textbox-compatible input.
const textareaWidget = (
	neoBblessed as unknown as {
		textarea: (options: Record<string, unknown>) => TextboxInterface;
	}
).textarea;

import { type EntityNounKind, entityNoun } from "../entity-noun.ts";
import {
	createPopupChrome,
	createScrollableViewport,
	type FilterPopupChoice,
	openSingleSelectFilterPopup,
} from "./filter-popup.ts";
import { isValidMilestoneDate } from "./milestone-form.ts";

export const DRAFT_STATUS = "Draft";

/** The task dates, in the order the composer asks for them — the same five the milestone form keeps. */
export const TASK_DATE_FIELDS = ["dueDate", "plannedStart", "plannedEnd", "actualStart", "actualEnd"] as const;

export type TaskComposerDateField = (typeof TASK_DATE_FIELDS)[number];

export const DATE_FIELD_LABELS: Record<TaskComposerDateField, string> = {
	dueDate: "Due",
	plannedStart: "Planned from",
	plannedEnd: "Planned to",
	actualStart: "Actual from",
	actualEnd: "Actual to",
};

/** Tab order, matching the top-to-bottom reading order of the composer. */
const FIELD_ORDER = ["title", "description", "status", "priority", ...TASK_DATE_FIELDS, "create", "cancel"] as const;

/** The widget's wrapped lines (`real`), the logical lines they belong to, and how many there are. */
export type CaretLines = {
	real: readonly string[];
	rtof: readonly number[];
	fakeCount: number;
	/** The widget's own display-cell measure; falls back to one cell per code point. */
	displayWidth?: (value: string) => number;
};

// The widget inserts this zero-width marker after a double-width character while wrapping. It is
// not part of the input value, so every caret calculation has to ignore it.
const WIDE_CHARACTER_PLACEHOLDER = "\x03";

// An astral character such as an emoji is two UTF-16 units, and splitting them leaves an
// unpaired surrogate that renders as a replacement character and corrupts the saved task file.
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Wrapped-line text without the widget's zero-width wide-character markers. */
const visibleLineText = (value: string): string => value.replaceAll(WIDE_CHARACTER_PLACEHOLDER, "");
const codePointWidth = (value: string): number => Array.from(value).length;

/** Snap an index off the middle of a surrogate pair so a mutation can never split one. */
function safeCodePointBoundary(value: string, index: number): number {
	const clamped = Math.min(value.length, Math.max(0, index));
	if (isLowSurrogate(value.charCodeAt(clamped)) && isHighSurrogate(value.charCodeAt(clamped - 1))) {
		return clamped - 1;
	}
	return clamped;
}

/** Code-unit index of the code point occupying `column`, or the value length when past the end. */
function indexAtDisplayColumn(value: string, column: number, displayWidth: (value: string) => number): number {
	const target = Math.max(0, column);
	let index = 0;
	let width = 0;
	for (const character of value) {
		const nextWidth = width + Math.max(0, displayWidth(character));
		if (target < nextWidth) return index;
		width = nextWidth;
		index += character.length;
	}
	return value.length;
}

/**
 * The input widgets report the caret as a negative offset from the end of its wrapped line
 * rather than as an index, so count everything that follows the caret to place it in the value.
 * The offsets are terminal columns, while the value is addressed in UTF-16 units, so the two are
 * reconciled through the display width before the result is snapped to a code-point boundary.
 */
export function caretIndexFromCursor(value: string, cursor: { x: number; y: number }, lines: CaretLines): number {
	if (lines.real.length === 0) return value.length;
	const lastLine = lines.real.length - 1;
	const currentLine = Math.min(lastLine, Math.max(0, lastLine + cursor.y));
	const displayWidth = lines.displayWidth ?? codePointWidth;
	const currentText = visibleLineText(lines.real[currentLine] ?? "");
	const caretColumn = displayWidth(currentText) + Math.min(0, cursor.x);
	const lineIndex = indexAtDisplayColumn(currentText, caretColumn, displayWidth);
	let after = currentText.length - lineIndex;
	for (let line = currentLine + 1; line <= lastLine; line += 1) {
		after += visibleLineText(lines.real[line] ?? "").length;
	}
	// Wrapped lines share a logical line; only logical breaks add a newline character.
	after += Math.max(0, lines.fakeCount - 1 - (lines.rtof[currentLine] ?? 0));
	return safeCodePointBoundary(value, value.length - after);
}

/** Cursor offsets placing the caret at `caretIndex`; the inverse of {@link caretIndexFromCursor}. */
export function cursorFromCaretIndex(value: string, caretIndex: number, lines: CaretLines): { x: number; y: number } {
	const lastLine = lines.real.length - 1;
	if (lastLine < 0) return { x: 0, y: 0 };
	const displayWidth = lines.displayWidth ?? codePointWidth;
	const after = value.length - safeCodePointBoundary(value, caretIndex);
	let trailing = 0;
	for (let line = lastLine; line >= 0; line -= 1) {
		const lineText = visibleLineText(lines.real[line] ?? "");
		const newlines = Math.max(0, lines.fakeCount - 1 - (lines.rtof[line] ?? 0));
		const trailingCodeUnits = after - trailing - newlines;
		if (trailingCodeUnits >= 0 && trailingCodeUnits <= lineText.length) {
			return {
				x: -displayWidth(lineText.slice(lineText.length - trailingCodeUnits)),
				y: line === lastLine ? 0 : -(lastLine - line),
			};
		}
		trailing += lineText.length;
	}
	return { x: 0, y: -lastLine };
}

/** First index Backspace (one character) or Ctrl+W (one word) should remove, counting back from the caret. */
export function deletionStart(value: string, caretIndex: number, unit: "char" | "word"): number {
	if (caretIndex <= 0) return caretIndex;
	if (unit === "char") {
		const pairedBack =
			isLowSurrogate(value.charCodeAt(caretIndex - 1)) && isHighSurrogate(value.charCodeAt(caretIndex - 2));
		return caretIndex - (pairedBack ? 2 : 1);
	}
	let start = caretIndex;
	while (start > 0 && /\s/.test(value[start - 1] ?? "")) start -= 1;
	while (start > 0 && !/\s/.test(value[start - 1] ?? "")) start -= 1;
	return start;
}

/** Last index Delete should remove, counting forward from the caret. */
export function deletionEnd(value: string, caretIndex: number): number {
	if (caretIndex >= value.length) return caretIndex;
	const pairedForward =
		isHighSurrogate(value.charCodeAt(caretIndex)) && isLowSurrogate(value.charCodeAt(caretIndex + 1));
	return caretIndex + (pairedForward ? 2 : 1);
}

export type TaskComposerValues = {
	title: string;
	description: string;
	status: string;
	priority: string;
} & Record<TaskComposerDateField, string>;

export type TaskComposerLayout = {
	compact: boolean;
	popupWidth: number;
	popupHeight: number;
	descriptionHeight: number;
	detailsTop: number;
	detailsHeight: number;
	datesTop: number;
	datesHeight: number;
	actionsTop: number;
	contentHeight: number;
};

/** A bordered text input: its top border, one editable row and its bottom border. */
const TEXT_INPUT_HEIGHT = 3;
/** Two popup borders, the form's top offset and the two rows it reserves below the form. */
const POPUP_FORM_VERTICAL_CHROME = 5;
/** Two popup borders and the form's one-column inset on each side. */
const POPUP_FORM_HORIZONTAL_CHROME = 4;
/** createPopupChrome's backdrop extends two columns beyond each side of the popup. */
const POPUP_OUTER_HORIZONTAL_MARGIN = 4;
const PREFERRED_POPUP_WIDTH = 72;
const NORMAL_SELECTOR_WIDTH_RATIO = 0.3;
const EXPANDED_DESCRIPTION_HEIGHT = 6;
const EXPANDED_DETAILS_HEIGHT = 3;
const EXPANDED_ACTIONS_HEIGHT = 2;
/** The five date rows (Due, Planned from/to, Actual from/to) stack between details and actions. */
const EXPANDED_DATES_HEIGHT = TASK_DATE_FIELDS.length;
/** Full expanded form plus chrome; taller screens grow no further. */
const EXPANDED_POPUP_HEIGHT = 24;

export type TaskComposerLayoutOptions = {
	statuses?: readonly string[];
	priorities?: readonly string[];
};

/** The widest selector row the composer can render, in terminal cells, cue included. */
function getLongestSelectorWidth(options: TaskComposerLayoutOptions): number {
	const selectors: Array<[string, FilterPopupChoice[]]> = [
		["Status", getTaskComposerStatusChoices(options.statuses ?? DEFAULT_STATUSES)],
		["Priority", getTaskComposerPriorityChoices(options.priorities)],
	];
	let longest = 0;
	for (const [label, choices] of selectors) {
		for (const choice of choices) {
			longest = Math.max(longest, Bun.stringWidth(`${label}: ${displayChoice(choice.value)} ▼`));
		}
	}
	return longest;
}

export function getTaskComposerLayout(
	screenWidth: number,
	screenHeight: number,
	options: TaskComposerLayoutOptions = {},
): TaskComposerLayout {
	const longestSelectorWidth = getLongestSelectorWidth(options);
	// Selectors are sized proportionally, so the popup grows until the widest configured value
	// plus its cue still fits a normal column; the terminal width is the only hard cap.
	const requiredPopupWidth =
		Math.ceil(longestSelectorWidth / NORMAL_SELECTOR_WIDTH_RATIO) + POPUP_FORM_HORIZONTAL_CHROME;
	const availablePopupWidth = Math.max(1, screenWidth - POPUP_OUTER_HORIZONTAL_MARGIN);
	const popupWidth = Math.min(availablePopupWidth, Math.max(PREFERRED_POPUP_WIDTH, requiredPopupWidth));
	// The popup must never be taller than the screen: blessed centers it by subtracting
	// half its height, so an oversized popup starts at a negative row and its actions,
	// error and help rows fall outside the terminal. Below ten rows it also has to keep
	// room for the popup chrome and one complete bordered input, or the focused field's
	// editable row and its cursor are clipped.
	const popupHeight = Math.min(
		EXPANDED_POPUP_HEIGHT,
		screenHeight,
		// The two-row margin is a short-screen guard: once the terminal fits the expanded form,
		// shaving it would force the compact layout for no benefit.
		screenHeight >= EXPANDED_POPUP_HEIGHT
			? screenHeight
			: Math.max(screenHeight - 2, POPUP_FORM_VERTICAL_CHROME + TEXT_INPUT_HEIGHT),
	);
	const normalSelectorWidth = Math.floor(
		Math.max(0, popupWidth - POPUP_FORM_HORIZONTAL_CHROME) * NORMAL_SELECTOR_WIDTH_RATIO,
	);
	const visibleFormHeight = Math.max(0, popupHeight - POPUP_FORM_VERTICAL_CHROME);
	const expandedContentHeight =
		TEXT_INPUT_HEIGHT +
		EXPANDED_DESCRIPTION_HEIGHT +
		EXPANDED_DETAILS_HEIGHT +
		EXPANDED_DATES_HEIGHT +
		EXPANDED_ACTIONS_HEIGHT;
	// Compact is the layout that stacks both selectors on their own full-width rows, so it
	// engages whenever a normal column would clip its content or the expanded form no longer fits.
	const compact = normalSelectorWidth < longestSelectorWidth || visibleFormHeight < expandedContentHeight;
	const descriptionHeight = compact ? 3 : EXPANDED_DESCRIPTION_HEIGHT;
	const detailsTop = TEXT_INPUT_HEIGHT + descriptionHeight;
	const detailsHeight = compact ? 4 : EXPANDED_DETAILS_HEIGHT;
	const datesTop = detailsTop + detailsHeight;
	const datesHeight = EXPANDED_DATES_HEIGHT;
	const actionsTop = datesTop + datesHeight;
	return {
		compact,
		popupWidth,
		popupHeight,
		descriptionHeight,
		detailsTop,
		detailsHeight,
		datesTop,
		datesHeight,
		actionsTop,
		// Compact hides the "Actions" caption, so the buttons are the last row instead of the second-last.
		contentHeight: actionsTop + (compact ? 1 : 2),
	};
}

function getTaskComposerHelpText(screenWidth: number, compact: boolean): string {
	// Each variant has to fit the popup width it is shown at, so drop hints as the screen narrows.
	if (screenWidth < 60) {
		return " {cyan-fg}[↑↓←→/Tab]{/} Nav | {cyan-fg}[Enter]{/} Choose";
	}
	if (compact) {
		return " {cyan-fg}[↑↓←→/Tab]{/} Nav | {cyan-fg}[Enter]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
	}
	return " {cyan-fg}[↑↓/←→/Tab]{/} Navigate | {cyan-fg}[Enter/Space]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
}

type TaskComposerField = "title" | "description" | "status" | "priority" | TaskComposerDateField | "create" | "cancel";

/** Text-input fields own the keyboard through readInput; the rest are selectors and actions. */
const TEXT_INPUT_FIELDS: readonly TaskComposerField[] = ["title", "description", ...TASK_DATE_FIELDS];

/** Up/down traversal order: the visual stack from title to the action row. */
const VERTICAL_ORDER: readonly TaskComposerField[] = [
	"title",
	"description",
	"status",
	"priority",
	...TASK_DATE_FIELDS,
	"create",
	"cancel",
];

function uniqueChoices(values: readonly string[], excludedValue?: string): string[] {
	const choices: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = String(value ?? "").trim();
		const normalized = trimmed.toLowerCase();
		if (!trimmed || normalized === excludedValue?.toLowerCase() || seen.has(normalized)) continue;
		seen.add(normalized);
		choices.push(trimmed);
	}
	return choices;
}

export function getTaskComposerWorkflowStatuses(statuses: readonly string[]): string[] {
	const configured = uniqueChoices(statuses, DRAFT_STATUS);
	return configured.length > 0 ? configured : ["To Do"];
}

export function getTaskComposerStatusChoices(statuses: readonly string[]): FilterPopupChoice[] {
	return [
		{ label: DRAFT_STATUS, value: DRAFT_STATUS },
		...getTaskComposerWorkflowStatuses(statuses).map((status) => ({ label: status, value: status })),
	];
}

export function getTaskComposerPriorityChoices(priorities?: readonly string[]): FilterPopupChoice[] {
	const configured = Array.from(new Set((priorities ?? []).map((p) => p.trim()).filter(Boolean)));
	const values = configured.length > 0 ? configured : ["high", "medium", "low"];
	return [
		{ label: "None", value: "" },
		...values.map((priority) => ({ label: priority, value: priority.toLowerCase() })),
	];
}

export function createTaskComposerValues(statuses: readonly string[]): TaskComposerValues {
	return {
		title: "",
		description: "",
		status: getTaskComposerWorkflowStatuses(statuses)[0] ?? "To Do",
		priority: "",
		dueDate: "",
		plannedStart: "",
		plannedEnd: "",
		actualStart: "",
		actualEnd: "",
	};
}

export function toTaskCreateInput(values: TaskComposerValues): TaskCreateInput {
	const title = values.title.trim();
	if (!title) throw new Error("Title is required.");
	const description = values.description.trim();
	const priority = values.priority.trim();
	for (const field of TASK_DATE_FIELDS) {
		const value = values[field].trim();
		if (value && !isValidMilestoneDate(value)) {
			throw new Error(`${DATE_FIELD_LABELS[field]} must be YYYY-MM-DD (or YYYY-MM-DD HH:mm).`);
		}
	}
	const dateEntries = TASK_DATE_FIELDS.map((field) => [field, values[field].trim()] as const).filter(([, value]) =>
		Boolean(value),
	);
	return {
		title,
		status: values.status,
		...(description && { description }),
		...(priority && { priority: priority as "high" | "medium" | "low" }),
		...Object.fromEntries(dateEntries),
	};
}

export class TaskComposerController {
	readonly values: TaskComposerValues;
	private readonly noun: { plain: string; titled: string };
	error = "";
	submitting = false;

	constructor(statuses: readonly string[], entity?: EntityNounKind) {
		this.values = createTaskComposerValues(statuses);
		this.noun = entityNoun(entity);
	}

	async create(persist: (input: TaskCreateInput) => Promise<Task>): Promise<Task | null> {
		if (this.submitting) return null;
		this.error = "";
		let input: TaskCreateInput;
		try {
			input = toTaskCreateInput(this.values);
		} catch (error) {
			this.error = error instanceof Error ? error.message : `${this.noun.titled} creation failed.`;
			return null;
		}

		this.submitting = true;
		try {
			return await persist(input);
		} catch (error) {
			this.error = error instanceof Error ? error.message : `${this.noun.titled} creation failed.`;
			return null;
		} finally {
			this.submitting = false;
		}
	}
}

function displayChoice(value: string): string {
	return value || "None";
}

export type TaskComposerOptions = {
	screen: ScreenInterface;
	statuses: readonly string[];
	/** What this window creates; the drafts session makes drafts, everything else makes tasks. */
	entity?: EntityNounKind;
	priorities?: readonly string[];
	persist: (input: TaskCreateInput) => Promise<Task>;
};

export async function openTaskComposer(options: TaskComposerOptions): Promise<Task | null> {
	return new Promise<Task | null>((resolve) => {
		const controller = new TaskComposerController(options.statuses, options.entity);
		let settled = false;
		let pickerOpen = false;
		let activeField: TaskComposerField = "title";
		let layout = getTaskComposerLayout(options.screen.width, options.screen.height, options);
		const { popup, close, reflow } = createPopupChrome({
			screen: options.screen,
			title: `Create ${entityNoun(options.entity).titled}`,
			helpText: getTaskComposerHelpText(options.screen.width, layout.compact),
			width: layout.popupWidth,
			height: layout.popupHeight,
		});

		// Short terminals cannot show every field at once, so the fields live in a viewport
		// that clips them to the popup and scrolls the focused one into view.
		const form = createScrollableViewport({
			parent: popup,
			top: 1,
			left: 1,
			right: 1,
			bottom: 2,
			keys: false,
			mouse: true,
		});

		const titleInput = textbox({
			parent: form,
			top: 0,
			left: 1,
			right: 1,
			height: 3,
			border: { type: "line" },
			label: " Title ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			// Suppresses the scroll key bindings this widget inherits from its scrollable base.
			ignoreKeys: true,
			style: { border: { fg: "gray" } },
		});

		const descriptionInput = textareaWidget({
			parent: form,
			top: 3,
			left: 1,
			right: 1,
			height: layout.descriptionHeight,
			border: { type: "line" },
			label: " Description ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			scrollable: true,
			style: { border: { fg: "gray" } },
		});

		const detailsGroup = box({
			parent: form,
			top: layout.detailsTop,
			left: 1,
			right: 1,
			height: layout.detailsHeight,
			border: { type: "line" },
			label: " Details ",
			style: { border: { fg: "cyan" } },
		});
		// The selectors and buttons sit inside the details frame visually, but stay direct
		// children of the viewport: blessed drops grandchildren of a scrolled viewport, which
		// would make them invisible on short terminals.
		const selectorContent = (label: string, value: string) => `${label}: ${displayChoice(value)} ▼`;
		const createSelector = (label: string, value: string) =>
			box({
				parent: form,
				top: 0,
				left: 3,
				height: 1,
				content: selectorContent(label, value),
				keys: true,
				mouse: true,
			});
		const statusField = createSelector("Status", controller.values.status);
		const priorityField = createSelector("Priority", controller.values.priority);

		// The date fields mirror the milestone form: a caption plus a single-row input. They sit
		// between the details frame and the actions, like the milestone form stacks its five dates.
		const DATE_LABEL_WIDTH = 14;
		const dateInputs = {} as Record<TaskComposerDateField, TextboxInterface>;
		const dateLabels = {} as Record<TaskComposerDateField, BoxInterface>;
		TASK_DATE_FIELDS.forEach((field, index) => {
			const top = layout.datesTop + index;
			dateLabels[field] = box({
				parent: form,
				top,
				left: 1,
				width: DATE_LABEL_WIDTH,
				height: 1,
				tags: true,
				content: `${DATE_FIELD_LABELS[field]}:`,
			});
			dateInputs[field] = textbox({
				parent: form,
				top,
				left: DATE_LABEL_WIDTH + 1,
				right: 1,
				height: 1,
				inputOnFocus: false,
				mouse: true,
				keys: true,
				// The single-row inputs inherit scroll keys from their scrollable base; they are
				// bound to field movement here instead.
				ignoreKeys: true,
				style: { focus: { inverse: true, bold: true } },
			});
		});

		const actionsLabel = box({
			parent: form,
			top: layout.actionsTop,
			left: 1,
			height: 1,
			content: "Actions",
			style: { fg: "cyan", bold: true },
		});
		const createAction = box({
			parent: form,
			top: layout.actionsTop + 1,
			left: 2,
			width: 18,
			height: 1,
			align: "center",
			content: `Create ${entityNoun(options.entity).plain}`,
			keys: true,
			mouse: true,
			style: { fg: "green" },
		});
		const cancelAction = box({
			parent: form,
			top: layout.actionsTop + 1,
			left: 22,
			width: 14,
			height: 1,
			align: "center",
			content: "Cancel",
			keys: true,
			mouse: true,
			style: { fg: "gray" },
		});

		const errorBox = box({
			parent: popup,
			bottom: 1,
			left: 2,
			right: 2,
			height: 1,
			content: "",
			style: { fg: "red" },
		});

		const widgets: Record<TaskComposerField, BoxInterface | TextboxInterface> = {
			title: titleInput,
			description: descriptionInput,
			status: statusField,
			priority: priorityField,
			...dateInputs,
			create: createAction,
			cancel: cancelAction,
		};
		/** Row of each field inside the scrollable viewport; selectors sit inside the details frame. */
		const getFieldTops = (): Record<TaskComposerField, number> => {
			const actionsRow = layout.actionsTop + (layout.compact ? 0 : 1);
			const tops = {
				title: 0,
				description: 3,
				status: layout.detailsTop + 1,
				priority: layout.detailsTop + (layout.compact ? 2 : 1),
				create: actionsRow,
				cancel: actionsRow,
			} as Record<TaskComposerField, number>;
			for (const [index, field] of TASK_DATE_FIELDS.entries()) tops[field] = layout.datesTop + index;
			return tops;
		};
		const getFieldTop = (field: TaskComposerField): number => getFieldTops()[field];
		const setFieldGeometry = (
			widget: BoxInterface,
			geometry: { top: number; left: string | number; width: string | number; height?: number },
		) => {
			widget.top = geometry.top;
			widget.left = geometry.left;
			widget.width = geometry.width;
			if (geometry.height !== undefined) widget.height = geometry.height;
		};

		const isTextInputWidget = (widget: BoxInterface | TextboxInterface): boolean =>
			widget === titleInput ||
			widget === descriptionInput ||
			Object.values(dateInputs).includes(widget as TextboxInterface);

		const setBorder = (widget: BoxInterface | TextboxInterface, active: boolean) => {
			const style = (widget.style ?? {}) as { border?: { fg?: string }; inverse?: boolean; bold?: boolean };
			const isTextInput = isTextInputWidget(widget);
			// The date inputs are borderless: their focus style marks them, so only the two
			// bordered inputs need a border-color change.
			if (widget === titleInput || widget === descriptionInput) {
				style.border ??= {};
				style.border.fg = active ? "yellow" : "gray";
			}
			style.inverse = active && !isTextInput;
			style.bold = active && !isTextInput;
			widget.style = style;
		};

		const syncInputs = () => {
			controller.values.title = titleInput.getValue();
			controller.values.description = descriptionInput.getValue();
			for (const field of TASK_DATE_FIELDS) controller.values[field] = dateInputs[field].getValue();
		};
		const cancelInputIfReading = (input: TextboxInterface) => {
			if ((input as TextboxInterface & { _reading?: boolean })._reading) input.cancel();
		};

		const scrollFieldIntoView = (field: TaskComposerField) => {
			const visibleHeight = typeof form.height === "number" ? form.height : 12;
			const target = Math.max(0, getFieldTop(field) - Math.max(0, visibleHeight - 3));
			form.childBase = Math.min(Math.max(0, layout.contentHeight - visibleHeight), target);
		};

		const applyLayout = () => {
			layout = getTaskComposerLayout(options.screen.width, options.screen.height, options);
			reflow(layout.popupWidth, layout.popupHeight, getTaskComposerHelpText(options.screen.width, layout.compact));
			descriptionInput.height = layout.descriptionHeight;
			detailsGroup.top = layout.detailsTop;
			detailsGroup.height = layout.detailsHeight;
			actionsLabel.top = layout.actionsTop;
			const mutableActionsLabel = actionsLabel as BoxInterface & { hide(): void; show(): void };
			if (layout.compact) mutableActionsLabel.hide();
			else mutableActionsLabel.show();
			const tops = getFieldTops();
			if (layout.compact) {
				setFieldGeometry(statusField, { top: tops.status, left: 3, width: "100%-6" });
				setFieldGeometry(priorityField, { top: tops.priority, left: 3, width: "100%-6" });
				setFieldGeometry(createAction, { top: tops.create, left: 3, width: "44%" });
				setFieldGeometry(cancelAction, { top: tops.cancel, left: "50%", width: "44%" });
			} else {
				setFieldGeometry(statusField, { top: tops.status, left: 3, width: "30%" });
				setFieldGeometry(priorityField, { top: tops.priority, left: "35%", width: "30%" });
				setFieldGeometry(createAction, { top: tops.create, left: 2, width: 18 });
				setFieldGeometry(cancelAction, { top: tops.cancel, left: 22, width: 14 });
			}
			statusField.setContent(selectorContent("Status", controller.values.status));
			priorityField.setContent(selectorContent("Priority", controller.values.priority));
			for (const field of TASK_DATE_FIELDS) {
				dateLabels[field].top = layout.datesTop + TASK_DATE_FIELDS.indexOf(field);
				dateInputs[field].top = layout.datesTop + TASK_DATE_FIELDS.indexOf(field);
			}
			scrollFieldIntoView(activeField);
		};

		const focusField = (field: TaskComposerField) => {
			if (TEXT_INPUT_FIELDS.includes(activeField)) {
				syncInputs();
				cancelInputIfReading(widgets[activeField] as TextboxInterface);
			}
			activeField = field;
			for (const [name, widget] of Object.entries(widgets) as Array<
				[TaskComposerField, BoxInterface | TextboxInterface]
			>) {
				setBorder(widget, name === field);
			}
			const widget = widgets[field];
			widget.focus();
			if (TEXT_INPUT_FIELDS.includes(field)) {
				(widget as TextboxInterface).readInput();
			}
			// blessed scrolls a focused widget into view using its offset within its immediate
			// parent, which is wrong for the grouped selectors and buttons, so correct it after.
			scrollFieldIntoView(field);
			options.screen.render();
		};

		const navigate = (direction: "up" | "down" | "left" | "right") => {
			let next = activeField;
			// Vertical movement follows the stacked field order; status and priority share a row,
			// so moving up from either one lands on the description above them.
			if (["status", "priority"].includes(activeField) && direction === "up") next = "description";
			else if (direction === "up" || direction === "down") {
				const index = VERTICAL_ORDER.indexOf(activeField);
				const neighbor = VERTICAL_ORDER[index + (direction === "down" ? 1 : -1)];
				if (neighbor) next = neighbor;
			}
			if (activeField === "status" && direction === "right" && !layout.compact) next = "priority";
			if (activeField === "priority" && direction === "left" && !layout.compact) next = "status";
			if (activeField === "create" && direction === "right") next = "cancel";
			if (activeField === "cancel" && direction === "left") next = "create";
			if (next !== activeField) focusField(next);
		};

		/** Tab traversal: reading order, wrapping at both ends. */
		const moveFocus = (step: number) => {
			const index = FIELD_ORDER.indexOf(activeField);
			const next = FIELD_ORDER[(index + step + FIELD_ORDER.length) % FIELD_ORDER.length];
			if (next) focusField(next);
		};
		const onResize = () => {
			syncInputs();
			if (!pickerOpen) applyLayout();
			options.screen.render();
		};
		let escapeHandler: () => false;
		const unkeyEscape = (target: BoxInterface | TextboxInterface) => {
			(target as BoxInterface & { unkey: (keys: string[], handler: () => boolean) => void }).unkey?.(
				["escape"],
				escapeHandler,
			);
		};

		const finish = (task: Task | null) => {
			if (settled) return;
			settled = true;
			(
				options.screen as ScreenInterface & {
					removeListener(event: string, listener: (...args: unknown[]) => void): void;
				}
			).removeListener("resize", onResize);
			unkeyEscape(popup);
			for (const widget of Object.values(widgets)) {
				unkeyEscape(widget);
			}
			for (const field of TEXT_INPUT_FIELDS) {
				cancelInputIfReading(widgets[field] as TextboxInterface);
			}
			close();
			resolve(task);
		};

		const showError = () => {
			errorBox.setContent(controller.error ? ` ${controller.error}` : "");
			options.screen.render();
		};

		const submit = async () => {
			if (pickerOpen || controller.submitting) return;
			syncInputs();
			errorBox.setContent(" Creating task...");
			options.screen.render();
			const task = await controller.create(options.persist);
			if (task) {
				finish(task);
				return;
			}
			showError();
			if (!controller.values.title.trim()) focusField("title");
			else {
				// A bad date is the one mistake worth walking back to; the rest stay put.
				const invalidDate = TASK_DATE_FIELDS.find(
					(field) => controller.values[field].trim() && !isValidMilestoneDate(controller.values[field].trim()),
				);
				focusField(invalidDate ?? "create");
			}
		};

		const openPicker = async (field: "status" | "priority") => {
			if (pickerOpen || controller.submitting) return;
			syncInputs();
			pickerOpen = true;
			const currentValue = controller.values[field];
			const choices =
				field === "status"
					? getTaskComposerStatusChoices(options.statuses)
					: getTaskComposerPriorityChoices(options.priorities);
			try {
				const selected = await openSingleSelectFilterPopup({
					screen: options.screen,
					title: field === "status" ? "Task Status" : "Task Priority",
					choices,
					selectedValue: currentValue,
				});
				if (selected !== null) {
					controller.values[field] = selected;
					const fieldLabel = field === "status" ? "Status" : "Priority";
					widgets[field].setContent(selectorContent(fieldLabel, selected));
				}
			} finally {
				pickerOpen = false;
				applyLayout();
				focusField(field);
			}
		};

		const cancel = () => {
			if (!pickerOpen && !controller.submitting) finish(null);
		};

		escapeHandler = () => {
			cancel();
			return false;
		};
		popup.key(["escape"], escapeHandler);
		for (const widget of Object.values(widgets)) {
			widget.key(["escape"], escapeHandler);
			widget.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			widget.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
		}

		type ComposerInput = TextboxInterface & {
			_listener?: (ch: string, key: { name?: string }) => void;
			_clines?: { length: number; real?: string[]; rtof?: number[]; fake?: string[] };
			getCursor?: () => { x: number; y: number };
			setCursor?: (x: number, y: number) => void;
			setScroll?: (offset: number) => void;
			strWidth?: (value: string) => number;
			_updateCursor?: () => void;
		};

		const readCaretLines = (input: ComposerInput, value: string): CaretLines => ({
			real: input._clines?.real ?? [value],
			rtof: input._clines?.rtof ?? [0],
			fakeCount: input._clines?.fake?.length ?? 1,
			displayWidth: input.strWidth?.bind(input),
		});

		/**
		 * Replace the whole value and put the caret back where the user aimed. Removing a line break
		 * shortens the wrapped lines, and setValue repositions the widget's cursor straight away, so
		 * park the caret on the last line first - that offset is valid for any replacement value.
		 */
		const setTextAtCaret = (input: ComposerInput, value: string, caret: number) => {
			input.setCursor?.(0, 0);
			input.setValue(value);
			syncInputs();
			const lines = readCaretLines(input, value);
			const cursor = cursorFromCaretIndex(value, caret, lines);
			input.setCursor?.(cursor.x, cursor.y);
			// setValue() scrolls to the last line while the caret is parked at (0, 0), so restore the
			// caret's own line and an edit near the top of a long description stays visible.
			input.setScroll?.(Math.max(0, lines.real.length - 1 + cursor.y));
			input._updateCursor?.();
			options.screen.render();
		};

		const insertText = (input: ComposerInput, inserted: string) => {
			const value = input.getValue();
			const cursor = input.getCursor?.() ?? { x: 0, y: 0 };
			const caret = caretIndexFromCursor(value, cursor, readCaretLines(input, value));
			setTextAtCaret(input, value.slice(0, caret) + inserted + value.slice(caret), caret + inserted.length);
		};

		const deleteText = (input: ComposerInput, unit: "char" | "word" | "forward") => {
			const value = input.getValue();
			const cursor = input.getCursor?.() ?? { x: 0, y: 0 };
			const caret = caretIndexFromCursor(value, cursor, readCaretLines(input, value));
			const start = unit === "forward" ? caret : deletionStart(value, caret, unit);
			const end = unit === "forward" ? deletionEnd(value, caret) : caret;
			if (start >= end) return;
			setTextAtCaret(input, value.slice(0, start) + value.slice(end), start);
		};

		/**
		 * Text changes the composer implements itself. The widgets compute the caret in display cells
		 * but slice the value by UTF-16 unit, so leaving insertion to them splits astral characters.
		 * Tab moves between fields instead of typing a tab, deletion is owned because the two inputs
		 * delete differently, and printable input is inserted here so every mutation stays on a
		 * code-point boundary.
		 */
		const ownedInputKeys = new Set(["tab", "backspace", "delete"]);
		const isTextInsertion = (ch: string): boolean => {
			if (!ch) return false;
			if (ch.length > 1) return true;
			const code = ch.charCodeAt(0);
			return code > 0x1f && code !== 0x7f;
		};
		const ownInputKeys = (input: ComposerInput) => {
			const listener = input._listener?.bind(input);
			if (!listener) return;
			input._listener = (ch, key) => {
				if ((key.name && ownedInputKeys.has(key.name)) || ch === "\t") return;
				if (isTextInsertion(ch)) {
					insertText(input, ch);
					return;
				}
				listener(ch, key);
			};
		};
		ownInputKeys(titleInput as ComposerInput);
		ownInputKeys(descriptionInput as ComposerInput);
		for (const field of TASK_DATE_FIELDS) ownInputKeys(dateInputs[field] as ComposerInput);

		let cursorBeforeKey: { y: number; lines: number } | null = null;
		for (const input of [titleInput, descriptionInput, ...Object.values(dateInputs)] as ComposerInput[]) {
			input.on("keypress", () => {
				// Single-row inputs have no wrapped lines to track; only the description does.
				cursorBeforeKey = {
					y: input.getCursor?.().y ?? 0,
					lines: Math.max(1, input._clines?.length ?? input.getValue().split("\n").length),
				};
				controller.error = "";
				errorBox.setContent("");
			});
			input.key(["backspace"], () => {
				deleteText(input, "char");
				return false;
			});
			input.key(["delete"], () => {
				deleteText(input, "forward");
				return false;
			});
			input.key(["C-w"], () => {
				deleteText(input, "word");
				return false;
			});
		}
		titleInput.key(["down"], () => {
			focusField("description");
			return false;
		});
		titleInput.on("submit", () => focusField("description"));
		descriptionInput.key(["up"], () => {
			const cursor = cursorBeforeKey;
			if (cursor && cursor.y <= -(cursor.lines - 1)) focusField("title");
			return false;
		});
		descriptionInput.key(["down"], () => {
			if (cursorBeforeKey?.y === 0) focusField("status");
			return false;
		});
		// Enter on a date row submits, like the milestone form; ↑↓ walk the field stack.
		for (const field of TASK_DATE_FIELDS) {
			const input = dateInputs[field] as ComposerInput;
			input.key(["enter"], () => {
				void submit();
				return false;
			});
			input.key(["up"], () => {
				navigate("up");
				return false;
			});
			input.key(["down"], () => {
				navigate("down");
				return false;
			});
		}

		for (const field of ["status", "priority"] as const) {
			widgets[field].key(["enter", "space"], () => {
				void openPicker(field);
				return false;
			});
		}

		// Pointer activation reuses the keyboard transition, so a clicked text field enters read
		// mode with a caret and every field has one source of truth for focus styling and scrolling.
		for (const field of ["title", "description", "status", "priority", ...TASK_DATE_FIELDS] as const) {
			widgets[field].on("click", () => {
				focusField(field);
				if (field === "status" || field === "priority") void openPicker(field);
				// Stop the click from bubbling: blessed otherwise auto-focuses the clicked widget
				// after this handler runs, which blurs the reader focusField just started.
				return false;
			});
		}

		for (const field of ["status", "priority", "create", "cancel"] as const) {
			const widget = widgets[field];
			for (const direction of ["up", "down", "left", "right"] as const) {
				widget.key([direction], () => {
					navigate(direction);
					return false;
				});
			}
		}

		createAction.key(["enter", "space"], () => {
			void submit();
			return false;
		});
		createAction.on("click", () => void submit());
		cancelAction.key(["enter", "space"], () => {
			cancel();
			return false;
		});
		cancelAction.on("click", cancel);

		options.screen.on("resize", onResize);
		applyLayout();
		setImmediate(() => focusField("title"));
	});
}
