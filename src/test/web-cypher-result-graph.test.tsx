import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import GraphDatabases from "../web/components/GraphDatabases.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

/**
 * The databases page draws a Cypher result as a graph (BACK-793). These tests pin the parts a
 * reader meets first: the view-mode switch, the graph pane mounting the shared canvas engine
 * without throwing, its legend, and the empty state for a result that carries no node. The
 * engine's own interactions (zoom, hover, fly-in, drag) are GraphView's, exercised by
 * web-graph-canvas.test.tsx - this pane shares them by construction.
 */

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

/** Mirrors the page's starting statement - a change here means the page changed. */
const DEFAULT_STATEMENT = "MATCH (n) RETURN n LIMIT 25";

/** A result as the server flattens it: two nodes joined by a relationship, plus a scalar column. */
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

/** A result with no node value at all (RETURN count(*)). */
const SCALAR_RESULT = { columns: ["count"], rows: [[2]], nodeKeys: [], truncated: false };

/** Two nodes of different labels, so a legend toggle has something to hide. */
const MIXED_LABEL_RESULT = {
	columns: ["a", "r", "b"],
	rows: [
		[
			{ _id: 0, _label: "Person", name: "Alice" },
			{ _label: "KNOWS", _src: 0, _dst: 1 },
			{ _id: 1, _label: "City", name: "Guangzhou" },
		],
	],
	nodeKeys: [],
	truncated: false,
};

/**
 * A corpus sweep (`MATCH (n) RETURN n`): two business nodes plus the store's own bookkeeping
 * node. It is the reason a 1599-node corpus used to read as 1600.
 */
const CORPUS_SWEEP_RESULT = {
	columns: ["n"],
	rows: [
		[{ _id: "0:1", _label: "FileNode", path: "tasks/a.md" }],
		[{ _id: "1:1", _label: "Tag", name: "auth" }],
		[{ _id: "2:0", _label: "Meta", name: "fingerprint", value: "abc123" }],
	],
	nodeKeys: [],
	truncated: false,
};

/** The body the page last posted to the Cypher endpoint. */
let lastCypherBody: string | null = null;

function databasesPayload() {
	return {
		databases: [
			{
				name: "demo",
				kind: "user",
				description: "demo data",
				createdAt: null,
				updatedAt: null,
				nodes: 2,
				edges: 1,
			},
		],
	};
}

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
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") htmlElementPrototype.attachEvent = () => {};
	if (typeof htmlElementPrototype.detachEvent !== "function") htmlElementPrototype.detachEvent = () => {};
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unsubscribe() {}
		disconnect() {}
	};
	(globalThis.window as { ResizeObserver?: unknown }).ResizeObserver = (
		globalThis as { ResizeObserver?: unknown }
	).ResizeObserver;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
		if (url.includes("/api/graph/databases")) return new Response(JSON.stringify(databasesPayload()), { status: 200 });
		if (url.includes("/api/graph/db-cypher")) {
			lastCypherBody = typeof init?.body === "string" ? init.body : null;
			return new Response(JSON.stringify(NODE_REL_RESULT), { status: 200 });
		}
		return new Response(JSON.stringify({}), { status: 200 });
	}) as unknown as typeof fetch;
	for (const name of ["SVGElement", "HTMLElement", "Element", "Node", "MouseEvent", "PointerEvent"] as const) {
		const value = (dom.window as unknown as Record<string, unknown>)[name];
		if (value) (globalThis as Record<string, unknown>)[name] = value;
	}
	return dom;
}

function pageText(): string {
	return document.getElementById("root")?.textContent ?? "";
}

/** The legend's node-label toggle: its text is the label followed by its count. */
function legendToggle(label: string): HTMLButtonElement {
	const button = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").startsWith(label));
	if (!button) throw new Error(`legend toggle ${label} not found`);
	return button as HTMLButtonElement;
}

function fullscreenButton(): HTMLButtonElement | null {
	const button = [...document.querySelectorAll("button")].find((b) =>
		["Fullscreen", "Exit fullscreen"].includes(b.getAttribute("aria-label") ?? ""),
	);
	return (button as HTMLButtonElement | undefined) ?? null;
}

function modeButton(label: string): HTMLButtonElement {
	const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
	if (!button) throw new Error(`view mode button ${label} not found`);
	return button as HTMLButtonElement;
}

describe("databases page: the result as a graph (BACK-793)", () => {
	let root: Root | null = null;

	async function mount(node: React.ReactNode) {
		const container = document.getElementById("root") as HTMLElement;
		const errors: unknown[][] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args);
		};
		try {
			root = createRoot(container);
			await act(async () => {
				root?.render(
					<MemoryRouter initialEntries={["/databases"]}>
						<ThemeProvider>
							<I18nProvider initialLocale="en">{node}</I18nProvider>
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
		return errors;
	}

	/** Run the statement in the box and wait for the result. */
	async function runQuery() {
		await act(async () => {
			modeButton("Run").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
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

	it("offers table, graph and both, and keeps the mode across a re-run", async () => {
		setupDom();
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		// The table is the default reading.
		expect(document.querySelector("table")).not.toBeNull();
		expect(modeButton("Table").getAttribute("aria-pressed")).toBe("true");

		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(modeButton("Graph").getAttribute("aria-pressed")).toBe("true");
		expect(modeButton("Table").getAttribute("aria-pressed")).toBe("false");
		// A re-run keeps the mode: switching the view is a separate decision from running.
		await runQuery();
		expect(modeButton("Graph").getAttribute("aria-pressed")).toBe("true");
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("draws the result on the shared canvas engine with a label and relation legend", async () => {
		setupDom();
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 80));
		});

		// The engine's canvas, its control cluster (fit / pan cross / zoom pair) and its hint panel.
		const canvas = document.querySelector("canvas");
		expect(canvas).not.toBeNull();
		expect(canvas?.getAttribute("aria-label")).toBe("Result graph");
		expect([...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label")?.includes("Ctrl+0"))).toBe(
			true,
		);
		// No in-view Cypher search: that belongs to the corpus graph page.
		expect([...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label")?.includes("Cypher"))).toBe(
			false,
		);

		// The legend names the node label with its count and the relationship type.
		const text = pageText();
		expect(text).toContain("Person");
		expect(text).toContain("KNOWS");
		expect(text).toContain("2 nodes · 1 edges");
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("shows the table and the graph together in split mode", async () => {
		setupDom();
		await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Both").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(document.querySelector("table")).not.toBeNull();
		expect(document.querySelector("canvas")).not.toBeNull();
	});

	it("hides the internal handles in the table but keeps the label and properties", async () => {
		setupDom();
		await mount(<GraphDatabases />);
		await runQuery();
		const cells = [...document.querySelectorAll("tbody td")].map((cell) => cell.textContent ?? "");
		expect(cells).toContain('{"_label":"Person","name":"Alice"}');
		expect(cells).toContain('{"_label":"KNOWS"}');
		// The scalar column is plain text.
		expect(cells).toContain("2");
	});

	it("shows an empty state instead of a broken canvas when the result carries no node", async () => {
		setupDom();
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
			if (url.includes("/api/graph/databases"))
				return new Response(JSON.stringify(databasesPayload()), { status: 200 });
			if (url.includes("/api/graph/db-cypher")) return new Response(JSON.stringify(SCALAR_RESULT), { status: 200 });
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(pageText()).toContain("no drawable node");
		expect(document.querySelector("canvas")).toBeNull();
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("declines to draw a result too large to lay out interactively", async () => {
		setupDom();
		const huge = {
			columns: ["n"],
			rows: Array.from({ length: 3001 }, (_, index) => [{ _id: index, _label: "Person", key: `p${index}` }]),
			nodeKeys: [],
			truncated: true,
		};
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
			if (url.includes("/api/graph/databases"))
				return new Response(JSON.stringify(databasesPayload()), { status: 200 });
			if (url.includes("/api/graph/db-cypher")) return new Response(JSON.stringify(huge), { status: 200 });
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
		await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(pageText()).toContain("3001 nodes is past what this pane can lay out");
		expect(document.querySelector("canvas")).toBeNull();
	});

	it("carries a fullscreen toggle on the graph title, matching the memo board's icon", async () => {
		setupDom();
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		const button = fullscreenButton();
		expect(button?.getAttribute("aria-label")).toBe("Fullscreen");
		// The memo board's icon: four outward corners.
		expect(button?.querySelector("path")?.getAttribute("d")).toBe("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5");
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("keeps a legend entry visible after it is switched off, so it can be switched back on", async () => {
		setupDom();
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
			if (url.includes("/api/graph/databases"))
				return new Response(JSON.stringify(databasesPayload()), { status: 200 });
			if (url.includes("/api/graph/db-cypher"))
				return new Response(JSON.stringify(MIXED_LABEL_RESULT), { status: 200 });
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		const person = legendToggle("Person");
		expect(person).not.toBeNull();
		expect(person.getAttribute("aria-pressed")).toBe("true");
		expect(pageText()).toContain("2 nodes · 1 edges");

		// Switch Person off: its nodes leave the picture, but the legend entry must stay - an entry
		// that vanished on click could never be clicked again.
		await act(async () => {
			person.click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		const after = legendToggle("Person");
		expect(after).not.toBeNull();
		expect(after.getAttribute("aria-pressed")).toBe("false");
		expect(pageText()).toContain("1 nodes · 0 edges");
		// The other label is untouched.
		expect(legendToggle("City").getAttribute("aria-pressed")).toBe("true");

		await act(async () => {
			after.click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(legendToggle("Person").getAttribute("aria-pressed")).toBe("true");
		expect(pageText()).toContain("2 nodes · 1 edges");
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("leaves the store's own Meta node out of the count, and says it did", async () => {
		setupDom();
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
			if (url.includes("/api/graph/databases"))
				return new Response(JSON.stringify(databasesPayload()), { status: 200 });
			if (url.includes("/api/graph/db-cypher"))
				return new Response(JSON.stringify(CORPUS_SWEEP_RESULT), { status: 200 });
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
		const errors = await mount(<GraphDatabases />);
		await runQuery();
		// In table mode every row is still there - keeping the store's bookkeeping node out of the
		// picture is a drawing decision, not a data one. (The page's first table lists the databases;
		// the last one is the result.)
		const tables = [...document.querySelectorAll("table")];
		expect(tables[tables.length - 1]?.querySelectorAll("tbody tr").length).toBe(3);

		await act(async () => {
			modeButton("Graph").click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		// Three rows came back, but only two of them are the reader's data - and now the pane says
		// which one it left out instead of quietly counting 1600.
		expect(pageText()).toContain("2 nodes · 0 edges");
		expect(pageText()).toContain("1 internal node(s) hidden");

		// Meta stays reachable: its legend entry is there and switching it on draws it.
		const meta = legendToggle("Meta");
		expect(meta.getAttribute("aria-pressed")).toBe("false");
		await act(async () => {
			meta.click();
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(pageText()).toContain("3 nodes · 0 edges");
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("runs View ALL from the examples row: fills the box and runs it", async () => {
		setupDom();
		const errors = await mount(<GraphDatabases />);
		expect((document.getElementById("database-cypher") as HTMLTextAreaElement).value).toBe(DEFAULT_STATEMENT);

		await act(async () => {
			modeButton("View ALL").click();
			await new Promise((resolve) => setTimeout(resolve, 60));
		});

		// The statement landed in the box, so the reader can see and edit what ran.
		const box = document.getElementById("database-cypher") as HTMLTextAreaElement;
		expect(box.value).toBe("MATCH (n)\nOPTIONAL MATCH (n)-[r]-()\nRETURN n,r");
		// And it ran on its own - a result is on screen without a second click.
		expect(lastCypherBody).toContain("OPTIONAL MATCH (n)-[r]-()");
		expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
		expect(errors.filter((args) => String(args[0]).includes("Error"))).toEqual([]);
	});

	it("posts an uncapped request when every row is asked for", async () => {
		setupDom();
		await mount(<GraphDatabases />);
		// Default: no cap travels, so the server applies its own.
		await runQuery();
		expect(lastCypherBody).toContain('"statement":"MATCH (n) RETURN n LIMIT 25"');
		expect(lastCypherBody).not.toContain("maxRows");

		const checkbox = document.getElementById("database-cypher-all-rows") as HTMLInputElement | null;
		expect(checkbox).not.toBeNull();
		await act(async () => {
			(checkbox as HTMLInputElement).click();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		await runQuery();
		// `null` is the only way to say "every row": `undefined` would drop the key and fall back
		// to the interactive cap.
		expect(lastCypherBody).toContain('"maxRows":null');
	});
});
