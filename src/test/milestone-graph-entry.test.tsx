import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { TocProvider } from "../web/contexts/TocContext.tsx";
import type { GraphPayload } from "../web/lib/api.ts";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;

const makeTask = (id: string, milestone: string): Task =>
	({
		id,
		title: `Task ${id}`,
		status: "To Do",
		priority: "medium",
		milestone,
		createdDate: "2026-10-01 00:00",
		ordinal: 0,
	}) as unknown as Task;

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
	// The dependency graph's draw effect leans on these browser APIs; jsdom lacks them.
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	};
	(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (() => 0) as never;
	(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = (() => {}) as never;
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

const originalGetGraph = apiClient.getGraph;

async function renderModal(): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<TocProvider>
					<I18nProvider>
						<MemoryRouter initialEntries={["/milestone/m-1"]}>
							<Routes>
								<Route
									path="/milestone/:id"
									element={
										<MilestoneDetailsModal
											milestoneId="m-1"
											milestone={milestone}
											tasks={[makeTask("BACK-1", "m-1"), makeTask("BACK-2", "m-1"), makeTask("OTHER-9", "m-2")]}
											milestoneEntities={[milestone]}
											isOpen
											onClose={() => {}}
											onEditTask={() => {}}
											graphVersion={0}
										/>
									}
								/>
							</Routes>
						</MemoryRouter>
					</I18nProvider>
				</TocProvider>
			</ThemeProvider>,
		);
	});
	return container;
}

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	apiClient.getGraph = originalGetGraph;
});

describe("milestone detail relationship-graph entry", () => {
	it("shows a graph entry control in the progress section", async () => {
		const container = await renderModal();
		const entry = container.querySelector('button[aria-label="Show relationship graph"]');
		expect(entry).not.toBeNull();
	});

	it("opens the relationship graph scoped to the milestone's tasks when activated", async () => {
		// The graph fetch is mocked so the test does not hit the server.
		apiClient.getGraph = (async () => mockPayload) as unknown as typeof apiClient.getGraph;
		const container = await renderModal();
		const entry = container.querySelector('button[aria-label="Show relationship graph"]');
		expect(entry).not.toBeNull();

		await act(async () => {
			entry?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			// Let the (mocked) getGraph promise resolve and the subgraph render.
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// The entry is replaced by the open graph view (header back button + canvas + title).
		expect(container.querySelector('button[aria-label="Show relationship graph"]')).toBeNull();
		expect(container.querySelector('button[aria-label="Back to milestone details (Esc)"]')).not.toBeNull();
		expect(container.querySelector("canvas")).not.toBeNull();
		expect(container.textContent).toContain("Relationship graph");
	});
});
