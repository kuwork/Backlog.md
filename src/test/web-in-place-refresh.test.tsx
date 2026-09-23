import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import type { Milestone, SearchResult, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const makeTask = (id: string, title: string, status: string, overrides: Partial<Task> = {}): Task => ({
	id,
	title,
	status,
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-07-10",
	ordinal: 1000,
	...overrides,
});

const defaultConfig = {
	projectName: "In-place QA",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
};

const emptyDuplicatePlan = (): DuplicateRepairPlan => ({
	groups: [],
	changes: [],
	references: [],
	referenceScanComplete: true,
	blockedReasons: [],
	repairable: false,
});

let tasks: Task[] = [];
let milestones: Milestone[] = [];
let duplicatePlan: DuplicateRepairPlan = emptyDuplicatePlan();
let failNextSearch = false;
let configHold: Promise<void> | null = null;
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
	if (url.pathname === "/api/config") {
		if (configHold) await configHold;
		return json(defaultConfig);
	}
	if (url.pathname === "/api/search") {
		if (failNextSearch) {
			failNextSearch = false;
			// 4xx so the api client surfaces the failure without retrying.
			return json({ error: "search unavailable" }, 400);
		}
		const results: SearchResult[] = tasks.map((task) => ({ type: "task", task, score: 1 }));
		return json(results);
	}
	if (url.pathname === "/api/tasks") return json(tasks);
	if (url.pathname === "/api/drafts") return json([]);
	if (url.pathname === "/api/milestones") return json(milestones);
	if (url.pathname === "/api/milestones/archived") return json([]);
	if (url.pathname === "/api/wiki/tree") return json([]);
	if (url.pathname === "/api/docs/tree") return json([]);
	if (url.pathname === "/api/tasks/duplicate-ids") return json(duplicatePlan);
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
	await waitFor(() => (container.textContent ?? "").includes(tasks[0]?.title ?? ""), "initial board content");
	await settle();
	requestLog = [];
	return container;
};

const requestedPaths = () => Array.from(new Set(requestLog)).sort();

/** The task details modal, which is what a deep link or a card click opens. */
const dialogText = (container: HTMLElement) => container.querySelector('[role="dialog"]')?.textContent ?? "";

/**
 * The loading shell is the task board skeleton: a status region labelled for tasks. The header's
 * indexing indicator is also a status region, so the label is what tells them apart.
 */
const hasLoadingShell = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('[role="status"]')).some((node) =>
		(node.getAttribute("aria-label") ?? "").startsWith("Loading tasks"),
	);

/** The sidebar marks every count as unavailable while a load error stands. */
const countUnavailable = (container: HTMLElement) =>
	container.querySelectorAll('[aria-label$="count unavailable"]').length > 0;

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
	tasks = [];
	milestones = [];
	duplicatePlan = emptyDuplicatePlan();
	failNextSearch = false;
	configHold = null;
	requestLog = [];
});

describe("in-place data refresh", () => {
	it("applies an external task edit in place through a single search refetch", async () => {
		tasks = [makeTask("TASK-1", "Original title", "To Do"), makeTask("TASK-2", "Neighbor card", "To Do")];
		const container = await renderBoard();
		const neighborBefore = Array.from(container.querySelectorAll("h4")).find(
			(node) => node.textContent === "Neighbor card",
		);
		expect(neighborBefore).toBeTruthy();

		tasks = [makeTask("TASK-1", "Renamed title", "To Do"), tasks[1] as Task];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Renamed title"), "renamed card");
		await settle();

		// Only the search corpus is refetched: no statuses, config, drafts, wiki tree, docs tree,
		// milestone or duplicate-plan burst, and no loading shell.
		expect(requestedPaths()).toEqual(["/api/search"]);
		expect(hasLoadingShell(container)).toBe(false);
		// The unchanged card kept its DOM node: the view updated in place.
		const neighborAfter = Array.from(container.querySelectorAll("h4")).find(
			(node) => node.textContent === "Neighbor card",
		);
		expect(neighborAfter).toBe(neighborBefore as HTMLHeadingElement);
	});

	it("moves a card between columns in place when its status changes externally", async () => {
		tasks = [makeTask("TASK-1", "Moving card", "To Do")];
		const container = await renderBoard();

		// The nearest ancestor that carries an h3 heading is the card's column, and that heading is
		// the column's status title.
		const columnOf = (title: string): string | null => {
			const card = Array.from(container.querySelectorAll("h4")).find((node) => node.textContent === title);
			let node: Element | null = card ?? null;
			while (node && node !== container) {
				const heading = node.querySelector("h3");
				if (heading?.textContent) return heading.textContent;
				node = node.parentElement;
			}
			return null;
		};
		expect(columnOf("Moving card")).toBe("To Do");

		tasks = [makeTask("TASK-1", "Moving card", "In Progress")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => columnOf("Moving card") === "In Progress", "card in the In Progress column");
		await settle();

		expect(requestedPaths()).toEqual(["/api/search"]);
		expect(hasLoadingShell(container)).toBe(false);
	});

	it("shows an externally created task without a full reload", async () => {
		tasks = [makeTask("TASK-1", "Existing card", "To Do")];
		const container = await renderBoard();

		tasks = [...tasks, makeTask("TASK-2", "Brand new card", "To Do")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Brand new card"), "externally created card");
		await settle();

		// A new task id can introduce a duplicate, so only this path also refreshes the plan behind
		// the duplicate repair.
		expect(requestedPaths()).toEqual(["/api/search", "/api/tasks/duplicate-ids"]);
		expect(hasLoadingShell(container)).toBe(false);
	});

	it("treats a broadcast that echoes already-applied data as a no-op", async () => {
		tasks = [makeTask("TASK-1", "Stable card", "To Do")];
		await renderBoard();

		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await settle();

		// The echo after a surgical drag update costs exactly one search read.
		expect(requestedPaths()).toEqual(["/api/search"]);
	});

	it("keeps the open views quiet when a broadcast echoes data already applied", async () => {
		tasks = [makeTask("TASK-1", "Echo card", "To Do")];
		// The deep link opens the task modal, which preloads its dependency picker on open.
		const container = await renderBoard("/task/TASK-1");
		await waitFor(() => dialogText(container).includes("Echo card"), "the task details modal");
		await settle();
		requestLog = [];

		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await settle();

		// The record did not change, so it kept its object and the modal did not see a new task:
		// its preload stays where it was. Without that identity the echo re-renders the open view
		// and buys two more requests.
		expect(requestedPaths()).toEqual(["/api/search"]);
	});

	it("refetches milestone entities incrementally on a milestone-scoped broadcast", async () => {
		tasks = [makeTask("TASK-1", "Milestone card", "To Do")];
		await renderBoard();

		milestones = [
			{ id: "m-1", title: "Launch", description: "", rawContent: "", createdDate: "2026-07-10" } as Milestone,
		];
		await act(async () => {
			getAppDataWebSocket().deliver("milestones-updated");
		});
		await settle();

		expect(requestedPaths()).toEqual(["/api/milestones", "/api/milestones/archived", "/api/search"]);
	});

	it("keeps refreshing the repair plan while duplicates exist, even for same-id edits", async () => {
		tasks = [makeTask("TASK-1", "Colliding card", "To Do")];
		duplicatePlan = {
			...emptyDuplicatePlan(),
			groups: [
				{
					id: "TASK-1",
					tasks: [
						{ ...(tasks[0] as Task), filePath: "backlog/tasks/task-1 - A.md" } as Task,
						{ ...(tasks[0] as Task), title: "Duplicate", filePath: "backlog/tasks/task-01 - B.md" } as Task,
					],
				},
			],
			repairable: true,
		} as DuplicateRepairPlan;
		await renderBoard();

		// Editing a colliding task changes the plan without changing the id set, so the plan has to
		// be refetched anyway.
		tasks = [makeTask("TASK-1", "Colliding card edited", "To Do")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await settle();

		expect(requestedPaths()).toEqual(["/api/search", "/api/tasks/duplicate-ids"]);
	});

	it("routes the next refresh through the full loader while a load error stands", async () => {
		tasks = [makeTask("TASK-1", "Error-state card", "To Do")];
		const container = await renderBoard();

		await act(async () => {
			getAppDataWebSocket().deliver(JSON.stringify({ type: "error", message: "corpus failed" }));
		});
		await settle();
		expect(countUnavailable(container)).toBe(true);

		requestLog = [];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await settle();

		// The standing error means state may be arbitrarily stale, so the retry is the full loader,
		// which also clears the error on success.
		expect(requestedPaths()).toEqual([
			"/api/config",
			"/api/docs/tree",
			"/api/drafts",
			"/api/milestones",
			"/api/milestones/archived",
			"/api/search",
			"/api/statuses",
			"/api/tasks/duplicate-ids",
			"/api/wiki/tree",
		]);
		expect(countUnavailable(container)).toBe(false);
	});

	it("adopts the scope of an in-flight full refresh instead of superseding it", async () => {
		tasks = [makeTask("TASK-1", "Race card", "To Do")];
		await renderBoard();

		let releaseConfig = () => {};
		configHold = new Promise<void>((resolve) => {
			releaseConfig = resolve;
		});
		await act(async () => {
			getAppDataWebSocket().deliver("config-updated");
		});
		// A task update arriving while the full reload is still waiting on config supersedes it
		// through the shared request id, so it has to run the full loader itself instead of a
		// search-only refresh on stale config.
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		configHold = null;
		releaseConfig();
		await settle();

		expect(requestLog.filter((path) => path === "/api/config").length).toBe(2);
		expect(requestLog.filter((path) => path === "/api/search").length).toBe(2);
	});

	it("falls back to the full reload when the incremental refresh fails", async () => {
		tasks = [makeTask("TASK-1", "Fallback card", "To Do")];
		const container = await renderBoard();

		failNextSearch = true;
		tasks = [makeTask("TASK-1", "Fallback card renamed", "To Do")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(
			() => (container.textContent ?? "").includes("Fallback card renamed"),
			"card after the fallback reload",
		);
		await settle();

		expect(requestedPaths()).toEqual([
			"/api/config",
			"/api/docs/tree",
			"/api/drafts",
			"/api/milestones",
			"/api/milestones/archived",
			"/api/search",
			"/api/statuses",
			"/api/tasks/duplicate-ids",
			"/api/wiki/tree",
		]);
	});
});
