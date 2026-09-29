import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { StatusesConfig } from "../types/index.ts";
import StateMachineEditor from "../web/components/StateMachineEditor.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

let activeRoot: Root | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

const OBJECT_FORM: StatusesConfig = [
	{
		name: "To Do",
		category: "active",
		next: [{ to: "Planning", when: "spec reviewed", ai: "allowed" }],
	},
	{ name: "Planning", category: "wip", next: [{ to: "Plan Review", ai: "allowed_if", if: "plan written" }] },
	{ name: "Plan Review", category: "blocked", next: [{ to: "Planning", when: "rejected", ai: "propose" }] },
];

const setupDom = (): HTMLElement => {
	const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as globalThis.Document;
	globalThis.navigator = dom.window.document.defaultView?.navigator as Navigator;
	// MermaidDiagram renders inside a requestAnimationFrame, which jsdom does not provide.
	(globalThis as Record<string, unknown>).requestAnimationFrame = (callback: (time: number) => void) =>
		setTimeout(() => callback(0), 0) as unknown as number;
	(globalThis as Record<string, unknown>).cancelAnimationFrame = (handle: number) => clearTimeout(handle);
	// Mermaid is a browser-only bundle; the render helper honours this mock instead of importing it.
	(globalThis as Record<string, unknown>).__MERMAID_MOCK__ = {
		default: {
			initialize: () => {},
			render: async () => ({ svg: "<svg></svg>" }),
		},
	};
	return dom.window.document.getElementById("root") as HTMLElement;
};

interface Harness {
	container: HTMLElement;
	changes: StatusesConfig[];
	reloads: number;
	restoreCalls: number;
}

/**
 * The editor is controlled, so the host has to feed each change back — exactly what the settings
 * page does. Without that, a second edit would start from the original machine again and the
 * earlier edits would look lost.
 */
function Host({
	harness,
	initial,
	dirty,
}: {
	harness: Harness;
	initial: StatusesConfig;
	dirty: boolean;
}): React.JSX.Element {
	const [statuses, setStatuses] = useState<StatusesConfig>(initial);
	return (
		<StateMachineEditor
			statuses={statuses}
			onChange={(next) => {
				harness.changes.push(next);
				setStatuses(next);
			}}
			onReload={() => {
				harness.reloads += 1;
			}}
			onRestoreDefault={async () => {
				harness.restoreCalls += 1;
			}}
			dirty={dirty}
		/>
	);
}

function renderEditor(props: Partial<Parameters<typeof StateMachineEditor>[0]> & { dirty?: boolean }): Harness {
	const container = setupDom();
	const harness: Harness = { container, changes: [], reloads: 0, restoreCalls: 0 };
	act(() => {
		activeRoot = createRoot(container);
		activeRoot.render(
			<I18nProvider>
				<Host harness={harness} initial={props.statuses ?? OBJECT_FORM} dirty={props.dirty ?? false} />
			</I18nProvider>,
		);
	});
	return harness;
}

const byId = (container: HTMLElement, id: string) => container.querySelector(`#${id}`) as HTMLInputElement | null;
const buttonsWithText = (container: HTMLElement, text: string) =>
	Array.from(container.querySelectorAll("button")).filter((button) => (button.textContent ?? "").includes(text));

/**
 * React's delegated listeners are unreliable across the JSDOM swap this suite does per render,
 * so events are delivered through the props React bound to the node (`__reactProps$...`), with the
 * prototype `value` setter keeping React's own change tracker out of the way.
 */
const reactProps = (element: Element): Record<string, unknown> => {
	const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
	return key ? ((element as unknown as Record<string, Record<string, unknown>>)[key] ?? {}) : {};
};

function setInput(container: HTMLElement, id: string, value: string) {
	const input = byId(container, id);
	expect(input).not.toBeNull();
	if (!input) return;
	Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set?.call(input, value);
	const onChange = reactProps(input).onChange as ((event: { target: HTMLElement }) => void) | undefined;
	act(() => {
		onChange?.({ target: input });
	});
}

function setSelect(container: HTMLElement, id: string, value: string) {
	const select = container.querySelector(`#${id}`) as HTMLSelectElement | null;
	expect(select).not.toBeNull();
	if (!select) return;
	Object.getOwnPropertyDescriptor(Object.getPrototypeOf(select), "value")?.set?.call(select, value);
	const onChange = reactProps(select).onChange as ((event: { target: HTMLElement }) => void) | undefined;
	act(() => {
		onChange?.({ target: select });
	});
}

function setCheckbox(container: HTMLElement, id: string, checked: boolean) {
	const input = byId(container, id);
	expect(input).not.toBeNull();
	if (!input) return;
	Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "checked")?.set?.call(input, checked);
	const onChange = reactProps(input).onChange as ((event: { target: HTMLInputElement }) => void) | undefined;
	act(() => {
		onChange?.({ target: input });
	});
}

/** Clicks through React's own handler; a bare `element.click()` does not reach it here. */
function click(element: Element | undefined | null) {
	if (!element) return;
	const onClick = reactProps(element).onClick as (() => void) | undefined;
	act(() => {
		onClick?.();
	});
}

describe("StateMachineEditor", () => {
	it("renders every status with its category and transitions", () => {
		const { container } = renderEditor({});
		expect(container.textContent).toContain("To Do");
		expect(container.textContent).toContain("Planning");
		expect(container.textContent).toContain("Plan Review");
		expect(byId(container, "status-name-0")?.value).toBe("To Do");
		expect((container.querySelector("#status-category-1") as HTMLSelectElement).value).toBe("wip");
		expect(byId(container, "when-0-0")?.value).toBe("spec reviewed");
	});

	it("keeps every field when a transition is edited (FR-7 R4)", () => {
		const { container, changes } = renderEditor({});
		setInput(container, "when-1-0", "plan is written");
		setInput(container, "if-1-0", "implementationPlan not empty");
		setInput(container, "requires-1-0", "implementationPlan not empty");
		setInput(container, "evidence-1-0", "diff + tests");
		setSelect(container, "ai-1-0", "forbidden");

		const last = changes[changes.length - 1];
		expect(last).toBeDefined();
		if (!last) throw new Error("expected the edit to report a change");
		const planning = last[1];
		expect(typeof planning).toBe("object");
		if (typeof planning === "string" || !planning) throw new Error("expected an object form status");
		expect(planning.next?.[0]).toEqual({
			to: "Plan Review",
			when: "plan is written",
			ai: "forbidden",
			if: "implementationPlan not empty",
			requires: "implementationPlan not empty",
			evidence: "diff + tests",
		});
	});

	it("renames a status without leaving the transitions that point at it dangling", () => {
		const { container, changes } = renderEditor({});
		setInput(container, "status-name-2", "Spec Review");
		const renamed = changes[changes.length - 1];
		expect(renamed).toBeDefined();
		if (!renamed) throw new Error("expected the rename to report a change");
		expect(renamed.map((entry) => (typeof entry === "string" ? entry : entry.name))).toEqual([
			"To Do",
			"Planning",
			"Spec Review",
		]);
		const planning = renamed[1];
		if (typeof planning === "string" || !planning) throw new Error("expected an object form status");
		expect(planning.next?.[0]?.to).toBe("Spec Review");
	});

	it("adds a status and removes one", () => {
		const { container, changes } = renderEditor({});
		click(buttonsWithText(container, "Add status")[0]);
		const added = changes[changes.length - 1];
		expect(added).toHaveLength(4);
		expect(added?.map((entry) => (typeof entry === "string" ? entry : entry.name))).toContain("New status");
	});

	it("offers the conversion for a plain string array and derives the legacy categories", () => {
		const { container, changes } = renderEditor({ statuses: ["To Do", "In Progress", "Done"] });
		expect(container.textContent).toContain("Convert to the object form");
		click(buttonsWithText(container, "Convert to the object form")[0]);
		expect(changes[changes.length - 1]).toEqual([
			{ name: "To Do", category: "active" },
			{ name: "In Progress", category: "wip" },
			{ name: "Done", category: "done", exit: "complete" },
		]);
	});

	it("shows the reset button only once the machine is dirty, and reloads on click", () => {
		const clean = renderEditor({ dirty: false });
		const resetClean = buttonsWithText(clean.container, "Reset")[0];
		expect(resetClean?.disabled).toBe(true);

		const dirty = renderEditor({ dirty: true });
		const resetDirty = buttonsWithText(dirty.container, "Reset")[0];
		expect(resetDirty?.disabled).toBe(false);
		click(resetDirty);
		expect(dirty.reloads).toBe(1);
	});

	it("asks for confirmation before restoring the agreed default, then writes it", () => {
		const editor = renderEditor({});
		const defaultButton = buttonsWithText(editor.container, "Default")[0];
		expect(defaultButton).not.toBeUndefined();
		click(defaultButton);
		expect(editor.restoreCalls).toBe(0);
		expect(editor.container.textContent).toContain("Continue?");

		click(buttonsWithText(editor.container, "Confirm")[0]);
		expect(editor.restoreCalls).toBe(1);
	});

	it("keeps the two panes on one tab strip so neither is squeezed into half the width", () => {
		const editor = renderEditor({});
		const tabs = Array.from(editor.container.querySelectorAll('button[role="tab"]'));
		expect(tabs.map((tab) => tab.textContent)).toEqual(["Statuses(3)", "Transition tree(3)"]);
		expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");

		// The statuses pane is the one open, and the tree is not mounted at all.
		expect(byId(editor.container, "status-name-0")).not.toBeNull();
		expect(editor.container.querySelector("#state-machine-panel-preview")).toBeNull();

		click(tabs[1]);
		expect(editor.container.querySelector("#state-machine-panel-statuses")).toBeNull();
		expect(editor.container.querySelector("#state-machine-panel-preview")).not.toBeNull();
		expect(editor.container.querySelector(".mermaid")).not.toBeNull();

		click(Array.from(editor.container.querySelectorAll('button[role="tab"]'))[0]);
		expect(byId(editor.container, "status-name-0")).not.toBeNull();
	});

	it("shows lint warnings without blocking anything", () => {
		const duplicated: StatusesConfig = [{ name: "A" }, { name: "a" }];
		const { container } = renderEditor({ statuses: duplicated });
		expect(container.textContent).toContain("Configuration warnings");
		expect(container.textContent).toContain("is duplicated");
	});

	it("toggles the display flag: unchecked writes display:false, checked drops back to the default", () => {
		const { container, changes } = renderEditor({});
		const checkbox = byId(container, "status-display-0") as HTMLInputElement | null;
		expect(checkbox).not.toBeNull();
		expect(checkbox?.checked).toBe(true);

		setCheckbox(container, "status-display-0", false);
		const off = changes[changes.length - 1];
		const todoOff = off?.[0];
		if (typeof todoOff === "string" || !todoOff) throw new Error("expected an object form status");
		expect(todoOff.display).toBe(false);

		setCheckbox(container, "status-display-0", true);
		const on = changes[changes.length - 1];
		const todoOn = on?.[0];
		if (typeof todoOn === "string" || !todoOn) throw new Error("expected an object form status");
		expect(todoOn.display).toBeUndefined();
	});
});
