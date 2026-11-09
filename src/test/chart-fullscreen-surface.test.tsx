import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setActiveDiagramEngine } from "../web/charts/diagram-engine";
import { peleDarkPalette } from "../web/charts/pele-engine";
import ChartBlock from "../web/components/ChartBlock.tsx";
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

	it("does not render a fullscreen overlay for non-svg engines", () => {
		setupDom("light");
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
		expect(container?.querySelector('[aria-label="View fullscreen"]')).toBeNull();
		expect(container?.querySelector(".chart-fullscreen-content")).toBeNull();
	});
});
