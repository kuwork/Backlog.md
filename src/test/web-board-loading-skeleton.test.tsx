import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BoardLoadingSkeleton } from "../web/components/BoardLoadingSkeleton";
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
	globalThis.Event = dom.window.Event as typeof Event;
	globalThis.CustomEvent = dom.window.CustomEvent as typeof CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as typeof MutationObserver;
	return dom.window.document.getElementById("root") as HTMLElement;
};

const renderSkeleton = (container: HTMLElement, columnCount?: number, locale: Locale = "en") => {
	if (!activeRoot) activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<I18nProvider initialLocale={locale}>
				<BoardLoadingSkeleton columnCount={columnCount} />
			</I18nProvider>,
		);
	});
};

const ghostTrack = (container: HTMLElement) => container.querySelector('[aria-hidden="true"].overflow-x-auto');
const countGhostColumns = (container: HTMLElement) => ghostTrack(container)?.querySelectorAll(".min-w-\\[16rem\\]").length;

describe("BoardLoadingSkeleton", () => {
	it("announces a compact loading status without visible copy", () => {
		const container = setupDom();
		renderSkeleton(container);

		const status = container.querySelector('[role="status"]');
		expect(status).not.toBeNull();
		expect(status?.getAttribute("aria-label")).toBe("Loading tasks...");
		expect(status?.querySelector(".sr-only")?.textContent).toBe("Loading tasks...");

		// The ring is the shared circular design: always turning, and never the dead `rounded-full`
		// utility (excluded from the compiled CSS since TASK-179, which is what made the old board
		// spinner render as a bordered square).
		const ring = status?.querySelector(".animate-spin");
		expect(ring).not.toBeNull();
		expect(ring?.className).toContain("rounded-circle");
		expect(ring?.className).not.toContain("animate-none");
		expect(container.innerHTML).not.toContain("rounded-full");
	});

	it("renders ghost columns hidden from assistive tech that mirror the board geometry", () => {
		const container = setupDom();
		renderSkeleton(container);

		const ghosts = ghostTrack(container);
		expect(ghosts).not.toBeNull();
		expect(ghosts?.querySelector(".flex.flex-row.flex-nowrap")).not.toBeNull();
		expect(countGhostColumns(container)).toBe(3);

		const pulses = Array.from(ghosts?.querySelectorAll(".animate-pulse") ?? []);
		expect(pulses.length).toBeGreaterThan(0);
		for (const pulse of pulses) {
			expect(pulse.className).not.toContain("animate-none");
		}
	});

	it("keeps the whole placeholder animating when the host switches system animations off", () => {
		const container = setupDom();
		renderSkeleton(container);

		// RDP and VM hosts commonly run with MinAnimate=0, which Chromium maps to
		// prefers-reduced-motion: reduce. A skeleton that honours it there is a ring around a still
		// board - indistinguishable from a hung one - so nothing may carry a reduced-motion escape.
		expect(container.innerHTML).not.toContain("motion-reduce");
		expect(container.querySelectorAll(".animate-spin").length).toBe(1);
		expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
	});

	it("keeps ghost columns at the real column floor height so the board never contracts", () => {
		const container = setupDom();
		renderSkeleton(container);

		// Every real column has at least min-h-24 (TaskColumn's empty floor); taller ghosts would
		// contract to 6rem on an empty project when the first load lands.
		const ghosts = ghostTrack(container);
		expect(ghosts?.querySelectorAll(".min-h-24").length).toBe(3);
		expect(container.innerHTML).not.toContain("min-h-96");
	});

	it("matches the configured status count so the real board mounts without a column jump", () => {
		const container = setupDom();
		renderSkeleton(container, 5);
		expect(countGhostColumns(container)).toBe(5);

		renderSkeleton(container, 2);
		expect(countGhostColumns(container)).toBe(2);
	});

	it("falls back to three ghost columns before the statuses are known", () => {
		const container = setupDom();
		renderSkeleton(container, 0);
		expect(countGhostColumns(container)).toBe(3);
	});

	it("announces the loading state in the active locale", () => {
		const container = setupDom();
		renderSkeleton(container, undefined, "zh-CN");

		const status = container.querySelector('[role="status"]');
		expect(status?.getAttribute("aria-label")).toBe("加载任务中...");
		expect(status?.querySelector(".sr-only")?.textContent).toBe("加载任务中...");
	});
});
