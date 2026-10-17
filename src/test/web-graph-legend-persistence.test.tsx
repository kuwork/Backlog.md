import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { GRAPH_LEGEND_UPDATED_EVENT } from "../graph/legend-updated.ts";
import GraphDatabases from "../web/components/GraphDatabases.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import {
	hasLegendPending,
	legendStorageKey,
	markLegendPending,
	saveLegendConfig,
} from "../web/utils/graph-legend-config.ts";
import { labelNodeColors } from "../web/utils/graph-palette.ts";

/**
 * Graph legend persistence in the browser pane (BACK-807). The server store and
 * endpoints are covered by server-graph-legend-endpoint.test.ts; this file pins the client
 * behaviour: restore-on-mount with local cache, one-time migration of a localStorage-only config,
 * live re-fetch on a same-database broadcast while ignoring other databases - that neither a stale
 * in-flight response nor a failed write-through may silently revert local work - and that a save
 * records the automatic type colours the picture already uses.
 */

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as { window?: typeof window }).window;
const originalDocument = (globalThis as { document?: Document }).document;
const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

/** A graph result so the pane renders: two Person nodes joined by KNOWS. */
const NODE_REL_RESULT = {
	columns: ["a", "r", "b", "n"],
	rows: [
		[
			{ _id: 0, _label: "Person", name: "Alice" },
			{ _label: "KNOWS", _src: 0, _dst: 1 },
			{ _id: 1, _label: "Person", name: "Bob" },
			2,
		],
	],
	nodeKeys: [],
	truncated: false,
};

function databasesPayload() {
	return {
		databases: [
			{ name: "demo", kind: "user", description: "demo data", createdAt: null, updatedAt: null, nodes: 2, edges: 1 },
		],
	};
}

/** A distinct server config so we can tell it apart from the localStorage defaults. */
const SERVER_CONFIG = {
	types: { Person: { caption: "{{name}}", color: "#ff0000", rules: [] } },
	captionsVisible: true,
	relations: {},
	hidden: [],
};

/** An older server config: the same shape, but the type carries no colour of its own. */
const STALE_SERVER_CONFIG = {
	types: { Person: { caption: "", rules: [] } },
	captionsVisible: true,
	relations: {},
	hidden: [],
};

/** A newer local copy: the type carries a colour the server has never seen. */
const LOCAL_WITH_COLOR = {
	types: { Person: { caption: "", color: "#123456", rules: [] } },
	captionsVisible: true,
	relations: {},
	hidden: [],
};

const PICKED_COLOR = "#123456";

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

function setupDom() {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/databases",
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
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unsubscribe() {}
		disconnect() {}
	};
	(globalThis.window as { ResizeObserver?: unknown }).ResizeObserver = (
		globalThis as { ResizeObserver?: unknown }
	).ResizeObserver;
	for (const name of ["SVGElement", "HTMLElement", "Element", "Node", "MouseEvent", "PointerEvent"] as const) {
		const value = (dom.window as unknown as Record<string, unknown>)[name];
		if (value) (globalThis as Record<string, unknown>)[name] = value;
	}
	return dom;
}

describe("graph legend persistence in the browser pane (BACK-807/809)", () => {
	let root: Root | null = null;
	let legendGets: number;
	let legendPuts: Array<{ database: string; config: unknown }>;
	/** Holds every legend GET open until released, so a restore can be made to land late. */
	let legendGetGate: Promise<void> | null = null;
	let releaseLegendGet: (() => void) | null = null;
	/** While true, PUTs answer 500 - a write-through that never reached the server. */
	let failPuts = false;

	/** A fetch mock that serves the page's routes and a configurable legend endpoint. */
	function installFetch(serverConfig: unknown | null, legendStatus = 200) {
		legendGets = 0;
		legendPuts = [];
		legendGetGate = null;
		releaseLegendGet = null;
		failPuts = false;
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
			if (url.includes("/api/graph/databases"))
				return new Response(JSON.stringify(databasesPayload()), { status: 200 });
			if (url.includes("/api/graph/db-cypher")) return new Response(JSON.stringify(NODE_REL_RESULT), { status: 200 });
			if (url.includes("/api/graph/legend")) {
				const method = (init?.method ?? "GET").toUpperCase();
				if (method === "PUT") {
					let db = "";
					let config: unknown = null;
					try {
						const parsed = JSON.parse(String(init?.body)) as { database?: string; config?: unknown };
						db = parsed.database ?? "";
						config = parsed.config ?? null;
					} catch {
						// ignore malformed body
					}
					legendPuts.push({ database: db, config });
					if (failPuts) return new Response(JSON.stringify({ error: "write failed" }), { status: 500 });
					return new Response(null, { status: 204 });
				}
				legendGets++;
				if (legendGetGate) await legendGetGate;
				if (legendStatus === 204) return new Response(null, { status: 204 });
				return new Response(JSON.stringify(serverConfig), { status: legendStatus });
			}
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
	}

	/** Open the gate a held legend GET is waiting on. */
	function holdLegendGet() {
		legendGetGate = new Promise<void>((resolve) => {
			releaseLegendGet = resolve;
		});
	}

	function releaseLegendGetNow() {
		releaseLegendGet?.();
		releaseLegendGet = null;
	}

	async function mountGraph() {
		const container = document.getElementById("root") as HTMLElement;
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<MemoryRouter initialEntries={["/databases"]}>
					<ThemeProvider>
						<I18nProvider initialLocale="en">
							<GraphDatabases />
						</I18nProvider>
					</ThemeProvider>
				</MemoryRouter>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
	}

	async function openGraph() {
		await act(async () => {
			const run = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run");
			run?.click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		await act(async () => {
			const graph = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Graph");
			graph?.click();
			await new Promise((resolve) => setTimeout(resolve, 80));
		});
	}

	async function openLegendPanel() {
		await act(async () => {
			const button = document.querySelector('button[aria-label="Graph legend"]');
			(button as HTMLButtonElement | null)?.click();
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
	}

	async function clickSave() {
		await act(async () => {
			const save = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Save");
			(save as HTMLButtonElement | null)?.click();
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
	}

	/**
	 * Pick a colour on a colour input. React's ChangeEventPlugin falls back to the legacy
	 * input-event polyfill in this JSDOM environment (`isInputEventSupported` is computed at
	 * react-dom load time, before the test installs `document` - the same reason the sibling
	 * suites stub `attachEvent`), so a dispatched "input" event never reaches onChange. Drive the
	 * handler React itself installed instead; the picker reads nothing but `event.target.value`.
	 */
	function pickColor(input: HTMLInputElement, value: string) {
		const propsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
		const props = propsKey
			? (input as unknown as Record<string, { onChange?: (event: { target: { value: string } }) => void }>)[propsKey]
			: undefined;
		props?.onChange?.({ target: { value } });
	}

	/** The type colour as it stands in the localStorage cache. */
	function cachedColor(): string | undefined {
		const cached = JSON.parse(localStorage.getItem(legendStorageKey("demo")) ?? "null");
		return cached?.types?.Person?.color;
	}

	async function settle(ms = 80) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, ms));
		});
	}

	afterEach(async () => {
		if (root) await act(async () => root?.unmount());
		root = null;
		globalThis.fetch = originalFetch;
		globalThis.window = originalWindow as typeof window & typeof globalThis;
		globalThis.document = originalDocument as Document;
		globalThis.navigator = originalNavigator as Navigator;
		globalThis.requestAnimationFrame = originalRAF;
		globalThis.cancelAnimationFrame = originalCAF;
		globalThis.localStorage?.clear?.();
	});

	it("restores the server config on mount and caches it in localStorage (no write-through)", async () => {
		setupDom();
		installFetch(SERVER_CONFIG, 200);
		await mountGraph();
		await openGraph();
		await settle();

		// The server config was cached locally.
		expect(cachedColor()).toBe("#ff0000");
		// Restore alone must not write through to the server.
		expect(legendPuts).toEqual([]);
	});

	it("migrates a localStorage-only config up to the server once when the server has none", async () => {
		setupDom();
		installFetch(null, 204);
		// Seed a localStorage-only config (the pre-persistence user state).
		saveLegendConfig("demo", SERVER_CONFIG);
		expect(localStorage.getItem(legendStorageKey("demo"))).not.toBeNull();

		await mountGraph();
		await openGraph();
		await settle();

		expect(legendPuts.map((put) => put.database)).toContain("demo");
	});

	it("re-fetches and applies on a graph-legend-updated broadcast for the same database", async () => {
		setupDom();
		installFetch(SERVER_CONFIG, 200);
		await mountGraph();
		await openGraph();
		await settle();
		const before = legendGets;
		expect(before).toBeGreaterThanOrEqual(1);

		await act(async () => {
			window.dispatchEvent(
				new (window as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent(GRAPH_LEGEND_UPDATED_EVENT, {
					detail: { database: "demo" },
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 80));
		});

		expect(legendGets).toBeGreaterThan(before);
	});

	it("ignores graph-legend-updated broadcasts for other databases", async () => {
		setupDom();
		installFetch(SERVER_CONFIG, 200);
		await mountGraph();
		await openGraph();
		await settle();
		const before = legendGets;

		await act(async () => {
			window.dispatchEvent(
				new (window as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent(GRAPH_LEGEND_UPDATED_EVENT, {
					detail: { database: "other" },
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 80));
		});

		expect(legendGets).toBe(before);
	});

	it("keeps an edit made while a restore is in flight: a stale response must not revert it", async () => {
		setupDom();
		holdLegendGet();
		installFetch(STALE_SERVER_CONFIG, 200);
		await mountGraph();
		await openGraph();
		await settle();

		// The reader picks a type colour while the restore GET is still in the air, then saves.
		await openLegendPanel();
		await act(async () => {
			const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null;
			expect(colorInput).not.toBeNull();
			pickColor(colorInput as HTMLInputElement, PICKED_COLOR);
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		await clickSave();

		// The save reached the server with the colour.
		expect(legendPuts).toHaveLength(1);
		expect(legendPuts[0]?.database).toBe("demo");
		expect((legendPuts[0]?.config as { types?: { Person?: { color?: string } } })?.types?.Person?.color).toBe(
			PICKED_COLOR,
		);

		// Now the in-flight response lands, carrying the older config. It must be dropped rather
		// than applied: the colour the reader just saved survives.
		await act(async () => {
			releaseLegendGetNow();
			await new Promise((resolve) => setTimeout(resolve, 80));
		});
		expect(cachedColor()).toBe(PICKED_COLOR);
	});

	it("pins the automatic type colour into the saved config", async () => {
		setupDom();
		installFetch(STALE_SERVER_CONFIG, 200);
		await mountGraph();
		await openGraph();
		await settle();

		// The stored config carries no type colour, yet the pane paints Person with the label's
		// automatic hue - and the colour picker opens on that same colour.
		await openLegendPanel();
		const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement | null;
		expect(colorInput).not.toBeNull();
		expect(colorInput?.value).toBe(labelNodeColors("Person", "light").fill);

		// Saving without touching the picker records that colour instead of leaving it to be
		// re-derived from the label hash on every visit...
		await clickSave();
		expect(legendPuts).toHaveLength(1);
		const saved = (legendPuts[0]?.config as { types?: { Person?: { color?: string } } })?.types?.Person?.color;
		expect(saved).toBe(labelNodeColors("Person", "light").fill);
		// ...and the local cache agrees, so the next visit shows the very same picture.
		expect(cachedColor()).toBe(labelNodeColors("Person", "light").fill);
	});

	it("pushes a pending local copy up instead of letting an older server copy win", async () => {
		setupDom();
		installFetch(STALE_SERVER_CONFIG, 200);
		// A copy that was saved while the server was unreachable: it still owes the server a push.
		saveLegendConfig("demo", LOCAL_WITH_COLOR);
		markLegendPending("demo");

		await mountGraph();
		await openGraph();
		await settle();

		// The local copy was pushed up...
		const push = legendPuts.at(-1);
		expect(push?.database).toBe("demo");
		expect((push?.config as { types?: { Person?: { color?: string } } })?.types?.Person?.color).toBe(PICKED_COLOR);
		// ...and the colour stayed local: the older server copy did not win.
		expect(cachedColor()).toBe(PICKED_COLOR);
		expect(hasLegendPending("demo")).toBe(false);
	});

	it("surfaces a failed write-through and pushes the edit up once the server is back", async () => {
		setupDom();
		installFetch(STALE_SERVER_CONFIG, 200);
		failPuts = true;
		saveLegendConfig("demo", LOCAL_WITH_COLOR);
		markLegendPending("demo");

		await mountGraph();
		await openGraph();
		await settle();

		// The mount's push-up retry failed too, but the edit survives locally and stays pending -
		// the older server copy did not win.
		expect(cachedColor()).toBe(PICKED_COLOR);
		expect(hasLegendPending("demo")).toBe(true);

		// A save that does not land says so, next to the button that was pressed, and the panel
		// stays open instead of closing as if it had worked.
		await openLegendPanel();
		await clickSave();
		expect(document.querySelector('[role="alert"]')?.textContent).toContain("Not saved to the server");

		// The server is back: the next mount pushes the pending copy up and clears the mark.
		failPuts = false;
		await act(async () => {
			root?.unmount();
		});
		root = null;
		await mountGraph();
		await openGraph();
		await settle();
		const push = legendPuts.at(-1);
		expect(push?.database).toBe("demo");
		expect((push?.config as { types?: { Person?: { color?: string } } })?.types?.Person?.color).toBe(PICKED_COLOR);
		expect(hasLegendPending("demo")).toBe(false);
	});
});
