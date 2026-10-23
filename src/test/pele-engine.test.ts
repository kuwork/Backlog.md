import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { JSDOM } from "jsdom";
import { peleEngine } from "../web/charts/pele-engine";

let dom: JSDOM;

function makeContainer(): HTMLElement {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.appendChild(container);
	return container;
}

describe("peleEngine", () => {
	beforeEach(async () => {
		const { JSDOM } = await import("jsdom");
		dom = new JSDOM("<!doctype html><html><body></body></html>");
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.window = dom.window as any;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.document = dom.window.document as any;
	});

	afterEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).window;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).document;
		dom.window.close();
	});

	it("is registered for the mermaid language", () => {
		expect(peleEngine.id).toBe("pele");
		expect(peleEngine.languages).toContain("mermaid");
	});

	it("renders a valid diagram into the container as SVG", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();

		renderer.render({ container, source: "graph TD\nA-->B", mode: "light" });

		const svg = container.querySelector("svg");
		expect(svg).toBeTruthy();
		expect(container.innerHTML).toContain("</svg>");
	});

	it("applies the light palette CSS variables", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();

		renderer.render({ container, source: "graph TD\nA-->B", mode: "light" });

		expect(container.style.getPropertyValue("--pele-bg")).toBe("transparent");
		expect(container.style.getPropertyValue("--pele-fg")).toBe("#1f2328");
		expect(container.style.getPropertyValue("--pele-surface")).toBe("#ffffff");
	});

	it("applies the dark palette CSS variables", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();

		renderer.render({ container, source: "graph TD\nA-->B", mode: "dark" });

		expect(container.style.getPropertyValue("--pele-fg")).toBe("#e6edf3");
		expect(container.style.getPropertyValue("--pele-surface")).toBe("#21262d");
		expect(container.style.getPropertyValue("--pele-border")).toBe("#8b949e");
		expect(container.style.getPropertyValue("--pele-line")).toBe("#c9d1d9");
	});

	it("leaves an empty container untouched", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();

		renderer.render({ container, source: "   ", mode: "light" });

		expect(container.innerHTML).toBe("");
		expect(container.querySelector("svg")).toBeNull();
	});

	it("surfaces the source instead of throwing on invalid syntax", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();
		const bad = "this is not a diagram";

		// Must not throw out of render().
		expect(() => renderer.render({ container, source: bad, mode: "light" })).not.toThrow();

		const pre = container.querySelector("pre.pele-error");
		expect(pre).toBeTruthy();
		expect(pre?.textContent).toBe(bad);
	});

	it("clears the container on dispose", async () => {
		const renderer = await peleEngine.load();
		const container = makeContainer();

		renderer.render({ container, source: "graph TD\nA-->B", mode: "light" });
		expect(container.querySelector("svg")).toBeTruthy();

		renderer.dispose?.(container);
		expect(container.innerHTML).toBe("");
	});
});
