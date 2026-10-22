import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { CHECKLIST_SAVE_DEBOUNCE_MS, TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { apiClient } from "../web/lib/api.ts";

type UpdateCall = { id: string; updates: Record<string, unknown> };

const makeTask = (): Task => ({
	id: "TASK-9",
	title: "Checklist burst task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-10-22",
	acceptanceCriteriaItems: [
		{ index: 1, text: "First criterion", checked: false },
		{ index: 2, text: "Second criterion", checked: false },
	],
	definitionOfDoneItems: [
		{ index: 1, text: "Types check", checked: false },
		{ index: 2, text: "Lint passes", checked: false },
	],
});

let updateCalls: UpdateCall[] = [];
let savedCount = 0;
let originalUpdateTask: typeof apiClient.updateTask;
let originalFetch: typeof globalThis.fetch;
let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost/task/9/checklist-burst-task",
		pretendToBeVisual: true,
	});
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document;
	globalThis.navigator = activeDom.window.navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.Event = activeDom.window.Event;
	globalThis.CustomEvent = activeDom.window.CustomEvent;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.Node = activeDom.window.Node;
	globalThis.MutationObserver = activeDom.window.MutationObserver as unknown as typeof MutationObserver;
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
	window.scrollTo = () => {};
	window.confirm = () => true;
	// The modal preloads the dependency picker on open; those fetches are not under test.
	globalThis.fetch = (async (_input: RequestInfo | URL) => Response.json([])) as unknown as typeof fetch;
};

const wait = async (ms: number) => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
};

const renderModal = async (task: Task): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter>
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<TaskDetailsModal
							task={task}
							isOpen={true}
							onClose={() => {}}
							onSaved={() => {
								savedCount += 1;
							}}
						/>
					</ThemeProvider>
				</I18nProvider>
			</MemoryRouter>,
		);
	});
	return container;
};

const sectionCheckboxes = (container: HTMLElement, sectionId: string): HTMLInputElement[] =>
	Array.from(container.querySelectorAll(`#${sectionId} input[type="checkbox"]`));

const click = async (checkbox: HTMLInputElement) => {
	await act(async () => {
		checkbox.click();
	});
};

describe("Task details modal checklist save batching", () => {
	beforeEach(() => {
		updateCalls = [];
		savedCount = 0;
		originalUpdateTask = apiClient.updateTask;
		originalFetch = globalThis.fetch;
		apiClient.updateTask = (async (id: string, updates: Record<string, unknown>) => {
			updateCalls.push({ id, updates });
			return makeTask();
		}) as typeof apiClient.updateTask;
	});

	afterEach(() => {
		apiClient.updateTask = originalUpdateTask;
		globalThis.fetch = originalFetch;
		if (activeRoot) {
			act(() => {
				activeRoot?.unmount();
			});
			activeRoot = null;
		}
		activeDom?.window.close();
		activeDom = null;
	});

	it("collapses a burst of AC and DoD toggles into one PUT after the quiet window", async () => {
		const container = await renderModal(makeTask());
		const [acOne, acTwo] = sectionCheckboxes(container, "task-section-acceptance-criteria");
		const [dodOne, dodTwo] = sectionCheckboxes(container, "task-section-definition-of-done");
		if (!acOne || !acTwo || !dodOne || !dodTwo) throw new Error("Checkboxes did not render");

		// A burst well inside the debounce window, including a double toggle that must settle
		// on its final state.
		await click(acOne);
		await click(acTwo);
		await click(dodOne);
		await click(dodTwo);
		await click(dodTwo);

		// Nothing may leave before the user pauses.
		await wait(150);
		expect(updateCalls).toHaveLength(0);

		await wait(CHECKLIST_SAVE_DEBOUNCE_MS + 400);
		expect(updateCalls).toHaveLength(1);
		const { id, updates } = updateCalls[0] as UpdateCall;
		expect(id).toBe("TASK-9");
		const criteria = updates.acceptanceCriteriaItems as { index: number; checked: boolean }[];
		expect(criteria.map((c) => [c.index, c.checked])).toEqual([
			[1, true],
			[2, true],
		]);
		expect(updates.definitionOfDoneCheck).toEqual([1]);
		// Toggled on then off again: only the final state is sent.
		expect(updates.definitionOfDoneUncheck).toEqual([2]);
		expect(savedCount).toBe(1);
	});

	it("flushes a pending toggle immediately when the modal unmounts", async () => {
		const container = await renderModal(makeTask());
		const [acOne] = sectionCheckboxes(container, "task-section-acceptance-criteria");
		if (!acOne) throw new Error("Checkboxes did not render");

		await click(acOne);
		expect(updateCalls).toHaveLength(0);

		await act(async () => {
			activeRoot?.unmount();
		});
		activeRoot = null;
		await wait(50);
		expect(updateCalls).toHaveLength(1);
		const criteria = updateCalls[0]?.updates.acceptanceCriteriaItems as { index: number; checked: boolean }[];
		expect(criteria.find((c) => c.index === 1)?.checked).toBe(true);
	});
});
