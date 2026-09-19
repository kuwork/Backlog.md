import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import DependencyInput from "../web/components/DependencyInput.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

/** Part of the board corpus, so the input can find it without help. */
const activeTask: Task = {
	id: "BACK-10",
	title: "An active board task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [],
};

/** Outside the board corpus: its record lives in backlog/completed. */
const completedTask: Task = {
	id: "BACK-624",
	title: "Global Spotlight-style search dialog for Web UI",
	status: "Done",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [],
	source: "completed",
};

const DEBOUNCE_MS = 250;

let activeRoot: Root | null = null;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	// React's input-event polyfill reaches for attachEvent when it focuses the field, which jsdom
	// does not implement; the same stub the other component tests install.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

async function renderInput(options: {
	searchCompletedTasks?: (query: string) => Promise<Task[]>;
	onChange: (values: string[]) => void;
}): Promise<void> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<MemoryRouter>
					<DependencyInput
						value={[]}
						onChange={options.onChange}
						availableTasks={[activeTask]}
						searchCompletedTasks={options.searchCompletedTasks}
					/>
				</MemoryRouter>
			</I18nProvider>,
		);
	});
}

/** React's change polyfill ignores a plain value assignment, so drive the prototype setter. */
function typeInto(element: HTMLTextAreaElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
	setter?.call(element, value);
	element.dispatchEvent(new window.Event("input", { bubbles: true }));
}

async function type(query: string): Promise<void> {
	const textarea = document.getElementById("dependency-input") as HTMLTextAreaElement;
	await act(async () => {
		typeInto(textarea, query);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 50));
	});
}

function suggestionRows(): HTMLButtonElement[] {
	return Array.from(document.querySelectorAll("button")).filter((button) =>
		button.textContent?.includes("BACK-"),
	) as HTMLButtonElement[];
}

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
});

describe("completed records in the dependency input suggestions", () => {
	it("offers a matching completed task and marks it as completed", async () => {
		await renderInput({ onChange: () => {}, searchCompletedTasks: async () => [completedTask] });

		await type("spotlight");

		const rows = suggestionRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.textContent).toContain("BACK-624");
		expect(rows[0]?.textContent).toContain(completedTask.title);
		expect(rows[0]?.textContent).toContain("Completed");
		// The marker is the task list's shared completed badge, so it carries that green background
		// instead of a one-off gray chip.
		const badgeClass = rows[0]?.querySelector("[title]")?.getAttribute("class") ?? "";
		expect(badgeClass).toContain("bg-emerald-600");
		expect(badgeClass).not.toContain("bg-gray-200");
	});

	it("adds the completed task as a dependency when it is chosen", async () => {
		const added: string[][] = [];
		await renderInput({
			onChange: (values) => added.push(values),
			searchCompletedTasks: async () => [completedTask],
		});

		await type("spotlight");
		const [row] = suggestionRows();
		await act(async () => {
			row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
		});

		expect(added).toEqual([["BACK-624"]]);
	});

	it("keeps board-corpus suggestions unchanged when no completed search is wired", async () => {
		await renderInput({ onChange: () => {} });

		await type("active");

		const rows = suggestionRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.textContent).toContain("BACK-10");
		expect(rows[0]?.textContent).not.toContain("Completed");
	});
});
