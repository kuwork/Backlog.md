import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Decision } from "../types/index.ts";
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

// Titles are deliberately unrelated to the IDs, and one ID has no number at all, so the title column
// and the ID column cannot agree by accident.
const decisions: Decision[] = [
	{
		id: "decision-2",
		title: "Zulu rollout",
		date: "2026-01-01",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
	{
		id: "decision-11",
		title: "Alpha storage",
		date: "2026-01-02",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
	{
		id: "notes",
		title: "Xray migration",
		date: "2026-01-03",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
	{
		id: "decision-3",
		title: "Mike logging",
		date: "2026-01-04",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
	{
		id: "decision-12",
		title: "Bravo cutover",
		date: "2026-01-05",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
];

const navigation = (locale: Locale = "en") => (
	<MemoryRouter>
		<I18nProvider initialLocale={locale}>
			<SideNavigation
				tasks={[]}
				docs={[]}
				docsTree={[]}
				decisions={decisions}
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
	// A persisted expansion keeps the list expanded even though the fixtures are close to the
	// auto-collapse threshold.
	localStorage.setItem("decisionsCollapsed", JSON.stringify(false));
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(navigation(locale));
	});
	return container;
};

// The documents and wiki sections render sort buttons with the same labels, so every lookup has to be
// scoped to the decisions section rather than to the whole sidebar.
const decisionsSection = (container: HTMLElement, heading = "Decisions"): HTMLElement => {
	const label = [...container.querySelectorAll("span")].find((span) =>
		(span.textContent ?? "").startsWith(heading),
	);
	const section = label?.closest(".px-4");
	if (!section) throw new Error(`no section headed "${heading}"`);
	return section as HTMLElement;
};

const sortButton = (container: HTMLElement, hint: string, heading = "Decisions"): HTMLElement => {
	const button = [...decisionsSection(container, heading).querySelectorAll("button")].find(
		(candidate) => candidate.getAttribute("aria-label") === hint,
	);
	if (!button) throw new Error(`no decision sort button labelled "${hint}"`);
	return button as HTMLElement;
};

const clickSort = (container: HTMLElement, hint: string) => {
	act(() => {
		sortButton(container, hint).dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
};

const expectDecisionOrder = (container: HTMLElement, labels: string[]) => {
	const region = decisionsSection(container).innerHTML;
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
const ID_HINT = "Sort by decision ID";

describe("SideNavigation decisions sorting", () => {
	it("starts on title ascending", () => {
		const container = renderNavigation();

		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, ID_HINT)).toEqual({ up: false, down: false });
		expectDecisionOrder(container, [
			"Alpha storage",
			"Bravo cutover",
			"Mike logging",
			"Xray migration",
			"Zulu rollout",
		]);
	});

	it("keeps the sort buttons next to the create-decision button, before the list", () => {
		const region = decisionsSection(renderNavigation()).innerHTML;

		expect(region.indexOf(TITLE_HINT)).toBeGreaterThan(-1);
		expect(region.indexOf(TITLE_HINT)).toBeLessThan(region.indexOf(ID_HINT));
		expect(region.indexOf(ID_HINT)).toBeLessThan(region.indexOf("Create new decision"));
		expect(region.indexOf("Create new decision")).toBeLessThan(region.indexOf("Alpha storage"));
	});

	it("sorts by decision ID while the rows keep printing the title", () => {
		const container = renderNavigation();
		clickSort(container, ID_HINT);

		expect(sortIndicators(container, ID_HINT)).toEqual({ up: true, down: false });
		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: false, down: false });
		// `notes` carries no number, so it sorts as 0 and leads the ID column.
		expectDecisionOrder(container, [
			"Xray migration",
			"Zulu rollout",
			"Mike logging",
			"Alpha storage",
			"Bravo cutover",
		]);
	});

	it("flips the direction when the active column is clicked again", () => {
		const container = renderNavigation();
		clickSort(container, ID_HINT);
		clickSort(container, ID_HINT);

		expect(sortIndicators(container, ID_HINT)).toEqual({ up: false, down: true });
		expectDecisionOrder(container, [
			"Bravo cutover",
			"Alpha storage",
			"Mike logging",
			"Zulu rollout",
			"Xray migration",
		]);
	});

	it("restarts ascending when the other column is selected", () => {
		const container = renderNavigation();
		// The ID column is taken to descending first, so a column switch that carried the previous
		// direction over would land on descending instead of restarting at ascending.
		clickSort(container, ID_HINT);
		clickSort(container, ID_HINT);
		clickSort(container, TITLE_HINT);

		expect(sortIndicators(container, TITLE_HINT)).toEqual({ up: true, down: false });
		expectDecisionOrder(container, [
			"Alpha storage",
			"Bravo cutover",
			"Mike logging",
			"Xray migration",
			"Zulu rollout",
		]);
	});

	it("localizes the sort labels", () => {
		const cases: Array<[Locale, string, string, string, string]> = [
			["en", "Decisions", "Title", "Sort by title", "Sort by decision ID"],
			["ja", "決定事項", "タイトル", "タイトルで並べ替え", "決定事項 ID で並べ替え"],
			["zh-CN", "决策", "标题", "按标题排序", "按决策 ID 排序"],
			["zh-TW", "決策", "標題", "按標題排序", "按決策 ID 排序"],
		];

		for (const [locale, heading, titleLabel, titleHint, idHint] of cases) {
			const container = renderNavigation(locale);
			expect(sortButton(container, titleHint, heading).textContent).toContain(titleLabel);
			expect(sortButton(container, idHint, heading).textContent).toContain("ID");
			act(() => {
				activeRoot?.unmount();
			});
			activeRoot = null;
		}
	});
});
