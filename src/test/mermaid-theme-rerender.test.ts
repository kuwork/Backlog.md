import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderMermaidDiagram } from "../web/utils/mermaid.ts";

const SOURCE = "treeView-beta\n├── tasks/ ## raw\n└── wiki/";
const SVG = '<svg data-testid="diagram"><rect width="10" height="10"/></svg>';

type CapturedConfig = { theme?: string; themeVariables?: { treeView?: Record<string, string> } };
type RenderResult = { svg: string };
type RenderFn = (id: string, text: string) => Promise<RenderResult>;

function installMermaidMock(render?: RenderFn): CapturedConfig[] {
	const configs: CapturedConfig[] = [];
	(globalThis as Record<string, unknown>).__MERMAID_MOCK__ = {
		default: {
			initialize: (config: CapturedConfig) => configs.push(config),
			render: render ?? (async () => ({ svg: SVG })),
		},
	};
	return configs;
}

function newContainer(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body></body></html>");
	return dom.window.document.createElement("div") as unknown as HTMLElement;
}

afterEach(() => {
	delete (globalThis as Record<string, unknown>).__MERMAID_MOCK__;
});

describe("classic Mermaid re-render", () => {
	it("replaces the source text with a fresh SVG after a theme switch", async () => {
		const configs = installMermaidMock();
		const container = newContainer();

		await renderMermaidDiagram(container, SOURCE, { mode: "light" });
		expect(container.querySelectorAll("svg")).toHaveLength(1);
		expect(container.textContent).not.toContain("treeView-beta");

		// ChartBlock keeps the container and only changes `mode` on a theme toggle.
		await renderMermaidDiagram(container, SOURCE, { mode: "dark" });
		expect(container.querySelectorAll("svg")).toHaveLength(1);
		expect(container.textContent).not.toContain("treeView-beta");
		expect(configs.at(-1)?.theme).toBe("dark");
	});

	it("keeps the previous SVG visible while the next theme render is in flight", async () => {
		let notifySecond: () => void = () => {};
		const secondStarted = new Promise<void>((resolve) => {
			notifySecond = resolve;
		});
		let resolveSecond: (result: RenderResult) => void = () => {};
		let calls = 0;
		installMermaidMock(async () => {
			calls++;
			if (calls === 1) return { svg: '<svg data-ver="old"></svg>' };
			notifySecond();
			return await new Promise<RenderResult>((resolve) => {
				resolveSecond = resolve;
			});
		});

		const container = newContainer();
		await renderMermaidDiagram(container, SOURCE, { mode: "light" });
		const pending = renderMermaidDiagram(container, SOURCE, { mode: "dark" });
		await secondStarted;

		// No blank box or raw source while the gallery re-renders diagram by diagram.
		expect(container.querySelector('svg[data-ver="old"]')).not.toBeNull();
		expect(container.textContent).not.toContain("treeView-beta");

		resolveSecond({ svg: '<svg data-ver="new"></svg>' });
		await pending;
		expect(container.querySelector('svg[data-ver="new"]')).not.toBeNull();
		expect(container.querySelector('svg[data-ver="old"]')).toBeNull();
	});

	it("discards a stale render that finishes after a newer one", async () => {
		let notifyFirst: () => void = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			notifyFirst = resolve;
		});
		let resolveFirst: (result: RenderResult) => void = () => {};
		let calls = 0;
		installMermaidMock(async () => {
			calls++;
			if (calls === 1) {
				notifyFirst();
				return await new Promise<RenderResult>((resolve) => {
					resolveFirst = resolve;
				});
			}
			return { svg: '<svg data-ver="new"></svg>' };
		});

		const container = newContainer();
		const first = renderMermaidDiagram(container, SOURCE, { mode: "light" });
		await firstStarted;
		await renderMermaidDiagram(container, SOURCE, { mode: "dark" });
		expect(container.querySelector('svg[data-ver="new"]')).not.toBeNull();

		resolveFirst({ svg: '<svg data-ver="old"></svg>' });
		await first;
		expect(container.querySelector('svg[data-ver="old"]')).toBeNull();
		expect(container.querySelector('svg[data-ver="new"]')).not.toBeNull();
	});

	it("surfaces the source when the very first render fails", async () => {
		installMermaidMock(async () => {
			throw new Error("parse failed");
		});
		const container = newContainer();

		await renderMermaidDiagram(container, SOURCE, { mode: "light" });
		expect(container.textContent).toContain("treeView-beta");
	});

	it("overrides the hardcoded black treeView palette only in dark mode", async () => {
		const configs = installMermaidMock();
		const container = newContainer();

		await renderMermaidDiagram(container, SOURCE, { mode: "dark" });
		expect(configs.at(-1)?.themeVariables?.treeView?.labelColor).toBe("#e6edf3");
		expect(configs.at(-1)?.themeVariables?.treeView?.lineColor).toBe("#c9d1d9");

		await renderMermaidDiagram(container, SOURCE, { mode: "light" });
		expect(configs.at(-1)?.theme).toBe("default");
		expect(configs.at(-1)?.themeVariables).toBeUndefined();
	});
});
