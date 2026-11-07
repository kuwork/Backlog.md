import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { INLINE_META_SAVE_DEBOUNCE_MS, TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { apiClient } from "../web/lib/api.ts";

type UpdateCall = { id: string; updates: Record<string, unknown> };

const makeTask = (): Task => ({
	id: "TASK-42",
	title: "Inline metadata burst task",
	status: "To Do",
	assignee: [],
	labels: ["alpha", "beta"],
	dependencies: [],
	references: ["docs/one.md", "docs/two.md"],
	documentation: [],
	modifiedFiles: [],
	createdDate: "2026-11-07",
	acceptanceCriteriaItems: [],
	definitionOfDoneItems: [],
});

let updateCalls: UpdateCall[] = [];
let savedCount = 0;
let originalUpdateTask: typeof apiClient.updateTask;
let originalFetch: typeof globalThis.fetch;
let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost/task/42/inline-metadata-burst-task",
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

const click = async (button: HTMLButtonElement) => {
	await act(async () => {
		button.click();
	});
};

/** ChipInput renders its chips as siblings of the text input inside the same flex row. */
const removeFirstLabel = async (container: HTMLElement) => {
	const input = container.querySelector<HTMLInputElement>("#chip-input-labels");
	const button = input?.parentElement?.querySelector<HTMLButtonElement>("button");
	if (!button) throw new Error("Label chip did not render");
	await click(button);
};

const removeFirstReference = async (container: HTMLElement) => {
	const button = container.querySelector<HTMLButtonElement>('button[title="Remove reference"]');
	if (!button) throw new Error("Reference remove button did not render");
	await click(button);
};

const statusLabel = (container: HTMLElement): string | undefined =>
	container.querySelector('[data-testid="inline-meta-save-status-label"]')?.textContent ?? undefined;

describe("Task details modal inline metadata save batching", () => {
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

	it("collapses a burst across labels and references into one PUT carrying each field final value", async () => {
		const container = await renderModal(makeTask());

		await removeFirstLabel(container);
		await removeFirstLabel(container);
		await removeFirstReference(container);

		// Nothing may leave before the user pauses.
		await wait(150);
		expect(updateCalls).toHaveLength(0);

		await wait(INLINE_META_SAVE_DEBOUNCE_MS + 400);
		expect(updateCalls).toHaveLength(1);
		const { id, updates } = updateCalls[0] as UpdateCall;
		expect(id).toBe("TASK-42");
		expect(updates.labels).toEqual([]);
		expect(updates.references).toEqual(["docs/two.md"]);
		expect(savedCount).toBe(1);
		expect(statusLabel(container)).toBe("Saved");
	});

	it("flushes a pending edit immediately when the modal unmounts", async () => {
		const container = await renderModal(makeTask());

		await removeFirstLabel(container);
		expect(updateCalls).toHaveLength(0);

		await act(async () => {
			activeRoot?.unmount();
		});
		activeRoot = null;
		await wait(50);
		expect(updateCalls).toHaveLength(1);
		expect(updateCalls[0]?.updates.labels).toEqual(["beta"]);
	});

	it("rolls back optimistic chips and shows the failure state when the write is rejected", async () => {
		apiClient.updateTask = (async () => {
			throw new Error("Edit failed: TASK-42 is being modified by another process");
		}) as typeof apiClient.updateTask;
		const container = await renderModal(makeTask());

		await removeFirstLabel(container);
		await wait(INLINE_META_SAVE_DEBOUNCE_MS + 400);

		expect(statusLabel(container)).toBe("Failed to save");
		expect(container.querySelectorAll("#chip-input-labels")[0]?.parentElement?.querySelectorAll("button")).toHaveLength(
			2,
		);
	});
});
