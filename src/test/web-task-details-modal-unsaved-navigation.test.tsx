import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
let currentPath = "";
let routerNavigate: ((to: string) => void) | null = null;

const dependency: Task = {
	id: "BACK-2",
	title: "Dependency task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-07",
	labels: [],
	dependencies: [],
};

const task: Task = {
	id: "BACK-1",
	title: "Task being edited",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-07",
	labels: [],
	dependencies: ["BACK-2"],
	references: [],
	comments: [
		{ index: 1, body: "Blocked by [BACK-2](/task/BACK-2) until it lands.", createdDate: "2026-08-07" },
	],
};

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = activeDom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

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

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	htmlElementPrototype.attachEvent = () => {};
	htmlElementPrototype.detachEvent = () => {};
};

function LocationProbe() {
	const location = useLocation();
	routerNavigate = useNavigate();
	currentPath = location.pathname;
	return null;
}

const renderTree = (modalTask: Task | undefined) => (
	<MemoryRouter initialEntries={["/task/BACK-1"]}>
		<I18nProvider initialLocale="en">
			<ThemeProvider>
				<LocationProbe />
				<TaskDetailsModal task={modalTask} isOpen={true} onClose={() => {}} />
			</ThemeProvider>
		</I18nProvider>
	</MemoryRouter>
);

const renderModal = async (modalTask: Task | undefined): Promise<HTMLElement> => {
	setupDom();
	currentPath = "";
	routerNavigate = null;
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(renderTree(modalTask));
		await Promise.resolve();
	});
	// Inject a chip-shaped route link into the modal content grid so the guard's handling
	// of dependency-chip clicks is exercised directly. The handler mirrors a react-router
	// Link: prevent the anchor default and push the route in place.
	const grid = container.querySelector(".grid.grid-cols-1");
	if (!grid) throw new Error("modal content grid not found");
	const chipLink = document.createElement("a");
	chipLink.href = "/task/BACK-2";
	chipLink.textContent = `${dependency.id} - ${dependency.title}`;
	chipLink.className = "dependency-chip-link";
	chipLink.addEventListener("click", (event) => {
		event.preventDefault();
		routerNavigate?.("/task/BACK-2");
	});
	grid.appendChild(chipLink);
	return container;
};

/** Existing task, opens in preview mode. */
const mountModal = () => renderModal(task);
/** No task, opens in create mode. */
const mountCreateModal = () => renderModal(undefined);

const click = async (element: Element): Promise<MouseEvent> => {
	const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
	await act(async () => {
		element.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

const setControlValue = async (element: HTMLElement, value: string) => {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	globalThis.HTMLElement = ownerWindow.HTMLElement;
	const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
	await act(async () => {
		valueSetter?.call(element, value);
		element.dispatchEvent(new ownerWindow.Event("input", { bubbles: true }));
		element.dispatchEvent(new ownerWindow.Event("change", { bubbles: true }));
		const reactPropsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
		if (reactPropsKey) {
			(element as unknown as Record<string, { onChange?: (event: { target: HTMLElement }) => void }>)[
				reactPropsKey
			]?.onChange?.({ target: element });
		}
		await Promise.resolve();
	});
};

const findButton = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === text);

const startEditing = async (container: HTMLElement) => {
	const editButton = findButton(container, "Edit");
	expect(editButton).toBeTruthy();
	await click(editButton as Element);
};

const startEditingWithUnsavedChanges = async (container: HTMLElement) => {
	await startEditing(container);
	// Long-form dirty state: dueDate is part of the isDirty baseline comparison.
	const dueDateInput = container.querySelector('input[type="date"]');
	expect(dueDateInput).toBeTruthy();
	await setControlValue(dueDateInput as HTMLElement, "2026-08-08");
};

/** Dependency chip stand-in: a react-router link that changes the route in place. */
const findChipLink = (container: HTMLElement): HTMLAnchorElement => {
	const link = container.querySelector("a.dependency-chip-link");
	expect(link).toBeTruthy();
	return link as HTMLAnchorElement;
};

/** Markdown body link in a comment: a plain anchor that would unload the page. */
const findCommentLink = (container: HTMLElement): HTMLAnchorElement => {
	const link = Array.from(container.querySelectorAll('a[href="/task/BACK-2"]')).find(
		(candidate) => candidate.textContent === dependency.id,
	);
	expect(link).toBeTruthy();
	return link as HTMLAnchorElement;
};

const declineOnConfirm = () => {
	const prompts: string[] = [];
	window.confirm = (message?: string) => {
		prompts.push(message ?? "");
		return false;
	};
	return prompts;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
});

describe("Task details modal navigation with unsaved edits", () => {
	it("keeps the editor open when a dependency chip is clicked and the discard prompt is declined", async () => {
		const container = await mountModal();
		await startEditingWithUnsavedChanges(container);

		const prompts = declineOnConfirm();
		const event = await click(findChipLink(container));

		expect(prompts).toEqual(["Discard unsaved changes and leave this task?"]);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/task/BACK-1");
	});

	it("navigates from a dependency chip once the discard prompt is accepted", async () => {
		const container = await mountModal();
		await startEditingWithUnsavedChanges(container);

		let prompts = 0;
		window.confirm = () => {
			prompts += 1;
			return true;
		};

		await click(findChipLink(container));

		expect(prompts).toBe(1);
		expect(currentPath).toBe("/task/BACK-2");
	});

	it("protects a comment draft that is the only unsaved work", async () => {
		const container = await mountModal();
		await startEditing(container);

		const commentBox = container.querySelector('textarea[placeholder="Add a comment..."]');
		expect(commentBox).toBeTruthy();
		await setControlValue(commentBox as HTMLElement, "Draft comment nobody has submitted yet");

		const prompts = declineOnConfirm();
		const event = await click(findChipLink(container));

		expect(prompts.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/task/BACK-1");
	});

	it("protects create-mode metadata entered without any long-form edit", async () => {
		const container = await mountCreateModal();

		const prioritySelect = Array.from(container.querySelectorAll("select")).find(
			(select) => select.value === "" && Array.from(select.options).some((option) => option.value === "high"),
		);
		expect(prioritySelect).toBeTruthy();
		await setControlValue(prioritySelect as HTMLElement, "high");

		const prompts = declineOnConfirm();
		const event = await click(findChipLink(container));

		expect(prompts.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/task/BACK-1");
	});

	it("blocks an auto-linked task ID in a comment when the discard prompt is declined", async () => {
		const container = await mountModal();
		await startEditingWithUnsavedChanges(container);

		const prompts = declineOnConfirm();
		const event = await click(findCommentLink(container));

		expect(prompts.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/task/BACK-1");
	});

	it("lets links through while there is nothing unsaved to lose", async () => {
		const container = await mountModal();

		let prompts = 0;
		window.confirm = () => {
			prompts += 1;
			return false;
		};

		await click(findChipLink(container));

		expect(prompts).toBe(0);
		expect(currentPath).toBe("/task/BACK-2");
	});
});
