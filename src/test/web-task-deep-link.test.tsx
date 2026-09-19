import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SearchResult, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const TASK_ID = "BACK-411";
const TASK_TITLE = "Prototype a Codex plugin for Backlog binary and MCP";
const TASK_SLUG = "prototype-a-codex-plugin-for-backlog-binary-and-mcp";
const DEEP_LINK_PATH = `/task/411/${TASK_SLUG}`;
const UNKNOWN_DEEP_LINK_PATH = "/task/999/no-such-task";
const STATUSES = ["To Do", "In Progress", "Done"];

/** A progress message the server actually emits; the sidebar and board both render it verbatim. */
const LOADING_MESSAGE = "Fetching remote branches...";

/** The health-check socket connects on a 100ms timer, so a flush has to outlast it. */
const SOCKET_HANDSHAKE_MS = 150;

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

let activeRoot: Root | null = null;

/** Sockets the app opened; the test drives them the way the server would. */
const sockets: StubSocket[] = [];

/** Resolves the first `/api/search`; held open to model a slow first load. */
let searchGate: Promise<void> = Promise.resolve();
let releaseSearch: () => void = () => {};

/**
 * `/api/tasks/duplicate-ids` is awaited after the search lands and before `loadAllData` marks the
 * first load complete, and the real endpoint can take over a second. Held open separately so the
 * test can reproduce the app being fully rendered with data while the load is still unfinished.
 */
let duplicateIdsGate: Promise<void> = Promise.resolve();
let releaseDuplicateIds: () => void = () => {};

/** Served by `/api/search` once the gate opens. */
let searchResults: SearchResult[] = [];

/** Keeps the first `/api/search` pending until `releaseSearch()` is called. */
function holdSearchOpen(): void {
	searchGate = new Promise<void>((resolve) => {
		releaseSearch = resolve;
	});
}

/** Keeps the duplicate-id preview pending until `releaseDuplicateIds()` is called. */
function holdDuplicateIdsOpen(): void {
	duplicateIdsGate = new Promise<void>((resolve) => {
		releaseDuplicateIds = resolve;
	});
}

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function openTask(): Task {
	return {
		id: TASK_ID,
		title: TASK_TITLE,
		status: "In Progress",
		assignee: ["@dsv4flash"],
		createdDate: "2026-08-01 10:00",
		labels: [],
		dependencies: [],
	};
}

class StubSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readyState = StubSocket.OPEN;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;

	constructor() {
		sockets.push(this);
	}

	send(): void {}
	close(): void {
		this.readyState = StubSocket.CLOSED;
	}
}

/** Delivers a frame to every socket, the way `publishBrowserLoadingState` broadcasts. */
async function broadcast(frame: Record<string, unknown>): Promise<void> {
	await act(async () => {
		for (const socket of sockets) {
			socket.onmessage?.({ data: JSON.stringify(frame) });
		}
	});
}

function setupDom(path: string): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	// The board re-renders through react-tooltip, which dispatches DOM events and watches the
	// tree; both have to come from the same realm as the window they act on.
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof globalThis.CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof globalThis.MutationObserver;
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	} as unknown as typeof globalThis.ResizeObserver;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

/** Serves the collections the app loads; `/api/search` waits on the gate so the first load is slow. */
function serveApi(): void {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const path = new URL(raw, "http://localhost").pathname;

		if (path === "/api/status") return json({ initialized: true });
		if (path === "/api/version") return json({ version: "1.52.0" });
		if (path === "/api/statuses") return json(STATUSES);
		if (path === "/api/config") {
			return json({
				projectName: "Backlog.md",
				labels: [],
				statuses: STATUSES,
				locale: "en",
				definitionOfDone: [],
				maxColumnWidth: 20,
				dateFormat: "yyyy-mm-dd",
			});
		}
		if (path === "/api/tasks/duplicate-ids") {
			await duplicateIdsGate;
			return json({ groups: [] });
		}
		if (path === "/api/search") {
			await searchGate;
			return json(searchResults);
		}
		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

/** Lets pending promises and the app's own timers settle inside `act`. */
async function flush(milliseconds = 0): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, milliseconds));
	});
}

async function renderApp(path: string): Promise<void> {
	const container = setupDom(path);
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>
			</I18nProvider>,
		);
	});
}

function dialogText(): string {
	const dialog = document.querySelector('[role="dialog"]');
	return dialog ? (dialog.textContent ?? "") : "";
}

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	sockets.length = 0;
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
});

describe("task deep links", () => {
	it("opens the linked task when the server loaded frame beats the first search", async () => {
		holdSearchOpen();
		holdDuplicateIdsOpen();
		searchResults = [{ type: "task", score: null, task: openTask() }];
		serveApi();

		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp(DEEP_LINK_PATH);
		await flush(SOCKET_HANDSHAKE_MS);

		// The server replays its own loading state on socket open. At this point the app is
		// initialized but its first /api/search has not resolved, so the task list is still empty.
		await broadcast({ type: "loaded" });
		await flush();

		expect(window.location.pathname).toBe(DEEP_LINK_PATH);

		// The search lands, so the task list is populated, but loadAllData is still waiting on the
		// duplicate-id preview and has not marked the first load complete.
		releaseSearch();
		await flush();
		expect(window.location.pathname).toBe(DEEP_LINK_PATH);

		releaseDuplicateIds();
		await flush();

		expect(window.location.pathname).toBe(DEEP_LINK_PATH);
		expect(dialogText()).toContain(TASK_TITLE);
	});

	it("still replaces an unknown deep link with the board once the first load completes", async () => {
		searchGate = Promise.resolve();
		duplicateIdsGate = Promise.resolve();
		searchResults = [{ type: "task", score: null, task: openTask() }];
		serveApi();

		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp(UNKNOWN_DEEP_LINK_PATH);
		await flush(SOCKET_HANDSHAKE_MS);
		await flush();

		expect(window.location.pathname).toBe("/");
	});

	it("keeps driving the loading indicator from the socket frames", async () => {
		holdSearchOpen();
		holdDuplicateIdsOpen();
		searchResults = [{ type: "task", score: null, task: openTask() }];
		serveApi();

		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp(DEEP_LINK_PATH);
		await flush(SOCKET_HANDSHAKE_MS);

		await broadcast({ type: "loading", message: LOADING_MESSAGE });
		await flush();
		expect(document.body.textContent).toContain(LOADING_MESSAGE);

		await broadcast({ type: "loaded" });
		await flush();
		expect(document.body.textContent).not.toContain(LOADING_MESSAGE);

		releaseSearch();
		releaseDuplicateIds();
		await flush();
	});
});
