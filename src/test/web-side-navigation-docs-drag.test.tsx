import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { DocsTreeNode, Document as DocumentEntry } from "../types/index.ts";
import SideNavigation from "../web/components/SideNavigation";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const DOC_DRAG_TYPE = "application/x-backlog-document";
const LONG_DOC_TITLE = "差异化运营机制横向差距分析：七层模型与五个缺口（完整版）";
const originalFetch = globalThis.fetch;
let activeRoot: Root | null = null;
let refreshCount = 0;
let getCount = 0;
let putCount = 0;
let putPayload: Record<string, unknown> | null = null;
let failUpdate = false;

const docs: DocumentEntry[] = [
	{
		id: "doc-3",
		title: "Mike log",
		type: "other",
		createdDate: "2026-01-01",
		rawContent: "Root document body",
		path: "doc-3 - mike.md",
	},
	{
		id: "notes",
		title: "Xray page",
		type: "other",
		createdDate: "2026-01-02",
		rawContent: "Nested document body",
		path: "prd/notes.md",
	},
	{
		id: "doc-long",
		title: LONG_DOC_TITLE,
		type: "other",
		createdDate: "2026-01-03",
		rawContent: "Long document body",
		path: "doc-long.md",
	},
];

const docsTree: DocsTreeNode[] = [
	{
		name: "prd",
		path: "prd",
		type: "directory",
		children: [{ name: "notes.md", path: "prd/notes.md", type: "file", docId: "notes" }],
	},
	{ name: "migration", path: "migration", type: "directory", children: [] },
	{ name: "doc-3 - mike.md", path: "doc-3 - mike.md", type: "file", docId: "doc-3" },
	{ name: "doc-long.md", path: "doc-long.md", type: "file", docId: "doc-long" },
];

const setupDom = (): HTMLElement => {
	const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as globalThis.Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Event = dom.window.Event as typeof Event;
	globalThis.CustomEvent = dom.window.CustomEvent as typeof CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as typeof MutationObserver;
	return dom.window.document.getElementById("root") as HTMLElement;
};

const renderNavigation = (sidebarWidth?: number): HTMLElement => {
	const container = setupDom();
	localStorage.setItem("docsExpandedPaths", JSON.stringify(["prd"]));
	if (sidebarWidth !== undefined) localStorage.setItem("sideNavWidth", String(sidebarWidth));
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<I18nProvider initialLocale="en">
					<SideNavigation
						tasks={[]}
						docs={docs}
						docsTree={docsTree}
						decisions={[]}
						wikiTree={[]}
						isLoading={false}
						onRefreshData={async () => {
							refreshCount += 1;
						}}
					/>
				</I18nProvider>
			</MemoryRouter>,
		);
	});
	return container;
};

const createDataTransfer = () => {
	const store = new Map<string, string>();
	const dataTransfer = {
		types: [] as string[],
		effectAllowed: "uninitialized",
		dropEffect: "none",
		setData(type: string, value: string) {
			store.set(type, value);
			if (!this.types.includes(type)) this.types.push(type);
		},
		getData(type: string) {
			return store.get(type) ?? "";
		},
	};
	return dataTransfer as unknown as DataTransfer;
};

const dispatchDrag = (element: Element, type: string, dataTransfer: DataTransfer) => {
	const event = new window.MouseEvent(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
	element.dispatchEvent(event);
};

const drag = (element: Element, type: string, dataTransfer: DataTransfer) => {
	act(() => {
		dispatchDrag(element, type, dataTransfer);
	});
};

const drop = async (element: Element, dataTransfer: DataTransfer) => {
	await act(async () => {
		dispatchDrag(element, "drop", dataTransfer);
		await Promise.resolve();
		await Promise.resolve();
	});
};

const dragHandle = (container: HTMLElement, title: string): HTMLButtonElement => {
	const handle = container.querySelector(`button[aria-label="Drag to move document: ${title}"]`);
	if (!handle) throw new Error(`No drag handle for ${title}`);
	return handle as HTMLButtonElement;
};

const dropTarget = (container: HTMLElement, path: string): HTMLElement => {
	const target = container.querySelector(`[data-docs-drop-target="${path}"]`);
	if (!target) throw new Error(`No drop target for ${path || "root"}`);
	return target as HTMLElement;
};

beforeEach(() => {
	refreshCount = 0;
	getCount = 0;
	putCount = 0;
	putPayload = null;
	failUpdate = false;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const match = url.match(/^\/api\/docs\/([^/]+)$/);
		if (!match) throw new Error(`Unexpected fetch: ${url}`);
		const docId = decodeURIComponent(match[1] ?? "");
		const doc = docs.find((candidate) => candidate.id === docId);
		if (!doc) throw new Error(`Unexpected document: ${docId}`);

		if (init?.method === "PUT") {
			putCount += 1;
			putPayload = JSON.parse(String(init.body)) as Record<string, unknown>;
			if (failUpdate) {
				return new Response(JSON.stringify({ error: "Move rejected" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(JSON.stringify({ ...doc, path: putPayload.path }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		getCount += 1;
		return new Response(JSON.stringify(doc), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}) as unknown as typeof fetch;
});

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe("SideNavigation document drag and drop", () => {
	it("shows a hover handle and makes only the handle draggable", () => {
		const container = renderNavigation();
		const handle = dragHandle(container, "Mike log");
		const link = handle.parentElement?.querySelector("a");

		expect(handle.getAttribute("draggable")).toBe("true");
		expect(handle.className).toContain("opacity-0");
		expect(handle.className).toContain("group-hover/file:opacity-100");
		expect(link?.getAttribute("draggable")).toBeNull();

		const dataTransfer = createDataTransfer();
		if (link) drag(link, "dragstart", dataTransfer);
		expect(dataTransfer.getData(DOC_DRAG_TYPE)).toBe("");
	});

	it("keeps a long document handle floating inside a narrow sidebar", () => {
		const container = renderNavigation(180);
		const handle = dragHandle(container, LONG_DOC_TITLE);
		const link = handle.parentElement?.querySelector("a");

		expect(handle.className).toContain("absolute");
		expect(handle.className).toContain("right-1");
		expect(handle.className).toContain("bg-gray-50/95");
		expect(link?.className).toContain("min-w-0");
	});

	it("moves a root document into a folder without changing its content", async () => {
		const container = renderNavigation();
		const dataTransfer = createDataTransfer();
		const target = dropTarget(container, "migration");

		drag(dragHandle(container, "Mike log"), "dragstart", dataTransfer);
		drag(target, "dragover", dataTransfer);
		expect(target.className).toContain("ring-2");
		expect(dataTransfer.dropEffect).toBe("move");
		await drop(target, dataTransfer);

		expect(getCount).toBe(1);
		expect(putCount).toBe(1);
		expect(putPayload).toEqual({ content: "Root document body", path: "migration" });
		expect(refreshCount).toBe(1);
		expect(target.className).not.toContain("ring-2");
	});

	it("moves a nested document to the docs root through the section title", async () => {
		const container = renderNavigation();
		const dataTransfer = createDataTransfer();
		const target = dropTarget(container, "");

		drag(dragHandle(container, "Xray page"), "dragstart", dataTransfer);
		drag(target, "dragover", dataTransfer);
		expect(target.className).toContain("ring-2");
		await drop(target, dataTransfer);

		expect(putPayload).toEqual({ content: "Nested document body", path: "" });
		expect(refreshCount).toBe(1);
	});

	it("does nothing when dropped into the current folder", async () => {
		const container = renderNavigation();
		const dataTransfer = createDataTransfer();

		drag(dragHandle(container, "Xray page"), "dragstart", dataTransfer);
		await drop(dropTarget(container, "prd"), dataTransfer);

		expect(getCount).toBe(0);
		expect(putCount).toBe(0);
		expect(refreshCount).toBe(0);
	});

	it("ignores invalid drops and clears target feedback when dragging ends", () => {
		const container = renderNavigation();
		const dataTransfer = createDataTransfer();
		const handle = dragHandle(container, "Mike log");
		const target = dropTarget(container, "migration");

		drag(handle, "dragstart", dataTransfer);
		drag(target, "dragover", dataTransfer);
		expect(target.className).toContain("ring-2");
		drag(document.body, "drop", dataTransfer);
		drag(handle, "dragend", dataTransfer);

		expect(target.className).not.toContain("ring-2");
		expect(getCount).toBe(0);
		expect(putCount).toBe(0);
		expect(refreshCount).toBe(0);
	});

	it("keeps the tree unchanged and shows an error when moving fails", async () => {
		failUpdate = true;
		const container = renderNavigation();
		const dataTransfer = createDataTransfer();

		drag(dragHandle(container, "Mike log"), "dragstart", dataTransfer);
		await drop(dropTarget(container, "migration"), dataTransfer);

		expect(putCount).toBe(1);
		expect(refreshCount).toBe(0);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Move rejected");
		expect(dragHandle(container, "Mike log")).toBeTruthy();
	});
});
