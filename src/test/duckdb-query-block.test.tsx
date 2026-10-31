import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UTF8_BOM } from "../sqlite/csv.ts";
import DuckdbQueryBlock from "../web/components/DuckdbQueryBlock.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

interface FakeWritable {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}
interface FakeHandle {
	createWritable(): Promise<FakeWritable>;
}

const RESULT = {
	columns: ["name"],
	rows: [["Alice"]],
	truncated: false,
	elapsedMs: 3,
	dbPath: "backlog/databases/shop.duckdb",
};

const BLOCK = ["source: backlog/databases/shop.duckdb", "sql: |", "  SELECT name", "  FROM people"].join("\n");

const BROKEN_BLOCK = ["source: backlog/databases/shop.duckdb", "  sql: SELECT name"].join("\n");

let root: Root | null = null;
let container: HTMLElement | null = null;
let queryCalls = 0;
let queryResult: unknown = RESULT;
/** Every export request body, so the "no rows travel to the server" rule can be asserted. */
const exportBodies: Record<string, unknown>[] = [];
/** Every file the stubbed save dialog actually handed to a writable, so the write can be asserted. */
const savedFiles: { name: string; contents: string }[] = [];

function mount(block: string) {
	act(() => {
		root?.render(
			<I18nProvider initialLocale="en">
				<DuckdbQueryBlock block={block} />
			</I18nProvider>,
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

/** The Show/Hide toggle: its label flips between "Show Query" and "Hide Query", so match on /query/. */
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

	queryCalls = 0;
	queryResult = RESULT;
	exportBodies.length = 0;
	savedFiles.length = 0;
	// The File System Access API is Chromium-only; stub it so the save path runs headless and the
	// written text can be inspected. The dialog "suggests" the server's filename.
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
		if (url.includes("/api/duckdb/export-csv")) {
			exportBodies.push(JSON.parse(String(init?.body ?? "{}")));
			return Promise.resolve(
				new Response(
					JSON.stringify({
						filename: "shop-20260101-000000.csv",
						csv: `${UTF8_BOM}name\r\nAlice\r\n`,
						rows: 1,
						truncated: false,
					}),
					{ status: 200 },
				),
			);
		}
		if (url.includes("/api/duckdb/query")) {
			queryCalls++;
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

describe("DuckdbQueryBlock base render (BACK-778)", () => {
	it("renders the title and the rows, and runs the query once", async () => {
		mount(BLOCK);
		await settle();

		expect(queryCalls).toBe(1);
		expect(container?.textContent).toContain("DuckDB query");
		expect(container?.textContent).toContain("Alice");
	});

	it("shows the summary line for a successful result", async () => {
		mount(BLOCK);
		await settle();
		expect(container?.textContent).toContain("1 rows · 3 ms");
	});

	it("reports a server-side error inline", async () => {
		queryResult = { error: "source 指向项目目录之外：../outside/shop.duckdb" };
		globalThis.fetch = ((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/duckdb/query")) {
				queryCalls++;
				return Promise.resolve(new Response(JSON.stringify(queryResult), { status: 400 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		}) as unknown as typeof fetch;
		mount(BLOCK);
		await settle();
		expect(container?.textContent).toContain("Query failed");
		expect(container?.textContent).toContain("source 指向项目目录之外");
	});

	it("shows the parse error and sends no request for an unparseable block", async () => {
		mount(BROKEN_BLOCK);
		await settle();
		expect(queryCalls).toBe(0);
		expect(container?.textContent).toContain("第 2 行");
	});
});

describe("DuckdbQueryBlock Show/Hide Query (BACK-779)", () => {
	it("runs the query once to render rows, and hides the SQL until asked", async () => {
		mount(BLOCK);
		await settle();

		expect(queryCalls).toBe(1);
		expect(container?.textContent).toContain("Alice");
		expect(toggle().textContent).toBe("Show Query");
		expect(container?.querySelector("pre")).toBeNull();
		expect(toggle().getAttribute("aria-expanded")).toBe("false");
	});

	it("reveals the source and the statement when expanded", async () => {
		mount(BLOCK);
		await settle();

		await act(async () => {
			toggle().click();
		});

		const panel = container?.querySelector("pre");
		expect(panel?.textContent).toBe("SELECT name\nFROM people");
		expect(container?.textContent).toContain("backlog/databases/shop.duckdb");
		expect(toggle().textContent).toBe("Hide Query");
		expect(toggle().getAttribute("aria-expanded")).toBe("true");
	});

	it("expanding costs no extra request, and Refresh leaves it expanded", async () => {
		mount(BLOCK);
		await settle();

		await act(async () => {
			toggle().click();
		});
		expect(queryCalls).toBe(1);

		const refresh = Array.from(container?.querySelectorAll("button") ?? []).find(
			(candidate) => candidate.textContent === "Refresh",
		) as HTMLButtonElement;
		await act(async () => {
			refresh.click();
		});
		await settle();

		// Two calls total (initial + refresh), and the panel survived the reload.
		expect(queryCalls).toBe(2);
		expect(container?.querySelector("pre")?.textContent).toBe("SELECT name\nFROM people");
		expect(toggle().textContent).toBe("Hide Query");
	});

	it("reveals the raw block body when the block cannot be parsed", async () => {
		mount(BROKEN_BLOCK);
		await settle();

		expect(queryCalls).toBe(0);
		expect(container?.textContent).toContain("第 2 行");

		await act(async () => {
			toggle().click();
		});

		expect(container?.querySelector("pre")?.textContent).toBe(BROKEN_BLOCK);
	});
});

// A DuckDB result after `toCell` coercion (validated in duckdb.test.ts): BIGINT→string, DECIMAL→fixed
// scale string, TIMESTAMP→ISO, DATE→ISO date, BLOB→"<blob N 字节>", NULL→null. The copy serializer
// only sees the coerced `SqliteCell` union, so this exercises the DuckDB→Markdown contract end to end.
const COPY_RESULT = {
	columns: ["id", "amount", "ts", "day", "blob", "note"],
	rows: [["1234567890123", "3.140", "2026-10-13T08:30:00.000Z", "2026-10-13", "<blob 4 字节>", null]],
	truncated: false,
	elapsedMs: 5,
	dbPath: "backlog/databases/shop.duckdb",
};

describe("DuckdbQueryBlock Copy Markdown (BACK-780)", () => {
	const writes: string[] = [];

	function stubClipboard() {
		writes.length = 0;
		(globalThis as { navigator?: Navigator }).navigator = {
			clipboard: {
				writeText: (text: string) => {
					writes.push(text);
					return Promise.resolve();
				},
			},
		} as unknown as Navigator;
	}

	async function clickCopy() {
		await act(async () => {
			button("Copy Markdown")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}

	it("copies a DuckDB-typed grid as a Markdown table", async () => {
		stubClipboard();
		queryResult = COPY_RESULT;
		mount(BLOCK);
		await settle();
		await clickCopy();

		expect(writes).toEqual([
			"| id | amount | ts | day | blob | note |\n" +
				"| --- | --- | --- | --- | --- | --- |\n" +
				"| 1234567890123 | 3.140 | 2026-10-13T08:30:00.000Z | 2026-10-13 | <blob 4 字节> |  |",
		]);
		// The success label proves the copy path ran; the shared 2s revert is covered by SQLite.
		expect(button("Copied")).toBeTruthy();
	});

	it("copies a value view as the bare scalar (DECIMAL stays formatted)", async () => {
		stubClipboard();
		queryResult = { columns: ["amount"], rows: [["3.140"]], truncated: false, elapsedMs: 2, dbPath: "x" };
		mount(`${BLOCK}\nview: value`);
		await settle();
		await clickCopy();

		expect(writes).toEqual(["3.140"]);
	});

	it("reports the failure instead of silently doing nothing", async () => {
		stubClipboard();
		(globalThis as { navigator: Navigator }).navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
		(globalThis as unknown as { document: { execCommand: (command: string) => boolean } }).document.execCommand = () =>
			false;
		mount(BLOCK);
		await settle();

		await act(async () => {
			button("Copy Markdown")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(button("Copy failed")).toBeTruthy();
	});

	it("hides the button when there is nothing to copy", async () => {
		stubClipboard();
		queryResult = { ...RESULT, rows: [] };
		mount(BLOCK);
		await settle();

		expect(button("Copy Markdown")).toBeUndefined();
	});
});

describe("DuckdbQueryBlock Export CSV (BACK-781)", () => {
	it("fetches the CSV and saves it where the user chose, with no rows leaving the browser", async () => {
		mount(BLOCK);
		await settle();

		await act(async () => {
			button("Export CSV")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		// The rows never leave the browser: the server re-runs `source` + `sql` behind its own gates,
		// so an export request cannot carry a payload to write. The body is strictly those two keys.
		expect(exportBodies).toEqual([{ source: "backlog/databases/shop.duckdb", sql: "SELECT name\nFROM people" }]);
		expect(Object.keys(exportBodies[0] ?? {})).toEqual(["source", "sql"]);
		expect(savedFiles).toEqual([{ name: "shop-20260101-000000.csv", contents: `${UTF8_BOM}name\r\nAlice\r\n` }]);
		// The confirmation names the suggestion, not a server-decided path.
		expect(container?.textContent).toContain("shop-20260101-000000.csv");
	});

	it("reports a refusal instead of pretending it worked", async () => {
		mount(BLOCK);
		await settle();
		globalThis.fetch = (() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "source 指向项目目录之外：../outside/shop.duckdb" }), { status: 400 }),
			)) as unknown as typeof fetch;

		await act(async () => {
			button("Export CSV")?.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(container?.textContent).toContain("Export failed");
		expect(container?.textContent).toContain("source 指向项目目录之外");
	});

	it("hides the button when there is no result to export", async () => {
		queryResult = { ...RESULT, rows: [] };
		mount(BLOCK);
		await settle();

		expect(button("Export CSV")).toBeUndefined();
	});
});
