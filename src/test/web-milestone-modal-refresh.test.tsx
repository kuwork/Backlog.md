import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone } from "../types/index.ts";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;
const originalFetchMilestone = apiClient.fetchMilestone.bind(apiClient);

const createMilestone = (overrides: Partial<Milestone>): Milestone => ({
	id: "m-1",
	title: "Release 1",
	description: "",
	rawContent: "",
	...overrides,
});

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
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

const renderModal = async (milestone: Milestone | null): Promise<HTMLElement> => {
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	if (!activeRoot) activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider>
				<ThemeProvider>
					<MemoryRouter>
						<MilestoneDetailsModal
							milestoneId="m-1"
							milestone={milestone}
							tasks={[]}
							isOpen={true}
							onClose={() => {}}
							onEditTask={() => {}}
						/>
					</MemoryRouter>
				</ThemeProvider>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const setFormValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	globalThis.HTMLElement = ownerWindow.HTMLElement;
	globalThis.HTMLInputElement = ownerWindow.HTMLInputElement;
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
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	throw new Error("waitFor: condition not met");
};

const nameInput = (container: HTMLElement): HTMLInputElement => {
	const input = container.querySelector<HTMLInputElement>("#milestone-details-modal-name");
	expect(input).toBeTruthy();
	return input as HTMLInputElement;
};

const dueDateInput = (container: HTMLElement): HTMLInputElement => {
	const input = container.querySelector<HTMLInputElement>("#milestone-details-modal-due-date");
	expect(input).toBeTruthy();
	return input as HTMLInputElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	apiClient.fetchMilestone = originalFetchMilestone;
});

describe("MilestoneDetailsModal refresh behaviour", () => {
	it("populates the form once the fallback fetch resolves", async () => {
		setupDom();
		apiClient.fetchMilestone = (async () =>
			createMilestone({ title: "Fetched title", dueDate: "2026-05-01" })) as typeof apiClient.fetchMilestone;

		const container = await renderModal(null);
		await act(async () => {
			clickElement(findButton(container, "Edit") as HTMLButtonElement);
		});

		await waitFor(() => nameInput(container).value === "Fetched title");
		expect(dueDateInput(container).value).toBe("2026-05-01");
	});

	it("keeps in-progress edits when the same milestone refreshes", async () => {
		setupDom();
		const container = await renderModal(createMilestone({ title: "Original", dueDate: "2026-05-01" }));
		await act(async () => {
			clickElement(findButton(container, "Edit") as HTMLButtonElement);
		});
		act(() => {
			setFormValue(nameInput(container), "User edit");
		});

		await renderModal(createMilestone({ title: "Server title", dueDate: "2026-06-02" }));

		expect(nameInput(container).value).toBe("User edit");
		expect(dueDateInput(container).value).toBe("2026-06-02");
	});
});
