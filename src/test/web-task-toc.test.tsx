import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import Modal from "../web/components/Modal.tsx";
import TabButton from "../web/components/TabButton.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { collectSectionedTocItems } from "../web/utils/toc.ts";

const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

/** 25 headings nested four levels deep: long enough to fold by default. */
function longSource(): string {
	const lines = ["# Top"];
	for (let index = 1; index <= 6; index += 1) {
		lines.push(`## Section ${index}`, `### Detail ${index}.1`, `### Detail ${index}.2`, `#### Note ${index}.2.a`);
	}
	return lines.join("\n\n");
}

const DUPLICATE_SOURCE = "## Details\n\nFirst\n\n## Details\n\nSecond";
const CJK_SOURCE = "## 二、TUI 概览\n\n正文\n\n### 详情";

function setupInteractiveDom(url = "http://localhost:6421/tasks/back-1") {
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

/** Heading offsets by element id, so the scrollspy can be driven deterministically. */
const headingTops = new Map<string, number>();

function installElementRects(dom: JSDOM): void {
	const proto = dom.window.HTMLElement.prototype as unknown as { getBoundingClientRect: () => DOMRect };
	proto.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
		const top = headingTops.get(this.id) ?? 0;
		return {
			top,
			bottom: top + 20,
			// A generous left gap keeps the TOC drawer in its docked mode; the floating
			// narrow-window mode is covered in web-toc-drawer.test.tsx.
			left: 500,
			right: 500,
			width: 0,
			height: 20,
			x: 500,
			y: top,
			toJSON: () => ({}),
		} as DOMRect;
	};
}

function headingIds(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).map((heading) => heading.id);
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

describe("task content TOC", () => {
	let root: Root | null = null;

	beforeEach(() => {
		const dom = setupInteractiveDom();
		installElementRects(dom);
		headingTops.clear();
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

	const renderContent = async (source: string) => {
		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ImageLightboxProvider>
							<MemoryRouter>
								<Modal isOpen onClose={() => {}} title="BACK-1 — Task" toc>
									<MermaidMarkdown source={source} />
								</Modal>
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

	it("keeps heading anchors stable across re-renders of the same content", async () => {
		await renderContent(longSource());
		const firstPass = headingIds();
		expect(firstPass.every((id) => id.length > 0)).toBe(true);

		await renderContent(longSource());
		expect(headingIds()).toEqual(firstPass);
	});

	it("gives duplicate headings distinct anchors and CJK headings readable ones", async () => {
		await renderContent(`${DUPLICATE_SOURCE}\n\n${CJK_SOURCE}`);
		const ids = headingIds();

		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.filter((id) => id.startsWith("details")).length).toBe(2);
		expect(ids.some((id) => id.includes("tui"))).toBe(true);
	});

	it("opens a long task outline folded below the top level", async () => {
		await renderContent(longSource());
		// Pin the reading position to the top so the scrollspy does not unfold a branch.
		headingTops.set("top", 0);
		for (const id of headingIds()) {
			if (id !== "top") headingTops.set(id, 200);
		}
		await clickElement(bookmark());

		// Top level plus the six sections stay visible; deeper entries start folded.
		expect(drawerLinks().map((link) => link.textContent)).toEqual([
			"Top",
			"Section 1",
			"Section 2",
			"Section 3",
			"Section 4",
			"Section 5",
			"Section 6",
		]);
	});

	it("highlights the entry at the reading position while the modal scrolls", async () => {
		await renderContent(longSource());
		await clickElement(bookmark());

		// Monotonic offsets in document order; Section 2 is the last heading above
		// the 96px reading line, everything after it sits below.
		for (const id of headingIds()) headingTops.set(id, 200);
		headingTops.set("top", 0);
		headingTops.set("section-1", 10);
		headingTops.set("detail-11", 20);
		headingTops.set("detail-12", 30);
		headingTops.set("note-12a", 40);
		headingTops.set("section-2", 80);
		await act(async () => {
			// JSDOM has no stylesheet layout, so the scroll container resolves to
			// window; in the browser it is the modal's own scrollable content div.
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		const current = drawerLinks().find((link) => link.getAttribute("aria-current") === "true");
		expect(current?.textContent).toBe("Section 2");
	});

	it("activates the last entry when the scroller reaches its end", async () => {
		const shortSource = "## Alpha\n\nBody\n\n## Beta\n\nTail";
		await renderContent(shortSource);
		await clickElement(bookmark());

		// Beta sits below the reading line and the content is too short to pull it
		// up, but the scroller is at its end, so Beta becomes the current entry.
		headingTops.set("alpha", 0);
		headingTops.set("beta", 200);
		Object.defineProperty(document.documentElement, "scrollHeight", { value: 2000, configurable: true });
		Object.defineProperty(document.documentElement, "clientHeight", { value: 500, configurable: true });
		Object.defineProperty(window, "scrollY", { value: 1500, configurable: true });
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		const current = drawerLinks().find((link) => link.getAttribute("aria-current") === "true");
		expect(current?.textContent).toBe("Beta");
	});

	it("selects a clicked entry that cannot scroll into place", async () => {
		const shortSource = "## Alpha\n\nBody\n\n## Beta\n\nTail";
		await renderContent(shortSource);
		await clickElement(bookmark());

		// Scroller is pinned at its end: Beta owns the reading position and Alpha,
		// sitting below the reading line, can never be scrolled across it.
		headingTops.set("alpha", 200);
		headingTops.set("beta", 400);
		Object.defineProperty(document.documentElement, "scrollHeight", { value: 2000, configurable: true });
		Object.defineProperty(document.documentElement, "clientHeight", { value: 500, configurable: true });
		Object.defineProperty(window, "scrollY", { value: 1500, configurable: true });
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(drawerLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe("Beta");

		// scrollIntoView is a no-op spy here, so no scroll event fires; the click
		// alone must select the entry.
		const alphaEntry = drawerLinks().find((link) => link.textContent === "Alpha");
		await clickElement(alphaEntry);
		expect(drawerLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe("Alpha");

		// A real scroll hands control back to the scrollspy.
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(drawerLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe("Beta");
	});

	it("keeps the narrow-screen fallback: capped width and in-modal overlay classes", async () => {
		await renderContent(longSource());
		await clickElement(bookmark());

		const panel = drawerPanel();
		// Below sm the panel overlays the modal's left edge with an inset; at sm and
		// up it docks outside with a gap, and its width always leaves room to close it.
		expect(panel?.className).toContain("left-2");
		expect(panel?.className).toContain("sm:right-full");
		expect(panel?.className).toContain("sm:mr-2");
		expect(panel?.className).toContain("max-w-[calc(100vw-8rem)]");
	});
});

describe("sectioned task outline", () => {
	let root: Root | null = null;

	beforeEach(() => {
		const dom = setupInteractiveDom();
		installElementRects(dom);
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

	it("groups headings under their declared sections", () => {
		const host = document.createElement("div");
		host.innerHTML =
			'<div id="sec-desc" data-toc-section="Description"><h2 id="overview" data-heading-text="Overview">Overview</h2>' +
			'<h3 id="detail" data-heading-text="Detail">Detail</h3></div>' +
			'<div id="sec-ac" data-toc-section="Acceptance Criteria"><ul><li>one</li></ul></div>';

		expect(collectSectionedTocItems(host)).toEqual([
			{ id: "sec-desc", text: "Description", level: 1 },
			{ id: "overview", text: "Overview", level: 2 },
			{ id: "detail", text: "Detail", level: 3 },
			{ id: "sec-ac", text: "Acceptance Criteria", level: 1 },
		]);
	});

	it("falls back to flat heading collection without declared sections", () => {
		const host = document.createElement("div");
		host.innerHTML = '<h2 id="a" data-heading-text="Alpha">Alpha</h2>';

		expect(collectSectionedTocItems(host)).toEqual([{ id: "a", text: "Alpha", level: 1 }]);
	});

	it("lists only the sections that are actually rendered, with headings nested", async () => {
		const descriptionSource = "## Overview\n\nBody\n\n### Detail";
		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ImageLightboxProvider>
							<MemoryRouter>
								<Modal isOpen onClose={() => {}} title="BACK-1 — Task" toc>
									<div id="task-section-description" data-toc-section="Description">
										<MermaidMarkdown source={descriptionSource} />
									</div>
									<div id="task-section-acceptance-criteria" data-toc-section="Acceptance Criteria">
										<ul>
											<li>one</li>
										</ul>
									</div>
								</Modal>
							</MemoryRouter>
						</ImageLightboxProvider>
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		await clickElement(bookmark());
		const links = drawerLinks();
		expect(links.map((link) => link.textContent)).toEqual(["Description", "Overview", "Detail", "Acceptance Criteria"]);
		// Sections sit at the top level; their internal headings nest underneath.
		const levels = Array.from(
			document.querySelectorAll<HTMLElement>("nav[aria-label='On this page'] li[data-toc-level]"),
		).map((row) => row.getAttribute("data-toc-level"));
		expect(levels).toEqual(["1", "2", "3", "1"]);
		// The plan/notes/summary sections are not rendered, so they do not appear.
		expect(links.some((link) => link.textContent === "Implementation Plan")).toBe(false);
	});

	it("lists every metadata tab and activates the clicked one", async () => {
		function TabbedHarness() {
			const [active, setActive] = useState<"references" | "documentation" | "modifiedFiles">("references");
			return (
				<Modal isOpen onClose={() => {}} title="BACK-1 — Task" toc>
					<div role="tablist">
						<TabButton
							id="tab-references"
							label="References"
							count={2}
							active={active === "references"}
							onSelect={() => setActive("references")}
							tocLabel="References (2)"
						/>
						<TabButton
							id="tab-documentation"
							label="Documentation"
							count={1}
							active={active === "documentation"}
							onSelect={() => setActive("documentation")}
							tocLabel="Documentation (1)"
						/>
						<TabButton
							id="tab-modified"
							label="Modified Files"
							count={0}
							active={active === "modifiedFiles"}
							onSelect={() => setActive("modifiedFiles")}
							tocLabel="Modified Files"
						/>
					</div>
				</Modal>
			);
		}

		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ImageLightboxProvider>
							<MemoryRouter>
								<TabbedHarness />
							</MemoryRouter>
						</ImageLightboxProvider>
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		await clickElement(bookmark());
		expect(drawerLinks().map((link) => link.textContent)).toEqual([
			"References (2)",
			"Documentation (1)",
			"Modified Files",
		]);
		expect(document.getElementById("tab-documentation")?.getAttribute("aria-selected")).toBe("false");

		const documentationEntry = drawerLinks().find((link) => link.textContent === "Documentation (1)");
		await clickElement(documentationEntry);

		expect(document.getElementById("tab-documentation")?.getAttribute("aria-selected")).toBe("true");
		expect(document.getElementById("tab-references")?.getAttribute("aria-selected")).toBe("false");
	});

	it("highlights the selected tab, not the last one sharing its position", async () => {
		function TabbedHarness() {
			const [active, setActive] = useState<"references" | "documentation" | "modifiedFiles">("references");
			return (
				<Modal isOpen onClose={() => {}} title="BACK-1 — Task" toc>
					<div role="tablist">
						<TabButton
							id="tab-references"
							label="References"
							active={active === "references"}
							onSelect={() => setActive("references")}
							tocLabel="References"
						/>
						<TabButton
							id="tab-documentation"
							label="Documentation"
							active={active === "documentation"}
							onSelect={() => setActive("documentation")}
							tocLabel="Documentation"
						/>
						<TabButton
							id="tab-modified"
							label="Modified Files"
							active={active === "modifiedFiles"}
							onSelect={() => setActive("modifiedFiles")}
							tocLabel="Modified Files"
						/>
					</div>
				</Modal>
			);
		}

		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ImageLightboxProvider>
							<MemoryRouter>
								<TabbedHarness />
							</MemoryRouter>
						</ImageLightboxProvider>
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		await clickElement(bookmark());
		// All three tabs sit at the same spot above the reading line.
		headingTops.set("tab-references", 40);
		headingTops.set("tab-documentation", 40);
		headingTops.set("tab-modified", 40);
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		// Position rules alone would pick the last tab; the selected one must win.
		expect(drawerLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe("References");

		// The reported scenario: jump to another tab; after the programmatic scroll
		// clears the pin, the newly selected tab still owns the reading position.
		await clickElement(drawerLinks().find((link) => link.textContent === "Documentation"));
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(drawerLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe(
			"Documentation",
		);
	});
});
