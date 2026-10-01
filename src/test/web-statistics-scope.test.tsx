import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { apiClient } from "../web/lib/api.ts";

/** Every call the page makes, so the scope it asked the server for is observable. */
const fetchStatisticsCalls: boolean[] = [];

const FIXTURE = {
	statusCounts: { "To Do": 3, Done: 5 },
	priorityCounts: { high: 1, medium: 0, low: 0, none: 7 },
	totalTasks: 8,
	completedTasks: 5,
	completionPercentage: 63,
	draftCount: 0,
	recentActivity: { created: [], updated: [] },
	projectHealth: {
		averageTaskAge: 27,
		averageCompletionMinutes: 142,
		completionSampleCount: 5,
		staleTasks: [],
		atRiskTasks: [],
		overdueTasks: [],
		blockedTasks: [],
	},
	completionHeatmap: { "2026-09-01": 2 },
};

/**
 * Replace the methods on the shared singleton rather than mocking the module. `mock.module` is
 * process-wide in Bun, and swapping `web/lib/api` out broke 65 unrelated web suites in the same
 * run; stubbing the instance is confined to this file as long as it is restored.
 */
const originalFetchStatistics = apiClient.fetchStatistics;
const originalFetchConfig = apiClient.fetchConfig;

apiClient.fetchStatistics = (async (completed = false) => {
	fetchStatisticsCalls.push(completed);
	return FIXTURE;
}) as unknown as typeof apiClient.fetchStatistics;
// The i18n provider reads the config for its persisted locale.
apiClient.fetchConfig = (async () => ({})) as unknown as typeof apiClient.fetchConfig;

afterAll(() => {
	apiClient.fetchStatistics = originalFetchStatistics;
	apiClient.fetchConfig = originalFetchConfig;
});

const { default: Statistics } = await import("../web/components/Statistics.tsx");

let activeRoot: Root | null = null;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	// The heatmap watches the <html> class for theme changes.
	(globalThis as { MutationObserver?: unknown }).MutationObserver = dom.window.MutationObserver;
	// The page opens a WebSocket for live updates; jsdom's would try to connect for real.
	(globalThis as { WebSocket?: unknown }).WebSocket = class {
		onmessage: ((event: MessageEvent) => void) | null = null;
		close(): void {}
	};
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

/** Renders the search string, so a scope change is observable without a real router. */
function UrlProbe() {
	const location = useLocation();
	return <span data-testid="url-search">{location.search}</span>;
}

async function renderPage(initialEntry = "/statistics"): Promise<void> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<MemoryRouter initialEntries={[initialEntry]}>
					<UrlProbe />
					<Routes>
						<Route path="/statistics" element={<Statistics />} />
					</Routes>
				</MemoryRouter>
			</I18nProvider>,
		);
	});
}

const search = (): string => document.querySelector("[data-testid=url-search]")?.textContent ?? "";

const switchInput = (): HTMLInputElement => document.getElementById("statistics-show-completed") as HTMLInputElement;

/** React's delegated listeners are unreliable here, so drive the handler React bound to the node. */
async function toggleSwitch(checked: boolean): Promise<void> {
	const input = switchInput();
	const propsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
	const props = (input as unknown as Record<string, { onChange?: (event: { target: { checked: boolean } }) => void }>)[
		propsKey as string
	];
	await act(async () => {
		props?.onChange?.({ target: { checked } });
	});
}

describe("statistics page corpus scope", () => {
	afterEach(() => {
		activeRoot?.unmount();
		activeRoot = null;
		fetchStatisticsCalls.length = 0;
	});

	it("asks for the active corpus by default", async () => {
		await renderPage();

		expect(fetchStatisticsCalls).toEqual([false]);
		expect(search()).toBe("");
		expect(switchInput().checked).toBe(false);
	});

	it("opens widened when the URL already carries completed=1", async () => {
		await renderPage("/statistics?completed=1");

		expect(fetchStatisticsCalls).toEqual([true]);
		expect(switchInput().checked).toBe(true);
	});

	it("places the switch in the contribution card header", async () => {
		await renderPage();

		const input = switchInput();
		// The switch shares its row with the heatmap title, not with the page filters.
		const row = input.parentElement?.parentElement ?? null;
		expect(row?.className ?? "").toContain("justify-between");
		const heading = row?.querySelector("h3") ?? null;
		expect(heading?.textContent ?? "NO-HEADING-IN-ROW").toContain("tasks completed in the last year");
	});

	it("writes the scope into the URL and refetches that scope", async () => {
		await renderPage();
		expect(fetchStatisticsCalls).toEqual([false]);

		await toggleSwitch(true);

		expect(search()).toBe("?completed=1");
		expect(fetchStatisticsCalls).toEqual([false, true]);
	});

	it("drops the parameter again when the switch goes back off", async () => {
		await renderPage("/statistics?completed=1");

		await toggleSwitch(false);

		expect(search()).toBe("");
		expect(fetchStatisticsCalls).toEqual([true, false]);
	});

	it("shows the completion mean as one of the headline metric cards", async () => {
		await renderPage();

		// The metric cards are the only elements rendering a text-2xl figure.
		const cards = [...document.querySelectorAll("p.text-2xl")];
		expect(cards).toHaveLength(5);

		const card = cards.find((node) => node.textContent?.includes("142")) ?? null;
		expect(card?.textContent ?? "").toContain("min");
		expect(card?.parentElement?.querySelector("p.text-sm")?.textContent).toBe("Avg Time Spent");
		expect(card?.parentElement?.querySelector("p.text-xs")?.textContent).toBe("n=5");
	});

	it("keeps the metric out of the project health row", async () => {
		await renderPage();

		const health = [...document.querySelectorAll("h3")].find((h) => h.textContent === "Project Health");
		expect(health?.parentElement?.textContent ?? "").not.toContain("Avg completion");
	});
});
