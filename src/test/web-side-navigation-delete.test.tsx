import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Decision, DocsTreeNode, Document as DocumentEntry } from "../types/index.ts";
import SideNavigation from "../web/components/SideNavigation";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const originalFetch = globalThis.fetch;
const originalConfirm = globalThis.confirm;
let activeRoot: Root | null = null;
let refreshCount = 0;
let deleteRequests: { url: string; method: string; body?: unknown }[] = [];
let confirmCalls: string[] = [];
let confirmResult = true;
let failDelete = false;

const docs: DocumentEntry[] = [
	{
		id: "doc-1",
		title: "Alpha",
		type: "other",
		createdDate: "2026-01-01",
		rawContent: "Alpha body",
		path: "doc-1 - alpha.md",
	},
	{
		id: "doc-2",
		title: "Nested",
		type: "other",
		createdDate: "2026-01-02",
		rawContent: "Nested body",
		path: "guides/nested.md",
	},
];

const decisions: Decision[] = [
	{
		id: "decision-1",
		title: "Use Postgres",
		date: "2026-01-01",
		status: "accepted",
		context: "",
		decision: "",
		consequences: "",
		alternatives: "",
		rawContent: "",
		path: "decision-1 - use-postgres.md",
	},
];

const docsTree: DocsTreeNode[] = [
	{
		name: "guides",
		path: "guides",
		type: "directory",
		children: [{ name: "nested.md", path: "guides/nested.md", type: "file", docId: "doc-2" }],
	},
	{ name: "doc-1 - alpha.md", path: "doc-1 - alpha.md", type: "file", docId: "doc-1" },
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
	dom.window.confirm = ((message?: string) => {
		confirmCalls.push(String(message));
		return confirmResult;
	}) as typeof dom.window.confirm;
	return dom.window.document.getElementById("root") as HTMLElement;
};

const renderNavigation = (): HTMLElement => {
	const container = setupDom();
	localStorage.setItem("docsExpandedPaths", JSON.stringify(["guides"]));
	localStorage.setItem("docsCollapsed", "false");
	localStorage.setItem("decisionsCollapsed", "false");
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<I18nProvider initialLocale="en">
					<SideNavigation
						tasks={[]}
						docs={docs}
						docsTree={docsTree}
						decisions={decisions}
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

const click = async (element: Element) => {
	await act(async () => {
		(element as HTMLElement).click();
		await Promise.resolve();
		await Promise.resolve();
	});
};

const deleteButton = (container: HTMLElement, label: string, title?: string): HTMLButtonElement => {
	const selector = title ? `button[aria-label="${label}: ${title}"]` : `button[aria-label^="${label}:"]`;
	const button = container.querySelector(selector);
	if (!button) throw new Error(`No delete button labeled ${label}${title ? `: ${title}` : ""}`);
	return button as HTMLButtonElement;
};

beforeEach(() => {
	refreshCount = 0;
	deleteRequests = [];
	confirmCalls = [];
	confirmResult = true;
	failDelete = false;
	globalThis.confirm = ((message?: string) => {
		confirmCalls.push(String(message));
		return confirmResult;
	}) as typeof confirm;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		if (method === "DELETE") {
			deleteRequests.push({
				url,
				method,
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			});
			if (failDelete) {
				return new Response(JSON.stringify({ error: "Delete rejected" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(null, { status: 204 });
		}
		return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
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
	globalThis.confirm = originalConfirm;
});

describe("SideNavigation delete actions", () => {
	it("deletes a document from the hover button after confirmation", async () => {
		const container = renderNavigation();
		await click(deleteButton(container, "Delete document", "Alpha"));
		expect(confirmCalls).toHaveLength(1);
		expect(confirmCalls[0]).toContain("Delete");
		expect(deleteRequests).toEqual([{ url: "/api/docs/doc-1", method: "DELETE", body: undefined }]);
		expect(refreshCount).toBe(1);
	});

	it("does not delete a document when confirmation is cancelled", async () => {
		confirmResult = false;
		const container = renderNavigation();
		await click(deleteButton(container, "Delete document"));
		expect(confirmCalls).toHaveLength(1);
		expect(deleteRequests).toHaveLength(0);
		expect(refreshCount).toBe(0);
	});

	it("deletes a decision from the hover button after confirmation", async () => {
		const container = renderNavigation();
		await click(deleteButton(container, "Delete decision"));
		expect(confirmCalls).toHaveLength(1);
		expect(deleteRequests).toEqual([{ url: "/api/decisions/decision-1", method: "DELETE", body: undefined }]);
		expect(refreshCount).toBe(1);
	});

	it("deletes a folder from the + menu after confirmation", async () => {
		const container = renderNavigation();
		const folderRow = container.querySelector('fieldset[data-docs-drop-target="guides"]');
		const plus = folderRow?.querySelector('button[title="Actions"]');
		if (!plus) throw new Error("No folder + menu button");
		await click(plus);
		const deleteFolder = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Delete folder",
		);
		if (!deleteFolder) throw new Error("No delete folder menu item");
		await click(deleteFolder);
		expect(confirmCalls).toHaveLength(1);
		expect(confirmCalls[0]).toContain("guides");
		expect(deleteRequests).toEqual([{ url: "/api/docs/folder", method: "DELETE", body: { path: "guides" } }]);
		expect(refreshCount).toBe(1);
	});

	it("shows an error and skips refresh when deletion fails", async () => {
		failDelete = true;
		const container = renderNavigation();
		await click(deleteButton(container, "Delete document", "Alpha"));
		expect(deleteRequests).toHaveLength(1);
		expect(refreshCount).toBe(0);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Delete rejected");
	});
});
