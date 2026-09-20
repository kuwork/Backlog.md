import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BranchIndexingIndicator } from "../web/components/BranchIndexingIndicator";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const APPEAR_MS = 20;
const EXIT_MS = 20;

const setupDom = (): HTMLElement => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as unknown as globalThis.Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.requestAnimationFrame = activeDom.window.requestAnimationFrame.bind(activeDom.window);
	globalThis.cancelAnimationFrame = activeDom.window.cancelAnimationFrame.bind(activeDom.window);
	return activeDom.window.document.getElementById("root") as HTMLElement;
};

const wait = async (ms: number) => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
};

const renderIndicator = (container: HTMLElement, message: string | null, locale: Locale = "en") => {
	if (!activeRoot) activeRoot = createRoot(container);
	const root = activeRoot;
	act(() => {
		root.render(
			<I18nProvider initialLocale={locale}>
				<BranchIndexingIndicator message={message} appearDelayMs={APPEAR_MS} exitDurationMs={EXIT_MS} />
			</I18nProvider>,
		);
	});
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom = null;
});

describe("BranchIndexingIndicator", () => {
	it("appears only after the indexing state persists and shows the real progress line", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 35 other local branches...");

		// Not mounted before the appear delay elapses.
		expect(container.querySelector('[role="status"]')).toBeNull();

		await wait(APPEAR_MS * 3);

		const chip = container.querySelector('[role="status"]');
		expect(chip).not.toBeNull();
		// The visible label is the real progress line: no generic short label, no sr-only copy.
		expect(chip?.textContent).toBe("Indexing 35 other local branches...");
		expect(chip?.getAttribute("title")).toBe("Indexing 35 other local branches...");
		expect(chip?.querySelector(".sr-only")).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).not.toBeNull();
	});

	it("shows the progress line in the active locale", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 35 other local branches...", "zh-CN");

		await wait(APPEAR_MS * 3);

		const chip = container.querySelector('[role="status"]');
		expect(chip?.textContent).toBe("正在索引 35 个其他本地分支...");
		expect(chip?.getAttribute("title")).toBe("正在索引 35 个其他本地分支...");
	});

	it("keeps the raw progress line when no localized phase matches", async () => {
		const container = setupDom();
		renderIndicator(container, "Something unknown here", "zh-CN");

		await wait(APPEAR_MS * 3);

		const chip = container.querySelector('[role="status"]');
		expect(chip?.textContent).toBe("Something unknown here");
	});

	it("never flashes when indexing completes before the appear delay", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 2 other local branches...");

		// Nothing may be mounted inside the appear window; an immediate mount would show here.
		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).toBeNull();

		renderIndicator(container, null);

		await wait(APPEAR_MS * 3);

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).toBeNull();
	});

	it("fades out and unmounts cleanly when indexing completes", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 35 other local branches...");
		await wait(APPEAR_MS * 3);
		expect(container.querySelector('[role="status"]')).not.toBeNull();

		renderIndicator(container, null);

		// Still mounted while the exit fade runs, already transitioning to hidden.
		const fading = container.querySelector('[role="status"]');
		expect(fading).not.toBeNull();
		expect(fading?.className).toContain("opacity-0");

		await wait(EXIT_MS * 3);

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).toBeNull();
	});

	it("stays visible when consecutive progress messages replace each other", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 3 recent remote branches...");
		await wait(APPEAR_MS * 3);
		renderIndicator(container, "Indexing 35 other local branches...");
		await wait(5);

		const chip = container.querySelector('[role="status"]');
		expect(chip).not.toBeNull();
		expect(chip?.className).toContain("opacity-100");
		expect(chip?.textContent).toBe("Indexing 35 other local branches...");
		expect(chip?.getAttribute("title")).toBe("Indexing 35 other local branches...");
	});
});
