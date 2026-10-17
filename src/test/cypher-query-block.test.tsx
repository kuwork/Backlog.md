import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GRAPH_UPDATED_EVENT } from "../graph/updated.ts";
import { UTF8_BOM } from "../sqlite/csv.ts";
import CypherQueryBlock from "../web/components/CypherQueryBlock.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { legendStorageKey } from "../web/utils/graph-legend-config.ts";

interface FakeWritable {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}
interface FakeHandle {
	createWritable(): Promise<FakeWritable>;
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

const RESULT = {
	columns: ["id"],
	rows: [["BACK-1"]],
	truncated: false,
	elapsedMs: 3,
	totalRows: 1,
	nodeKeys: [],
};

/** Three rows, so a zebra-striped render has both unpainted and painted rows to assert on. */
const THREE_ROWS = { ...RESULT, rows: [["BACK-1"], ["BACK-2"], ["BACK-3"]], totalRows: 3 };

const BLOCK = ["source: tasks", "query: |", "  MATCH (t:Task)", "  RETURN t.id AS id"].join("\n");

const BROKEN_BLOCK = ["source: tasks", "  query: RETURN 1"].join("\n");

let root: Root | null = null;
let container: HTMLElement | null = null;
let queryCalls = 0;
let queryResult: unknown = RESULT;
const queryBodies: Record<string, unknown>[] = [];
const exportBodies: Record<string, unknown>[] = [];
const savedFiles: { name: string; contents: string }[] = [];

function mount(block: string) {
	act(() => {
		root?.render(
			<I18nProvider initialLocale="en">
				<CypherQueryBlock block={block} />
			</I18nProvider>,
		);
	});
}

/** The graph view's pane reads the theme context, so graph tests mount inside its provider. */
function mountThemed(block: string) {
	act(() => {
		root?.render(
			<ThemeProvider>
				<I18nProvider initialLocale="en">
					<CypherQueryBlock block={block} />
				</I18nProvider>
			</ThemeProvider>,
		);
	});
}

async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
}

function button(label: string): HTMLButtonElement | undefined {
	return Array.from(container?.querySelectorAll("button") ?? []).find((candidate) => candidate.textContent === label) as
		| HTMLButtonElement
		| undefined;
}

function toggle(): HTMLButtonElement {
	const buttons = Array.from(container?.querySelectorAll("button") ?? []);
	return buttons.find((candidate) => /query/i.test(candidate.textContent ?? "")) as HTMLButtonElement;
}

beforeEach(() => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

	// The graph view (BACK-803) mounts the shared canvas engine; JSDOM needs the same stubs the
	// databases-page tests use (web-cypher-result-graph.test.tsx).
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

	queryCalls = 0;
	queryResult = RESULT;
	queryBodies.length = 0;
	exportBodies.length = 0;
	savedFiles.length = 0;
	(globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = async (options?: {
		suggestedName?: string;
	}) => {
		const handle: FakeHandle = {
			async createWritable() {
				const writable: FakeWritable = {
					async write(data: string) {
						savedFiles.push({ name: options?.suggestedName ?? "", contents: data });
					},
					async close() {},
				};
				return writable;
			},
		};
		return handle;
	};
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("/api/graph/export-csv")) {
			exportBodies.push(JSON.parse(String(init?.body ?? "{}")));
			return Promise.resolve(
				new Response(
					JSON.stringify({
						filename: "tasks-20260101-000000.csv",
						csv: `${UTF8_BOM}id\r\nBACK-1\r\n`,
						rows: 1,
						truncated: false,
					}),
					{ status: 200 },
				),
			);
		}
		if (url.includes("/api/graph/cypher-query")) {
			queryCalls++;
			queryBodies.push(JSON.parse(String(init?.body ?? "{}")));
			return Promise.resolve(new Response(JSON.stringify(queryResult), { status: 200 }));
		}
		return Promise.resolve(new Response("{}", { status: 200 }));
	}) as unknown as typeof fetch;

	container = document.getElementById("root");
	root = createRoot(container as HTMLElement);
});

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	globalThis.fetch = (() => Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;
	(globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
});

describe("CypherQueryBlock base render (BACK-802)", () => {
	it("renders the title and the rows, and posts source + query to the cypher endpoint", async () => {
		mount(BLOCK);
		await settle();

		expect(queryCalls).toBe(1);
		expect(queryBodies).toEqual([{ source: "tasks", query: "MATCH (t:Task)\nRETURN t.id AS id" }]);
		expect(container?.textContent).toContain("Cypher query");
		expect(container?.textContent).toContain("BACK-1");
		expect(container?.textContent).toContain("1 rows · 3 ms");
	});

	it("reports a server-side error inline", async () => {
		queryResult = { error: '数据库 "nope" 不存在。可用：default, tasks。' };
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/graph/cypher-query")) {
				queryCalls++;
				return Promise.resolve(new Response(JSON.stringify(queryResult), { status: 400 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		}) as unknown as typeof fetch;
		mount(BLOCK);
		await settle();
		expect(container?.textContent).toContain("Query failed");
		expect(container?.textContent).toContain("数据库");
	});

	it("shows the parse error and sends no request for an unparseable block", async () => {
		mount(BROKEN_BLOCK);
		await settle();
		expect(queryCalls).toBe(0);
		expect(container?.textContent).toContain("第 2 行");
	});

	it("shows the empty message for a zero-row result", async () => {
		queryResult = { ...RESULT, rows: [], totalRows: 0 };
		mount(BLOCK);
		await settle();
		expect(container?.textContent).toContain("The query returned no rows.");
	});

	it("has no pagination toggle - the row cap is the whole answer", async () => {
		mount(BLOCK);
		await settle();
		expect(container?.textContent).not.toContain("Pagination");
	});
});

describe("CypherQueryBlock Show/Hide Query (BACK-802)", () => {
	it("hides the statement until asked, then reveals source and Cypher without re-querying", async () => {
		mount(BLOCK);
		await settle();

		expect(toggle().textContent).toBe("Show query");
		expect(container?.querySelector("pre")).toBeNull();

		await act(async () => {
			toggle().click();
		});

		expect(container?.querySelector("pre")?.textContent).toBe("MATCH (t:Task)\nRETURN t.id AS id");
		expect(container?.textContent).toContain("tasks");
		expect(toggle().textContent).toBe("Hide query");
		expect(queryCalls).toBe(1);
	});
});

describe("CypherQueryBlock Copy Markdown (BACK-802)", () => {
	it("copies the grid as a GFM table", async () => {
		const writes: string[] = [];
		(globalThis as { navigator?: Navigator }).navigator = {
			clipboard: {
				writeText: (text: string) => {
					writes.push(text);
					return Promise.resolve();
				},
			},
		} as unknown as Navigator;

		mount(BLOCK);
		await settle();
		await act(async () => {
			button("Copy Markdown")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(writes).toEqual(["| id |\n| --- |\n| BACK-1 |"]);
	});
});

describe("CypherQueryBlock Export CSV (BACK-802)", () => {
	it("sends exactly { source, query } and saves the CSV where the user chose", async () => {
		mount(BLOCK);
		await settle();

		await act(async () => {
			button("Export CSV")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(exportBodies).toEqual([{ source: "tasks", query: "MATCH (t:Task)\nRETURN t.id AS id" }]);
		expect(Object.keys(exportBodies[0] ?? {})).toEqual(["source", "query"]);
		expect(savedFiles).toEqual([{ name: "tasks-20260101-000000.csv", contents: `${UTF8_BOM}id\r\nBACK-1\r\n` }]);
	});

	it("hides the button when there is no result to export", async () => {
		queryResult = { ...RESULT, rows: [], totalRows: 0 };
		mount(BLOCK);
		await settle();
		expect(button("Export CSV")).toBeUndefined();
	});
});

describe("CypherQueryBlock graph view (BACK-803)", () => {
	const GRAPH_BLOCK = [
		"source: tasks",
		"view: graph",
		"query: |",
		"  MATCH (a:Person)-[r:KNOWS]->(b:Person)",
		"  RETURN a, r, b",
	].join("\n");

	/** Two nodes joined by a relationship: the coerced grid plus the raw channel the graph reads. */
	const GRAPH_RESULT = {
		columns: ["a", "r", "b"],
		rows: [['{"_label":"Person","name":"Alice"}', "(0:0)-[KNOWS]->(0:1)", '{"_label":"Person","name":"Bob"}']],
		graphRows: [
			[
				{ _id: "0:0", _label: "Person", name: "Alice" },
				{ _label: "KNOWS", _src: "0:0", _dst: "0:1" },
				{ _id: "0:1", _label: "Person", name: "Bob" },
			],
		],
		truncated: false,
		elapsedMs: 3,
		totalRows: 1,
		nodeKeys: [],
	};

	/** `nodeCount` unconnected Person nodes, in both the coerced and the raw channel. */
	function bigGraphResult(nodeCount: number) {
		const graphRows = Array.from({ length: nodeCount }, (_, i) => [{ _id: `0:${i}`, _label: "Person", name: `n${i}` }]);
		return {
			columns: ["n"],
			rows: graphRows.map(([node]) => [JSON.stringify({ _label: "Person", name: (node as { name: string }).name })]),
			graphRows,
			truncated: false,
			elapsedMs: 3,
			totalRows: nodeCount,
			nodeKeys: [],
		};
	}

	async function settleGraph() {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 80));
		});
	}

	it("asks the server for the raw rows and draws the result on the shared canvas engine", async () => {
		queryResult = GRAPH_RESULT;
		mountThemed(GRAPH_BLOCK);
		await settleGraph();

		expect(queryBodies).toEqual([
			{ source: "tasks", query: "MATCH (a:Person)-[r:KNOWS]->(b:Person)\nRETURN a, r, b", view: "graph" },
		]);
		const canvas = container?.querySelector("canvas");
		expect(canvas).not.toBeNull();
		expect(canvas?.getAttribute("aria-label")).toBe("Result graph");
		// No coerced table next to the graph.
		expect(container?.querySelector("table")).toBeNull();
		// The legend names the node label and the relationship type.
		expect(container?.textContent).toContain("Person");
		expect(container?.textContent).toContain("KNOWS");
		expect(container?.textContent).toContain("2 nodes · 1 edges");
	});

	it("reads the legend configuration stored for the block's source database", async () => {
		localStorage.setItem(
			legendStorageKey("tasks"),
			JSON.stringify({
				captionsVisible: true,
				types: {},
				relations: { KNOWS: { dash: "solid", arrow: "end", name: "knows-well" } },
				hidden: [],
			}),
		);
		queryResult = GRAPH_RESULT;
		mountThemed(GRAPH_BLOCK);
		await settleGraph();

		// The configured display name replaces the raw relationship type in the legend.
		expect(container?.textContent).toContain("knows-well");
	});

	it("falls back to the table with a notice when the result has more than 3000 nodes", async () => {
		queryResult = bigGraphResult(3001);
		mountThemed(GRAPH_BLOCK);
		await settleGraph();

		expect(container?.querySelector("canvas")).toBeNull();
		expect(container?.querySelector("table")).not.toBeNull();
		expect(container?.textContent).toContain(
			"Graph view is limited to 3000 nodes; this result has 3001, so the table is shown instead.",
		);
	});

	it("says there is nothing to draw instead of blanking when the result carries no node", async () => {
		queryResult = {
			columns: ["count"],
			rows: [[2]],
			graphRows: [[2]],
			truncated: false,
			elapsedMs: 3,
			totalRows: 1,
			nodeKeys: [],
		};
		mountThemed(GRAPH_BLOCK);
		await settleGraph();

		expect(container?.querySelector("canvas")).toBeNull();
		expect(container?.textContent).toContain("The result carries no drawable node");
	});
});

describe("CypherQueryBlock refresh: auto (BACK-804)", () => {
	const AUTO_BLOCK = ["source: tasks", "refresh: auto", "query: |", "  MATCH (t:Task)", "  RETURN t.id AS id"].join(
		"\n",
	);

	/** Dispatch the shell's graph-updated window event, then outwait the 500ms quiet period. */
	async function dispatchGraphUpdated(database: string) {
		await act(async () => {
			window.dispatchEvent(new window.CustomEvent(GRAPH_UPDATED_EVENT, { detail: { database } }));
			await new Promise((resolve) => setTimeout(resolve, 600));
		});
	}

	it("shows the Live badge and merges a burst of broadcasts into one re-run", async () => {
		mount(AUTO_BLOCK);
		await settle();
		expect(queryCalls).toBe(1);
		expect(container?.textContent).toContain("Live");

		// An import burst: five change notices 50ms apart collapse into a single re-run.
		await act(async () => {
			for (let i = 0; i < 5; i++) {
				window.dispatchEvent(new window.CustomEvent(GRAPH_UPDATED_EVENT, { detail: { database: "tasks" } }));
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			await new Promise((resolve) => setTimeout(resolve, 600));
		});
		expect(queryCalls).toBe(2);
	});

	it("ignores broadcasts that name another database", async () => {
		mount(AUTO_BLOCK);
		await settle();
		await dispatchGraphUpdated("other");
		expect(queryCalls).toBe(1);
	});

	it("keeps the on-screen state when the re-run returns the same rows", async () => {
		mount(AUTO_BLOCK);
		await settle();
		expect(container?.textContent).toContain("1 rows · 3 ms");

		// Same rows, different timing: the fingerprint matches, so the first run's state stays.
		queryResult = { ...RESULT, elapsedMs: 9 };
		await dispatchGraphUpdated("tasks");
		expect(queryCalls).toBe(2);
		expect(container?.textContent).toContain("1 rows · 3 ms");
		expect(container?.textContent).not.toContain("9 ms");
	});

	it("re-renders when the re-run's rows actually changed", async () => {
		mount(AUTO_BLOCK);
		await settle();
		queryResult = { ...RESULT, rows: [["BACK-2"]], elapsedMs: 5 };
		await dispatchGraphUpdated("tasks");
		expect(queryCalls).toBe(2);
		expect(container?.textContent).toContain("BACK-2");
		expect(container?.textContent).toContain("1 rows · 5 ms");
	});

	it("pauses and resumes the re-run without dropping the listener", async () => {
		mount(AUTO_BLOCK);
		await settle();

		await act(async () => {
			button("Pause")?.click();
		});
		await dispatchGraphUpdated("tasks");
		expect(queryCalls).toBe(1);

		await act(async () => {
			button("Resume")?.click();
		});
		await dispatchGraphUpdated("tasks");
		expect(queryCalls).toBe(2);
	});

	it("leaves a manual block deaf to broadcasts - no badge, no re-run", async () => {
		mount(BLOCK);
		await settle();
		expect(container?.textContent).not.toContain("Live");
		await dispatchGraphUpdated("tasks");
		expect(queryCalls).toBe(1);
	});
});

describe("CypherQueryBlock style field (BACK-805)", () => {
	/** The block's outer frame: the root div the presets dress. */
	function frame(): Element | null | undefined {
		return container?.querySelector("div.my-3");
	}

	it("applies compact: smaller body text and tighter cells", async () => {
		mount(`${BLOCK}\nstyle: compact`);
		await settle();

		expect(frame()?.className).toContain("text-xs");
		expect(container?.querySelector("td")?.className).toContain("py-0");
	});

	it("applies striped: zebra rows in the table", async () => {
		queryResult = THREE_ROWS;
		mount(`${BLOCK}\nstyle: striped`);
		await settle();

		const rows = container?.querySelectorAll("tbody tr");
		expect(rows?.[0]?.className).not.toContain("bg-blue-50");
		expect(rows?.[1]?.className).toContain("bg-blue-50");
		expect(rows?.[2]?.className).not.toContain("bg-blue-50");
	});

	it("applies borderless: no frame and no rule lines", async () => {
		mount(`${BLOCK}\nstyle: borderless`);
		await settle();

		expect(frame()?.className).not.toContain("border");
		expect(container?.querySelector("tbody tr")?.className ?? "").not.toContain("border-b");
	});

	it("combines presets, ignores unknown values, and still renders the rows", async () => {
		queryResult = THREE_ROWS;
		mount(`${BLOCK}\nstyle: compact bogus striped`);
		await settle();

		expect(container?.textContent).toContain("BACK-1");
		expect(frame()?.className).toContain("text-xs");
		expect(container?.querySelectorAll("tbody tr")?.[1]?.className).toContain("bg-blue-50");
	});

	it("dresses the list view too: zebra rows, and no gutter rule when borderless", async () => {
		queryResult = THREE_ROWS;
		mount(`${BLOCK}\nview: list\nstyle: striped borderless`);
		await settle();

		const rows = container?.querySelectorAll("div.space-y-3 > div");
		// The padding lands on every row so painted and unpainted rows stay aligned.
		expect(rows?.[0]?.className).toContain("px-2");
		expect(rows?.[0]?.className).not.toContain("bg-blue-50");
		expect(rows?.[1]?.className).toContain("bg-blue-50");
		expect(rows?.[0]?.querySelector("div")?.className).not.toContain("border-r");
	});

	it("leaves the default look untouched when no style is set", async () => {
		queryResult = THREE_ROWS;
		mount(BLOCK);
		await settle();

		expect(frame()?.className).toContain("text-sm");
		expect(frame()?.className).toContain("border");
		const rows = container?.querySelectorAll("tbody tr");
		// Every row but the last carries the rule line; nothing is painted without `striped`.
		expect(rows?.[0]?.className).toContain("border-b");
		expect(rows?.[2]?.className).not.toContain("border-b");
		expect(rows?.[1]?.className).not.toContain("bg-blue-50");
	});

	it("ignores the presets in the graph view, which draws its own pane", async () => {
		queryResult = {
			columns: ["n"],
			rows: [['{"_label":"Person","name":"Alice"}']],
			graphRows: [[{ _id: "0:0", _label: "Person", name: "Alice" }]],
			truncated: false,
			elapsedMs: 3,
			totalRows: 1,
			nodeKeys: [],
		};
		mountThemed(`${BLOCK}\nview: graph\nstyle: compact borderless`);
		await settle();

		expect(frame()?.className).toContain("text-sm");
		expect(frame()?.className).toContain("border");
	});
});
