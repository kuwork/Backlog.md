import { afterEach, describe, expect, it, mock } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Modal from "../web/components/Modal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div><div id='outside'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
};

const renderModal = async (onClose: () => void): Promise<HTMLElement> => {
	const container = document.getElementById("root");
	activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider>
				<Modal isOpen={true} onClose={onClose} title="Test modal">
					<p>content</p>
				</Modal>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	await act(async () => {
		element.dispatchEvent(new ownerWindow.MouseEvent("click", { bubbles: true }));
	});
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Modal backdrop click", () => {
	it("closes when the overlay itself is clicked", async () => {
		setupDom();
		const onClose = mock(() => {});
		const container = await renderModal(onClose);
		const overlay = container.querySelector('[role="presentation"]');
		expect(overlay).toBeTruthy();
		await clickElement(overlay as HTMLElement);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("ignores clicks inside the panel", async () => {
		setupDom();
		const onClose = mock(() => {});
		const container = await renderModal(onClose);
		const panel = container.querySelector('[role="dialog"]');
		expect(panel).toBeTruthy();
		await clickElement(panel as HTMLElement);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("ignores clicks on elements outside the modal that are not the overlay", async () => {
		setupDom();
		const onClose = mock(() => {});
		await renderModal(onClose);
		// Stands in for the still-bubbling click that opened the modal.
		const outside = document.getElementById("outside");
		expect(outside).toBeTruthy();
		await clickElement(outside as HTMLElement);
		expect(onClose).not.toHaveBeenCalled();
	});
});
