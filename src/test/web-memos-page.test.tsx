import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { Memo } from "../core/memos.ts";
import MemosPage from "../web/components/MemosPage.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext";
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

let observed: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serveApi(): void {
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
			if (!cursor) return json({ items: PAGE_ONE, nextCursor: "20261001-2" });
			return json({ items: PAGE_TWO, nextCursor: null });
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
