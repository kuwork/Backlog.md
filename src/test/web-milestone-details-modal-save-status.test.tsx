import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone } from "../types/index.ts";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient } from "../web/lib/api.ts";

const createMilestone = (overrides: Partial<Milestone> = {}): Milestone => ({
	id: "m-1",
	title: "Release 1",
	description: "",
	rawContent: "",
	...overrides,
});

let updateCalls: unknown[][] = [];
let refreshedCount = 0;
let originalUpdateMilestone: typeof apiClient.updateMilestone;
let originalFetch: typeof globalThis.fetch;
let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
type UpdateResult = Awaited<ReturnType<typeof apiClient.updateMilestone>>;
let resolvePendingUpdate: ((result: UpdateResult) => void) | null = null;
let rejectPendingUpdate: ((error: unknown) => void) | null = null;

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
		pretendToBeVisual: true,
	});
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document;
	globalThis.navigator = activeDom.window.navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.Event = activeDom.window.Event;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
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
	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") htmlElementPrototype.attachEvent = () => {};
	if (typeof htmlElementPrototype.detachEvent !== "function") htmlElementPrototype.detachEvent = () => {};
	globalThis.fetch = (async () => Response.json([])) as unknown as typeof fetch;
};

const renderModal = async (): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<ThemeProvider>
					<MemoryRouter>
						<MilestoneDetailsModal
							milestoneId="m-1"
							milestone={createMilestone()}
							tasks={[]}
							isOpen={true}
							onClose={() => {}}
							onEditTask={() => {}}
							onRefreshData={() => {
								refreshedCount += 1;
							}}
						/>
					</MemoryRouter>
				</ThemeProvider>
			</I18nProvider>,
		);
	});
	return container;
};

const statusLabel = (container: HTMLElement): string | undefined =>
	container.querySelector('[data-testid="milestone-meta-save-status-label"]')?.textContent ?? undefined;

const dueDateInput = (container: HTMLElement): HTMLInputElement => {
	const input = container.querySelector<HTMLInputElement>("#milestone-details-modal-due-date");
	if (!input) throw new Error("Due date input did not render");
	return input;
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

describe("Milestone details modal sidebar save badge", () => {
	beforeEach(() => {
		updateCalls = [];
		refreshedCount = 0;
		resolvePendingUpdate = null;
		rejectPendingUpdate = null;
		originalUpdateMilestone = apiClient.updateMilestone;
		originalFetch = globalThis.fetch;
		apiClient.updateMilestone = (async (...args: unknown[]) => {
			updateCalls.push(args);
			return new Promise<UpdateResult>((resolve, reject) => {
				resolvePendingUpdate = resolve;
				rejectPendingUpdate = reject;
			});
		}) as typeof apiClient.updateMilestone;
	});

	afterEach(() => {
		apiClient.updateMilestone = originalUpdateMilestone;
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

	it("shows Saving then Saved on the header badge when a sidebar date changes", async () => {
		const container = await renderModal();

		await setDateValue(dueDateInput(container), "2026-12-31");

		expect(updateCalls).toHaveLength(1);
		expect(updateCalls[0]?.[0]).toBe("m-1");
		expect(updateCalls[0]?.[2]).toBe("2026-12-31");
		expect(statusLabel(container)).toContain("Saving");

		await act(async () => {
			resolvePendingUpdate?.({ success: true, milestone: createMilestone() });
			await Promise.resolve();
		});

		expect(statusLabel(container)).toBe("Saved");
		expect(refreshedCount).toBe(1);
	});

	it("shows the failure state and keeps the error message when the write is rejected", async () => {
		const container = await renderModal();

		await setDateValue(dueDateInput(container), "2026-12-31");
		expect(statusLabel(container)).toContain("Saving");

		await act(async () => {
			rejectPendingUpdate?.(new Error("milestone lock conflict"));
			await Promise.resolve();
		});

		expect(statusLabel(container)).toBe("Failed to save");
		expect(container.textContent).toContain("milestone lock conflict");
		expect(refreshedCount).toBe(0);
	});
});
