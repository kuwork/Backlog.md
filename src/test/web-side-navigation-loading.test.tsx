import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import BoardPage from "../web/components/BoardPage";
import SideNavigation from "../web/components/SideNavigation";

const storage = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key) => storage.get(key) ?? null,
	setItem: (key, value) => storage.set(key, value),
	removeItem: (key) => storage.delete(key),
	clear: () => storage.clear(),
	key: (index) => [...storage.keys()][index] ?? null,
	get length() {
		return storage.size;
	},
} as Storage;

const renderNavigation = (isLoading: boolean, error?: Error): string =>
	renderToString(
		<I18nProvider initialLocale="en">
			<MemoryRouter>
				<SideNavigation
					tasks={[]}
					docs={[]}
					docsTree={[]}
					decisions={[]}
					wikiTree={[]}
					isLoading={isLoading}
					error={error}
					onRetry={async () => {}}
					onRefreshData={async () => {}}
				/>
			</MemoryRouter>
		</I18nProvider>,
	);

const renderBoard = (isLoading: boolean, error?: Error): string =>
	renderToString(
		<I18nProvider initialLocale="en">
			<MemoryRouter>
				<BoardPage
					onEditTask={() => {}}
					onNewTask={() => {}}
					tasks={[]}
					statuses={["To Do", "Done"]}
					milestones={[]}
					availableLabels={[]}
					milestoneEntities={[]}
					archivedMilestones={[]}
					isLoading={isLoading}
					loadError={error}
					onRefreshData={async () => {}}
				/>
			</MemoryRouter>
		</I18nProvider>,
	);

describe("SideNavigation task loading", () => {
	it("keeps navigation mounted while only the task count is loading", () => {
		const loading = renderNavigation(true);
		expect(loading).toContain("Kanban Board");
		expect(loading).toContain("All Tasks");
		expect(loading).toContain('aria-label="Loading task count"');
		expect(loading).toContain('aria-label="Loading document count"');
		expect(loading).toContain('aria-label="Loading decision count"');
		// The indexing progress sentence no longer renders here; the phase placeholders are
		// skeleton pulses and the header indicator carries the message.
		expect(loading).toContain('aria-label="Loading content"');
		expect(loading).not.toContain("No documents");
		expect(loading).not.toContain("No decisions");

		const loaded = renderNavigation(false).replaceAll("<!-- -->", "");
		expect(loaded).toContain("Kanban Board");
		expect(loaded).toContain("All Tasks");
		expect(loaded).toContain("(0)");
	});
});

describe("BoardPage loading and error states", () => {
	it("shows the first-load skeleton while loading with no tasks", () => {
		const loading = renderBoard(true);
		expect(loading).toContain('role="status"');
		expect(loading).toContain('aria-label="Loading tasks..."');
		// Ghost columns mirror the configured status count, and the ring is the circular utility
		// rather than the dead rounded-full class that used to render a bordered square.
		expect(loading.split("min-w-[16rem]").length - 1).toBe(2);
		expect(loading).toContain("rounded-circle");
		expect(loading).not.toContain("rounded-full");

		// The real board takes over: its columns reuse the same geometry, so the skeleton is gone
		// rather than the layout changing.
		const loadedEmpty = renderBoard(false);
		expect(loadedEmpty).toContain("Empty");
		expect(loadedEmpty).not.toContain("Loading tasks...");
		expect(loadedEmpty).not.toContain('role="status"');
	});

	it("shows a retryable error panel instead of empty content", () => {
		const error = new Error("Failed to load tasks");
		const failed = renderBoard(false, error);
		expect(failed).toContain("Failed to load tasks");
		expect(failed).toContain(error.message);
		expect(failed).toContain("Retry");
		expect(failed).toContain('role="alert"');
	});
});
