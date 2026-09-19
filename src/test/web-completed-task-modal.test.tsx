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

/** A board record: part of the corpus, so its popup has to stay a working surface. */
const ACTIVE_TASK_ID = "BACK-500";
const ACTIVE_TASK_TITLE = "An active board task";
const activeTask: Task = {
	id: ACTIVE_TASK_ID,
	title: ACTIVE_TASK_TITLE,
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [],
};

/** Merged in from another branch: read-only like a completed record, but for a different reason. */
const CROSS_BRANCH_TASK_ID = "BACK-501";
const CROSS_BRANCH_TASK_TITLE = "A task from another branch";
const crossBranchTask: Task = {
	id: CROSS_BRANCH_TASK_ID,
	title: CROSS_BRANCH_TASK_TITLE,
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [],
	branch: "feature/other",
};

/** A board record whose predecessor has already moved to backlog/completed. */
const SUCCESSOR_TASK_ID = "BACK-502";
const SUCCESSOR_TASK_TITLE = "A task that depends on a completed record";
const successorTask: Task = {
	id: SUCCESSOR_TASK_ID,
	title: SUCCESSOR_TASK_TITLE,
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-01 10:00",
	labels: [],
	dependencies: [TASK_ID],
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
 * Serves the collections the app loads. The board corpus is whatever the caller passes; the
 * completed record exists only as the navigation payload, the way the search dialog
 * widened-corpus flow delivers it.
 */
function serveApi(boardTasks: Task[] = [], singleRecords: Task[] = [], completedRecords: Task[] = []): void {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const url = new URL(raw, "http://localhost");
		const path = url.pathname;

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
		if (path === "/api/search") {
			// A widened corpus answers with the board tasks too, the way the real endpoint does.
			const includeCompleted = url.searchParams.get("completed") === "true";
			const corpus = includeCompleted ? [...boardTasks, ...completedRecords] : boardTasks;
			return json(corpus.map((task) => ({ type: "task", task })));
		}
		if (path.startsWith("/api/task/")) {
			const requestedId = path.slice("/api/task/".length);
			const record = singleRecords.find((task) => task.id === requestedId);
			return record ? json(record) : json([]);
		}
		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

/** The action buttons render their label as the button text, so this is the reliable probe. */
function buttonWithText(label: string): HTMLButtonElement | undefined {
	return Array.from(document.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === label,
	) as HTMLButtonElement | undefined;
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

describe("task popup for records read outside the board corpus", () => {
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

	it("locks the popup down and names the completed archive under the title bar", async () => {
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

		expect(document.body.textContent).toContain("Read-only");
		expect(document.body.textContent).toContain("completed archive");
		expect(buttonWithText("Edit")).toBeUndefined();
		expect(buttonWithText("Save")).toBeUndefined();
	});

	it("keeps an active board task editable", async () => {
		serveApi([activeTask]);
		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp("/search?q=plugin");
		await flush(SOCKET_HANDSHAKE_MS);
		await broadcast({ type: "loaded" });
		await flush();

		await navigateHistory(`/task/${ACTIVE_TASK_ID}`, {
			backgroundLocation: { pathname: "/search", search: "?q=plugin", hash: "", state: null },
		});
		await flush();

		expect(document.body.textContent).toContain(ACTIVE_TASK_TITLE);
		expect(buttonWithText("Edit")).toBeDefined();
		expect(document.body.textContent).not.toContain("Read-only");
	});

	it("names the source branch instead of the archive for a cross-branch record", async () => {
		serveApi([crossBranchTask]);
		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp("/search?q=plugin");
		await flush(SOCKET_HANDSHAKE_MS);
		await broadcast({ type: "loaded" });
		await flush();

		await navigateHistory(`/task/${CROSS_BRANCH_TASK_ID}`, {
			backgroundLocation: { pathname: "/search", search: "?q=plugin", hash: "", state: null },
		});
		await flush();

		expect(document.body.textContent).toContain(CROSS_BRANCH_TASK_TITLE);
		expect(document.body.textContent).toContain("feature/other branch");
		expect(document.body.textContent).not.toContain("completed archive");
		expect(buttonWithText("Edit")).toBeUndefined();
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

/** Opens the board record whose predecessor has already moved to the completed archive. */
async function openSuccessorPopup(): Promise<void> {
	serveApi([successorTask], [completedTask]);
	globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
	await renderApp("/search?q=plugin");
	await flush(SOCKET_HANDSHAKE_MS);
	await broadcast({ type: "loaded" });
	await flush();

	await navigateHistory(`/task/${SUCCESSOR_TASK_ID}`, {
		backgroundLocation: { pathname: "/search", search: "?q=plugin", hash: "", state: null },
	});
	// One flush for the popup, one for the dependency fetch it kicks off.
	await flush();
	await flush();
}

function dependencyChip(): HTMLAnchorElement | undefined {
	return Array.from(document.querySelectorAll("a")).find((anchor) => anchor.textContent?.includes(TASK_ID)) as
		| HTMLAnchorElement
		| undefined;
}

describe("completed predecessor in the dependency input", () => {
	it("resolves the chip to the completed record instead of leaving a bare id", async () => {
		await openSuccessorPopup();

		const chip = dependencyChip();
		expect(chip?.getAttribute("href")).toBe("/task/411");
		expect(chip?.textContent).toBe(`${TASK_ID} - ${TASK_TITLE}`);
	});

	it("opens the completed record read-only when the chip is clicked", async () => {
		await openSuccessorPopup();
		const chip = dependencyChip();
		expect(chip).toBeDefined();

		await act(async () => {
			chip?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
		});
		await flush();

		expect(window.location.pathname).toBe(TASK_PATH);
		expect(document.body.textContent).toContain(TASK_TITLE);
		expect(document.body.textContent).toContain("completed archive");
		expect(buttonWithText("Edit")).toBeUndefined();
	});
});

describe("completed rows in the task list", () => {
	it("opens a completed row read-only instead of bouncing back to the board", async () => {
		serveApi([activeTask], [], [completedTask]);
		globalThis.WebSocket = StubSocket as unknown as typeof WebSocket;
		await renderApp("/tasks?completed=1");
		await flush(SOCKET_HANDSHAKE_MS);
		await broadcast({ type: "loaded" });
		await flush();

		// The checkbox starts ticked from the URL, so the archive row is on the list.
		expect(document.body.textContent).toContain(TASK_TITLE);
		const row = Array.from(document.querySelectorAll("tbody tr")).find((element) =>
			element.textContent?.includes(TASK_TITLE),
		);
		expect(row).toBeTruthy();

		await act(async () => {
			row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await flush();

		// Without the record riding the navigation this lands back on the board (/tasks).
		expect(window.location.pathname).toBe(TASK_PATH);
		expect(document.body.textContent).toContain("completed archive");
		expect(buttonWithText("Edit")).toBeUndefined();
	});
});
