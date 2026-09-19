import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const TASK_ID = "BACK-411";
const TASK_TITLE = "Prototype a Codex plugin for Backlog binary and MCP";
const TASK_SLUG = "prototype-a-codex-plugin-for-backlog-binary-and-mcp";
const TASK_PATH = `/task/411/${TASK_SLUG}`;
const UNKNOWN_TASK_PATH = "/task/999/no-such-task";
const STATUSES = ["To Do", "In Progress", "Done"];

/** The health-check socket connects on a 100ms timer, so a flush has to outlast it. */
const SOCKET_HANDSHAKE_MS = 150;

/** A completed record: alive in backlog/completed, absent from the board corpus by design. */
const completedTask: Task = {
	id: TASK_ID,
	title: TASK_TITLE,
	status: "Done",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [],
	source: "completed",
};

const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

let activeRoot: Root | null = null;
const sockets: StubSocket[] = [];

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

async function broadcast(frame: Record<string, unknown>): Promise<void> {
	await act(async () => {
		for (const socket of sockets) {
			socket.onmessage?.({ data: JSON.stringify(frame) });
		}
	});
}

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function setupDom(path: string): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
	globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof globalThis.CustomEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof globalThis.MutationObserver;
	globalThis.ResizeObserver = class {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	} as unknown as typeof globalThis.ResizeObserver;
	// React's change-event polyfill probes for attachEvent/detachEvent on the element prototype.
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: unknown;
		detachEvent?: unknown;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
		htmlElementPrototype.detachEvent = () => {};
	}
	if (!window.matchMedia) {
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

/**
 * Serves the collections the app loads. The board corpus intentionally stays empty: the
 * completed record exists only as the navigation payload, the way the search dialog
 * widened-corpus flow delivers it.
 */
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
		if (path === "/api/tasks/duplicate-ids") return json({ groups: [] });
		if (path === "/api/search") return json([]);
		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

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

/** Drives a history navigation the way react-router observes it: v5-compat state wrapper first, then popstate. */
async function navigateHistory(path: string, state: unknown): Promise<void> {
	await act(async () => {
		window.history.pushState({ usr: state, key: `test-${Date.now()}`, idx: 99 }, "", path);
		window.dispatchEvent(new window.PopStateEvent("popstate"));
	});
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

describe("completed task opened from the widened search corpus", () => {
	it("opens the modal from the record carried in the navigation state", async () => {
		serveApi();
		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp("/search?q=plugin");
		await flush(SOCKET_HANDSHAKE_MS);
		await broadcast({ type: "loaded" });
		await flush();

		await navigateHistory(TASK_PATH, {
			backgroundLocation: { pathname: "/search", search: "?q=plugin", hash: "", state: null },
			preloadedTask: completedTask,
		});
		await flush();

		expect(window.location.pathname).toBe(TASK_PATH);
		expect(document.body.textContent).toContain(TASK_TITLE);
	});

	it("still falls back to the board for an unknown id without a preloaded record", async () => {
		serveApi();
		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp("/search?q=plugin");
		await flush(SOCKET_HANDSHAKE_MS);
		await broadcast({ type: "loaded" });
		await flush();

		await navigateHistory(UNKNOWN_TASK_PATH, {
			backgroundLocation: { pathname: "/search", search: "?q=plugin", hash: "", state: null },
		});
		await flush();

		expect(window.location.pathname).toBe("/");
	});
});
