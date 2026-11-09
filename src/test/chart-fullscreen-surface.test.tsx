import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setActiveDiagramEngine } from "../web/charts/diagram-engine";
import EchartsFromResult from "../web/charts/EchartsFromResult.tsx";
import { peleDarkPalette } from "../web/charts/pele-engine";
import type { ChartRenderer } from "../web/charts/types.ts";
import ChartBlock from "../web/components/ChartBlock.tsx";
import type { QueryBlockResult } from "../web/components/SqlQueryBlock.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;

const setupDom = (theme: "light" | "dark") => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.localStorage.setItem("backlog-theme", theme);

	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

	if (!window.matchMedia) {
		window.matchMedia = () =>
			({
				matches: false,
				media: "",
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}) as MediaQueryList;
	}

	// Mermaid is a browser-only bundle; the render helper honours this mock instead of importing it.
	(globalThis as Record<string, unknown>).__MERMAID_MOCK__ = {
		default: {
			initialize: () => {},
			render: async () => ({ svg: '<svg data-testid="diagram"><rect width="10" height="10"/></svg>' }),
		},
	};
};

interface EchartsStubLog {
	renders: { container: HTMLElement; mode: string }[];
	disposed: HTMLElement[];
}

/**
 * ECharts needs a real canvas context, which jsdom lacks. Install a stub renderer
 * (mirroring the `__MERMAID_MOCK__` seam) that stamps a `<canvas>` into the
 * container and records the mode/dispose calls so we can assert the overlay path.
 */
const installEchartsStub = (): EchartsStubLog => {
	const log: EchartsStubLog = { renders: [], disposed: [] };
	const stub: ChartRenderer = {
		render({ container, mode }) {
			log.renders.push({ container, mode });
			// A plain element stands in for the canvas bitmap: jsdom has no canvas
			// context, and the assertion only needs to see a fresh render child.
			const surface = document.createElement("div");
			surface.setAttribute("data-testid", "echarts-canvas");
			container.appendChild(surface);
		},
		dispose(container) {
			log.disposed.push(container);
			container.replaceChildren();
		},
	};
	(globalThis as Record<string, unknown>).__ECHARTS_MOCK__ = stub;
	return log;
};

const renderInteractive = (engine: "pele" | "mermaid", theme: "light" | "dark" = "light") => {
	setupDom(theme);
	setActiveDiagramEngine(engine);
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<ThemeProvider>
					<ChartBlock lang="mermaid" source={"graph TD\nA --> B"} />
				</ThemeProvider>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

// The classic Mermaid backend renders asynchronously (rAF + dynamic import), so
// flush those timers/microtasks before opening the overlay — in the real app the
// user opens the overlay only after seeing the rendered diagram on the page.
const flush = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 5));
	});

afterEach(() => {
	act(() => activeRoot?.unmount());
	activeRoot = null;
	delete (globalThis as { window?: unknown }).window;
	delete (globalThis as { document?: unknown }).document;
	delete (globalThis as { navigator?: unknown }).navigator;
	delete (globalThis as { localStorage?: unknown }).localStorage;
	delete (globalThis as Record<string, unknown>).__MERMAID_MOCK__;
	delete (globalThis as Record<string, unknown>).__ECHARTS_MOCK__;
	setActiveDiagramEngine("pele");
});

const openFullscreen = (container: HTMLElement) => {
	const button = container.querySelector('[aria-label="View fullscreen"]') as HTMLButtonElement | null;
	expect(button).toBeTruthy();
	act(() => {
		button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
};

describe("ChartBlock fullscreen overlay", () => {
	it("renders the diagram fresh into the overlay (never empty)", async () => {
		const container = renderInteractive("pele");
		await flush();
		openFullscreen(container);
		await flush();
		const surface = container.querySelector(".chart-fullscreen-content") as HTMLElement | null;
		expect(surface).toBeTruthy();
		expect(surface?.querySelector("svg")).toBeTruthy();
	});

	it("re-themes the Pele diagram to dark via CSS variables in the overlay", async () => {
		const container = renderInteractive("pele");
		await flush();
		openFullscreen(container);
		await flush();
		const surface = container.querySelector(".chart-fullscreen-content") as HTMLElement;
		expect(surface.style.getPropertyValue("--pele-fg")).toBe(peleDarkPalette["--pele-fg"]!);
		expect(surface.style.getPropertyValue("--pele-line")).toBe(peleDarkPalette["--pele-line"]!);
		// No opaque surface card; the dimmed backdrop provides contrast.
		expect(surface.className).not.toContain("bg-white");
		expect(surface.className).not.toContain("bg-[#18181b]");
	});

	it("inverts the classic-Mermaid diagram so its light strokes stay visible", async () => {
		const container = renderInteractive("mermaid");
		await flush();
		openFullscreen(container);
		await flush();
		const surface = container.querySelector(".chart-fullscreen-content") as HTMLElement;
		expect(surface.style.getPropertyValue("filter")).toContain("invert(1)");
		expect(surface.style.getPropertyValue("filter")).toContain("hue-rotate(180deg)");
		expect(surface.querySelector("svg[data-testid='diagram']")).toBeTruthy();
	});

	it("renders an echarts chart fresh into the overlay with a sized dark canvas", async () => {
		setupDom("light");
		const log = installEchartsStub();
		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);
		act(() => {
			activeRoot?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ChartBlock lang="echarts" source={'{"series":[]}'} />
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		// ECharts now opts into the fullscreen entry, just like Mermaid.
		expect(container?.querySelector('[aria-label="View fullscreen"]')).toBeTruthy();
		await flush();
		openFullscreen(container as HTMLElement);
		await flush();

		const surface = container?.querySelector(".chart-fullscreen-content") as HTMLElement;
		expect(surface).toBeTruthy();
		// The canvas engine re-renders into the clean overlay node (not a blank clone).
		expect(surface.querySelector("div[data-testid='echarts-canvas']")).toBeTruthy();
		// It needs an explicit box before init, otherwise the bitmap renders at 0x0.
		expect(surface.style.width).toBeTruthy();
		expect(surface.style.height).toBeTruthy();
		// ECharts renders natively dark, so no light-SVG inversion is applied.
		expect(surface.style.filter).not.toContain("invert(1)");
		// The overlay render (the last one) is the dark one.
		expect(log.renders.at(-1)?.mode).toBe("dark");
		expect(log.renders.at(-1)?.container).toBe(surface);
	});

	it("disposes the echarts chart instance when the overlay closes", async () => {
		setupDom("light");
		const log = installEchartsStub();
		const container = document.getElementById("root");
		activeRoot = createRoot(container as HTMLElement);
		act(() => {
			activeRoot?.render(
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<ChartBlock lang="echarts" source={'{"series":[]}'} />
					</ThemeProvider>
				</I18nProvider>,
			);
		});
		await flush();
		openFullscreen(container as HTMLElement);
		await flush();
		expect(log.disposed.length).toBe(0);

		const closeButton = container?.querySelector('[aria-label="Close"]') as HTMLButtonElement | null;
		expect(closeButton).toBeTruthy();
		act(() => {
			closeButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		expect(log.disposed.length).toBeGreaterThan(0);
	});

	it("gives query-direct (view: echarts) charts the same fullscreen entry", async () => {
		setupDom("light");
		const log = installEchartsStub();
		const container = document.getElementById("root") as HTMLElement;
		activeRoot = createRoot(container);
		const result: QueryBlockResult = {
			columns: ["day", "cnt"],
			rows: [
				["Mon", 3],
				["Tue", 5],
			],
			truncated: false,
			elapsedMs: 2,
			dbPath: "shop.sqlite",
			totalRows: 2,
		};
		const chart = JSON.stringify({ type: "bar", categoryField: "day", valueField: "cnt" });
		act(() => {
			activeRoot?.render(
				<I18nProvider initialLocale="en">
					<EchartsFromResult result={result} chart={chart} />
				</I18nProvider>,
			);
		});
		await flush();

		// The query-direct path used to render ECharts on its own and had no button.
		expect(container.querySelector('[aria-label="View fullscreen"]')).toBeTruthy();
		expect(log.renders.length).toBe(1);
		expect(log.renders[0]?.mode).toBe("light");

		openFullscreen(container);
		await flush();
		const surface = container.querySelector(".chart-fullscreen-content") as HTMLElement;
		expect(surface.querySelector("div[data-testid='echarts-canvas']")).toBeTruthy();
		// The overlay re-renders from the built option with the native dark theme.
		expect(log.renders.at(-1)?.mode).toBe("dark");
		expect(log.renders.at(-1)?.container).toBe(surface);
	});
});
