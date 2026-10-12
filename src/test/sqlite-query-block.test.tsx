import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import SqliteQueryBlock from "../web/components/SqliteQueryBlock.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

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
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("/api/sqlite/query")) {
			queryCalls++;
			const body = init?.body ? JSON.parse(String(init.body)) : {};
			if (body.source === "") {
				return Promise.resolve(new Response(JSON.stringify({ error: "bad" }), { status: 400 }));
			}
			return Promise.resolve(new Response(JSON.stringify(RESULT), { status: 200 }));
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
