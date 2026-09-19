import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { SearchResult, Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import SearchDialog from "../web/components/search/SearchDialog.tsx";

const SEARCH_DEBOUNCE_MS = 300;

const activeTask: Task = {
	id: "BACK-2",
	title: "Deep link follow-up",
	status: "In Progress",
	priority: "high",
	assignee: [],
	createdDate: "2026-09-18",
	labels: [],
	dependencies: [],
	source: "local",
};

const completedTask: Task = {
	id: "BACK-1",
	title: "Completed deep link work",
	status: "Done",
	assignee: [],
	createdDate: "2026-09-18",
	labels: [],
	dependencies: [],
	source: "completed",
};

const taskResults: SearchResult[] = [
	{ type: "task", score: 0.1, task: activeTask },
	{ type: "task", score: 0.2, task: completedTask },
];

const decisionResult: SearchResult = {
	type: "decision",
	score: 0.3,
	decision: {
		id: "DOC-1",
		title: "Deep link decision",
		date: "2026-09-01",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
	},
};

interface RecordedLocation {
	pathname: string;
	search: string;
	state: unknown;
}

const locations: RecordedLocation[] = [];

function LocationProbe(): null {
	const location = useLocation();
	locations.push({ pathname: location.pathname, search: location.search, state: location.state });
	return null;
}

const originalFetch = globalThis.fetch;
let activeRoot: Root | null = null;
let fetchUrls: string[] = [];
/** Per-test result payload; the VirtualList window only renders the first few rows. */
let mockedResults: SearchResult[] = [];

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function setupDom(path: string): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof globalThis.CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof globalThis.MutationObserver;
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	} as unknown as typeof globalThis.ResizeObserver;
	// React's change-event polyfill probes for attachEvent/detachEvent on the element prototype.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: unknown;
		detachEvent?: unknown;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
		htmlElementPrototype.detachEvent = () => {};
	}
	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

async function flush(milliseconds = 0): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, milliseconds));
	});
}

async function renderDialog(path: string): Promise<HTMLElement> {
	const container = setupDom(path);
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<MemoryRouter initialEntries={[path]}>
					<LocationProbe />
					<SearchDialog />
				</MemoryRouter>
			</I18nProvider>,
		);
	});
	return container;
}

function fetchCompletedParams(): Array<string | null> {
	return fetchUrls
		.filter((raw) => new URL(raw, "http://localhost").pathname === "/api/search")
		.map((raw) => new URL(raw, "http://localhost").searchParams.get("completed"));
}

beforeEach(() => {
	fetchUrls = [];
	locations.length = 0;
	mockedResults = taskResults;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		fetchUrls.push(raw);
		return json(mockedResults);
	}) as unknown as typeof globalThis.fetch;
});

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	globalThis.fetch = originalFetch;
});

describe("search dialog completed toggle", () => {
	it("requests the widened corpus when the URL carries completed=true and badges completed rows", async () => {
		const container = await renderDialog("/search?q=deep&completed=true");
		await flush(SEARCH_DEBOUNCE_MS + 50);

		expect(fetchCompletedParams()).toEqual(["true"]);
		expect(container.textContent).toContain("Completed deep link work");
		// The completed-corpus row is distinguishable from the active one (AC#5 for the web surface).
		const badges = Array.from(container.querySelectorAll("span")).filter(
			(element) => element.textContent === "Completed",
		);
		expect(badges.length).toBeGreaterThan(0);
		// Priority goes through the shared i18n label, not the raw enum value.
		const priorityBadges = Array.from(container.querySelectorAll("span")).filter(
			(element) => element.textContent === "High",
		);
		expect(priorityBadges.length).toBeGreaterThan(0);

		const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(checkbox).toBeTruthy();
		expect(checkbox?.checked).toBe(true);
	});

	it("translates the decision status badge instead of showing the raw enum value", async () => {
		mockedResults = [decisionResult];
		const container = await renderDialog("/search?q=deep&completed=true");
		await flush(SEARCH_DEBOUNCE_MS + 50);

		expect(container.textContent).toContain("Deep link decision");
		const decisionBadges = Array.from(container.querySelectorAll("span")).filter(
			(element) => element.textContent === "Accepted",
		);
		expect(decisionBadges.length).toBeGreaterThan(0);
	});

	it("dropping the toggle removes completed from the next request", async () => {
		const container = await renderDialog("/search?q=deep&completed=true");
		await flush(SEARCH_DEBOUNCE_MS + 50);
		expect(fetchCompletedParams()).toEqual(["true"]);

		const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(checkbox).toBeTruthy();
		await act(async () => {
			const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
			nativeSetter?.call(checkbox, false);
			checkbox?.dispatchEvent(new window.Event("click", { bubbles: true }));
		});
		await flush(SEARCH_DEBOUNCE_MS + 50);

		expect(fetchCompletedParams()).toEqual(["true", null]);
		// The toggle state is shareable/bookmarkable: it lives in the URL.
		const last = locations[locations.length - 1];
		expect(last?.pathname).toBe("/search");
		expect(last?.search).not.toContain("completed=true");
	});

	it("opens a completed task with the resolved record in the navigation state", async () => {
		const container = await renderDialog("/search?q=deep&completed=true");
		await flush(SEARCH_DEBOUNCE_MS + 50);

		const row = Array.from(container.querySelectorAll("button")).find((element) =>
			element.textContent?.includes("Completed deep link work"),
		);
		expect(row).toBeTruthy();
		await act(async () => {
			row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});

		const last = locations[locations.length - 1];
		expect(last?.pathname).toBe("/task/1/completed-deep-link-work");
		const state = last?.state as { backgroundLocation?: unknown; preloadedTask?: Task };
		expect(state?.preloadedTask?.id).toBe("BACK-1");
		expect(state?.preloadedTask?.source).toBe("completed");
		expect(state?.backgroundLocation).toBeTruthy();
	});
});
