import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import Modal from "../web/components/Modal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

const SOURCE = "## Alpha\n\nBody text\n\n### Alpha One\n\nMore text\n\n## Beta\n\nEven more";
const NO_HEADINGS_SOURCE = "Just a paragraph without any headings.";

function setupInteractiveDom(url = "http://localhost:6421/tasks") {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}
	return dom;
}

function installScrollSpy(dom: JSDOM): HTMLElement[] {
	const scrolled: HTMLElement[] = [];
	const proto = dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: () => void };
	proto.scrollIntoView = function scrollIntoView(this: HTMLElement) {
		scrolled.push(this);
	};
	return scrolled;
}

/**
 * jsdom has no layout, so every rect is all-zero and the drawer would always think the panel
 * hugs the viewport's left edge. Stub the left gap the drawer measures against: 500 keeps the
 * docked mode, 8 forces the floating mode.
 */
function stubLeftGap(dom: JSDOM, left: number): void {
	const proto = dom.window.HTMLElement.prototype as unknown as { getBoundingClientRect?: () => unknown };
	proto.getBoundingClientRect = () => ({
		left,
		right: left + 100,
		top: 0,
		bottom: 100,
		width: 100,
		height: 100,
		x: left,
		y: 0,
		toJSON: () => ({}),
	});
}

function DrawerHarness({ source }: { source: string }) {
	return (
		<Modal isOpen onClose={() => {}} title="Preview" toc>
			<MermaidMarkdown source={source} />
		</Modal>
	);
}

function bookmark(): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>("button[aria-label='On this page']");
}

function drawerPanel(): HTMLElement | null {
	return document.querySelector<HTMLElement>("nav[aria-label='On this page']");
}

function drawerLinks(): HTMLAnchorElement[] {
	return Array.from(document.querySelectorAll<HTMLAnchorElement>("nav[aria-label='On this page'] a[href^='#']"));
}

async function clickElement(element: Element | null | undefined) {
	await act(async () => {
		element?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
	});
}

describe("TocDrawer", () => {
	let root: Root | null = null;
	let scrolled: HTMLElement[] = [];
	let dom: JSDOM;

	beforeEach(() => {
		dom = setupInteractiveDom();
		scrolled = installScrollSpy(dom);
		stubLeftGap(dom, 500);
		root = createRoot(document.getElementById("root") as HTMLElement);
	});

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		(globalThis as { window?: typeof window }).window = originalWindowGlobal;
		(globalThis as { document?: Document }).document = originalDocumentGlobal;
		(globalThis as { navigator?: Navigator }).navigator = originalNavigatorGlobal;
	});

	const renderDrawer = async (source: string) => {
		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ImageLightboxProvider>
							<MemoryRouter>
								<DrawerHarness source={source} />
							</MemoryRouter>
						</ImageLightboxProvider>
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});
	};

	it("shows only the bookmark tab until it is clicked", async () => {
		await renderDrawer(SOURCE);

		expect(bookmark()).toBeTruthy();
		expect(drawerPanel()).toBeNull();
	});

	it("hides the bookmark while the drawer is open and restores it on close", async () => {
		await renderDrawer(SOURCE);

		await clickElement(bookmark());
		expect(bookmark()).toBeNull();
		const panel = drawerPanel();
		expect(panel).toBeTruthy();
		expect(drawerLinks().map((link) => link.textContent)).toEqual(["Alpha", "Alpha One", "Beta"]);

		const closeButton = panel?.querySelector<HTMLButtonElement>("button[aria-label]");
		await clickElement(closeButton);
		expect(drawerPanel()).toBeNull();
		expect(bookmark()).toBeTruthy();
	});

	it("scrolls the heading into view when an entry is clicked", async () => {
		await renderDrawer(SOURCE);
		await clickElement(bookmark());

		const betaLink = drawerLinks().find((link) => link.textContent === "Beta");
		await clickElement(betaLink);

		expect(scrolled.some((element) => element.tagName === "H2" && element.textContent === "Beta")).toBe(true);
		// The drawer stays open after jumping, unlike the header outline popup.
		expect(drawerPanel()).toBeTruthy();
	});

	it("stays hidden entirely when the content has no headings", async () => {
		await renderDrawer(NO_HEADINGS_SOURCE);

		expect(bookmark()).toBeNull();
		expect(drawerPanel()).toBeNull();
	});

	it("floats over the panel without a close button when the outside gap is too small", async () => {
		stubLeftGap(dom, 8);
		await renderDrawer(SOURCE);

		await clickElement(bookmark());
		const panel = drawerPanel();
		expect(panel?.dataset.tocMode).toBe("floating");
		// No close button in floating mode: picking an entry is the way out.
		expect(panel?.querySelector("button[aria-label='Close modal']")).toBeNull();
	});

	it("closes after an entry is picked in floating mode", async () => {
		stubLeftGap(dom, 8);
		await renderDrawer(SOURCE);
		await clickElement(bookmark());

		const betaLink = drawerLinks().find((link) => link.textContent === "Beta");
		await clickElement(betaLink);

		expect(scrolled.some((element) => element.tagName === "H2" && element.textContent === "Beta")).toBe(true);
		expect(drawerPanel()).toBeNull();
		// The bookmark comes back once the drawer is gone.
		expect(bookmark()).toBeTruthy();
	});

	it("docks outside and keeps its close button when the gap is wide", async () => {
		await renderDrawer(SOURCE);
		expect(bookmark()?.dataset.tocTab).toBe("outside");

		await clickElement(bookmark());
		const panel = drawerPanel();
		expect(panel?.dataset.tocMode).toBe("docked");
		expect(panel?.querySelector("button[aria-label='Close modal']")).toBeTruthy();
	});

	it("dims the panel in floating mode and closes when the dim is clicked", async () => {
		stubLeftGap(dom, 8);
		await renderDrawer(SOURCE);
		await clickElement(bookmark());
		expect(document.querySelector("[data-toc-backdrop]")).toBeTruthy();

		await clickElement(document.querySelector("[data-toc-backdrop]"));
		expect(drawerPanel()).toBeNull();
		expect(document.querySelector("[data-toc-backdrop]")).toBeNull();
		expect(bookmark()).toBeTruthy();
	});

	it("keeps the panel undimmed in docked mode", async () => {
		await renderDrawer(SOURCE);
		await clickElement(bookmark());

		expect(drawerPanel()?.dataset.tocMode).toBe("docked");
		expect(document.querySelector("[data-toc-backdrop]")).toBeNull();
	});

	it("moves the bookmark inside the panel edge in a narrow window", async () => {
		stubLeftGap(dom, 8);
		await renderDrawer(SOURCE);

		expect(bookmark()?.dataset.tocTab).toBe("inside");
	});
});
