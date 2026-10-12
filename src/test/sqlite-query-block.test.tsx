import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UTF8_BOM } from "../sqlite/csv.ts";
import SqliteQueryBlock from "../web/components/SqliteQueryBlock.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

interface FakeWritable {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}
interface FakeHandle {
	createWritable(): Promise<FakeWritable>;
}

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

const RESULT = {
	columns: ["name"],
	rows: [["Alice"]],
	truncated: false,
	elapsedMs: 3,
	dbPath: "backlog/databases/shop.sqlite",
};

const BLOCK = ["source: backlog/databases/shop.sqlite", "sql: |", "  SELECT name", "  FROM people"].join("\n");

const BROKEN_BLOCK = ["source: backlog/databases/shop.sqlite", "  sql: SELECT name"].join("\n");

let root: Root | null = null;
let container: HTMLElement | null = null;
let queryCalls = 0;
/** Swapped per test: the payload the faked query endpoint answers with. */
let queryResult: unknown = RESULT;
/** Every export request body, so the "no rows travel to the server" rule can be asserted. */
const exportBodies: Record<string, unknown>[] = [];
/** Every file the stubbed save dialog actually handed to a writable, so the write can be asserted. */
const savedFiles: { name: string; contents: string }[] = [];

function mount(block: string) {
	act(() => {
		root?.render(
			<I18nProvider initialLocale="en">
				<SqliteQueryBlock block={block} />
			</I18nProvider>,
		);
	});
}

/** Let the query promise settle and React flush the result. */
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
}

function toggle(): HTMLButtonElement {
	const buttons = Array.from(container?.querySelectorAll("button") ?? []);
	return buttons.find((button) => /query/i.test(button.textContent ?? "")) as HTMLButtonElement;
}

function button(label: string): HTMLButtonElement {
	return Array.from(container?.querySelectorAll("button") ?? []).find(
		(candidate) => candidate.textContent === label,
	) as HTMLButtonElement;
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
		if (url.includes("/api/sqlite/export-csv")) {
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
		if (url.includes("/api/sqlite/query")) {
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
	(globalThis as { window?: typeof window }).window = originalWindowGlobal;
	(globalThis as { document?: Document }).document = originalDocumentGlobal;
	(globalThis as { navigator?: Navigator }).navigator = originalNavigatorGlobal;
	(globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
	globalThis.fetch = originalFetch;
});

describe("SqliteQueryBlock Show/Hide Query", () => {
	it("runs the query once to render rows, and hides the SQL until asked", async () => {
		mount(BLOCK);
		await settle();

		expect(queryCalls).toBe(1);
		expect(container?.textContent).toContain("Alice");
		expect(toggle().textContent).toBe("Show query");
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
		expect(container?.textContent).toContain("backlog/databases/shop.sqlite");
		expect(toggle().textContent).toBe("Hide query");
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
			(button) => button.textContent === "Refresh",
		) as HTMLButtonElement;
		await act(async () => {
			refresh.click();
		});
		await settle();

		// Two calls total (initial + refresh), and the panel survived the reload.
		expect(queryCalls).toBe(2);
		expect(container?.querySelector("pre")?.textContent).toBe("SELECT name\nFROM people");
		expect(toggle().textContent).toBe("Hide query");
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

describe("SqliteQueryBlock Copy Markdown", () => {
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
			button("Copy Markdown").click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}

	it("copies the rendered grid as a Markdown table", async () => {
		stubClipboard();
		mount(BLOCK);
		await settle();
		await clickCopy();

		expect(writes).toEqual(["| name |\n| --- |\n| Alice |"]);
		expect(button("Copied")).toBeTruthy();
	});

	it("copies a value view as the bare scalar", async () => {
		stubClipboard();
		mount(`${BLOCK}\nview: value`);
		await settle();
		await clickCopy();

		expect(writes).toEqual(["Alice"]);
	});

	it("falls back to a textarea when the async clipboard API is missing", async () => {
		// jsdom has no navigator.clipboard, which is also what a non-secure origin looks like.
		mount(BLOCK);
		await settle();

		const seen: string[] = [];
		const originalAppend = document.body.appendChild.bind(document.body);
		(document.body as unknown as { appendChild: (node: Node) => Node }).appendChild = (node: Node) => {
			if ((node as HTMLElement).tagName === "TEXTAREA") seen.push((node as HTMLTextAreaElement).value);
			return originalAppend(node);
		};
		(document as unknown as { execCommand: (command: string) => boolean }).execCommand = () => true;

		await clickCopy();

		(document.body as unknown as { appendChild: (node: Node) => Node }).appendChild = originalAppend;
		expect(seen).toEqual(["| name |\n| --- |\n| Alice |"]);
		expect(button("Copied")).toBeTruthy();
		expect(document.querySelector("textarea")).toBeNull();
	});

	it("reports the failure instead of silently doing nothing", async () => {
		mount(BLOCK);
		await settle();
		(document as unknown as { execCommand: (command: string) => boolean }).execCommand = () => false;

		await clickCopy();

		expect(button("Copy failed")).toBeTruthy();
	});

	it("hides the button when there is nothing to copy", async () => {
		queryResult = { ...RESULT, rows: [] };
		stubClipboard();
		mount(BLOCK);
		await settle();

		expect(button("Copy Markdown")).toBeUndefined();
	});
});

describe("SqliteQueryBlock Export CSV", () => {
	it("fetches the CSV and saves it where the user chose, with no rows leaving the browser", async () => {
		mount(BLOCK);
		await settle();

		await act(async () => {
			button("Export CSV").click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		// The rows never leave the browser: the server re-runs `source` + `sql` behind its own gates,
		// so an export request cannot carry a payload to write.
		expect(exportBodies).toEqual([{ source: "backlog/databases/shop.sqlite", sql: "SELECT name\nFROM people" }]);
		expect(savedFiles).toEqual([{ name: "shop-20260101-000000.csv", contents: `${UTF8_BOM}name\r\nAlice\r\n` }]);
		// The confirmation names the suggestion, not a server-decided path.
		expect(container?.textContent).toContain("shop-20260101-000000.csv");
	});

	it("reports a refusal instead of pretending it worked", async () => {
		mount(BLOCK);
		await settle();
		globalThis.fetch = (() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "source 指向项目目录之外：../outside/shop.sqlite" }), { status: 400 }),
			)) as unknown as typeof fetch;

		await act(async () => {
			button("Export CSV").click();
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
