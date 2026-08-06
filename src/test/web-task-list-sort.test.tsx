import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskList from "../web/components/TaskList.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const createTask = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

const sortTasks: Task[] = [
	createTask({ id: "task-1", title: "Zebra", ordinal: 30 }),
	createTask({ id: "task-2", title: "Apple", ordinal: 10 }),
	createTask({ id: "task-3", title: "Mango" }),
	createTask({ id: "task-4", title: "Banana", ordinal: 20 }),
];

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

	if (!window.matchMedia) {
		window.matchMedia = () =>
			({
				matches: false,
				media: "",
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}) as MediaQueryList;
	}

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const renderTaskList = (tasks: Task[]): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<MemoryRouter>
					<TaskList
						tasks={tasks}
						availableStatuses={["To Do", "In Progress", "Done"]}
						availableLabels={[]}
						availableMilestones={[]}
						milestoneEntities={[]}
						archivedMilestones={[]}
						onEditTask={() => {}}
						onNewTask={() => {}}
					/>
				</MemoryRouter>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const getHeaderButton = (container: HTMLElement, label: string): HTMLButtonElement => {
	const buttons = Array.from(container.querySelectorAll("th button"));
	const button = buttons.find((element) => element.textContent?.includes(label));
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

const getRowIds = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("tbody tr td:first-child")).map(
		(element) => element.textContent?.trim() ?? "",
	);

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskList sorting", () => {
	it("defaults to ordinal sort", () => {
		const container = renderTaskList(sortTasks);

		expect(getRowIds(container)).toEqual(["task-2", "task-4", "task-1", "task-3"]);
	});

	it("cycles column sort through ascending, descending, and cleared back to ordinal", async () => {
		const container = renderTaskList(sortTasks);
		const idHeader = getHeaderButton(container, "ID");

		await clickElement(idHeader);
		expect(getRowIds(container)).toEqual(["task-1", "task-2", "task-3", "task-4"]);

		await clickElement(idHeader);
		expect(getRowIds(container)).toEqual(["task-4", "task-3", "task-2", "task-1"]);

		await clickElement(idHeader);
		expect(getRowIds(container)).toEqual(["task-2", "task-4", "task-1", "task-3"]);
	});

	it("clears one column sort and restores ordinal when clicking a different column", async () => {
		const container = renderTaskList(sortTasks);
		const idHeader = getHeaderButton(container, "ID");
		const titleHeader = getHeaderButton(container, "Title");

		await clickElement(idHeader);
		await clickElement(idHeader);
		expect(getRowIds(container)).toEqual(["task-4", "task-3", "task-2", "task-1"]);

		await clickElement(titleHeader);
		expect(getRowIds(container)).toEqual(["task-2", "task-4", "task-3", "task-1"]);

		await clickElement(titleHeader);
		await clickElement(titleHeader);
		expect(getRowIds(container)).toEqual(["task-2", "task-4", "task-1", "task-3"]);
	});
});
