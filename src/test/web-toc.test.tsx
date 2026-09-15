import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Decision as BacklogDecision } from "../types/index.ts";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import TocButton from "../web/components/TocButton.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { TocProvider, usePageToc } from "../web/contexts/TocContext.tsx";
import { collectTocItems, buildTocTree, flattenTocTree, normalizeTocLevels, tocAncestorIds } from "../web/utils/toc.ts";

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

// JSX attribute strings keep "\n" literal, so markdown sources must be real strings.
const MIXED_SOURCE = "## 二、TUI 概览\n\n### Details\n\n## Details\n\n#### Deep section\n\nBody text";

/** 25 headings nested four levels deep: long enough to fold by default. */
function longSource(): string {
	const lines = ["# Top"];
	for (let index = 1; index <= 6; index += 1) {
		lines.push(`## Section ${index}`, `### Detail ${index}.1`, `### Detail ${index}.2`, `#### Note ${index}.2.a`);
	}
	return lines.join("\n\n");
}

function setupInteractiveDom(url = "http://localhost:6421/decisions/decision-1") {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
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

/** Heading offsets by element id, so the scrollspy can be driven deterministically. */
const headingTops = new Map<string, number>();

function installElementRects(dom: JSDOM): void {
	const proto = dom.window.HTMLElement.prototype as unknown as { getBoundingClientRect: () => DOMRect };
	proto.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
		const top = headingTops.get(this.id) ?? 0;
		return {
			top,
			bottom: top + 20,
			left: 0,
			right: 0,
			width: 0,
			height: 20,
			x: 0,
			y: top,
			toJSON: () => ({}),
		} as DOMRect;
	};
}

/**
 * Mirrors how the app hosts the outline: a reading page publishes its rendered
 * headings, and the header button renders them on demand.
 */
function TocHarness({ source }: { source: string }) {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	usePageToc(containerRef, source);
	return (
		<div>
			<div ref={containerRef}>
				<MermaidMarkdown source={source} />
			</div>
			<TocButton />
		</div>
	);
}

function decisionFixture(): BacklogDecision {
	return {
		id: "decision-1",
		title: "Alpha",
		date: "2026-08-01",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: MIXED_SOURCE,
	};
}

function tocButton(): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>("button[aria-controls][aria-expanded]");
}

function tocPanel(): HTMLElement | null {
	return document.querySelector<HTMLElement>("nav[aria-label='On this page']");
}

function tocLinks(): HTMLAnchorElement[] {
	return Array.from(document.querySelectorAll<HTMLAnchorElement>("nav[aria-label='On this page'] a[href^='#']"));
}

function tocRows(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>("nav[aria-label='On this page'] li[data-toc-level]"));
}

/** The fold toggle sitting on the same row as the entry with this text. */
function foldToggle(label: string): HTMLButtonElement | null {
	const link = tocLinks().find((anchor) => anchor.textContent === label);
	return link?.parentElement?.querySelector<HTMLButtonElement>("button[aria-expanded]") ?? null;
}

function visibleLabels(): (string | null)[] {
	return tocLinks().map((link) => link.textContent);
}

/** The master fold control in the panel header, whatever state it is in. */
function toggleAllButton(): HTMLButtonElement | null {
	const labels = ["Expand all", "Collapse all"];
	return (
		Array.from(document.querySelectorAll<HTMLButtonElement>("nav[aria-label='On this page'] button")).find((button) =>
			labels.includes(button.textContent?.trim() ?? ""),
		) ?? null
	);
}

async function clickElement(element: Element | null | undefined) {
	await act(async () => {
		element?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
	});
}

describe("collectTocItems", () => {
	let dom: ReturnType<typeof setupInteractiveDom> | null = null;

	beforeEach(() => {
		dom = setupInteractiveDom();
	});

	afterEach(() => {
		(globalThis as { window?: typeof window }).window = originalWindowGlobal;
		(globalThis as { document?: Document }).document = originalDocumentGlobal;
	});

	it("reads every heading level and normalizes the shallowest to depth 1", () => {
		const host = document.createElement("div");
		host.innerHTML =
			'<h3 id="a" data-heading-text="Alpha">Alpha</h3>' +
			'<h4 id="a1" data-heading-text="Alpha One">Alpha One</h4>' +
			'<h3 id="b" data-heading-text="Beta">Beta</h3>' +
			'<h5 id="b1" data-heading-text="Beta One">Beta One</h5>';

		expect(collectTocItems(host)).toEqual([
			{ id: "a", text: "Alpha", level: 1 },
			{ id: "a1", text: "Alpha One", level: 2 },
			{ id: "b", text: "Beta", level: 1 },
			{ id: "b1", text: "Beta One", level: 3 },
		]);
	});

	it("skips headings the renderer gave no anchor", () => {
		const host = document.createElement("div");
		host.innerHTML = '<h2 data-heading-text="No anchor">No anchor</h2><h2 id="kept" data-heading-text="Kept">Kept</h2>';

		expect(collectTocItems(host).map((item) => item.id)).toEqual(["kept"]);
	});

	it("caps depth at six levels", () => {
		const items = normalizeTocLevels([
			{ id: "a", text: "A", level: 1 },
			{ id: "b", text: "B", level: 9 },
		]);

		expect(items.map((item) => item.level)).toEqual([1, 6]);
	});

	it("returns nothing for a missing container", () => {
		expect(collectTocItems(null)).toEqual([]);
		expect(dom).toBeTruthy();
	});
});

describe("toc tree", () => {
	const items = [
		{ id: "a", text: "A", level: 1 },
		{ id: "a1", text: "A1", level: 2 },
		{ id: "a1x", text: "A1X", level: 3 },
		{ id: "a2", text: "A2", level: 2 },
		{ id: "b", text: "B", level: 1 },
	];

	it("nests every entry under the closest shallower entry", () => {
		const tree = buildTocTree(items);

		expect(tree.map((node) => node.id)).toEqual(["a", "b"]);
		expect(tree[0]?.children.map((node) => node.id)).toEqual(["a1", "a2"]);
		expect(tree[0]?.children[0]?.children.map((node) => node.id)).toEqual(["a1x"]);
	});

	it("keeps a level jump attached to the preceding entry instead of dropping it", () => {
		const tree = buildTocTree([
			{ id: "a", text: "A", level: 1 },
			{ id: "a1x", text: "A1X", level: 4 },
		]);

		expect(tree[0]?.children.map((node) => node.id)).toEqual(["a1x"]);
	});

	it("hides the whole subtree of a folded entry", () => {
		const tree = buildTocTree(items);
		const expanded = flattenTocTree(tree, () => false);
		const folded = flattenTocTree(tree, (id) => id === "a");

		expect(expanded.map((row) => row.item.id)).toEqual(["a", "a1", "a1x", "a2", "b"]);
		expect(expanded.map((row) => row.hasChildren)).toEqual([true, true, false, false, false]);
		expect(folded.map((row) => row.item.id)).toEqual(["a", "b"]);
	});

	it("reports the ancestors of a nested entry, outermost first", () => {
		const tree = buildTocTree(items);

		expect(tocAncestorIds(tree, "a1x")).toEqual(["a", "a1"]);
		expect(tocAncestorIds(tree, "a")).toEqual([]);
		expect(tocAncestorIds(tree, "missing")).toEqual([]);
	});
});

describe("TocButton", () => {
	let root: Root | null = null;
	let scrolled: HTMLElement[] = [];

	beforeEach(() => {
		const dom = setupInteractiveDom();
		scrolled = installScrollSpy(dom);
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

	const renderToc = async (source: string) => {
		act(() => {
			root?.render(
				<I18nProvider initialLocale="en">
					<ImageLightboxProvider>
						<MemoryRouter initialEntries={["/decisions/decision-1"]}>
							<TocProvider>
								<TocHarness source={source} />
							</TocProvider>
						</MemoryRouter>
					</ImageLightboxProvider>
				</I18nProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});
	};

	const openPanel = async () => {
		await clickElement(tocButton());
	};

	it("shows the header button and reveals the outline only once it is opened", async () => {
		await renderToc(MIXED_SOURCE);

		const button = tocButton();
		expect(button).toBeTruthy();
		expect(button?.getAttribute("aria-expanded")).toBe("false");
		expect(button?.getAttribute("aria-label")).toBe("On this page");
		// Nothing floats over the content until the reader asks for it.
		expect(tocPanel()).toBeNull();

		await openPanel();

		const headings = Array.from(document.querySelectorAll<HTMLElement>("h2, h3, h4, h5, h6"));
		const links = tocLinks();

		expect(tocButton()?.getAttribute("aria-expanded")).toBe("true");
		expect(tocPanel()).toBeTruthy();
		expect(headings).toHaveLength(4);
		expect(links).toHaveLength(4);
		expect(links.map((link) => link.getAttribute("href"))).toEqual(headings.map((heading) => `#${heading.id}`));
		expect(links.map((link) => link.textContent)).toEqual(["二、TUI 概览", "Details", "Details", "Deep section"]);
		// Duplicate titles keep distinct anchors.
		expect(new Set(headings.map((heading) => heading.id)).size).toBe(4);
	});

	it("indents nested entries by depth", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		expect(tocRows().map((row) => row.getAttribute("data-toc-level"))).toEqual(["1", "2", "1", "3"]);
		expect(tocRows().map((row) => row.style.paddingLeft)).toEqual(["12px", "24px", "12px", "36px"]);
	});

	it("offers a fold toggle on entries that own a subtree, and none on leaves", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		// "二、TUI 概览" owns the h3 "Details"; the leaf "Deep section" owns nothing.
		const parentToggle = foldToggle("二、TUI 概览");
		expect(parentToggle).toBeTruthy();
		expect(parentToggle?.getAttribute("aria-expanded")).toBe("true");
		expect(parentToggle?.getAttribute("aria-label")).toBe("Collapse section — 二、TUI 概览");
		expect(foldToggle("Deep section")).toBeNull();

		const nestedHref = tocLinks()[1]?.getAttribute("href");
		expect(nestedHref).toBeTruthy();

		await clickElement(parentToggle);

		expect(visibleLabels()).toEqual(["二、TUI 概览", "Details", "Deep section"]);
		expect(tocLinks().map((link) => link.getAttribute("href"))).not.toContain(nestedHref);
		const collapsedToggle = foldToggle("二、TUI 概览");
		expect(collapsedToggle?.getAttribute("aria-expanded")).toBe("false");
		expect(collapsedToggle?.getAttribute("aria-label")).toBe("Expand section — 二、TUI 概览");

		await clickElement(collapsedToggle);

		expect(visibleLabels()).toEqual(["二、TUI 概览", "Details", "Details", "Deep section"]);
	});

	it("opens a long outline folded below the top level", async () => {
		await renderToc(longSource());
		// The reader is at the top of the page, so nothing forces a branch open.
		Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).forEach((heading, index) =>
			headingTops.set(heading.id, index === 0 ? -100 : 600),
		);
		await openPanel();

		// 25 headings: the 6 sections stay visible, their 18 descendants start folded.
		expect(visibleLabels()).toEqual(["Top", "Section 1", "Section 2", "Section 3", "Section 4", "Section 5", "Section 6"]);

		await clickElement(foldToggle("Section 1"));

		// "Detail 1.2" itself owns a deeper note, so it stays folded until asked.
		expect(visibleLabels()).toEqual([
			"Top",
			"Section 1",
			"Detail 1.1",
			"Detail 1.2",
			"Section 2",
			"Section 3",
			"Section 4",
			"Section 5",
			"Section 6",
		]);

		await clickElement(foldToggle("Detail 1.2"));

		expect(visibleLabels()).toContain("Note 1.2.a");
	});

	it("folds the branches of a short outline only when asked", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		expect(visibleLabels()).toHaveLength(4);
	});

	it("folds every branch and unfolds them again from the master control", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		// A fully open outline offers the fold action.
		expect(toggleAllButton()?.textContent).toBe("Collapse all");

		await clickElement(toggleAllButton());

		// Only the top level survives; the nested "Details" goes with its parent.
		expect(visibleLabels()).toEqual(["二、TUI 概览", "Details"]);
		expect(toggleAllButton()?.textContent).toBe("Expand all");

		await clickElement(toggleAllButton());

		expect(visibleLabels()).toEqual(["二、TUI 概览", "Details", "Details", "Deep section"]);
		expect(toggleAllButton()?.textContent).toBe("Collapse all");
	});

	it("unfolds a long outline that opened folded, and folds it back to the top level", async () => {
		await renderToc(longSource());
		Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).forEach((heading, index) =>
			headingTops.set(heading.id, index === 0 ? -100 : 600),
		);
		await openPanel();

		// The default already folds the deeper levels, so the control offers the
		// opposite action right away.
		expect(toggleAllButton()?.textContent).toBe("Expand all");

		await clickElement(toggleAllButton());

		expect(visibleLabels()).toHaveLength(25);
		expect(toggleAllButton()?.textContent).toBe("Collapse all");

		await clickElement(toggleAllButton());

		expect(visibleLabels()).toEqual(["Top"]);
		expect(toggleAllButton()?.textContent).toBe("Expand all");
	});

	it("keeps the outline folded while the reader scrolls after folding everything", async () => {
		await renderToc(longSource());
		const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
		headings.forEach((heading, index) => headingTops.set(heading.id, index === 0 ? -100 : 600));
		await openPanel();

		// Unfold everything, then fold it back to the top level.
		await clickElement(toggleAllButton());
		await clickElement(toggleAllButton());
		expect(visibleLabels()).toEqual(["Top"]);

		// The reader scrolls past the first few headings. The scrollspy follows
		// the page, but it must not unfold the tree the reader just folded.
		headings.forEach((heading, index) => headingTops.set(heading.id, index <= 4 ? -100 : 600));
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 60));
		});

		expect(visibleLabels()).toEqual(["Top"]);
		// The entry holding the current section is still marked, so the reading
		// position is not lost just because the branch is folded.
		expect(tocLinks()[0]?.className).toContain("text-blue-600");
	});

	it("omits the master control when no entry owns a subtree", async () => {
		await renderToc("## Alpha\n\n## Beta\n\nBody text");

		await openPanel();

		expect(visibleLabels()).toEqual(["Alpha", "Beta"]);
		expect(toggleAllButton()).toBeNull();
	});

	it("opens the branch holding the current section back up", async () => {
		await renderToc(longSource());
		await openPanel();

		const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
		// Top, Section 1, Detail 1.1, Detail 1.2 and Note 1.2.a sit above the reading position.
		headings.forEach((heading, index) => headingTops.set(heading.id, index <= 4 ? -100 : 600));

		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 60));
		});

		// The current entry is reachable and marked, even though it starts folded.
		expect(visibleLabels()).toContain("Note 1.2.a");
		expect(tocLinks().find((link) => link.getAttribute("aria-current") === "true")?.textContent).toBe("Note 1.2.a");
	});

	it("scrolls to the heading, updates the URL hash and closes the panel when an entry is clicked", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		const link = tocLinks()[2] as HTMLAnchorElement;
		const targetId = link.getAttribute("href")?.slice(1) ?? "";
		await clickElement(link);

		expect(scrolled.map((element) => element.id)).toContain(targetId);
		expect(scrolled.at(-1)?.id).toBe(targetId);
		expect(window.location.hash).toBe(`#${targetId}`);
		expect(tocPanel()).toBeNull();
		expect(tocButton()?.getAttribute("aria-expanded")).toBe("false");
	});

	it("highlights the entry at the reading position while the page scrolls", async () => {
		await renderToc(MIXED_SOURCE);
		await openPanel();

		const ids = tocLinks().map((link) => link.getAttribute("href")?.slice(1) ?? "");
		const currentIds = () =>
			tocLinks()
				.map((link) => (link.getAttribute("aria-current") === "true" ? link.getAttribute("href") : null))
				.filter(Boolean);

		// Only the first heading is above the reading position.
		headingTops.set(ids[0] as string, -500);
		for (const id of ids.slice(1)) headingTops.set(id, 500);
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		expect(currentIds()).toEqual([`#${ids[0]}`]);

		// The reader scrolls past the second heading.
		headingTops.set(ids[1] as string, -400);
		headingTops.set(ids[2] as string, 10);
		await act(async () => {
			window.dispatchEvent(new window.Event("scroll"));
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		expect(currentIds()).toEqual([`#${ids[2]}`]);
	});

	it("closes on Escape and on a click outside the panel", async () => {
		await renderToc(MIXED_SOURCE);

		await openPanel();
		await act(async () => {
			document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		});
		expect(tocPanel()).toBeNull();

		await openPanel();
		expect(tocPanel()).toBeTruthy();
		await act(async () => {
			document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
		});
		expect(tocPanel()).toBeNull();

		// A click inside the panel keeps it open.
		await openPanel();
		await act(async () => {
			tocPanel()?.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
		});
		expect(tocPanel()).toBeTruthy();
	});

	it("renders no button when the content has no headings", async () => {
		await renderToc("Just a paragraph without headings.");

		expect(tocButton()).toBeNull();
		expect(tocLinks()).toEqual([]);
	});
});

describe("DecisionDetail outline", () => {
	let root: Root | null = null;

	beforeEach(() => {
		setupInteractiveDom();
		headingTops.clear();
		globalThis.fetch = (async () =>
			new Response(JSON.stringify(decisionFixture()), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			})) as unknown as typeof fetch;
		root = createRoot(document.getElementById("root") as HTMLElement);
	});

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		(globalThis as { window?: typeof window }).window = originalWindowGlobal;
		(globalThis as { document?: Document }).document = originalDocumentGlobal;
		(globalThis as { navigator?: Navigator }).navigator = originalNavigatorGlobal;
		globalThis.fetch = originalFetch;
	});

	const renderDecision = async () => {
		act(() => {
			root?.render(
				<TocProvider>
					<ThemeProvider>
						<I18nProvider initialLocale="en">
							<ImageLightboxProvider>
								<MemoryRouter initialEntries={["/decisions/decision-1"]}>
									<Routes>
										<Route path="/decisions/:id" element={<DecisionDetail decisions={[decisionFixture()]} onRefreshData={async () => {}} />} />
										<Route path="/decisions/:id/:title" element={<DecisionDetail decisions={[decisionFixture()]} onRefreshData={async () => {}} />} />
									</Routes>
								</MemoryRouter>
								<TocButton />
							</ImageLightboxProvider>
						</I18nProvider>
					</ThemeProvider>
				</TocProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 150));
		});
	};

	it("offers the outline while reading and hides it while editing", async () => {
		await renderDecision();

		expect(tocButton()).toBeTruthy();
		await clickElement(tocButton());
		expect(tocLinks().length).toBe(4);

		const editButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Edit");
		expect(editButton).toBeTruthy();
		await clickElement(editButton);

		expect(tocButton()).toBeNull();
		expect(tocPanel()).toBeNull();
	});
});
