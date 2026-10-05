import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { Memo } from "../core/memos.ts";
import type { Decision, Document as DocEntity, Task } from "../types";
import { localDateKeyFromStoredUtc } from "../utils/date-utc.ts";
import MemosPage, { MemoCard } from "../web/components/MemosPage.tsx";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import type { Locale } from "../web/locales";

/**
 * The `/memos` feed end to end in jsdom: first page on mount, quick capture through the composer,
 * and offset pagination through a stubbed IntersectionObserver. `globalThis.fetch` is stubbed
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

/** A `YYYY-MM-DD HH:mm` UTC string (the stored shape) for a given instant. */
const storedUtc = (date: Date): string => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

/** Two pages behind one offset window, so a component that ignores the sentinel stops at 2 rows. */
const PAGE_ONE = [
	makeMemo("20261001-3", "Newest memo #idea", ["idea"]),
	makeMemo("20261001-2", "Middle memo #meeting", ["meeting"]),
];
const PAGE_TWO = [makeMemo("20261001-1", "Oldest memo #idea", ["idea"])];

const originalFetch = globalThis.fetch;
let root: Root | null = null;
let requests: string[] = [];
let created: { content: string; tags: string[]; createdDate?: string } | null = null;
/** Set false to make every mutation answer 500 and prove errors surface instead of dropping notes. */
let failWrites = false;
/** Set true to make the SECOND feed fetch (the live refresh) answer 500, proving it is swallowed. */
let failRefreshes = false;

let observed: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serveApi(): void {
	let firstPageFetches = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const url = new URL(raw, "http://localhost");
		requests.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);

		if (url.pathname === "/api/config") return json({});

		if (url.pathname === "/api/memos" && (init?.method ?? "GET") === "POST") {
			if (failWrites) return json({ error: "boom" }, 500);
			const body = JSON.parse(String(init?.body ?? "{}"));
			created = { content: body.content, tags: body.tags ?? [], createdDate: body.createdDate };
			// Echo the stored stamp back the way the server does, so the composer's optimistic
			// calendar bump works off the same value the page just sent.
			const saved = makeMemo("20261001-4", body.content, created.tags);
			return json(body.createdDate ? { ...saved, createdDate: body.createdDate } : saved, 201);
		}

		if (url.pathname === "/api/memos") {
			const offset = Number(url.searchParams.get("offset") ?? "0");
			const limit = Number(url.searchParams.get("limit") ?? "30");
			expect(limit).toBeGreaterThan(0);
			if (offset === 0) {
				// The first offset-0 fetch is the page load; any later one is the live refresh
				// triggered by the memos-updated broadcast. The refresh surfaces a freshly written
				// memo so the test can prove the list updated in place.
				firstPageFetches += 1;
				if (failRefreshes && firstPageFetches > 1) return json({ error: "refresh failed" }, 500);
				if (firstPageFetches > 1) {
					return json({
						items: [...PAGE_ONE, makeMemo("20261001-5", "Refreshed memo #live", ["live"])],
						total: PAGE_ONE.length + 1 + PAGE_TWO.length,
						offset: 0,
						limit,
						hasMore: true,
					});
				}
				return json({
					items: PAGE_ONE,
					total: PAGE_ONE.length + PAGE_TWO.length,
					offset: 0,
					limit,
					hasMore: true,
				});
			}
			return json({ items: PAGE_TWO, total: PAGE_ONE.length + PAGE_TWO.length, offset, limit, hasMore: false });
		}

		if (url.pathname.startsWith("/api/memos/") && url.pathname.endsWith("/archive")) {
			if (failWrites) return json({ error: "boom" }, 500);
			const id = decodeURIComponent(url.pathname.slice("/api/memos/".length, -"/archive".length));
			return json(makeMemo(id, "Archived memo", []));
		}

		if (url.pathname === "/api/memos/calendar") {
			const year = Number(url.searchParams.get("year"));
			const month = Number(url.searchParams.get("month"));
			if (year === 2026 && month === 10)
				return json({ "2026-10-01": 2, "2026-10-03": 1, "2026-10-15": 5, "2026-10-20": 9 });
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

async function renderMemos(path = "/memos", locale: Locale = "en"): Promise<HTMLElement> {
	const container = setupDom(path);
	serveApi();
	root = createRoot(container);
	await act(async () => {
		root?.render(
			<ThemeProvider>
				<I18nProvider initialLocale={locale}>
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

async function clickElement(element: Element | null): Promise<void> {
	expect(element).toBeTruthy();
	await act(async () => {
		reactProps(element as Element).onClick?.({});
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
		expect(requests.some((request) => request.includes("offset=2"))).toBe(true);
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

	it("keeps edit and delete behind the card's ⋮ menu", async () => {
		const container = await renderMemos();
		// Nothing is offered until the menu opens.
		expect(buttonByText(container, "Edit")).toBeNull();
		expect(buttonByText(container, "Delete")).toBeNull();

		const more = container.querySelector('[aria-label="More actions"]');
		expect(more).toBeTruthy();
		await clickElement(more);

		const menu = container.querySelector('[role="menu"]');
		expect(menu).toBeTruthy();
		expect(buttonByText(menu as HTMLElement, "Edit")).toBeTruthy();
		expect(buttonByText(menu as HTMLElement, "Delete")).toBeTruthy();

		// Choosing Edit dismisses the menu and swaps the card body for the editor.
		await clickButton(menu as HTMLElement, "Edit");
		expect(container.querySelector('[role="menu"]')).toBeNull();
		expect(container.querySelector('[data-testid="memo-card"] textarea')).toBeTruthy();
	});

	it("leaves the calendar popover shut when the URL does not ask for it", async () => {
		const container = await renderMemos("/memos?view=feed");
		expect(container.querySelector("#memos-calendar-popover")).toBeNull();
		expect(cardTexts(container).length).toBeGreaterThan(0);
	});

	it("copies the memo id from the card menu with a transient confirmation", async () => {
		const container = await renderMemos();
		// setupDom swaps in a fresh jsdom navigator, so the mock goes on after the render.
		const written: string[] = [];
		Object.defineProperty(globalThis.navigator, "clipboard", {
			value: {
				writeText: async (text: string) => {
					written.push(text);
				},
			},
			configurable: true,
		});

		await clickElement(container.querySelector('[aria-label="More actions"]'));
		const menu = container.querySelector('[role="menu"]') as HTMLElement;
		expect(menu).toBeTruthy();
		expect(buttonByText(menu, "Copy ID")).toBeTruthy();

		await clickButton(menu, "Copy ID");
		// The newest card heads the feed, so its id is what lands on the clipboard.
		expect(written).toEqual(["20261001-3"]);
		// The menu stays open for a beat showing the confirmation before closing itself.
		expect(buttonByText(menu, "Copied")).toBeTruthy();
	});

	it("archives a memo from the card menu and drops it from the feed", async () => {
		const container = await renderMemos();
		expect(cardTexts(container)).toHaveLength(2);

		await clickElement(container.querySelector('[aria-label="More actions"]'));
		const menu = container.querySelector('[role="menu"]') as HTMLElement;
		expect(buttonByText(menu, "Archive")).toBeTruthy();

		await clickButton(menu, "Archive");
		// The first card's menu is the newest memo, so that is the id sent to the archive route.
		expect(requests).toContain("POST /api/memos/20261001-3/archive");
		expect(cardTexts(container)).toHaveLength(1);
	});

	it("reports a failed archive instead of dropping the card", async () => {
		failWrites = true;
		const container = await renderMemos();

		await clickElement(container.querySelector('[aria-label="More actions"]'));
		await clickButton(container.querySelector('[role="menu"]') as HTMLElement, "Archive");

		expect(container.querySelector("[role='alert']")?.textContent).toContain("Could not archive this memo");
		expect(cardTexts(container)).toHaveLength(2);
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

describe("MemosPage calendar popover", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
		failWrites = false;
		created = null;
		requests = [];
		act(() => root?.unmount());
		root = null;
	});

	const popover = (container: HTMLElement): HTMLElement | null => container.querySelector("#memos-calendar-popover");
	const calendarButton = (container: HTMLElement): HTMLElement | null =>
		container.querySelector('[aria-controls="memos-calendar-popover"]');

	it("opens the month grid from the composer's calendar button and closes it on Escape", async () => {
		const container = await renderMemos();
		expect(popover(container)).toBeNull();

		await clickElement(calendarButton(container));
		expect(popover(container)).toBeTruthy();
		// The grid follows the current month and marks a day with memos by a dot.
		expect(calendarDay(container, "2026-10-15")?.querySelector('[data-testid="calendar-dot"]')).toBeTruthy();
		expect(container.querySelector('[aria-label="Previous month"]')).toBeTruthy();
		expect(container.querySelector('[aria-label="Next month"]')).toBeTruthy();

		await act(async () => {
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			await Promise.resolve();
		});
		await flush();
		expect(popover(container)).toBeNull();
	});

	it("marks memo density with a coloured dot instead of a count", async () => {
		const container = await renderMemos("/memos?view=calendar");
		const dot = (date: string) =>
			calendarDay(container, date)?.querySelector<HTMLElement>('[data-testid="calendar-dot"]');
		expect(dot("2026-10-03")?.className).toContain("bg-green");
		expect(dot("2026-10-01")?.className).toContain("bg-blue");
		expect(dot("2026-10-20")?.className).toContain("bg-red");
		// The count itself is never printed; a day with no memos has no dot.
		expect(calendarDay(container, "2026-10-20")?.textContent).toBe("20");
		expect(dot("2026-10-10")).toBeNull();
	});

	it("deep-links ?view=calendar&date= to the open popover with that day selected", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-15");
		expect(popover(container)).toBeTruthy();
		expect(calendarDay(container, "2026-10-15")?.getAttribute("aria-pressed")).toBe("true");
		// The date chip sits on the composer.
		expect(container.textContent).toContain("October 15, 2026");
	});

	it("picking a day parks a closable date chip on the composer and filters the feed", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01");
		await clickCalendarDay(container, "2026-10-15");

		// Choosing a day dismisses the popover and reloads the feed filtered to it.
		expect(popover(container)).toBeNull();
		expect(requests.some((request) => request.includes("date=2026-10-15"))).toBe(true);
		expect(container.textContent).toContain("October 15, 2026");

		// The chip's clear button drops the filter.
		const clear = container.querySelector('[aria-label="Clear date filter"]');
		expect(clear).toBeTruthy();
		await clickElement(clear);
		expect(container.querySelector('[aria-label="Clear date filter"]')).toBeNull();
	});

	it("captures into the selected day (back-dated) from the single composer", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01");
		await typeIntoComposer(container, "Backdated note #retro");
		await clickButton(container, "Save");

		expect(created?.content).toBe("Backdated note #retro");
		expect(created?.tags).toEqual(["retro"]);
		// The single composer pins the capture to the day on the chip, with the current LOCAL time,
		// and sends it in the stored UTC shape. The chip's day is therefore what the local date part
		// of the sent value must be - the stored string itself is a different day east or west of UTC.
		expect(localDateKeyFromStoredUtc(String(created?.createdDate))).toBe("2026-10-01");
	});

	it("counts a back-dated capture on the local day, not on its stored UTC date", async () => {
		const container = await renderMemos("/memos?view=calendar");
		// A day the stubbed grid has no memos for, so a dot can only come from the optimistic bump.
		await clickCalendarDay(container, "2026-10-07");
		await typeIntoComposer(container, "Late note #late");
		await clickButton(container, "Save");

		// `bun test` runs in UTC, so the sent value and its local day agree here; the conversion itself
		// is forced apart on a real zone by test/memo-local-day-timezone.test.ts.
		const stored = String(created?.createdDate ?? "");
		expect(stored).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
		expect(localDateKeyFromStoredUtc(stored)).toBe("2026-10-07");

		await clickElement(calendarButton(container));
		expect(calendarDay(container, "2026-10-07")?.querySelector('[data-testid="calendar-dot"]')).toBeTruthy();
	});

	it("renders the month and weekday headings in the app locale", async () => {
		const container = await renderMemos("/memos?view=calendar&date=2026-10-01", "zh-CN");
		const gridText = popover(container)?.textContent ?? "";
		expect(gridText).toContain("2026年10月");
		expect(gridText).not.toContain("Sun");
		expect(gridText).toContain("周");
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

	async function renderCard(content: string, withIndex = true, createdDate?: string): Promise<HTMLElement> {
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
										memo={{ ...makeMemo("20261001-3", content, []), ...(createdDate ? { createdDate } : {}) }}
										onUpdate={async () => {}}
										onDelete={async () => {}}
										onArchive={async () => {}}
										onTagClick={() => {}}
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

	it("carries /memos as the background location so the task modal closes back onto the feed", async () => {
		const container = await renderCard("Jump to task-123");
		const link = container.querySelector('a[href="/task/123"]') as HTMLElement | null;
		expect(link).toBeTruthy();
		await act(async () => {
			reactProps(link as Element).onClick?.({ preventDefault() {} });
			await Promise.resolve();
		});
		await flush();
		const state = window.history.state as { usr?: { backgroundLocation?: { pathname?: string } } } | null;
		expect(state?.usr?.backgroundLocation?.pathname).toBe("/memos");
	});

	it("shows the elapsed minutes for a recent memo instead of a persistent 'just now'", async () => {
		const container = await renderCard("Recent note", false, storedUtc(new Date(Date.now() - 5 * 60000)));
		expect(container.textContent).toContain("5 min ago");
		expect(container.textContent).not.toContain("just now");
	});

	it("reads the first minute as '1 min ago', never 'just now'", async () => {
		const container = await renderCard("Brand new", false, storedUtc(new Date(Date.now() - 20000)));
		expect(container.textContent).toContain("1 min ago");
		expect(container.textContent).not.toContain("just now");
	});

	it("reads the under-an-hour bucket as 'Today'", async () => {
		const container = await renderCard("Half an hour old", false, storedUtc(new Date(Date.now() - 30 * 60000)));
		expect(container.textContent).toContain("Today");
		expect(container.textContent).not.toContain("min ago");
	});

	it("falls back to the concrete clock time once past an hour", async () => {
		const container = await renderCard("Older", false, storedUtc(new Date(Date.now() - 2 * 60 * 60000)));
		expect(container.textContent).not.toContain("Today");
		expect(container.textContent).not.toContain("min ago");
		// The shared renderer prints a clock time (H:MM) for a stored datetime.
		expect(/\d{1,2}:\d{2}/.test(container.textContent ?? "")).toBe(true);
	});

	it("renders a date-only memo as that exact day, with no UTC shift", async () => {
		const container = await renderCard("Back-dated", false, "2026-10-15");
		expect(container.textContent).toContain("October 15, 2026");
		expect(container.textContent).not.toContain("October 14, 2026");
	});
});

describe("MemoCard task list", () => {
	/** The shape a pasted acceptance list arrives in: indented items, blank lines between them. */
	const CHECKLIST = " Acceptance Criteria\n\n - [ ] first item\n\n - [ ] second item";

	let updates: Array<{ id: string; content: string; tags: string[] }> = [];
	let failUpdate = false;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		updates = [];
		failUpdate = false;
		act(() => root?.unmount());
		root = null;
	});

	async function renderCard(content: string): Promise<HTMLElement> {
		const container = setupDom("/memos");
		globalThis.fetch = (async () => new Response("{}")) as unknown as typeof globalThis.fetch;
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<BrowserRouter>
								<TaskIdIndexProvider tasks={[]} docs={[]} decisions={[]}>
									<MemoCard
										memo={makeMemo("20261001-3", content, [])}
										onUpdate={async (id, next, tags) => {
											if (failUpdate) throw new Error("nope");
											updates.push({ id, content: next, tags });
										}}
										onDelete={async () => {}}
										onArchive={async () => {}}
										onTagClick={() => {}}
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

	async function clickCheckbox(container: HTMLElement, index: number): Promise<void> {
		const box = container.querySelectorAll('input[type="checkbox"]')[index] as HTMLInputElement | undefined;
		expect(box).toBeTruthy();
		await act(async () => {
			reactProps(box as Element).onChange?.({ currentTarget: box });
			await Promise.resolve();
		});
		await flush();
	}

	it("renders the checklist as enabled checkboxes, not a dead read-only list", async () => {
		const container = await renderCard(CHECKLIST);
		const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
		expect(boxes).toHaveLength(2);
		expect(boxes.every((box) => !box.disabled)).toBe(true);
		expect(boxes.map((box) => box.checked)).toEqual([false, false]);
	});

	it("saves the memo with the clicked marker ticked, leaving the others alone", async () => {
		const container = await renderCard(CHECKLIST);
		await clickCheckbox(container, 1);
		expect(updates).toHaveLength(1);
		expect(updates[0]?.id).toBe("20261001-3");
		expect(updates[0]?.content).toBe(" Acceptance Criteria\n\n - [ ] first item\n\n - [x] second item");
	});

	it("untick a rendered box that is already checked", async () => {
		const container = await renderCard(" - [x] done thing");
		await clickCheckbox(container, 0);
		expect(updates[0]?.content).toBe(" - [ ] done thing");
	});

	it("ends up genuinely unticked when the host feeds the save back, as the page does", async () => {
		// The regression this guards: react-markdown emits `checked` only for a ticked item, and React
		// re-applies that prop only while it exists. A box that went ticked -> unticked therefore kept
		// the tick React had restored, even though the save had already flipped the marker.
		const container = setupDom("/memos");
		globalThis.fetch = (async () => new Response("{}")) as unknown as typeof globalThis.fetch;
		root = createRoot(container);
		function Host() {
			const [memo, setMemo] = useState(makeMemo("20261001-3", " - [x] done thing", []));
			return (
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<BrowserRouter>
								<TaskIdIndexProvider tasks={[]} docs={[]} decisions={[]}>
									<MemoCard
										memo={memo}
										onUpdate={async (id, content, tags) => {
											setMemo(makeMemo(id, content, tags));
										}}
										onDelete={async () => {}}
										onArchive={async () => {}}
										onTagClick={() => {}}
									/>
								</TaskIdIndexProvider>
							</BrowserRouter>
						</ImageLightboxProvider>
					</I18nProvider>
				</ThemeProvider>
			);
		}
		await act(async () => {
			root?.render(<Host />);
		});
		await flush();

		const boxOf = () => container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(boxOf().checked).toBe(true);

		await act(async () => {
			boxOf().click();
			await Promise.resolve();
		});
		await flush();
		expect(boxOf().checked).toBe(false);

		// And the other direction still works on a host that keeps feeding the memo back.
		await act(async () => {
			boxOf().click();
			await Promise.resolve();
		});
		await flush();
		expect(boxOf().checked).toBe(true);
	});

	it("surfaces a save failure instead of pretending the box moved", async () => {
		failUpdate = true;
		const container = await renderCard(" - [ ] first item");
		await clickCheckbox(container, 0);
		expect(container.textContent).toContain("Could not save the changes to this memo");
		expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
	});

	it("keeps the boxes read-only when the renderer is used without a toggle handler", async () => {
		// The other markdown surfaces (task and doc bodies) pass no handler, so their checklists
		// must stay exactly as GitHub draws them.
		const container = setupDom("/memos");
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<TaskIdIndexProvider tasks={[]} docs={[]} decisions={[]}>
								<MermaidMarkdown source={" - [ ] first item"} />
							</TaskIdIndexProvider>
						</ImageLightboxProvider>
					</I18nProvider>
				</ThemeProvider>,
			);
		});
		await flush();
		const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
		expect(box).toBeTruthy();
		expect(box?.disabled).toBe(true);
	});
});

describe("MemoCard body: note typography and tag chips", () => {
	let tagClicks: string[] = [];

	afterEach(() => {
		globalThis.fetch = originalFetch;
		tagClicks = [];
		act(() => root?.unmount());
		root = null;
	});

	async function renderBody(content: string, chips = true): Promise<HTMLElement> {
		const container = setupDom("/memos");
		globalThis.fetch = (async () => new Response("{}")) as unknown as typeof globalThis.fetch;
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<BrowserRouter>
								<TaskIdIndexProvider tasks={[]} docs={[]} decisions={[]}>
									{chips ? (
										<MemoCard
											memo={makeMemo("20261001-3", content, [])}
											onUpdate={async () => {}}
											onDelete={async () => {}}
											onArchive={async () => {}}
											onTagClick={(tag) => tagClicks.push(tag)}
										/>
									) : (
										<MermaidMarkdown source={content} />
									)}
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

	const chip = (container: HTMLElement, tag: string): HTMLElement | null =>
		container.querySelector<HTMLElement>(`[data-memo-tag="${tag}"]`);

	it("marks the body with the class the note typography is scoped to", async () => {
		const container = await renderBody("Just a note");
		const body = container.querySelector(".memo-body");
		expect(body).toBeTruthy();
		// The dead `prose` classes are gone; nothing defines them, so they styled nothing.
		expect(body?.className).not.toContain("prose");
	});

	it("renders a #tag in the body as a chip instead of leaving it as plain text", async () => {
		const container = await renderBody("And here are my tasks. #todo");
		const el = chip(container, "todo");
		expect(el).toBeTruthy();
		expect(el?.textContent).toBe("#todo");
		expect(el?.className).toContain("inline-tag");
		// A chip stands for a filter, so it is reachable and activatable without a mouse.
		expect(el?.getAttribute("role")).toBe("button");
		expect(el?.getAttribute("tabindex")).toBe("0");
	});

	it("keeps the separating space outside the chip so the text still reads normally", async () => {
		const container = await renderBody("tasks #todo next");
		expect(container.textContent).toContain("tasks #todo next");
	});

	it("chips every tag a bare token can produce, including one alone on its line", async () => {
		const container = await renderBody("#标签\n\nbody #todo");
		expect(chip(container, "标签")?.textContent).toBe("#标签");
		expect(chip(container, "todo")).toBeTruthy();
	});

	it("leaves a real heading alone: the no-space form is a tag, `# ` is a title", async () => {
		const container = await renderBody("# Title text");
		expect(container.querySelector("h1")?.textContent).toBe("Title text");
		expect(chip(container, "Title")).toBeNull();
	});

	it("does not chip a #token inside code, inline or fenced", async () => {
		const container = await renderBody("Try `#inline` and\n\n```\n#fenced\n```\n\nbut #real");
		expect(chip(container, "inline")).toBeNull();
		expect(chip(container, "fenced")).toBeNull();
		expect(chip(container, "real")).toBeTruthy();
	});

	it("leaves tags as literal text where the caller did not opt in", async () => {
		const container = await renderBody("Just #todo here", false);
		expect(container.querySelector(".inline-tag")).toBeNull();
		expect(container.textContent).toContain("#todo");
	});

	it("filters the feed when a chip is clicked", async () => {
		const container = await renderBody("tasks #todo");
		await act(async () => {
			chip(container, "todo")?.dispatchEvent(new Event("click", { bubbles: true }));
			await Promise.resolve();
		});
		expect(tagClicks).toEqual(["todo"]);
	});

	it("activates a chip from the keyboard, since it is a role=button", async () => {
		const container = await renderBody("tasks #todo");
		await act(async () => {
			chip(container, "todo")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			await Promise.resolve();
		});
		expect(tagClicks).toEqual(["todo"]);
	});

	it("ignores other keys and clicks that miss a chip", async () => {
		const container = await renderBody("tasks #todo");
		await act(async () => {
			chip(container, "todo")?.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
			container.querySelector(".memo-body")?.dispatchEvent(new Event("click", { bubbles: true }));
			await Promise.resolve();
		});
		expect(tagClicks).toEqual([]);
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
