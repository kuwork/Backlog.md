import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import BoardPage from "../web/components/BoardPage.tsx";
import TaskList from "../web/components/TaskList.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const STATUSES = ["To Do", "In Progress", "Done"];

/** Board corpus: on the board whether or not the checkbox is ticked. */
const ACTIVE_TASK_TITLE = "An active board task";
const activeTask: Task = {
	id: "BACK-500",
	title: ACTIVE_TASK_TITLE,
	status: "To Do",
	assignee: ["alice"],
	labels: [],
	dependencies: [],
	createdDate: "2026-08-01 10:00",
};

/** Completed corpus: served only when the request asks for it. */
const COMPLETED_TASK_TITLE = "A record in the completed archive";
const completedTask: Task = {
	id: "BACK-624",
	title: COMPLETED_TASK_TITLE,
	status: "Done",
	assignee: ["bob"],
	labels: [],
	dependencies: [],
	createdDate: "2026-08-01 10:00",
	source: "completed",
	// A priority, so the card's badge group has the priority badge the marker must sit beside.
	priority: "high",
};

const originalFetch = globalThis.fetch;
let activeRoot: Root | null = null;
/** Every /api/search the views issued, so a test can prove which corpus was requested. */
let searchRequests: string[] = [];

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** The stubbed server only hands over the completed record when the request asks for it. */
function serveApi(): void {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const url = new URL(raw, "http://localhost");

		if (url.pathname === "/api/search") {
			searchRequests.push(`?${url.searchParams.toString()}`);
			const includeCompleted = url.searchParams.get("completed") === "true";
			const corpus = includeCompleted ? [activeTask, completedTask] : [activeTask];
			return json(corpus.map((task) => ({ type: "task", task })));
		}
		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

function setupDom(path: string): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;

	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}

	// React's change-event polyfill probes for attachEvent/detachEvent on the element prototype.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: unknown;
		detachEvent?: unknown;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
		htmlElementPrototype.detachEvent = () => {};
	}

	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function renderBoard(path = "/board"): Promise<HTMLElement> {
	const container = setupDom(path);
	serveApi();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<BrowserRouter>
					<BoardPage
						tasks={[activeTask]}
						statuses={STATUSES}
						milestones={[]}
						availableLabels={[]}
						milestoneEntities={[]}
						archivedMilestones={[]}
						isLoading={false}
						onEditTask={() => {}}
						onNewTask={() => {}}
					/>
				</BrowserRouter>
			</I18nProvider>,
		);
	});
	await flush();
	return container;
}

async function renderTaskList(path = "/task-list"): Promise<HTMLElement> {
	const container = setupDom(path);
	serveApi();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<BrowserRouter>
					<TaskList
						tasks={[activeTask]}
						availableStatuses={STATUSES}
						availableLabels={[]}
						availableMilestones={[]}
						milestoneEntities={[]}
						archivedMilestones={[]}
						onEditTask={() => {}}
						onNewTask={() => {}}
					/>
				</BrowserRouter>
			</I18nProvider>,
		);
	});
	await flush();
	return container;
}

function completedToggle(container: HTMLElement, view: "board" | "task-list"): HTMLInputElement {
	const input = container.querySelector(`input#${view}-completed-filter`);
	expect(input).toBeTruthy();
	expect(input?.getAttribute("type")).toBe("checkbox");
	return input as HTMLInputElement;
}

function toggleLabel(input: HTMLInputElement): HTMLLabelElement {
	const label = input.closest("label");
	expect(label).toBeTruthy();
	expect(label?.textContent?.trim()).toBe("Show completed");
	return label as HTMLLabelElement;
}

/** The completed marker carries the read-only corpus hint as its tooltip. */
function completedBadge(container: HTMLElement): HTMLElement {
	const badge = Array.from(container.querySelectorAll("span")).find(
		(element) => element.textContent?.trim() === "Completed",
	);
	expect(badge).toBeTruthy();
	expect(badge?.getAttribute("title")).toContain("completed archive");
	// The marker wears the emerald of the task modal's mark-completed button.
	expect(badge?.className).toContain("bg-emerald-600");
	expect(badge?.className).toContain("dark:bg-emerald-700");
	return badge as HTMLElement;
}

function clearFiltersButton(container: HTMLElement): HTMLButtonElement | undefined {
	return Array.from(container.querySelectorAll("button")).find((button) =>
		button.textContent?.trim().includes("Clear filters"),
	) as HTMLButtonElement | undefined;
}

function selectWithFirstOption(container: HTMLElement, firstOption: string): HTMLSelectElement {
	const select = Array.from(container.querySelectorAll("select")).find(
		(element) => element.options[0]?.textContent === firstOption,
	);
	expect(select).toBeTruthy();
	return select as HTMLSelectElement;
}

async function tick(checkbox: HTMLInputElement): Promise<void> {
	await act(async () => {
		checkbox.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
	await flush();
}

async function setSelectValue(select: HTMLSelectElement, value: string): Promise<void> {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
		valueSetter?.call(select, value);
		select.dispatchEvent(new window.Event("change", { bubbles: true }));
		await Promise.resolve();
	});
	await flush();
}

async function clickButton(button: HTMLButtonElement | undefined): Promise<void> {
	await act(async () => {
		button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
	await flush();
}

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	searchRequests = [];
	globalThis.fetch = originalFetch;
});

describe("Web completed-corpus filter checkbox", () => {
	it("keeps completed records off the board until the box is ticked, and clears both together", async () => {
		const container = await renderBoard();

		const toggle = completedToggle(container, "board");
		expect(toggle.checked).toBe(false);
		expect(container.textContent).toContain(ACTIVE_TASK_TITLE);
		expect(container.textContent).not.toContain(COMPLETED_TASK_TITLE);
		// Nothing asked the server for the widened corpus while the box was unchecked.
		expect(searchRequests.every((request) => !request.includes("completed=true"))).toBe(true);
		expect(clearFiltersButton(container)).toBeUndefined();

		await tick(toggle);

		expect(new URLSearchParams(window.location.search).get("completed")).toBe("1");
		expect(container.textContent).toContain(COMPLETED_TASK_TITLE);
		const badge = completedBadge(container);
		// The marker is a badge like the priority one, so it belongs in the card header's
		// right-hand group, directly left of the priority badge - not beside the task ID.
		expect(badge.parentElement?.textContent).toContain("High");
		expect(badge.nextElementSibling?.textContent?.trim()).toBe("High");
		expect(badge.parentElement?.textContent).not.toContain("BACK-624");
		expect(searchRequests.some((request) => request.includes("completed=true"))).toBe(true);
		// The widened search answers with the board corpus as well; appending it must not
		// render the active task twice.
		expect((container.textContent ?? "").split(ACTIVE_TASK_TITLE)).toHaveLength(2);

		// A completed card must not be draggable: a status drag would try to write into the archive.
		const cards = Array.from(container.querySelectorAll("[draggable]"));
		const completedCard = cards.find((card) => card.textContent?.includes(COMPLETED_TASK_TITLE));
		const activeCard = cards.find((card) => card.textContent?.includes(ACTIVE_TASK_TITLE));
		expect(completedCard?.getAttribute("draggable")).toBe("false");
		expect(activeCard?.getAttribute("draggable")).toBe("true");

		// Ticking the box counts as a filter, so the clear button appears directly behind the
		// toggle instead of somewhere else in the row.
		const clear = clearFiltersButton(container);
		expect(clear).toBeTruthy();
		expect(toggleLabel(toggle).nextElementSibling).toBe(clear ?? null);

		await clickButton(clear);

		expect(completedToggle(container, "board").checked).toBe(false);
		expect(new URLSearchParams(window.location.search).get("completed")).toBeNull();
		expect(container.textContent).not.toContain(COMPLETED_TASK_TITLE);
	});

	it("runs completed records through the board's own filters", async () => {
		const container = await renderBoard();

		await tick(completedToggle(container, "board"));
		expect(container.textContent).toContain(COMPLETED_TASK_TITLE);

		// bob only exists on the completed record, so a board filter that keeps it proves the
		// record travelled through the same assignee filter as the board corpus.
		await setSelectValue(selectWithFirstOption(container, "All assignees"), "bob");

		expect(container.textContent).toContain(COMPLETED_TASK_TITLE);
		expect(container.textContent).not.toContain(ACTIVE_TASK_TITLE);
	});

	it("adds completed rows to the task list and keeps the filtered request widened", async () => {
		const container = await renderTaskList();

		const toggle = completedToggle(container, "task-list");
		expect(toggle.checked).toBe(false);
		expect(container.textContent).not.toContain(COMPLETED_TASK_TITLE);

		await tick(toggle);

		expect(new URLSearchParams(window.location.search).get("completed")).toBe("1");
		expect(container.textContent).toContain(COMPLETED_TASK_TITLE);
		completedBadge(container);
		// One row per record: the widened corpus must not duplicate the active task.
		expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

		const clear = clearFiltersButton(container);
		expect(clear).toBeTruthy();
		expect(toggleLabel(toggle).nextElementSibling).toBe(clear ?? null);

		// A real filter drives the list through the server, and the widened corpus has to
		// travel with it rather than being dropped by that second request.
		searchRequests = [];
		await setSelectValue(selectWithFirstOption(container, "All priorities"), "low");
		expect(searchRequests.some((request) => request.includes("priority=low"))).toBe(true);
		expect(searchRequests.some((request) => request.includes("completed=true"))).toBe(true);
	});

	it("leaves the task list rendering exactly the board corpus while the box is unchecked", async () => {
		const container = await renderTaskList();

		const rows = Array.from(container.querySelectorAll("tbody tr"));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.textContent).toContain(ACTIVE_TASK_TITLE);
		expect(container.textContent).not.toContain(COMPLETED_TASK_TITLE);
		expect(searchRequests.every((request) => !request.includes("completed=true"))).toBe(true);
	});
});
