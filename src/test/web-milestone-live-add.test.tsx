import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import MilestonesPage from "../web/components/MilestonesPage.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";

const makeMilestone = (overrides: Partial<Milestone>): Milestone => ({
	id: "m-0",
	title: "Alpha",
	description: "Milestone: Alpha",
	rawContent: "## Description\n\nMilestone: Alpha",
	...overrides,
});

const defaultConfig = {
	projectName: "Milestone live add",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
};

let milestones: Milestone[] = [];
/** Answers `/api/milestones/:id` - the by-id fetch the detail modal and the self-heal both use. */
let singleMilestones: Record<string, Milestone> = {};
/** Answers `/api/search` - the corpus the task list, board and milestones page all derive from. */
let searchResults: Array<{ type: "task"; task: Task }> = [];
/** Every by-id milestone fetch, so a test can assert the self-heal stays surgical. */
let milestoneByIdCalls: string[] = [];

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

/** The app opens more than one socket (the health check does too); the data one installs onmessage. */
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

const emptyDuplicatePlan = () => ({
	groups: [],
	changes: [],
	references: [],
	referenceScanComplete: true,
	blockedReasons: [],
	repairable: false,
});

const respond = async (url: URL): Promise<Response> => {
	if (url.pathname === "/api/status") return json({ initialized: true, projectPath: "/tmp/project" });
	if (url.pathname === "/api/statuses") return json(defaultConfig.statuses);
	if (url.pathname === "/api/config") return json(defaultConfig);
	if (url.pathname === "/api/search") return json(searchResults);
	if (url.pathname === "/api/tasks") return json([]);
	if (url.pathname === "/api/drafts") return json([]);
	if (url.pathname === "/api/milestones") return json(milestones);
	if (url.pathname === "/api/milestones/archived") return json([]);
	if (url.pathname.startsWith("/api/milestones/")) {
		const id = decodeURIComponent(url.pathname.slice("/api/milestones/".length));
		milestoneByIdCalls.push(id);
		const found = singleMilestones[id];
		return found ? json(found) : json({ error: "Milestone not found" }, 404);
	}
	if (url.pathname === "/api/wiki/tree") return json([]);
	if (url.pathname === "/api/docs/tree") return json([]);
	if (url.pathname === "/api/tasks/duplicate-ids") return json(emptyDuplicatePlan());
	if (url.pathname === "/api/version") return json({ version: "test" });
	return json([]);
};

const installFetchMock = () => {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		return respond(new URL(value, window.location.origin));
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

/** Every milestone bucket header is an h3; its text is the label the page renders for the bucket. */
const milestoneHeadings = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("h3")).map((node) => (node.textContent ?? "").trim());

const renderApp = async (path: string): Promise<HTMLElement> => {
	setupDom(path);
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
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
	await settle();
	return container;
};

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
	milestones = [];
	singleMilestones = {};
	searchResults = [];
	milestoneByIdCalls = [];
});

describe("Web milestone live add", () => {
	it("renders the title of a milestone added while the page is open", async () => {
		milestones = [makeMilestone({ id: "m-0", title: "Alpha" })];
		const container = await renderApp("/milestones");
		await waitFor(() => milestoneHeadings(container).includes("Alpha"), "the milestone loaded at open");

		// The CLI writes the file and the server now broadcasts `milestones-updated`; the client
		// answers it by refetching the milestone entities. Before that broadcast existed the page
		// never learned the new title and fell back to the raw id.
		milestones = [makeMilestone({ id: "m-0", title: "Alpha" }), makeMilestone({ id: "m-1", title: "Live Added" })];
		await act(async () => {
			getAppDataWebSocket().deliver("milestones-updated");
		});
		await waitFor(() => milestoneHeadings(container).includes("Live Added"), "the live-added milestone title");
		await settle();

		const headings = milestoneHeadings(container);
		expect(headings).toContain("Alpha");
		expect(headings).toContain("Live Added");
		// The bug's symptom was the bucket rendering the code alone.
		expect(headings).not.toContain("m-1");
	});

	it("resolves the title of a task's milestone that the entity list never contained", async () => {
		// A task points at m-9 but the loaded entity list never learned about it: the CLI wrote the
		// milestone out of band and no `milestones-updated` reached this client. The bucket can only
		// render the raw id - exactly the reported symptom (the detail view shows the title because
		// it fetches the milestone by id). The client now closes that gap itself.
		searchResults = [
			{
				type: "task",
				task: {
					id: "task-9",
					title: "Written against a missed milestone",
					status: "To Do",
					assignee: [],
					labels: [],
					dependencies: [],
					createdDate: "2026-01-01",
					milestone: "m-9",
				},
			},
		];
		milestones = [];
		singleMilestones = { "m-9": makeMilestone({ id: "m-9", title: "Out of band" }) };

		const container = await renderApp("/milestones");
		await waitFor(
			() => milestoneHeadings(container).includes("Out of band"),
			"the title fetched for the task's unresolved milestone",
		);
		await settle();

		const headings = milestoneHeadings(container);
		expect(headings).toContain("Out of band");
		expect(headings).not.toContain("m-9");
	});

	it("does not refetch entities the loaded list already covers", async () => {
		// The self-heal must compare against the list it just loaded, not a stale one. If it ran
		// before the entity list was committed, every referenced milestone would look unresolved and
		// the page would fire one by-id request per task milestone on every load.
		searchResults = [
			{
				type: "task",
				task: {
					id: "task-1",
					title: "Assigned work",
					status: "To Do",
					assignee: [],
					labels: [],
					dependencies: [],
					createdDate: "2026-01-01",
					milestone: "m-1",
				},
			},
		];
		milestones = [makeMilestone({ id: "m-1", title: "Alpha" })];

		const container = await renderApp("/milestones");
		await waitFor(() => milestoneHeadings(container).includes("Alpha"), "the covered milestone title");
		await settle();

		expect(milestoneByIdCalls).toEqual([]);
	});
});

describe("Milestone bucket label source", () => {
	it("falls back to the id only while the entity is unknown, then shows the title", async () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Assigned work",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: [],
				createdDate: "2026-01-01",
				milestone: "m-1",
			},
		];
		setupDom("/milestones");
		const container = document.getElementById("root") as HTMLElement;
		activeRoot = createRoot(container);

		const render = async (entities: Milestone[]) => {
			await act(async () => {
				activeRoot?.render(
					<MemoryRouter>
						<I18nProvider initialLocale="en">
							<MilestonesPage
								tasks={tasks}
								statuses={["To Do", "In Progress", "Done"]}
								milestoneEntities={entities}
								archivedMilestones={[]}
								onEditTask={() => {}}
							/>
						</I18nProvider>
					</MemoryRouter>,
				);
			});
		};

		// The task references m-1 but no entity has been fetched: the bucket can only show the id.
		await render([]);
		expect(milestoneHeadings(container)).toContain("m-1");

		// Once the entity arrives the same bucket shows its title.
		await render([makeMilestone({ id: "m-1", title: "Fetched Title" })]);
		const headings = milestoneHeadings(container);
		expect(headings).toContain("Fetched Title");
		expect(headings).not.toContain("m-1");
	});
});
