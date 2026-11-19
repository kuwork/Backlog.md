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

const STATUSES = ["To Do", "In Progress", "Done"];

const makeTask = (): Task => ({
	id: "TASK-42",
	title: "Inline metadata immediate save task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	references: [],
	documentation: [],
	modifiedFiles: [],
	createdDate: "2026-11-07",
	acceptanceCriteriaItems: [],
	definitionOfDoneItems: [],
});

let updateCalls: UpdateCall[] = [];
let originalUpdateTask: typeof apiClient.updateTask;
let originalFetch: typeof globalThis.fetch;
let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
let resolvePendingUpdate: ((task: Task) => void) | null = null;
let rejectPendingUpdate: ((error: unknown) => void) | null = null;

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost/task/42/inline-metadata-immediate-save",
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
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
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
	// The status picker needs the configured columns; every other background fetch is irrelevant here.
	globalThis.fetch = (async (input: RequestInfo | URL) =>
		String(input).includes("/statuses")
			? Response.json({ statuses: STATUSES, terminalStatuses: [] })
			: Response.json([])) as unknown as typeof fetch;
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
						<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} onSaved={() => {}} />
					</ThemeProvider>
				</I18nProvider>
			</MemoryRouter>,
		);
	});
	await wait(50);
	return container;
};

const statusLabel = (container: HTMLElement): string | undefined =>
	container.querySelector('[data-testid="inline-meta-save-status-label"]')?.textContent ?? undefined;

const findStatusSelect = (container: HTMLElement): HTMLSelectElement => {
	const select = Array.from(container.querySelectorAll("select")).find((candidate) =>
		Array.from(candidate.options).some((option) => option.value === "In Progress"),
	);
	if (!select) throw new Error("Status select did not render");
	return select;
};

const changeSelect = async (select: HTMLSelectElement, value: string) => {
	await act(async () => {
		const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
		if (!setter) throw new Error("select value setter unavailable");
		setter.call(select, value);
		select.dispatchEvent(new window.Event("change", { bubbles: true }));
	});
};

const setDateValue = async (input: HTMLInputElement, value: string) => {
	const ownerWindow = input.ownerDocument.defaultView ?? window;
	await act(async () => {
		const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
		if (!setter) throw new Error("input value setter unavailable");
		setter.call(input, value);
		input.dispatchEvent(new ownerWindow.Event("input", { bubbles: true }));
		input.dispatchEvent(new ownerWindow.Event("change", { bubbles: true }));
		const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
		if (reactPropsKey) {
			(input as unknown as Record<string, { onChange?: (event: { target: HTMLInputElement }) => void }>)[
				reactPropsKey
			]?.onChange?.({ target: input });
		}
		await Promise.resolve();
	});
};

describe("Task details modal immediate inline metadata save badge", () => {
	beforeEach(() => {
		updateCalls = [];
		resolvePendingUpdate = null;
		rejectPendingUpdate = null;
		originalUpdateTask = apiClient.updateTask;
		originalFetch = globalThis.fetch;
		apiClient.updateTask = (async (id: string, updates: Record<string, unknown>) => {
			updateCalls.push({ id, updates });
			return new Promise<Task>((resolve, reject) => {
				resolvePendingUpdate = resolve;
				rejectPendingUpdate = reject;
			});
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

	it("shows Saving then Saved on the shared badge when the status changes, with no debounce wait", async () => {
		const container = await renderModal(makeTask());

		await changeSelect(findStatusSelect(container), "In Progress");

		// The write leaves immediately rather than waiting for the chip-field debounce window.
		expect(updateCalls).toHaveLength(1);
		expect(updateCalls[0]?.updates.status).toBe("In Progress");
		expect(statusLabel(container)).toContain("Saving");

		await act(async () => {
			resolvePendingUpdate?.(makeTask());
			await Promise.resolve();
		});

		expect(statusLabel(container)).toBe("Saved");
	});

	it("rolls the status back and shows the failure state when the write is rejected", async () => {
		const container = await renderModal(makeTask());
		const statusSelect = findStatusSelect(container);

		await changeSelect(statusSelect, "In Progress");
		expect(statusSelect.value).toBe("In Progress");

		await act(async () => {
			rejectPendingUpdate?.(new Error("Edit failed: TASK-42 is being modified by another process"));
			await Promise.resolve();
		});

		expect(statusLabel(container)).toBe("Failed to save");
		expect(findStatusSelect(container).value).toBe("To Do");
	});

	it("shows Saved on the shared badge when a date field changes and writes immediately", async () => {
		const container = await renderModal(makeTask());
		const dueDateInput = container.querySelector<HTMLInputElement>("#task-details-modal-due-date");
		if (!dueDateInput) throw new Error("Due date input did not render");

		await setDateValue(dueDateInput, "2026-12-31");
		// Well inside the debounce window, so the PUT being out already proves the immediate path.
		await wait(200);
		expect(updateCalls).toHaveLength(1);
		expect(updateCalls[0]?.updates.dueDate).toBe("2026-12-31");
		expect(INLINE_META_SAVE_DEBOUNCE_MS).toBeGreaterThan(200);

		await act(async () => {
			resolvePendingUpdate?.(makeTask());
			await Promise.resolve();
		});
		expect(statusLabel(container)).toBe("Saved");
	});
});
