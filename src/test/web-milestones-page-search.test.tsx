import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { setNativeInputValue } from "./react-dom-input.ts";

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

const milestoneEntities: Milestone[] = [
	{
		id: "m-1",
		title: "Release 1",
		description: "Milestone: Release 1",
		rawContent: "## Description\n\nMilestone: Release 1",
	},
	{
		id: "m-2",
		title: "Release 2",
		description: "Milestone: Release 2",
		rawContent: "## Description\n\nMilestone: Release 2",
	},
];

const baseTasks: Task[] = [
	createTask({ id: "task-101", title: "Setup authentication flow", status: "In Progress", milestone: "m-1" }),
	createTask({ id: "task-202", title: "Deploy pipeline", status: "To Do", milestone: "m-1", labels: ["backend-infra"] }),
	createTask({ id: "task-404", title: "Ship docs site", status: "To Do", milestone: "m-2", description: "Publishes the needle-body-content portal." }),
	createTask({ id: "task-303", title: "Draft release notes", status: "To Do" }),
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

const renderPage = (tasks: Task[] = baseTasks): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<I18nProvider initialLocale="en">
					<MilestonesPage
						tasks={tasks}
						statuses={["To Do", "In Progress", "Done"]}
						milestoneEntities={milestoneEntities}
						archivedMilestones={[]}
						onEditTask={() => {}}
					/>
				</I18nProvider>
			</MemoryRouter>,
		);
	});
	return container as HTMLElement;
};

const getSearchInput = (container: HTMLElement): HTMLInputElement => {
	const input = container.querySelector("input[aria-label='Search milestones']");
	expect(input).toBeTruthy();
	return input as HTMLInputElement;
};

const setSearchValue = (container: HTMLElement, value: string) => {
	const input = getSearchInput(container);
	act(() => {
		setNativeInputValue(input, value);
	});
};

const titles = () => ({
	auth: "Setup authentication flow",
	pipeline: "Deploy pipeline",
	docs: "Ship docs site",
	notes: "Draft release notes",
});

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web milestones page search", () => {
	it("renders the search input next to the header", () => {
		const container = renderPage();
		expect(container.textContent).toContain("Milestones");
		const input = getSearchInput(container);
		expect(input.disabled).toBe(false);
	});

	it("routes label queries through the shared task index", () => {
		const container = renderPage();
		// "backend-infra" appears in no id or title, so only the shared index can answer it.
		setSearchValue(container, "backend-infra");
		const text = container.textContent ?? "";
		expect(text).toContain(titles().pipeline);
		expect(text).not.toContain(titles().auth);
		expect(text).not.toContain(titles().docs);
	});

	it("routes body queries through the shared task index", () => {
		const container = renderPage();
		setSearchValue(container, "needle-body-content");
		const text = container.textContent ?? "";
		expect(text).toContain(titles().docs);
		expect(text).not.toContain(titles().pipeline);
	});

	it("keeps the exact-id pre-match short-circuit exclusive", () => {
		const container = renderPage();
		setSearchValue(container, "task-404");
		const text = container.textContent ?? "";
		expect(text).toContain(titles().docs);
		expect(text).not.toContain(titles().auth);
		expect(text).not.toContain(titles().pipeline);
		expect(text).not.toContain(titles().notes);
	});

	it("keeps the substring pre-match on id and title", () => {
		const container = renderPage();
		setSearchValue(container, "pipeline");
		const text = container.textContent ?? "";
		expect(text).toContain(titles().pipeline);
		expect(text).not.toContain(titles().auth);
	});

	it("shows the no-match state while keeping the milestone sections", () => {
		const container = renderPage();
		setSearchValue(container, "zzzz-no-match");
		const text = container.textContent ?? "";
		expect(text).toContain('No milestones match "zzzz-no-match".');
		expect(text).toContain("Release 1");
		expect(text).toContain("Release 2");
	});
});
