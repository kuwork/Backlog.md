import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import TaskDetailsModal from "../web/components/TaskDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { TocProvider } from "../web/contexts/TocContext.tsx";
import type { GraphPayload } from "../web/lib/api.ts";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;

const task = {
	id: "BACK-1",
	title: "Task One",
	status: "To Do",
	priority: "medium",
	milestone: "m-1",
	dependencies: [],
	createdDate: "2026-10-01 00:00",
	ordinal: 0,
} as unknown as Task;

const milestone: Milestone = {
	id: "m-1",
	title: "Milestone One",
	description: "",
	documentation: [],
	dueDate: "",
	plannedStart: "",
	plannedEnd: "",
	actualStart: "",
	actualEnd: "",
	createdDate: "2026-10-01 00:00",
	updatedDate: "",
} as unknown as Milestone;

const mockPayload: GraphPayload = {
	status: "ready",
	nodes: [
		{ id: "BACK-1", title: "Task One", kind: "task", status: "To Do", filePath: "tasks/BACK-1.md" },
		{ id: "BACK-2", title: "Task Two", kind: "task", status: "To Do", filePath: "tasks/BACK-2.md" },
		{ id: "m-1", title: "Milestone One", kind: "milestone", status: "", filePath: "milestones/m-1.md" },
	],
	edges: [
		{ type: "ParentOf", from: "BACK-2", to: "BACK-1" },
		{ type: "BelongsToMilestone", from: "BACK-1", to: "m-1" },
	],
} as unknown as GraphPayload;

const originalGetGraph = apiClient.getGraph;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	};
	(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (() => 0) as never;
	(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = (() => {}) as never;
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

function renderModal(isOpen: boolean): HTMLElement {
	const container = setupDom();
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<ThemeProvider>
				<TocProvider>
					<I18nProvider>
						<MemoryRouter initialEntries={["/task/BACK-1"]}>
							<TaskDetailsModal
								task={task}
								isOpen={isOpen}
								onClose={() => {}}
								availableStatuses={["To Do", "In Progress", "Done"]}
								defaultAssignee={[]}
								definitionOfDoneDefaults={[]}
								milestoneEntities={[milestone]}
								availableTasks={[task]}
								graphVersion={0}
								onDrillDown={() => {}}
								onBack={() => {}}
							/>
						</MemoryRouter>
					</I18nProvider>
				</TocProvider>
			</ThemeProvider>,
		);
	});
	return container;
}

function rerender(isOpen: boolean): void {
	act(() => {
		activeRoot?.render(
			<ThemeProvider>
				<TocProvider>
					<I18nProvider>
						<MemoryRouter initialEntries={["/task/BACK-1"]}>
							<TaskDetailsModal
								task={task}
								isOpen={isOpen}
								onClose={() => {}}
								availableStatuses={["To Do", "In Progress", "Done"]}
								defaultAssignee={[]}
								definitionOfDoneDefaults={[]}
								milestoneEntities={[milestone]}
								availableTasks={[task]}
								graphVersion={0}
								onDrillDown={() => {}}
								onBack={() => {}}
							/>
						</MemoryRouter>
					</I18nProvider>
				</TocProvider>
			</ThemeProvider>,
		);
	});
}

const tick = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

afterEach(() => {
	act(() => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	apiClient.getGraph = originalGetGraph;
});

describe("task detail relationship-graph survives a milestone stack", () => {
	it("keeps the graph open when returning from a drilled-open milestone", async () => {
		// The graph fetch is mocked so the test does not hit the server.
		apiClient.getGraph = (async () => mockPayload) as unknown as typeof apiClient.getGraph;

		const container = renderModal(true);

		// Open the relationship graph from the task detail.
		const entry = container.querySelector('button[aria-label="Show relationship graph"]');
		expect(entry).not.toBeNull();
		entry?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await tick();

		// Graph is open: toggle replaced by the back button, canvas drawn, title present.
		expect(container.querySelector('button[aria-label="Show relationship graph"]')).toBeNull();
		expect(container.querySelector('button[aria-label="Back to task details (Esc)"]')).not.toBeNull();
		expect(container.querySelector("canvas")).not.toBeNull();
		expect(container.textContent).toContain("Relationship graph");

		// Simulate the milestone stacking on top: the task modal's `isOpen` briefly flips to false
		// (useMatch("/task/:id") is null while at /milestone/:id), but the instance stays mounted.
		rerender(false);
		await tick();

		// Returning from the milestone restores `isOpen` to true.
		rerender(true);
		await tick();

		// Regression guard: the graph must still be open (where the task was left), not reset to the
		// detail view. With the buggy `!isOpen` wipe this would show the toggle and drop the canvas.
		expect(container.querySelector('button[aria-label="Back to task details (Esc)"]')).not.toBeNull();
		expect(container.querySelector('button[aria-label="Show relationship graph"]')).toBeNull();
		expect(container.querySelector("canvas")).not.toBeNull();
		expect(container.textContent).toContain("Relationship graph");
	});
});
