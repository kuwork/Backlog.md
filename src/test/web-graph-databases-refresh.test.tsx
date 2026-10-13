import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import GraphDatabases from "../web/components/GraphDatabases.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { GraphDatabaseSummary } from "../web/lib/api.ts";

/**
 * The databases table reports the corpus graph's row counts, and the corpus graph lives in the
 * server process: it changes without a reload. These tests pin both halves - the counts shown are
 * the ones the API returned (no "rebuild" placeholder), and a graph-updated broadcast (a bumped
 * graphVersion) refetches them instead of leaving a stale number on screen.
 */

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

function databasesPayload(nodes: number, edges: number): { databases: GraphDatabaseSummary[] } {
	return {
		databases: [
			{
				name: "default",
				kind: "derived",
				description: "markdown 语料",
				createdAt: null,
				updatedAt: null,
				nodes,
				edges,
			},
			{
				name: "demo",
				kind: "user",
				description: "demo data",
				createdAt: "2026-10-13T00:00:00.000Z",
				updatedAt: "2026-10-13T00:00:00.000Z",
				nodes: 2,
				edges: 0,
			},
		],
	};
}

/** Serve `/api/graph/databases` from a queue of responses so a refetch is observable. */
function stubFetch(responses: Array<{ nodes: number; edges: number } | "fail">) {
	const calls: string[] = [];
	let index = 0;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		if (url.includes("/api/config")) return new Response(JSON.stringify({ locale: "en" }), { status: 200 });
		if (url.includes("/api/graph/databases")) {
			const next = responses[Math.min(index, responses.length - 1)] ?? "fail";
			index++;
			if (next === "fail") return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
			return new Response(JSON.stringify(databasesPayload(next.nodes, next.edges)), { status: 200 });
		}
		return new Response(JSON.stringify({}), { status: 200 });
	}) as unknown as typeof fetch;
	return {
		calls,
		count: () => calls.filter((url) => url.includes("/api/graph/databases")).length,
	};
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
	// React's legacy input-event polyfill calls attachEvent/detachEvent, which jsdom does not
	// implement; stub them like the other component tests do.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") htmlElementPrototype.attachEvent = () => {};
	if (typeof htmlElementPrototype.detachEvent !== "function") htmlElementPrototype.detachEvent = () => {};
	for (const name of ["SVGElement", "HTMLElement", "Element", "Node", "MouseEvent"] as const) {
		const value = (dom.window as unknown as Record<string, unknown>)[name];
		if (value) (globalThis as Record<string, unknown>)[name] = value;
	}
	return dom;
}

/** The cells of the database row named `name`, in column order. */
function rowCells(name: string): string[] {
	const rows = [...document.querySelectorAll("tbody tr")];
	const row = rows.find((candidate) => candidate.querySelector("td")?.textContent?.trim() === name);
	if (!row) throw new Error(`row ${name} not found`);
	return [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? "");
}

function pageText(): string {
	return document.getElementById("root")?.textContent ?? "";
}

describe("databases table counts (BACK-771 follow-up)", () => {
	let root: Root | null = null;
	const origError = console.error;

	async function mount(node: React.ReactNode) {
		const container = document.getElementById("root") as HTMLElement;
		console.error = () => {};
		try {
			root = createRoot(container);
			await act(async () => {
				root?.render(
					<MemoryRouter>
						<I18nProvider initialLocale="en">{node}</I18nProvider>
					</MemoryRouter>,
				);
			});
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 30));
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
	});

	it("shows the counts the API returned for `default`, not a placeholder", async () => {
		setupDom();
		stubFetch([{ nodes: 12, edges: 34 }]);
		await mount(<GraphDatabases />);

		expect(rowCells("default").slice(3)).toEqual(["12", "34"]);
		expect(rowCells("demo").slice(3)).toEqual(["2", "0"]);
	});

	it("refetches the counts when the shell bumps graphVersion", async () => {
		setupDom();
		const fetcher = stubFetch([
			{ nodes: 12, edges: 34 },
			{ nodes: 15, edges: 40 },
		]);
		await mount(<GraphDatabases graphVersion={0} />);
		expect(rowCells("default").slice(3)).toEqual(["12", "34"]);
		expect(fetcher.count()).toBe(1);

		// A graph-updated broadcast: the shell bumps the version and the table follows.
		await act(async () => {
			root?.render(
				<MemoryRouter>
					<I18nProvider initialLocale="en">
						<GraphDatabases graphVersion={1} />
					</I18nProvider>
				</MemoryRouter>,
			);
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(fetcher.count()).toBe(2);
		expect(rowCells("default").slice(3)).toEqual(["15", "40"]);
	});

	it("keeps the table when a refresh fails, instead of blanking a populated page", async () => {
		setupDom();
		stubFetch([{ nodes: 12, edges: 34 }, "fail"]);
		await mount(<GraphDatabases graphVersion={0} />);

		await act(async () => {
			root?.render(
				<MemoryRouter>
					<I18nProvider initialLocale="en">
						<GraphDatabases graphVersion={1} />
					</I18nProvider>
				</MemoryRouter>,
			);
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(rowCells("default").slice(3)).toEqual(["12", "34"]); // stale, but not gone
	});

	it("offers the schema procedures as one-click statements, next to the CLI hint", async () => {
		setupDom();
		stubFetch([{ nodes: 12, edges: 34 }]);
		await mount(<GraphDatabases />);

		expect(pageText()).toContain("backlog graph schema");
		const chips = [...document.querySelectorAll("button")].filter((button) =>
			(button.textContent ?? "").startsWith("CALL "),
		);
		expect(chips.map((chip) => chip.textContent)).toEqual([
			"CALL show_tables() RETURN name, type",
			"CALL table_info('FileNode') RETURN name, type, `primary key`",
		]);

		// Clicking a chip loads it into the statement box rather than running it: the user keeps the
		// last word on what executes.
		const first = chips[0] as HTMLButtonElement;
		await act(async () => {
			first.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
		expect((document.querySelector("#database-cypher") as HTMLTextAreaElement).value).toBe(
			"CALL show_tables() RETURN name, type",
		);
	});

	it("describes `default` as a warm in-process graph rather than a per-query rebuild", async () => {
		setupDom();
		stubFetch([{ nodes: 12, edges: 34 }]);
		await mount(<GraphDatabases />);

		// Selecting `default` is what reveals the note (the initial selection is a user database).
		const defaultRow = [...document.querySelectorAll("tbody tr")].find(
			(candidate) => candidate.querySelector("td")?.textContent?.trim() === "default",
		) as HTMLElement;
		await act(async () => {
			defaultRow.click();
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		const text = pageText();
		expect(text).toContain("never rebuild");
		expect(text).not.toContain("takes a few seconds");
	});
});
