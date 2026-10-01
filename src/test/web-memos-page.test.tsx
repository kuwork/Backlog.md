import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { Memo } from "../core/memos.ts";
import type { Decision, Document as DocEntity, Task } from "../types";
import MemosPage, { MemoCard } from "../web/components/MemosPage.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";

/**
 * The `/memos` feed end to end in jsdom: first page on mount, quick capture through the composer,
 * and cursor pagination through a stubbed IntersectionObserver. `globalThis.fetch` is stubbed
 * instead of the api module, which would be process-wide in Bun and poison every other suite.
 */

const makeMemo = (id: string, content: string, tags: string[] = []): Memo => ({
	id,
	createdDate: "2026-10-01 09:00",
	tags,
	displayTitle: content,
	rawContent: content,
	path: `/repo/backlog/memos/${id}.md`,
});

/** Two pages behind one cursor, so a component that ignores the sentinel stops at 2 rows. */
const PAGE_ONE = [
	makeMemo("20261001-3", "Newest memo #idea", ["idea"]),
	makeMemo("20261001-2", "Middle memo #meeting", ["meeting"]),
];
const PAGE_TWO = [makeMemo("20261001-1", "Oldest memo #idea", ["idea"])];

const originalFetch = globalThis.fetch;
let root: Root | null = null;
let requests: string[] = [];
let created: { content: string; tags: string[] } | null = null;
/** Set false to make every mutation answer 500 and prove errors surface instead of dropping notes. */
let failWrites = false;
/** Set true to make the SECOND feed fetch (the live refresh) answer 500, proving it is swallowed. */
let failRefreshes = false;

let observed: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serveApi(): void {
	let noCursorFeedFetches = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const url = new URL(raw, "http://localhost");
		requests.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);

		if (url.pathname === "/api/config") return json({});

		if (url.pathname === "/api/memos" && (init?.method ?? "GET") === "POST") {
			if (failWrites) return json({ error: "boom" }, 500);
			const body = JSON.parse(String(init?.body ?? "{}"));
			created = { content: body.content, tags: body.tags ?? [] };
			return json(makeMemo("20261001-4", body.content, created.tags), 201);
		}

		if (url.pathname === "/api/memos") {
			const cursor = url.searchParams.get("cursor");
			const limit = Number(url.searchParams.get("limit") ?? "30");
			expect(limit).toBeGreaterThan(0);
			if (!cursor) {
				// The first no-cursor fetch is the page load; any later one is the live refresh
				// triggered by the memos-updated broadcast. The refresh surfaces a freshly written
				// memo so the test can prove the list updated in place.
				noCursorFeedFetches += 1;
				if (failRefreshes && noCursorFeedFetches > 1) return json({ error: "refresh failed" }, 500);
				if (noCursorFeedFetches > 1) {
					return json({
						items: [...PAGE_ONE, makeMemo("20261001-5", "Refreshed memo #live", ["live"])],
						nextCursor: "20261001-2",
					});
				}
				return json({ items: PAGE_ONE, nextCursor: "20261001-2" });
			}
			return json({ items: PAGE_TWO, nextCursor: null });
		}

		if (url.pathname === "/api/memos/calendar") {
			const year = Number(url.searchParams.get("year"));
			const month = Number(url.searchParams.get("month"));
			if (year === 2026 && month === 10) return json({ "2026-10-01": 2, "2026-10-15": 5 });
			return json({});
		}

		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

function setupDom(path: string): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as unknown as typeof globalThis.HTMLTextAreaElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement as unknown as typeof globalThis.HTMLInputElement;
	globalThis.KeyboardEvent = dom.window.KeyboardEvent as unknown as typeof globalThis.KeyboardEvent;
	// Mermaid rendering and the entity autocomplete both schedule work through rAF/cAF.
	(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = ((callback: FrameRequestCallback) =>
		setTimeout(() => callback(Date.now()), 0)) as never;
	(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = ((handle: number) =>
		clearTimeout(handle)) as never;
	// WebSocket stub: the page's live-update channel must not dial out from a test.
	(globalThis as { WebSocket?: unknown }).WebSocket = class {
		close() {}
		addEventListener() {}
	} as never;
	// The feed pages itself through an IntersectionObserver on a sentinel; record the callbacks so
	// a test can scroll to the bottom without a layout engine.
	observed = [];
	(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
		constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
			observed.push(callback);
		}
		observe() {}
		disconnect() {}
	} as never;

	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}

	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: unknown;
		detachEvent?: unknown;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
		htmlElementPrototype.detachEvent = () => {};
	}

	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function renderMemos(path = "/memos"): Promise<HTMLElement> {
	const container = setupDom(path);
	serveApi();
	root = createRoot(container);
	await act(async () => {
		root?.render(
			<ThemeProvider>
				<I18nProvider initialLocale="en">
					<ImageLightboxProvider>
						<BrowserRouter>
							<MemosPage />
						</BrowserRouter>
					</ImageLightboxProvider>
				</I18nProvider>
			</ThemeProvider>,
		);
	});
	await flush();
	return container;
}

const cardTexts = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll('[data-testid="memo-card"]')).map((card) => card.textContent ?? "");

const buttonByText = (container: HTMLElement, text: string): HTMLButtonElement | null =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === text) ?? null;

interface ReactProps {
	onClick?: (event: unknown) => void;
	onChange?: (event: unknown) => void;
	[key: string]: unknown;
}

const reactProps = (element: Element): ReactProps => {
	const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
	if (!key) return {};
	return ((element as unknown as Record<string, ReactProps>)[key] as ReactProps) ?? {};
};

async function clickButton(container: HTMLElement, text: string): Promise<void> {
	const button = buttonByText(container, text);
	expect(button).toBeTruthy();
	await act(async () => {
		reactProps(button as Element).onClick?.({});
		await Promise.resolve();
	});
	await flush();
}

async function typeIntoComposer(container: HTMLElement, value: string): Promise<void> {
	const textarea = container.querySelector("textarea");
	expect(textarea).toBeTruthy();
	await act(async () => {
		const props = reactProps(textarea as Element);
		const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
		setter?.call(textarea, value);
		props.onChange?.({ target: textarea });
		await Promise.resolve();
	});
	await flush();
}

describe("MemosPage feed", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		failWrites = false;
		created = null;
		requests = [];
		act(() => root?.unmount());
		root = null;
	});

	it("loads the first page on mount and renders each memo as a dated markdown card", async () => {
		const container = await renderMemos();

		expect(cardTexts(container)).toHaveLength(2);
		expect(cardTexts(container)[0]).toContain("Newest memo");
		// Newest-first order straight from the server.
		expect(cardTexts(container)[1]).toContain("Middle memo");
		// The canonical UTC value is on the date's hover title regardless of the machine locale.
		expect(container.querySelector('[title^="2026-10-01 09:00"]')).toBeTruthy();
		expect(container.querySelector('[data-testid="memos-sentinel"]')).toBeTruthy();
		expect(requests.some((request) => request.startsWith("GET /api/memos?"))).toBe(true);
	});

	it("captures through the composer and shows the saved memo at the top of the feed", async () => {
		const container = await renderMemos();

		await typeIntoComposer(container, "Captured note #smoke");
		await clickButton(container, "Save");

		expect(created?.content).toBe("Captured note #smoke");
		expect(created?.tags).toEqual(["smoke"]);
		expect(cardTexts(container)[0]).toContain("Captured note");
		expect(cardTexts(container)).toHaveLength(3);
	});

	it("keeps the note in the composer when the write fails instead of dropping it", async () => {
		failWrites = true;
		const container = await renderMemos();

		await typeIntoComposer(container, "Do not lose me");
		await clickButton(container, "Save");

		expect(cardTexts(container)).toHaveLength(2);
		expect(container.querySelector("[role='alert']")?.textContent).toContain("Could not save this memo");
		expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Do not lose me");
	});

	it("appends the next page when the sentinel is reached, keeping the loaded pages", async () => {
		const container = await renderMemos();
		// The observer attaches once the first page is on screen.
		expect(observed.length).toBeGreaterThan(0);

		await act(async () => {
			for (const callback of observed) callback([{ isIntersecting: true }]);
			await Promise.resolve();
		});
		await flush();

		expect(cardTexts(container)).toHaveLength(3);
		expect(cardTexts(container).join(" ")).toContain("Oldest memo");
		expect(requests.some((request) => request.includes("cursor=20261001-2"))).toBe(true);
		expect(container.textContent).toContain("That is every memo");
	});

	it("narrows the feed by tag chip and restores it again", async () => {
		const container = await renderMemos();
		const meetingChip = Array.from(container.querySelectorAll("button[aria-pressed]")).find(
			(button) => button.textContent?.trim() === "#meeting",
		);
		expect(meetingChip).toBeTruthy();

		await act(async () => {
			reactProps(meetingChip as Element).onClick?.({});
			await Promise.resolve();
		});
		await flush();

		expect(cardTexts(container)).toHaveLength(1);
		expect(cardTexts(container)[0]).toContain("Middle memo");

		await clickButton(container, "Clear tag filter");
		expect(cardTexts(container)).toHaveLength(2);
	});

	it("reads ?view= from the URL so a feed link opens the feed mode", async () => {
		const container = await renderMemos("/memos?view=feed");
		const feedTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
			(tab) => tab.textContent?.trim() === "Feed",
		);
		expect(feedTab?.getAttribute("aria-selected")).toBe("true");
		expect(cardTexts(container).length).toBeGreaterThan(0);
	});
});

const calendarDay = (container: HTMLElement, date: string): HTMLElement | null =>
	container.querySelector(`[data-testid="calendar-day"][data-date="${date}"]`);

async function clickCalendarDay(container: HTMLElement, date: string): Promise<void> {
	const button = calendarDay(container, date);
	expect(button).toBeTruthy();
	await act(async () => {
		reactProps(button as Element).onClick?.({});
		await Promise.resolve();
	});
	await flush();
}

describe("MemosPage calendar", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		failWrites = false;
		created = null;
		requests = [];
		act(() => root?.unmount());
		root = null;
	});

	it("renders the month grid with per-day counts and prev/next navigation", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01");
		expect(calendarDay(container, "2026-10-01")).toBeTruthy();
		expect(calendarDay(container, "2026-10-15")).toBeTruthy();
		// Two memos were reported for the first; the count badge shows the number.
		expect(calendarDay(container, "2026-10-01")?.textContent).toContain("2");
		expect(container.querySelector('[aria-label="Previous month"]')).toBeTruthy();
		expect(container.querySelector('[aria-label="Next month"]')).toBeTruthy();
	});

	it("opens a day panel when a day is clicked and collapses it on the second click", async () => {
		const container = await renderMemos("/memos?view=calendar");
		expect(container.querySelector('[data-testid="day-panel"]')).toBeNull();
		await clickCalendarDay(container, "2026-10-01");
		expect(container.querySelector('[data-testid="day-panel"]')).toBeTruthy();
		await clickCalendarDay(container, "2026-10-01");
		expect(container.querySelector('[data-testid="day-panel"]')).toBeNull();
	});

	it("deep-links ?view=calendar&date= straight to that day's panel", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-15");
		const panel = container.querySelector('[data-testid="day-panel"]');
		expect(panel).toBeTruthy();
		expect(panel?.getAttribute("data-date")).toBe("2026-10-15");
	});

	it("saves a back-dated memo from the day panel pinned to that day", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01");
		const panel = container.querySelector('[data-testid="day-panel"]');
		expect(panel).toBeTruthy();

		const textarea = panel?.querySelector("textarea");
		expect(textarea).toBeTruthy();
		await act(async () => {
			const props = reactProps(textarea as Element);
			const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
			setter?.call(textarea, "Backdated note #retro");
			props.onChange?.({ target: textarea });
			await Promise.resolve();
		});
		await flush();

		const saveButton = Array.from((panel as HTMLElement).querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Save",
		);
		expect(saveButton).toBeTruthy();
		await act(async () => {
			reactProps(saveButton as Element).onClick?.({});
			await Promise.resolve();
		});
		await flush();

		expect(created?.content).toBe("Backdated note #retro");
		expect(created?.tags).toEqual(["retro"]);
		// The panel composer pins the capture to the selected day.
		expect(requests.some((request) => request.includes("2026-10-01"))).toBe(true);
	});

	it("switches to feed filtered to the day from the panel", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01");
		const panel = container.querySelector('[data-testid="day-panel"]');
		const viewInFeed = buttonByText(panel as HTMLElement, "View in feed");
		expect(viewInFeed).toBeTruthy();
		await clickButton(panel as HTMLElement, "View in feed");
		// The feed mode is selected and the date chip is shown.
		const feedTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
			(tab) => tab.textContent?.trim() === "Feed",
		);
		expect(feedTab?.getAttribute("aria-selected")).toBe("true");
		expect(container.textContent).toContain("2026-10-01");
	});
});

describe("MemoCard knowledge web (BACK-734)", () => {
	const asTask = (id: string) => ({ id }) as unknown as Task;
	const asDoc = (id: string) => ({ id }) as unknown as DocEntity;
	const asDecision = (id: string) => ({ id }) as unknown as Decision;

	const index = {
		tasks: [asTask("task-123")],
		docs: [asDoc("doc-9")],
		decisions: [asDecision("decision-1")],
	};

	afterEach(() => {
		globalThis.fetch = originalFetch;
		act(() => root?.unmount());
		root = null;
	});

	async function renderCard(content: string, withIndex = true): Promise<HTMLElement> {
		const container = setupDom("/memos");
		globalThis.fetch = (async () => new Response("{}")) as unknown as typeof globalThis.fetch;
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<BrowserRouter>
								<TaskIdIndexProvider
									tasks={withIndex ? index.tasks : []}
									docs={withIndex ? index.docs : []}
									decisions={withIndex ? index.decisions : []}
								>
									<MemoCard
										memo={makeMemo("20261001-3", content, [])}
										onUpdate={async () => {}}
										onDelete={async () => {}}
									/>
								</TaskIdIndexProvider>
							</BrowserRouter>
						</ImageLightboxProvider>
					</I18nProvider>
				</ThemeProvider>,
			);
		});
		await flush();
		return container;
	}

	it("renders a bare task id as a link to the task route", async () => {
		const container = await renderCard("See task-123 for context");
		const link = container.querySelector('a[href="/task/123"]');
		expect(link).toBeTruthy();
		expect(link?.textContent).toContain("task-123");
	});

	it("renders bare doc and decision ids as links to their routes", async () => {
		const container = await renderCard("Cross-reference doc-9 and decision-1 here");
		expect(container.querySelector('a[href="/documentation/9"]')?.textContent).toContain("doc-9");
		expect(container.querySelector('a[href="/decisions/1"]')?.textContent).toContain("decision-1");
	});

	it("renders a [[wiki/path]] wikilink as a link to the wiki page", async () => {
		const container = await renderCard("Background in [[wiki/notes]]");
		const link = container.querySelector('a[href^="/wiki/"]');
		expect(link).toBeTruthy();
		expect(link?.textContent).toContain("wiki/notes");
	});

	it("leaves entity ids inside inline code untouched", async () => {
		const container = await renderCard("Do not link `task-123` inside code");
		expect(container.querySelector('a[href="/task/123"]')).toBeNull();
		expect(container.textContent).toContain("task-123");
	});

	it("navigates to the entity without a full page reload when the link is clicked", async () => {
		const container = await renderCard("Jump to task-123");
		const link = container.querySelector('a[href="/task/123"]') as HTMLElement | null;
		expect(link).toBeTruthy();
		await act(async () => {
			reactProps(link as Element).onClick?.({ preventDefault() {} });
			await Promise.resolve();
		});
		await flush();
		// SPA navigation: the location moved client-side; a full reload would 404 in jsdom.
		expect(globalThis.window.location.pathname).toBe("/task/123");
	});
});

describe("MemosPage live refresh (BACK-735)", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		failRefreshes = false;
		created = null;
		requests = [];
		act(() => root?.unmount());
		root = null;
	});

	it("refetches the feed in place on a memos-updated broadcast, without resetting the view", async () => {
		const container = await renderMemos("/memos?view=feed");
		// Initial load: two memos, feed mode, more pages behind the cursor.
		expect(cardTexts(container)).toHaveLength(2);
		const feedGetsBefore = requests.filter((request) => request.startsWith("GET /api/memos?")).length;

		// The App relays the server's memos-updated websocket message as a window event.
		await act(async () => {
			globalThis.window.dispatchEvent(new Event("memos-updated"));
			await Promise.resolve();
		});
		await flush();

		// The refresh pulled the freshly written memo into the very same feed.
		expect(cardTexts(container).some((text) => text.includes("Refreshed memo"))).toBe(true);
		// The previously loaded pages stayed put - the list was updated, not reset to empty.
		expect(cardTexts(container).some((text) => text.includes("Newest memo"))).toBe(true);
		// A further feed fetch proves the broadcast path actually fired.
		const feedGetsAfter = requests.filter((request) => request.startsWith("GET /api/memos?")).length;
		expect(feedGetsAfter).toBeGreaterThan(feedGetsBefore);
	});

	it("swallows a failed refresh without blanking the list or breaking the page", async () => {
		failRefreshes = true;
		const container = await renderMemos("/memos?view=feed");
		expect(cardTexts(container)).toHaveLength(2);

		await act(async () => {
			globalThis.window.dispatchEvent(new Event("memos-updated"));
			await Promise.resolve();
		});
		await flush();

		// The failed background refresh left the loaded list exactly as it was.
		expect(cardTexts(container)).toHaveLength(2);
		expect(cardTexts(container).some((text) => text.includes("Newest memo"))).toBe(true);
		// And it did not knock the page into the destructive load-error state.
		expect(container.querySelector("[role='alert']")).toBeNull();
	});
});
