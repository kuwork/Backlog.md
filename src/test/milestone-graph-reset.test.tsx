import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import type React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useMatch, useNavigate } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { TocProvider } from "../web/contexts/TocContext.tsx";
import type { GraphPayload } from "../web/lib/api.ts";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;

const makeTask = (id: string, milestoneId: string): Task =>
	({
		id,
		title: `Task ${id}`,
		status: "To Do",
		priority: "medium",
		milestone: milestoneId,
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

/**
 * Mirrors how App wires the milestone modal: the modal is mounted once and stays mounted, while
 * `isOpen` is derived from the route match. Closing it navigates away (popping the background
 * location) and re-opening pushes a new entry, so a test can drive the exact `isOpen` + `location`
 * transitions the real app produces - including the "drill a task on top" occlusion.
 */
function TestApp(): React.ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	const match = useMatch("/milestone/:id");
	return (
		<>
			<button
				type="button"
				data-testid="open"
				onClick={() => navigate("/milestone/m-1", { state: { backgroundLocation: location } })}
			>
				open
			</button>
			<button
				type="button"
				data-testid="occlude"
				onClick={() => navigate("/task/BACK-1", { state: { backgroundLocation: location } })}
			>
				occlude
			</button>
			<button type="button" data-testid="close" onClick={() => navigate(-1)}>
				close
			</button>
			<MilestoneDetailsModal
				milestoneId={match?.params.id ?? null}
				milestone={milestone}
				tasks={[makeTask("BACK-1", "m-1"), makeTask("BACK-2", "m-1")]}
				milestoneEntities={[milestone]}
				isOpen={match !== null}
				onClose={() => navigate(-1)}
				onEditTask={() => {}}
				graphVersion={0}
			/>
		</>
	);
}

async function renderTestApp(): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<TocProvider>
					<I18nProvider>
						<MemoryRouter initialEntries={["/milestones"]}>
							<TestApp />
						</MemoryRouter>
					</I18nProvider>
				</TocProvider>
			</ThemeProvider>,
		);
	});
	return container;
}

const click = async (container: HTMLElement, testId: string) => {
	await act(async () => {
		container
			.querySelector(`[data-testid="${testId}"]`)
			?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const clickEntry = async (container: HTMLElement) => {
	await act(async () => {
		container
			.querySelector('button[aria-label="Show relationship graph"]')
			?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const graphIsOpen = (container: HTMLElement) =>
	container.querySelector('button[aria-label="Back to milestone details (Esc)"]') !== null;

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	apiClient.getGraph = originalGetGraph;
});

describe("milestone relationship-graph reset vs occlusion", () => {
	it("resets to the detail view after a real close, so reopening does not jump back into the graph", async () => {
		apiClient.getGraph = (async () => mockPayload) as unknown as typeof apiClient.getGraph;
		const container = await renderTestApp();

		await click(container, "open");
		await clickEntry(container);
		expect(graphIsOpen(container)).toBe(true);

		// Real close: pops back to /milestones - a non-modal route, so the graph state is dropped.
		await click(container, "close");
		expect(graphIsOpen(container)).toBe(false);

		// Re-opening the same milestone starts on the detail view, not the graph.
		await click(container, "open");
		expect(container.querySelector('button[aria-label="Show relationship graph"]')).not.toBeNull();
		expect(graphIsOpen(container)).toBe(false);
	});

	it("keeps the graph open when a task is drilled on top and the milestone is returned to", async () => {
		apiClient.getGraph = (async () => mockPayload) as unknown as typeof apiClient.getGraph;
		const container = await renderTestApp();

		await click(container, "open");
		await clickEntry(container);
		expect(graphIsOpen(container)).toBe(true);

		// A task opens on top (a modal route) - an occlusion, not a close.
		await click(container, "occlude");
		expect(graphIsOpen(container)).toBe(false);

		// Returning restores the milestone with its graph still expanded.
		await click(container, "close");
		expect(graphIsOpen(container)).toBe(true);
		expect(container.textContent).toContain("Relationship graph");
	});
});
