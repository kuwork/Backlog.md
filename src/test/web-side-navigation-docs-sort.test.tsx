import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { DocsTreeNode, Document as DocumentEntry } from "../types/index.ts";
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

// Titles are deliberately unrelated to the file names and to the IDs, so the name column, the ID
// column and the raw tree order all disagree.
const docs: DocumentEntry[] = [
	{ id: "doc-2", title: "Zulu notes", type: "other", createdDate: "2026-01-01", rawContent: "" },
	{ id: "doc-11", title: "Alpha brief", type: "other", createdDate: "2026-01-02", rawContent: "" },
	{ id: "notes", title: "Xray page", type: "other", createdDate: "2026-01-03", rawContent: "" },
	{ id: "doc-3", title: "Mike log", type: "other", createdDate: "2026-01-04", rawContent: "" },
	{ id: "doc-12", title: "Bravo spec", type: "other", createdDate: "2026-01-05", rawContent: "" },
	{ id: "zeta", title: "Yankee guide", type: "other", createdDate: "2026-01-06", rawContent: "" },
];

// Deliberately unsorted, with a file name (`zeta.md`) that has no numeric ID so the two columns
// really do disagree, and a folder that is not the first entry.
const docsTree: DocsTreeNode[] = [
	{
		name: "prd",
		path: "prd",
		type: "directory",
		children: [
			{ name: "notes.md", path: "prd/notes.md", type: "file", docId: "notes" },
			{ name: "doc-11 - alpha.md", path: "prd/doc-11 - alpha.md", type: "file", docId: "doc-11" },
			{ name: "doc-2 - zulu.md", path: "prd/doc-2 - zulu.md", type: "file", docId: "doc-2" },
		],
	},
	{ name: "migration", path: "migration", type: "directory", children: [] },
	{ name: "doc-3 - mike.md", path: "doc-3 - mike.md", type: "file", docId: "doc-3" },
	{ name: "zeta.md", path: "zeta.md", type: "file", docId: "zeta" },
	{ name: "doc-12 - bravo.md", path: "doc-12 - bravo.md", type: "file", docId: "doc-12" },
];

const navigation = (locale: Locale = "en") => (
	<MemoryRouter>
		<I18nProvider initialLocale={locale}>
			<SideNavigation
				tasks={[]}
				docs={docs}
				docsTree={docsTree}
				decisions={[]}
				wikiTree={[]}
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
	localStorage.setItem("docsExpandedPaths", JSON.stringify(["prd"]));
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(navigation(locale));
	});
	return container;
};

const sortButton = (container: HTMLElement, hint: string): HTMLElement => {
	const button = [...container.querySelectorAll("button")].find(
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

// The documents section is the only filled one in these fixtures, so the slice from its heading to
// the decisions heading is the tree, and plain substring positions are enough to assert order.
const docsRegion = (container: HTMLElement): string => {
	const html = container.innerHTML;
	return html.slice(html.indexOf("Documents"), html.indexOf("Decisions"));
};

const expectDocsOrder = (container: HTMLElement, labels: string[]) => {
	const region = docsRegion(container);
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

const NAME_HINT = "Sort by title";
const ID_HINT = "Sort by document ID";

describe("SideNavigation document tree sorting", () => {
	it("starts on title ascending with folders first", () => {
		const container = renderNavigation();

		expect(sortIndicators(container, NAME_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, ID_HINT)).toEqual({ up: false, down: false });
		expectDocsOrder(container, [
			"migration",
			"prd",
			"Alpha brief",
			"Xray page",
			"Zulu notes",
			"Bravo spec",
			"Mike log",
			"Yankee guide",
		]);
	});

	it("keeps the sort buttons next to the create-document button, before the tree", () => {
		const region = docsRegion(renderNavigation());

		expect(region.indexOf(NAME_HINT)).toBeGreaterThan(-1);
		expect(region.indexOf(NAME_HINT)).toBeLessThan(region.indexOf(ID_HINT));
		// `Actions` is the title of the create-document dropdown that sits after the sort buttons.
		expect(region.indexOf(ID_HINT)).toBeLessThan(region.indexOf("Actions"));
		expect(region.indexOf("Actions")).toBeLessThan(region.indexOf("migration"));
	});

	it("sorts files by document ID while folders follow the same direction by name", () => {
		const container = renderNavigation();
		clickSort(container, ID_HINT);

		expect(sortIndicators(container, ID_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, NAME_HINT)).toEqual({ up: false, down: false });
		expectDocsOrder(container, [
			"migration",
			"prd",
			"Xray page",
			"Zulu notes",
			"Alpha brief",
			"Yankee guide",
			"Mike log",
			"Bravo spec",
		]);
	});

	it("flips the direction when the active column is clicked again", () => {
		const container = renderNavigation();
		clickSort(container, ID_HINT);
		clickSort(container, ID_HINT);

		expect(sortIndicators(container, ID_HINT)).toEqual({ up: false, down: true });
		expectDocsOrder(container, [
			"prd",
			"Alpha brief",
			"Zulu notes",
			"Xray page",
			"migration",
			"Bravo spec",
			"Mike log",
			"Yankee guide",
		]);
	});

	it("restarts ascending when the other column is selected", () => {
		const container = renderNavigation();
		clickSort(container, ID_HINT);
		clickSort(container, NAME_HINT);
		clickSort(container, NAME_HINT);

		expect(sortIndicators(container, NAME_HINT)).toEqual({ up: false, down: true });
		expectDocsOrder(container, [
			"prd",
			"Zulu notes",
			"Xray page",
			"Alpha brief",
			"migration",
			"Yankee guide",
			"Mike log",
			"Bravo spec",
		]);
	});

	it("localizes the sort labels", () => {
		const cases: Array<[Locale, string, string, string]> = [
			["en", "Title", "Sort by title", "Sort by document ID"],
			["ja", "タイトル", "タイトルで並べ替え", "ドキュメント ID で並べ替え"],
			["zh-CN", "标题", "按标题排序", "按文档 ID 排序"],
			["zh-TW", "標題", "按標題排序", "按文檔 ID 排序"],
		];

		for (const [locale, nameLabel, nameHint, idHint] of cases) {
			const container = renderNavigation(locale);
			expect(sortButton(container, nameHint).textContent).toContain(nameLabel);
			expect(sortButton(container, idHint).textContent).toContain("ID");
			act(() => {
				activeRoot?.unmount();
			});
			activeRoot = null;
		}
	});
});
