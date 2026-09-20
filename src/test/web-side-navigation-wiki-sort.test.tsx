import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { WikiTreeNode } from "../types/index.ts";
import SideNavigation from "../web/components/SideNavigation";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";

let activeRoot: Root | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

const setupDom = (): HTMLElement => {
	const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as globalThis.Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	// react-tooltip dispatches its own events, so they have to come from the jsdom window too.
	globalThis.Event = dom.window.Event as typeof Event;
	globalThis.CustomEvent = dom.window.CustomEvent as typeof CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as typeof MutationObserver;
	return dom.window.document.getElementById("root") as HTMLElement;
};

// Titles are deliberately unrelated to the file names, one page has no title at all, and the folders
// are neither first nor in the order the two columns produce, so every column disagrees with the raw
// tree order.
const wikiTree: WikiTreeNode[] = [
	{
		name: "guides",
		path: "guides",
		type: "directory",
		children: [
			{ name: "deploy.md", path: "guides/deploy.md", type: "file", title: "Charlie runbook" },
			{ name: "auto-port.md", path: "guides/auto-port.md", type: "file", title: "Mike port" },
			{ name: "zeta.md", path: "guides/zeta.md", type: "file" },
		],
	},
	{ name: "archive", path: "archive", type: "directory", children: [] },
	{ name: "overview.md", path: "overview.md", type: "file", title: "Alpha overview" },
	{ name: "index.md", path: "index.md", type: "file", title: "Bravo index" },
	{ name: "log.md", path: "log.md", type: "file" },
];

const navigation = (locale: Locale = "en") => (
	<MemoryRouter>
		<I18nProvider initialLocale={locale}>
			<SideNavigation
				tasks={[]}
				docs={[]}
				docsTree={[]}
				decisions={[]}
				wikiTree={wikiTree}
				isLoading={false}
				onRetry={async () => {}}
				onRefreshData={async () => {}}
			/>
		</I18nProvider>
	</MemoryRouter>
);

const renderNavigation = (locale: Locale = "en"): HTMLElement => {
	const container = setupDom();
	// Folders start collapsed unless an expansion is persisted, and the nested order is part of what
	// these cases check.
	localStorage.setItem("wikiExpandedPaths", JSON.stringify(["guides"]));
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(navigation(locale));
	});
	return container;
};

// The wiki section is the last one, so the slice from its heading to the end of the markup is the
// tree, and plain substring positions are enough to assert order.
const wikiRegion = (container: HTMLElement): string => {
	const html = container.innerHTML;
	return html.slice(html.indexOf("Wiki ("));
};

// Both trees print a control labelled "Sort by title"/"Sort by …", so the wiki one has to be looked
// up inside the wiki section's own header row rather than by label alone.
const wikiHeader = (container: HTMLElement): HTMLElement => {
	const heading = [...container.querySelectorAll("span")].find((node) => node.textContent?.startsWith("Wiki ("));
	if (!heading) throw new Error("no wiki heading");
	return heading.parentElement?.parentElement as HTMLElement;
};

const sortButton = (container: HTMLElement, hint: string): HTMLElement => {
	const button = [...wikiHeader(container).querySelectorAll("button")].find(
		(candidate) => candidate.getAttribute("aria-label") === hint,
	);
	if (!button) throw new Error(`no sort button labelled "${hint}"`);
	return button as HTMLElement;
};

const clickSort = (container: HTMLElement, hint: string) => {
	act(() => {
		sortButton(container, hint).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
};

const expectWikiOrder = (container: HTMLElement, labels: string[]) => {
	const region = wikiRegion(container);
	const positions = labels.map((label) => region.indexOf(label));
	expect(positions.every((position) => position >= 0)).toBe(true);
	expect(positions).toEqual([...positions].sort((a, b) => a - b));
};

// The arrows live in a wrapper span: [0] is the ascending arrow, [1] the descending one.
const sortIndicators = (container: HTMLElement, hint: string): { up: boolean; down: boolean } => {
	const [up, down] = [...sortButton(container, hint).querySelectorAll("span span")];
	return {
		up: up?.classList.contains("text-gray-600") ?? false,
		down: down?.classList.contains("text-gray-600") ?? false,
	};
};

const TITLE_HINT = "Sort by title";
const FILE_HINT = "Sort by file name";

describe("SideNavigation wiki tree sorting", () => {
	it("starts on title ascending, prints titles, and keeps folders first", () => {
		const container = renderNavigation();

		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, FILE_HINT)).toEqual({ up: false, down: false });
		expectWikiOrder(container, [
			"archive",
			"guides",
			// Each level is sorted on its own: the nested pages follow their folder.
			"Charlie runbook",
			"Mike port",
			"zeta",
			"Alpha overview",
			"Bravo index",
			"log",
		]);
	});

	it("keeps the sort buttons next to the create-page button, before the tree", () => {
		const region = wikiRegion(renderNavigation());

		expect(region.indexOf(TITLE_HINT)).toBeGreaterThan(-1);
		expect(region.indexOf(TITLE_HINT)).toBeLessThan(region.indexOf(FILE_HINT));
		// `Actions` is the title of the create-page dropdown that sits after the sort buttons.
		expect(region.indexOf(FILE_HINT)).toBeLessThan(region.indexOf("Actions"));
		expect(region.indexOf("Actions")).toBeLessThan(region.indexOf("archive"));
	});

	it("prints file names and orders by them after switching columns", () => {
		const container = renderNavigation();
		clickSort(container, FILE_HINT);

		expect(sortIndicators(container, FILE_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: false, down: false });
		expectWikiOrder(container, [
			"archive",
			"guides",
			"auto-port",
			"deploy",
			"zeta",
			"index",
			"log",
			"overview",
		]);
		// The list prints the field it is sorted by: the titles are gone, the file names are in.
		expect(wikiRegion(container)).not.toContain("Charlie runbook");
	});

	it("flips the direction on the active column and takes the folders with it", () => {
		const container = renderNavigation();
		clickSort(container, FILE_HINT);
		clickSort(container, FILE_HINT);

		expect(sortIndicators(container, FILE_HINT)).toEqual({ up: false, down: true });
		expectWikiOrder(container, [
			"guides",
			"zeta",
			"deploy",
			"auto-port",
			"archive",
			"overview",
			"log",
			"index",
		]);
	});

	it("restarts ascending when the other column is selected", () => {
		const container = renderNavigation();
		clickSort(container, FILE_HINT);
		clickSort(container, TITLE_HINT);
		clickSort(container, TITLE_HINT);

		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: false, down: true });
		expectWikiOrder(container, [
			"guides",
			"zeta",
			"Mike port",
			"Charlie runbook",
			"archive",
			"log",
			"Bravo index",
			"Alpha overview",
		]);
	});

	it("falls back to the file name for a page the corpus has no title for", () => {
		const region = wikiRegion(renderNavigation());

		// Sorted by title, the two untitled pages still read as their file names, without extension.
		// The extension only survives inside the link targets, never in the printed label.
		expect(region).toContain(">zeta<");
		expect(region).toContain(">log<");
		expect(region).not.toContain(">zeta.md<");
		expect(region).not.toContain(">log.md<");
	});

	it("localizes the sort labels", () => {
		const cases: Array<[Locale, string, string, string, string]> = [
			["en", "Title", "Sort by title", "File name", "Sort by file name"],
			["ja", "タイトル", "タイトルで並べ替え", "ファイル名", "ファイル名で並べ替え"],
			["zh-CN", "标题", "按标题排序", "文件名", "按文件名排序"],
			["zh-TW", "標題", "按標題排序", "檔名", "按檔名排序"],
		];

		for (const [locale, titleLabel, titleHint, fileLabel, fileHint] of cases) {
			const container = renderNavigation(locale);
			expect(sortButton(container, titleHint).textContent).toContain(titleLabel);
			expect(sortButton(container, fileHint).textContent).toContain(fileLabel);
			act(() => {
				activeRoot?.unmount();
			});
			activeRoot = null;
		}
	});
});
