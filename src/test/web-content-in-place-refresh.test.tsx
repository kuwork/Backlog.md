import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Document, DocsTreeNode, Decision, SearchResult, WikiTreeNode } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const makeDoc = (id: string, title: string): Document => ({
	id,
	title,
	type: "other",
	rawContent: `${title} body`,
	contentHash: `hash-${id}`,
});

const makeDecision = (id: string, title: string): Decision => ({
	id,
	title,
	date: "2026-09-24",
	status: "proposed",
	context: "context",
	decision: "decision",
	consequences: "consequences",
	rawContent: `${title} body`,
});

const defaultConfig = {
	projectName: "Content in-place QA",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
};

let documents: Document[] = [];
let decisions: Decision[] = [];
let docsTreeData: DocsTreeNode[] = [];
let wikiTreeData: WikiTreeNode[] = [];
let requestLog: string[] = [];

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
const originalResizeObserver = globalThis.ResizeObserver;
const originalEvent = globalThis.Event;
const originalCustomEvent = globalThis.CustomEvent;
const originalElement = globalThis.Element;
const originalHTMLElement = globalThis.HTMLElement;
const originalNode = globalThis.Node;
const originalMutationObserver = globalThis.MutationObserver;

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];
	readyState = FakeWebSocket.OPEN;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;

	constructor() {
		FakeWebSocket.instances.push(this);
	}

	deliver(data: string) {
		if (!this.onmessage) throw new Error(`Cannot deliver ${data}: WebSocket message handler is not installed`);
		this.onmessage({ data });
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}
}

/**
 * The app opens more than one socket (the health check does too), so the data one is the open socket
 * whose `onmessage` handler is installed - the health socket never sets one.
 */
const getAppDataWebSocket = (): FakeWebSocket => {
	const socket = FakeWebSocket.instances.findLast(
		(candidate) => candidate.readyState === FakeWebSocket.OPEN && candidate.onmessage !== null,
	);
	if (!socket) throw new Error("No live App data WebSocket found");
	return socket;
};

class FakeResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

const respond = async (url: URL): Promise<Response> => {
	if (url.pathname === "/api/status") return json({ initialized: true, projectPath: "/tmp/project" });
	if (url.pathname === "/api/statuses") return json(defaultConfig.statuses);
	if (url.pathname === "/api/config") return json(defaultConfig);
	if (url.pathname === "/api/search") {
		const types = url.searchParams.getAll("type");
		const results: SearchResult[] = [];
		if (types.length === 0 || types.includes("document")) {
			for (const document of documents) results.push({ type: "document", document, score: 1 } as SearchResult);
		}
		if (types.length === 0 || types.includes("decision")) {
			for (const decision of decisions) results.push({ type: "decision", decision, score: 1 } as SearchResult);
		}
		return json(results);
	}
	if (url.pathname === "/api/tasks") return json([]);
	if (url.pathname === "/api/drafts") return json([]);
	if (url.pathname === "/api/milestones") return json([]);
	if (url.pathname === "/api/milestones/archived") return json([]);
	if (url.pathname === "/api/wiki/tree") return json(wikiTreeData);
	if (url.pathname === "/api/docs/tree") return json(docsTreeData);
	if (url.pathname === "/api/decisions") return json(decisions);
	if (url.pathname === "/api/tasks/duplicate-ids")
		return json({
			groups: [],
			changes: [],
			references: [],
			referenceScanComplete: true,
			blockedReasons: [],
			repairable: false,
		});
	if (url.pathname === "/api/version") return json({ version: "test" });
	return json([]);
};

const installFetchMock = () => {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		const url = new URL(value, window.location.origin);
		requestLog.push(url.pathname);
		return respond(url);
	}) as typeof fetch;
};

const setupDom = (path: string) => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document;
	globalThis.navigator = activeDom.window.navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
	globalThis.Event = activeDom.window.Event;
	globalThis.CustomEvent = activeDom.window.CustomEvent;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.Node = activeDom.window.Node;
	// react-tooltip observes the head from the same window, so the constructor has to come from it.
	globalThis.MutationObserver = activeDom.window.MutationObserver as unknown as typeof MutationObserver;
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

	window.matchMedia = () =>
		({
			matches: false,
			media: "",
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
	window.scrollTo = () => {};
	window.confirm = () => true;
	installFetchMock();
};

const waitFor = async (predicate: () => boolean, description: string) => {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
	throw new Error(`Timed out waiting for ${description}`);
};

const settle = async () => {
	await act(async () => {
		for (let turn = 0; turn < 5; turn++) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
	});
};

/** The board is the index route, so the app opens on it without a redirect. */
const renderBoard = async (path = "/"): Promise<HTMLElement> => {
	setupDom(path);
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
		// The provider stack the web entry mounts, so the test drives the same app the browser does.
		activeRoot?.render(
			<StrictMode>
				<I18nProvider>
					<HealthCheckProvider>
						<App />
					</HealthCheckProvider>
				</I18nProvider>
			</StrictMode>,
		);
		await Promise.resolve();
	});
	await waitFor(() => (container.textContent ?? "").includes("Content in-place QA"), "initial shell content");
	await settle();
	requestLog = [];
	return container;
};

const requestedPaths = () => Array.from(new Set(requestLog)).sort();

/** The innermost element whose text is exactly the given string. */
const exactTextNode = (container: HTMLElement, text: string): Element | undefined =>
	Array.from(container.querySelectorAll("*"))
		.filter((node) => node.textContent === text)
		.at(-1);

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	FakeWebSocket.instances = [];
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	globalThis.ResizeObserver = originalResizeObserver;
	globalThis.Event = originalEvent;
	globalThis.CustomEvent = originalCustomEvent;
	globalThis.Element = originalElement;
	globalThis.HTMLElement = originalHTMLElement;
	globalThis.Node = originalNode;
	globalThis.MutationObserver = originalMutationObserver;
	activeDom = null;
	documents = [];
	decisions = [];
	docsTreeData = [];
	wikiTreeData = [];
	requestLog = [];
});

describe("in-place content-entity refresh", () => {
	it("refreshes documentation and its tree in place on documents-updated", async () => {
		const stableNode: DocsTreeNode = { name: "Stable-doc.md", path: "Stable-doc.md", type: "file", docId: "doc-1", docTitle: "Stable doc" };
		documents = [makeDoc("doc-1", "Stable doc")];
		docsTreeData = [stableNode];
		const container = await renderBoard();
		const stableBefore = exactTextNode(container, "Stable doc");
		expect(stableBefore).toBeTruthy();

		documents = [makeDoc("doc-1", "Stable doc"), makeDoc("doc-2", "Brand new doc")];
		docsTreeData = [stableNode, { name: "New-doc.md", path: "New-doc.md", type: "file", docId: "doc-2", docTitle: "Brand new doc" }];
		await act(async () => {
			getAppDataWebSocket().deliver("documents-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Brand new doc"), "externally created document");
		await settle();

		// Only the documentation corpus and its tree are refetched: no decisions, wiki,
		// milestone or duplicate-plan burst, and no statuses/config reload.
		expect(requestedPaths()).toEqual(["/api/docs/tree", "/api/search"]);
		// The unchanged document kept its DOM node: the sidebar updated in place.
		const stableAfter = exactTextNode(container, "Stable doc");
		expect(stableAfter).toBe(stableBefore);
	});

	it("does not touch other entity lists when a document changes", async () => {
		documents = [makeDoc("doc-1", "Only doc")];
		docsTreeData = [{ name: "Only-doc.md", path: "Only-doc.md", type: "file", docId: "doc-1", docTitle: "Only doc" }];
		decisions = [makeDecision("decision-1", "Only decision")];
		wikiTreeData = [{ name: "page.md", path: "page.md", type: "file", title: "Only page" }];
		const container = await renderBoard();
		await settle();
		requestLog = [];

		// An unchanged echo still refetches exactly the document scope, and never the others.
		await act(async () => {
			getAppDataWebSocket().deliver("documents-updated");
		});
		await settle();
		expect(requestedPaths()).toEqual(["/api/docs/tree", "/api/search"]);
		expect(container.textContent ?? "").toContain("Only decision");
		expect(container.textContent ?? "").toContain("Only page");
	});

	it("refreshes the decisions list in place on decisions-updated", async () => {
		const container = await renderBoard();

		decisions = [makeDecision("decision-90", "Externally added decision")];
		await act(async () => {
			getAppDataWebSocket().deliver("decisions-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Externally added decision"), "externally created decision");
		await settle();

		expect(requestedPaths()).toEqual(["/api/decisions"]);
	});

	it("refreshes the wiki tree in place on wikis-updated", async () => {
		const container = await renderBoard();

		wikiTreeData = [{ name: "New-page.md", path: "New-page.md", type: "file", title: "Externally added page" }];
		await act(async () => {
			getAppDataWebSocket().deliver("wikis-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Externally added page"), "externally created wiki page");
		await settle();

		expect(requestedPaths()).toEqual(["/api/wiki/tree"]);
	});
});
