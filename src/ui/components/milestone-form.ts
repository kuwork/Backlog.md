/**
 * Milestone form: the one place a milestone's description and dates are typed in.
 *
 * `N` opens it empty to create a milestone; the detail popup's `E` opens it filled in to change
 * what is already there. Both ask for the same fields, so they share one form — the only difference
 * is the title row, which is an input while creating and a read-only heading afterwards: the
 * milestone file is named after its title, so renaming moves a file and stays the CLI's and the
 * web page's job rather than something a date-editing form does by accident.
 *
 * The fields mirror the milestone frontmatter (`## Description` and the five dates), which is also
 * exactly what the milestone detail popup displays.
 */

import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import * as neoBblessed from "neo-neo-bblessed";
import { box, textbox } from "neo-neo-bblessed";
import type { Milestone, MilestoneCreateOptions } from "../../types/index.ts";
import { createPopupChrome, createScrollableViewport } from "./filter-popup.ts";

// The bundled d.ts does not expose textarea to the type system (bun resolution gap),
// but the runtime export exists; typed as a textbox-compatible input.
const textareaWidget = (
	neoBblessed as unknown as {
		textarea: (options: Record<string, unknown>) => TextboxInterface;
	}
).textarea;

export type MilestoneFormMode = "create" | "edit";

/** The five dates, in the order the form asks for them. */
export const MILESTONE_DATE_FIELDS = ["dueDate", "plannedStart", "plannedEnd", "actualStart", "actualEnd"] as const;

export type MilestoneDateField = (typeof MILESTONE_DATE_FIELDS)[number];

export type MilestoneFormField = "title" | "description" | MilestoneDateField;

export type MilestoneFormValues = {
	title: string;
	description: string;
} & Record<MilestoneDateField, string>;

const FIELD_LABELS: Record<MilestoneFormField, string> = {
	title: "Title",
	description: "Description",
	dueDate: "Due",
	plannedStart: "Planned from",
	plannedEnd: "Planned to",
	actualStart: "Actual from",
	actualEnd: "Actual to",
};

/** Everything the user can type once the milestone exists. */
const EDITABLE_FIELDS: MilestoneFormField[] = ["description", ...MILESTONE_DATE_FIELDS];

/** The fields the form shows, top to bottom. Create asks for a title; edit shows it as a heading. */
function getMilestoneFormFields(mode: MilestoneFormMode): MilestoneFormField[] {
	return mode === "create" ? ["title", ...EDITABLE_FIELDS] : [...EDITABLE_FIELDS];
}

/** The form's starting values: the milestone's own for an edit, empty for a create. */
function milestoneFormValues(milestone: Milestone | undefined, mode: MilestoneFormMode): MilestoneFormValues {
	const date = (value: string | undefined) => value ?? "";
	return {
		title: mode === "create" ? "" : (milestone?.title ?? ""),
		description: milestone?.description ?? "",
		dueDate: date(milestone?.dueDate),
		plannedStart: date(milestone?.plannedStart),
		plannedEnd: date(milestone?.plannedEnd),
		actualStart: date(milestone?.actualStart),
		actualEnd: date(milestone?.actualEnd),
	};
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;

/** A plain date or a date with a time: the two shapes the milestone frontmatter keeps. */
export function isValidMilestoneDate(value: string): boolean {
	return DATE_PATTERN.test(value) || DATE_TIME_PATTERN.test(value);
}

export type MilestoneFormValidation = {
	mode: MilestoneFormMode;
	/** Titles already in use; create refuses a duplicate rather than writing a second file for it. */
	existingTitles?: string[];
};

/** The first thing wrong with the form, or null when it can be saved. */
export function validateMilestoneForm(values: MilestoneFormValues, options: MilestoneFormValidation): string | null {
	if (options.mode === "create") {
		const title = values.title.trim();
		if (!title) return "Title cannot be empty.";
		const taken = (options.existingTitles ?? []).map((entry) => entry.trim().toLowerCase());
		if (taken.includes(title.toLowerCase())) return "A milestone with that title already exists.";
	}
	for (const field of MILESTONE_DATE_FIELDS) {
		const value = values[field].trim();
		if (value && !isValidMilestoneDate(value)) {
			return `${FIELD_LABELS[field]} must be YYYY-MM-DD (or YYYY-MM-DD HH:mm).`;
		}
	}
	return null;
}

/**
 * The description and dates as `createMilestone`/`updateMilestone` take them. An empty string is
 * both "no date" and how one is cleared, so a field the user emptied is removed rather than kept.
 */
export function toMilestoneWriteOptions(
	values: MilestoneFormValues,
): Pick<MilestoneCreateOptions, "description" | MilestoneDateField> {
	const trimmed = (value: string) => value.trim();
	return {
		description: trimmed(values.description),
		dueDate: trimmed(values.dueDate),
		plannedStart: trimmed(values.plannedStart),
		plannedEnd: trimmed(values.plannedEnd),
		actualStart: trimmed(values.actualStart),
		actualEnd: trimmed(values.actualEnd),
	};
}

/** Row of every field inside the scrolled form; the description is the one multi-row field. */
function getMilestoneFormLayout(mode: MilestoneFormMode): {
	tops: Record<MilestoneFormField, number>;
	actionsTop: number;
	contentHeight: number;
} {
	let row = 0;
	const tops = {} as Record<MilestoneFormField, number>;
	// An edit shows the milestone as a heading where a create shows the title input.
	if (mode === "create") {
		tops.title = row;
		row += 1;
	} else {
		row += 1;
	}
	tops.description = row;
	row += DESCRIPTION_HEIGHT;
	for (const field of MILESTONE_DATE_FIELDS) {
		tops[field] = row;
		row += 1;
	}
	return { tops, actionsTop: row, contentHeight: row + 1 };
}

const LABEL_WIDTH = 14;
const DESCRIPTION_HEIGHT = 3;
const PREFERRED_POPUP_WIDTH = 72;
/** Two popup borders, the form's one-row inset, the actions row and the help row below it. */
const POPUP_CHROME_ROWS = 5;

const HELP_TEXT: Record<MilestoneFormMode, string> = {
	create: " {cyan-fg}[Tab/↑↓]{/} Next field | {cyan-fg}[Enter]{/} Create | {cyan-fg}[Esc]{/} Cancel",
	edit: " {cyan-fg}[Tab/↑↓]{/} Next field | {cyan-fg}[Enter]{/} Save | {cyan-fg}[Esc]{/} Cancel",
};

type TextField = MilestoneFormField | "save" | "cancel";

type ReadableInput = TextboxInterface & {
	_reading?: boolean;
	_done?: (error: null, value: string | null) => void;
};

/**
 * readInput() puts the screen into grab-all-keys mode, and only the input's own _done() releases it.
 * Tearing the form down while a field still holds the keys would leave every later keypress dead —
 * including the host's quit — so the read is always ended before the widgets are destroyed.
 */
function endInputRead(screen: ScreenInterface, input: TextboxInterface): void {
	const readable = input as ReadableInput;
	if (!readable._reading) return;
	if (readable._done) {
		readable._done(null, null);
		return;
	}
	readable._reading = false;
	(screen as ScreenInterface & { grabKeys?: boolean }).grabKeys = false;
}

export type MilestoneFormOptions = {
	screen: ScreenInterface;
	mode: MilestoneFormMode;
	/** The milestone being edited; its values seed the form. */
	milestone?: Milestone;
	/** Titles already in use, so create can refuse a duplicate. */
	existingTitles?: string[];
};

/**
 * Ask for a milestone's description and dates. Resolves with the values, or null when cancelled.
 */
export async function openMilestoneForm(options: MilestoneFormOptions): Promise<MilestoneFormValues | null> {
	return new Promise<MilestoneFormValues | null>((resolve) => {
		const { screen, mode } = options;
		const values = milestoneFormValues(options.milestone, mode);
		const fields = getMilestoneFormFields(mode);
		const layout = getMilestoneFormLayout(mode);
		// The popup never grows past the screen, and never so small that one field is clipped. Both
		// the opening size and the size a resize reflows to come from here.
		const screenWidth = typeof screen.width === "number" ? screen.width : 120;
		const screenHeight = typeof screen.height === "number" ? screen.height : 40;
		const fitPopup = () => ({
			width: Math.max(1, Math.min(PREFERRED_POPUP_WIDTH, screenWidth - 4)),
			height: Math.max(6, Math.min(screenHeight, layout.contentHeight + POPUP_CHROME_ROWS)),
		});

		const { popup, close, reflow } = createPopupChrome({
			screen,
			title: mode === "create" ? "New Milestone" : "Edit Milestone",
			helpText: HELP_TEXT[mode],
			...fitPopup(),
		});

		// Short terminals cannot show every field at once, so the fields live in a viewport that
		// clips them to the popup and scrolls the focused one into view.
		const form = createScrollableViewport({
			parent: popup,
			top: 1,
			left: 1,
			right: 1,
			bottom: 2,
			keys: false,
			mouse: true,
		});

		const inputs = new Map<MilestoneFormField, TextboxInterface>();

		/** A read-only caption; the label of a single-row input, which the widget cannot draw itself. */
		const addLabel = (field: MilestoneFormField, top: number) =>
			box({
				parent: form,
				top,
				left: 1,
				width: LABEL_WIDTH,
				height: 1,
				tags: true,
				content: `${FIELD_LABELS[field]}:`,
			});

		for (const field of fields) {
			const top = layout.tops[field];
			if (field === "description") {
				inputs.set(
					field,
					textareaWidget({
						parent: form,
						top,
						left: 1,
						right: 1,
						height: DESCRIPTION_HEIGHT,
						border: { type: "line" },
						label: " Description ",
						keys: true,
						mouse: true,
						inputOnFocus: false,
						scrollable: true,
						style: { border: { fg: "gray" } },
					}) as TextboxInterface,
				);
				continue;
			}
			addLabel(field, top);
			inputs.set(
				field,
				textbox({
					parent: form,
					top,
					left: LABEL_WIDTH + 1,
					right: 1,
					height: 1,
					inputOnFocus: false,
					mouse: true,
					keys: true,
					// The single-row inputs inherit scroll keys from their scrollable base; they are
					// bound to field movement here instead.
					ignoreKeys: true,
					style: { focus: { inverse: true, bold: true } },
				}),
			);
		}

		const saveAction = box({
			parent: form,
			top: layout.actionsTop,
			left: 3,
			width: 20,
			height: 1,
			align: "center",
			content: mode === "create" ? "Create milestone" : "Save changes",
			keys: true,
			mouse: true,
			style: { fg: "green" },
		});
		const cancelAction = box({
			parent: form,
			top: layout.actionsTop,
			left: 25,
			width: 14,
			height: 1,
			align: "center",
			content: "Cancel",
			keys: true,
			mouse: true,
			style: { fg: "gray" },
		});
		const errorLine = box({
			parent: popup,
			bottom: 1,
			left: 2,
			right: 2,
			height: 1,
			tags: true,
			content: "",
		});

		for (const [field, input] of inputs) input.setValue?.(values[field]);

		let settled = false;
		let activeField: TextField = fields[0] ?? "cancel";

		// The fields plus the two actions, in the order Tab walks them and keys are bound.
		const widgets = new Map<TextField, BoxInterface | TextboxInterface>(inputs);
		widgets.set("save", saveAction);
		widgets.set("cancel", cancelAction);

		const error = (message: string) => {
			errorLine.setContent(`{red-fg}${message}{/}`);
			screen.render();
		};

		const syncValues = () => {
			for (const [field, input] of inputs) values[field] = String(input.getValue?.() ?? "");
		};

		const scrollFieldIntoView = (field: TextField) => {
			const row = field === "save" || field === "cancel" ? layout.actionsTop : layout.tops[field];
			const visibleHeight = typeof form.height === "number" ? form.height : layout.contentHeight;
			const target = Math.max(0, row - Math.max(0, visibleHeight - 2));
			form.childBase = Math.min(Math.max(0, layout.contentHeight - visibleHeight), target);
		};

		/** Show which field owns the keyboard: the description's border and the two actions. */
		const applyFieldStyles = (field: TextField) => {
			const description = inputs.get("description");
			if (description) {
				const style = (description.style ?? {}) as { border?: { fg?: string } };
				style.border ??= {};
				style.border.fg = field === "description" ? "yellow" : "gray";
				description.style = style;
			}
			for (const [action, name] of [
				[saveAction, "save"],
				[cancelAction, "cancel"],
			] as const) {
				const style = (action.style ?? {}) as { inverse?: boolean; bold?: boolean };
				style.inverse = field === name;
				style.bold = field === name;
				action.style = style;
			}
		};

		const focusField = (field: TextField) => {
			const previous = inputs.get(activeField as MilestoneFormField);
			if (previous) endInputRead(screen, previous);
			activeField = field;
			applyFieldStyles(field);
			widgets.get(field)?.focus();
			if (inputs.has(field as MilestoneFormField)) {
				(inputs.get(field as MilestoneFormField) as TextboxInterface).readInput?.();
			}
			scrollFieldIntoView(field);
			screen.render();
		};

		/** Tab traversal over the fields and then the two actions, wrapping at both ends. */
		const moveFocus = (step: number) => {
			const order: TextField[] = [...fields, "save", "cancel"];
			const index = order.indexOf(activeField);
			const next = order[(index + step + order.length) % order.length];
			if (next) focusField(next);
		};

		const finish = (result: MilestoneFormValues | null) => {
			if (settled) return;
			settled = true;
			(
				screen as ScreenInterface & { removeListener(event: string, listener: (...args: unknown[]) => void): void }
			).removeListener("resize", onResize);
			for (const input of inputs.values()) endInputRead(screen, input);
			close();
			screen.render();
			resolve(result);
		};

		const submit = () => {
			syncValues();
			const problem = validateMilestoneForm(values, { mode, existingTitles: options.existingTitles });
			if (problem) {
				error(problem);
				// A missing title is the one mistake worth walking back to; the rest stay put.
				if (mode === "create" && !values.title.trim()) focusField("title");
				return;
			}
			finish(values);
		};

		const cancel = () => finish(null);

		// The focused widget is the only one blessed delivers a key to, so every field binds the
		// form's own keys. Returning false keeps the widget from handling them itself.
		for (const [field, widget] of inputs) {
			widget.key(["enter"], () => {
				submit();
				return false;
			});
			widget.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			widget.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
			// The description owns ↑↓ for its own caret, so it moves on Tab alone.
			if (field !== "description") {
				for (const direction of ["up", "down"] as const) {
					widget.key([direction], () => {
						moveFocus(direction === "down" ? 1 : -1);
						return false;
					});
				}
			}
			widget.on("click", () => {
				focusField(field);
				return false;
			});
			widget.on("keypress", () => {
				errorLine.setContent("");
			});
		}

		// A key held by a widget that is torn down is lost, so cancel is bound on the popup too: the
		// keys pressed before the first field takes the focus still belong to the form.
		for (const target of [...widgets.values(), popup]) {
			target.key(["escape"], () => {
				cancel();
				return false;
			});
		}

		saveAction.key(["enter", "space"], () => {
			submit();
			return false;
		});
		saveAction.on("click", () => submit());
		cancelAction.key(["enter", "space"], () => {
			cancel();
			return false;
		});
		cancelAction.on("click", () => cancel());
		for (const [action, step, direction] of [
			[saveAction, 1, "down"],
			[cancelAction, 1, "down"],
			[saveAction, -1, "up"],
			[cancelAction, -1, "up"],
		] as const) {
			action.key([direction], () => {
				moveFocus(step);
				return false;
			});
		}

		const onResize = () => {
			syncValues();
			reflow(fitPopup().width, fitPopup().height, HELP_TEXT[mode]);
			scrollFieldIntoView(activeField);
			screen.render();
		};
		screen.on("resize", onResize);

		setImmediate(() => {
			if (settled) return;
			focusField(activeField);
		});
	});
}
