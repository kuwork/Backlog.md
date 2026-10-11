import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { selectFilteredGraph } from "../web/components/GraphLegend.tsx";
import GraphView from "../web/components/GraphView.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import type { GraphPayload } from "../web/lib/api.ts";

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

const PAYLOAD: GraphPayload = {
	status: "ready",
	backend: "memory",
	nodeCount: 4,
	nodes: [
		{ id: "back-1", title: "Root task", kind: "task", status: "To Do", filePath: "tasks/back-1.md" },
		{ id: "back-9", title: "Done task", kind: "task", status: "Done", filePath: "completed/back-9.md" },
		{ id: "wiki/a.md", title: "Page A", kind: "wiki", status: "", filePath: "wiki/a.md" },
		{ id: "wiki/b.md", title: "Page B", kind: "wiki", status: "", filePath: "wiki/b.md" },
	],
	edges: [{ type: "LinksTo", from: "wiki/a.md", to: "wiki/b.md" }],
};

/** A permissive 2d-context stub: every method is a no-op, properties settable. */
function stubContext2d() {
	const target: Record<string | symbol, unknown> = {};
	return new Proxy(target, {
		get(t, prop) {
			if (prop in t) return t[prop];
			if (prop === "canvas") return null;
			if (prop === "measureText") return () => ({ width: 10 });
			return () => {};
		},
		set(t, prop, value) {
			t[prop] = value;
			return true;
		},
	}) as unknown as CanvasRenderingContext2D;
}

function setupDom(cypherNodeKeys: string[]) {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/graph",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
		setTimeout(() => cb(performance.now()), 0)) as unknown as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}
	dom.window.HTMLCanvasElement.prototype.getContext = (() => stubContext2d()) as never;
	// React's legacy input-event polyfill calls attachEvent/detachEvent, which jsdom does not
	// implement; stub them like the other component tests do.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") htmlElementPrototype.attachEvent = () => {};
	if (typeof htmlElementPrototype.detachEvent !== "function") htmlElementPrototype.detachEvent = () => {};
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	(globalThis.window as { ResizeObserver?: unknown }).ResizeObserver = (
		globalThis as { ResizeObserver?: unknown }
	).ResizeObserver;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("/api/graph/cypher")) {
			// The dialog sends the statement as JSON; a statement naming Page A narrows the hit set.
			let keys = cypherNodeKeys;
			try {
				const body = init?.body ? JSON.parse(String(init.body)) : null;
				if (String(body?.statement ?? "").includes("Page A")) keys = ["wiki/a.md"];
			} catch {}
			return new Response(JSON.stringify({ columns: ["n"], rows: [[]], nodeKeys: keys, truncated: false }), {
				status: 200,
			});
		}
		return new Response(JSON.stringify(PAYLOAD), { status: 200 });
	}) as unknown as typeof fetch;
	for (const name of ["SVGElement", "HTMLElement", "Element", "Node", "MouseEvent", "PointerEvent"] as const) {
		const value = (dom.window as unknown as Record<string, unknown>)[name];
		if (value) (globalThis as Record<string, unknown>)[name] = value;
	}
	return dom;
}

function legendButton(label: string): HTMLButtonElement {
	const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
	if (!button) throw new Error(`legend button ${label} not found`);
	return button as HTMLButtonElement;
}

function hasLegend(label: string): boolean {
	return [...document.querySelectorAll("button")].some((b) => b.textContent?.includes(label));
}

function pageText(): string {
	return document.getElementById("root")?.textContent ?? "";
}

function headline(): string {
	const match = document.getElementById("root")?.textContent?.match(/(\d+ nodes · \d+ edges)/);
	if (!match?.[1]) throw new Error("headline count not found");
	return match[1];
}

async function searchCypher(statement: string) {
	// If the popup is already open (e.g. right after 清除), close it first: reopening is what
	// refills the input from localStorage.
	const closeButton = document.querySelector("button[aria-label='Close']") as HTMLButtonElement | null;
	if (closeButton) {
		await act(async () => {
			closeButton.click();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
	}
	// Prefill through the dialog's own backfill path (it restores the last statement from
	// localStorage on open) - simulating keystrokes in jsdom trips React's input polyfill.
	localStorage.setItem("backlog.graph.cypher.lastStatement", statement);
	await act(async () => {
		(document.querySelector("button[aria-label='Cypher Search']") as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	const searchButton = [...document.querySelectorAll("button")].find(
		(b) => b.textContent?.trim() === "Search",
	) as HTMLButtonElement;
	await act(async () => {
		searchButton.click();
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
}

async function clickClear() {
	// A successful search closes the popup, so reopen it to reach the 清除 button - the real flow.
	await act(async () => {
		(document.querySelector("button[aria-label='Cypher Search']") as HTMLButtonElement).click();
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	const clearButton = [...document.querySelectorAll("button")].find(
		(b) => b.textContent?.trim() === "Clear",
	) as HTMLButtonElement;
	await act(async () => {
		clearButton.click();
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
}

describe("Cypher search filters the canvas to the result set (BACK-765)", () => {
	let root: Root | null = null;

	async function mount(node: React.ReactNode) {
		const container = document.getElementById("root") as HTMLElement;
		const origError = console.error;
		console.error = () => {};
		try {
			root = createRoot(container);
			await act(async () => {
				root?.render(
					<MemoryRouter initialEntries={["/graph"]}>
						<ThemeProvider>
							<I18nProvider>{node}</I18nProvider>
						</ThemeProvider>
					</MemoryRouter>,
				);
			});
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});
		} finally {
			console.error = origError;
		}
	}

	afterEach(async () => {
		if (root) await act(async () => root?.unmount());
		root = null;
		globalThis.fetch = originalFetch;
		globalThis.window = originalWindowGlobal as typeof window & typeof globalThis;
		globalThis.document = originalDocumentGlobal as Document;
		globalThis.navigator = originalNavigatorGlobal as Navigator;
		globalThis.requestAnimationFrame = originalRAF;
		globalThis.cancelAnimationFrame = originalCAF;
	});

	it("selectFilteredGraph keeps hit nodes and only edges whose both ends hit", () => {
		const filtered = selectFilteredGraph(PAYLOAD.nodes, PAYLOAD.edges, new Set(["wiki/a.md"]));
		expect(filtered.nodes.map((node) => node.id)).toEqual(["wiki/a.md"]);
		// b did not hit, so the a->b edge does not survive.
		expect(filtered.edges).toEqual([]);
		const both = selectFilteredGraph(PAYLOAD.nodes, PAYLOAD.edges, new Set(["wiki/a.md", "wiki/b.md"]));
		expect(both.edges).toHaveLength(1);
	});

	it("shows only the result set on the knowledge graph, opens just its categories, and clear restores", async () => {
		setupDom(["back-1"]);
		await mount(<GraphView graphVersion={0} onEditTask={() => {}} variant="knowledge" />);
		// Knowledge default: the two wiki pages and their edge; work kinds are hidden.
		expect(headline()).toBe("2 nodes · 1 edges");
		expect(legendButton("Task").getAttribute("aria-pressed")).toBe("false");

		await searchCypher("MATCH (n:FileNode) RETURN n LIMIT 1");
		// The filter alone decides the picture: the hidden task is shown, nothing else is. The legend
		// is the result set's summary: only the category it has appears, open and counted; the
		// relation legend lists only relations the result set has (here: none).
		expect(headline()).toBe("1 nodes · 0 edges");
		expect(legendButton("Task").getAttribute("aria-pressed")).toBe("true");
		expect(legendButton("Task").textContent).toBe("Task1");
		// Completed and the knowledge kinds are not in the result set: their legend entries are gone.
		expect(hasLegend("Completed")).toBe(false);
		expect(hasLegend("Wiki")).toBe(false);
		expect(pageText()).not.toContain("Links to");

		// The legend keeps working on top of the filter: hiding the category empties the picture,
		// and the entry itself stays (the result set has it) so it can be toggled back on.
		await act(async () => {
			legendButton("Task").click();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(headline()).toBe("0 nodes · 0 edges");
		expect(hasLegend("Task")).toBe(true);
		expect(legendButton("Task").getAttribute("aria-pressed")).toBe("false");
		await act(async () => {
			legendButton("Task").click();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(headline()).toBe("1 nodes · 0 edges");
		expect(legendButton("Task").getAttribute("aria-pressed")).toBe("true");

		await clickClear();
		expect(headline()).toBe("2 nodes · 1 edges");
		expect(legendButton("Task").getAttribute("aria-pressed")).toBe("false");
		expect(hasLegend("Completed")).toBe(true);
		expect(legendButton("Wiki").getAttribute("aria-pressed")).toBe("true");
		expect(pageText()).toContain("Links to");
	});

	it("lists a relation legend entry only when the result set has that relation", async () => {
		setupDom(["wiki/a.md", "wiki/b.md"]);
		await mount(<GraphView graphVersion={0} onEditTask={() => {}} variant="knowledge" />);
		// The a->b edge survives filtering only when both ends hit.
		await searchCypher("MATCH (n:FileNode) RETURN n LIMIT 2");
		expect(headline()).toBe("2 nodes · 1 edges");
		expect(pageText()).toContain("Links to");

		await clickClear();
		await searchCypher("MATCH (n:FileNode) WHERE n.title = 'Page A' RETURN n");
		expect(headline()).toBe("1 nodes · 0 edges");
		expect(pageText()).not.toContain("Links to");
	});

	it("opens hidden knowledge categories on the task graph while filtering, and restores on clear", async () => {
		setupDom(["wiki/a.md"]);
		await mount(<GraphView graphVersion={0} onEditTask={() => {}} />);
		expect(headline()).toBe("2 nodes · 0 edges");
		expect(legendButton("Wiki").getAttribute("aria-pressed")).toBe("false");

		await searchCypher("MATCH (n:FileNode) RETURN n LIMIT 1");
		expect(headline()).toBe("1 nodes · 0 edges");
		expect(legendButton("Wiki").getAttribute("aria-pressed")).toBe("true");
		expect(legendButton("Wiki").textContent).toBe("Wiki page1");
		// Tasks are not in the result set: the legend entry is gone until the filter lifts.
		expect(hasLegend("Task")).toBe(false);

		await clickClear();
		expect(headline()).toBe("2 nodes · 0 edges");
		expect(legendButton("Wiki").getAttribute("aria-pressed")).toBe("false");
		expect(hasLegend("Task")).toBe(true);
	});
});
