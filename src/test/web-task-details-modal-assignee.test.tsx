import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

let activeRoot: Root | null = null;

const setFormValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	globalThis.HTMLElement = ownerWindow.HTMLElement;
	globalThis.HTMLInputElement = ownerWindow.HTMLInputElement;
	globalThis.HTMLTextAreaElement = ownerWindow.HTMLTextAreaElement;
	const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
	element.focus();
	valueSetter?.call(element, value);
	element.dispatchEvent(new ownerWindow.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
	element.dispatchEvent(new ownerWindow.Event("change", { bubbles: true }));
	const reactPropsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
	if (!reactPropsKey) return;
	const reactProps = (element as unknown as Record<string, { onChange?: (event: { target: typeof element }) => void }>)[
		reactPropsKey
	];
	reactProps?.onChange?.({ target: element });
};

const clickElement = (element: Element) => {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	element.dispatchEvent(new ownerWindow.MouseEvent("click", { bubbles: true }));
};

const findButton = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(text));

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
};

const flushReact = async () => {
	await act(async () => {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

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

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web task popup assignee", () => {
	it("pre-fills defaultAssignee in create mode and omits assignee on submit when unchanged", async () => {
		setupDom();

		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);

		let submittedPayload: Record<string, unknown> | undefined;

		await act(async () => {
			activeRoot?.render(
				<MemoryRouter>
					<I18nProvider initialLocale="en">
						<ThemeProvider>
							<TaskDetailsModal
								isOpen={true}
								onClose={() => {}}
								availableStatuses={["To Do", "In Progress", "Done"]}
								defaultAssignee={["@alice"]}
								onSubmit={async (data) => {
									submittedPayload = data as Record<string, unknown>;
								}}
							/>
						</ThemeProvider>
					</I18nProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		await flushReact();

		const assigneeSection = container?.querySelector("#chip-input-assignee")?.closest("div.relative");
		expect(assigneeSection?.textContent).toContain("@alice");

		const titleInput = (container as HTMLElement).querySelector(
			"input[placeholder='Enter task title']",
		) as HTMLInputElement | null;
		expect(titleInput).toBeTruthy();
		await act(async () => {
			setFormValue(titleInput!, "Task with default assignee");
			await Promise.resolve();
		});
		await flushReact();

		const createButton = findButton(container as HTMLElement, "Create");
		expect(createButton).toBeTruthy();
		await act(async () => {
			clickElement(createButton as HTMLButtonElement);
			await Promise.resolve();
		});
		await flushReact();
		await waitFor(() => submittedPayload !== undefined);

		expect(submittedPayload).toBeTruthy();
		expect(submittedPayload?.title).toBe("Task with default assignee");
		expect("assignee" in submittedPayload!).toBe(false);
	});

	it("sends assignee: [] in create mode when defaultAssignee chips are cleared", async () => {
		setupDom();

		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);

		let submittedPayload: Record<string, unknown> | undefined;

		await act(async () => {
			activeRoot?.render(
				<MemoryRouter>
					<I18nProvider initialLocale="en">
						<ThemeProvider>
							<TaskDetailsModal
								isOpen={true}
								onClose={() => {}}
								availableStatuses={["To Do", "In Progress", "Done"]}
								defaultAssignee={["@alice"]}
								onSubmit={async (data) => {
									submittedPayload = data as Record<string, unknown>;
								}}
							/>
						</ThemeProvider>
					</I18nProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		await flushReact();

		const assigneeSection = (container as HTMLElement).querySelector("#chip-input-assignee")?.closest("div.relative");
		expect(assigneeSection?.textContent).toContain("@alice");

		const removeButton = assigneeSection?.querySelector("button[aria-label^='Remove']");
		expect(removeButton).toBeTruthy();
		await act(async () => {
			clickElement(removeButton as HTMLButtonElement);
			await Promise.resolve();
		});
		await flushReact();

		await waitFor(() => {
			const section = (container as HTMLElement).querySelector("#chip-input-assignee")?.closest("div.relative");
			return !section?.textContent?.includes("@alice");
		});

		const titleInput = (container as HTMLElement).querySelector(
			"input[placeholder='Enter task title']",
		) as HTMLInputElement | null;
		expect(titleInput).toBeTruthy();
		await act(async () => {
			setFormValue(titleInput!, "Task without assignee");
			await Promise.resolve();
		});
		await flushReact();

		const createButton = findButton(container as HTMLElement, "Create");
		expect(createButton).toBeTruthy();
		await act(async () => {
			clickElement(createButton as HTMLButtonElement);
			await Promise.resolve();
		});
		await flushReact();
		await waitFor(() => submittedPayload !== undefined);

		expect(submittedPayload).toBeTruthy();
		expect(submittedPayload?.title).toBe("Task without assignee");
		expect(submittedPayload?.assignee).toEqual([]);
	});

	it("shows available assignees in a dropdown and adds the selected one", async () => {
		setupDom();

		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);

		await act(async () => {
			activeRoot?.render(
				<MemoryRouter>
					<I18nProvider initialLocale="en">
						<ThemeProvider>
							<TaskDetailsModal
								isOpen={true}
								onClose={() => {}}
								availableStatuses={["To Do", "In Progress", "Done"]}
								defaultAssignee={["@alice"]}
								availableAssignees={["@alice", "@bob"]}
							/>
						</ThemeProvider>
					</I18nProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		await flushReact();

		const assigneeInput = (container as HTMLElement).querySelector("#chip-input-assignee") as HTMLInputElement | null;
		expect(assigneeInput).toBeTruthy();

		await act(async () => {
			assigneeInput!.focus();
			await Promise.resolve();
		});
		await flushReact();

		const assigneeSection = assigneeInput!.closest("div.relative") as HTMLElement;
		await waitFor(() => assigneeSection.querySelectorAll("button").length > 0);

		const option = findButton(container as HTMLElement, "@bob");
		expect(option).toBeTruthy();
		await act(async () => {
			clickElement(option as HTMLButtonElement);
			await Promise.resolve();
		});
		await flushReact();

		const chips = assigneeSection.querySelectorAll("span.inline-flex");
		expect(Array.from(chips).some((chip) => chip.textContent?.includes("@bob"))).toBe(true);
	});
});
