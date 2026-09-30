import { afterEach, describe, expect, it } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter } from "react-router-dom";
import GraphView from "../web/components/GraphView.tsx";
import TaskDependencyGraph, { type GraphViewports } from "../web/components/TaskDependencyGraph.tsx";
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
	nodeCount: 5,
	nodes: [
		{ id: "back-1", title: "Root task", kind: "task", status: "To Do", filePath: "tasks/back-1.md" },
		{ id: "back-2", title: "Child task", kind: "task", status: "To Do", filePath: "tasks/back-2.md" },
		{ id: "wiki/a.md", title: "Page A", kind: "wiki", status: "", filePath: "wiki/a.md" },
		{ id: "wiki/b.md", title: "Page B", kind: "wiki", status: "", filePath: "wiki/b.md" },
		{ id: "tag:demo", title: "", kind: "tag", status: "", filePath: "" },
	],
	edges: [
		{ type: "DependsOn", from: "back-2", to: "back-1" },
		{ type: "LinksTo", from: "wiki/a.md", to: "wiki/b.md" },
		{ type: "TaggedWith", from: "wiki/a.md", to: "tag:demo" },
	],
};

/** A permissive 2d-context stub: every method is a no-op, properties settable. */
function stubContext2d(omit: string[] = []) {
	const target: Record<string | symbol, unknown> = {};
	for (const name of omit) target[name] = undefined;
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

function setupDom(omitCtxMethods: string[] = []) {
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
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	// jsdom has no canvas 2d and no ResizeObserver.
	dom.window.HTMLCanvasElement.prototype.getContext = (() => stubContext2d(omitCtxMethods)) as never;
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	(globalThis.window as { ResizeObserver?: unknown }).ResizeObserver = (
		globalThis as { ResizeObserver?: unknown }
	).ResizeObserver;
	globalThis.fetch = (async () =>
		new Response(JSON.stringify(PAYLOAD), { status: 200 })) as unknown as typeof fetch;
	// d3-zoom/d3-selection reference these as bare globals.
	for (const name of ["SVGElement", "HTMLElement", "Element", "Node", "MouseEvent", "PointerEvent"] as const) {
		const value = (dom.window as unknown as Record<string, unknown>)[name];
		if (value) (globalThis as Record<string, unknown>)[name] = value;
	}
	return dom;
}

describe("canvas graph views smoke", () => {
	let root: Root | null = null;
	let container: HTMLElement | null = null;

	async function mount(node: React.ReactNode) {
		container = document.getElementById("root") as HTMLElement;
		const errors: unknown[][] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args);
		};
		try {
			root = createRoot(container as HTMLElement);
			await act(async () => {
				root?.render(
					<MemoryRouter initialEntries={["/graph"]}>
						<ThemeProvider>
							<I18nProvider>{node}</I18nProvider>
						</ThemeProvider>
					</MemoryRouter>,
				);
			});
			// Let the fetch resolve and the rAF draw fire.
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});
		} finally {
			console.error = origError;
		}
		return errors;
	}

	const fatalErrors = (errors: unknown[][]) =>
		errors.filter((args) => String(args[0]).includes("%s") || String(args[0]).includes("Error"));

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

	it("mounts the task graph variant without throwing", async () => {
		setupDom();
		const errors = await mount(<GraphView graphVersion={0} onEditTask={() => {}} />);
		expect(container?.textContent).toContain("Task Graph");
		expect(fatalErrors(errors)).toEqual([]);
	});

	it("mounts the knowledge graph variant without throwing", async () => {
		setupDom();
		const errors = await mount(<GraphView graphVersion={0} onEditTask={() => {}} variant="knowledge" />);
		expect(container?.textContent).toContain("Knowledge Graph");
		expect(fatalErrors(errors)).toEqual([]);
	});

	it("keeps rendering when the 2d context has no roundRect", async () => {
		setupDom(["roundRect"]);
		const errors = await mount(<GraphView graphVersion={0} onEditTask={() => {}} variant="knowledge" />);
		expect(container?.textContent).toContain("Knowledge Graph");
		expect(fatalErrors(errors)).toEqual([]);
	});

	it("mounts the task dependency subgraph without throwing", async () => {
		setupDom();
		const viewports: GraphViewports = new Map();
		const errors = await mount(
			<TaskDependencyGraph
				focusId="back-1"
				graphVersion={0}
				viewports={viewports}
				onHiddenStylesChange={() => {}}
				onTaskClick={() => {}}
			/>,
		);
		expect(fatalErrors(errors)).toEqual([]);
	});

	it("clears the canvas instead of freezing when every node is hidden", async () => {
		// The empty-subset path (all legend kinds off, or an empty corpus) must clear the canvas
		// explicitly - an early return would leave the last frame painted and inert.
		setupDom();
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ ...PAYLOAD, nodeCount: 0, nodes: [], edges: [] }), {
				status: 200,
			})) as unknown as typeof fetch;
		const errors = await mount(<GraphView graphVersion={0} onEditTask={() => {}} />);
		expect(fatalErrors(errors)).toEqual([]);
	});
});
