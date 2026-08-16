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

const renderNavigation = (
	isLoading: boolean,
	error?: Error,
	loadingMessage?: string,
	initialLocale: "en" | "zh-CN" = "en",
): string =>
	renderToString(
		<I18nProvider initialLocale={initialLocale}>
			<MemoryRouter>
				<SideNavigation
					tasks={[]}
					docs={[]}
					docsTree={[]}
					decisions={[]}
					wikiTree={[]}
					isLoading={isLoading}
					loadingMessage={loadingMessage}
					error={error}
					onRetry={async () => {}}
					onRefreshData={async () => {}}
				/>
			</MemoryRouter>
		</I18nProvider>,
	);

const renderBoard = (isLoading: boolean, error?: Error, loadingMessage?: string): string =>
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
					loadingMessage={loadingMessage}
					loadError={error}
					onRefreshData={async () => {}}
				/>
			</MemoryRouter>
		</I18nProvider>,
	);

describe("SideNavigation task loading", () => {
	it("keeps navigation mounted while only the task count is loading", () => {
		const phase = "Hydrating 21 remote candidates...";
		const loading = renderNavigation(true, undefined, phase);
		expect(loading).toContain("Kanban Board");
		expect(loading).toContain("All Tasks");
		expect(loading).toContain('aria-label="Loading task count"');
		expect(loading).toContain('aria-label="Loading document count"');
		expect(loading).toContain('aria-label="Loading decision count"');
		expect(loading).toContain(phase);
		expect(loading).not.toContain("No documents");
		expect(loading).not.toContain("No decisions");

		const loaded = renderNavigation(false).replaceAll("<!-- -->", "");
		expect(loaded).toContain("Kanban Board");
		expect(loaded).toContain("All Tasks");
		expect(loaded).toContain("(0)");
	});

	it("localizes the loading phase message", () => {
		const phase = "Hydrating 21 remote candidates...";
		const loading = renderNavigation(true, undefined, phase, "zh-CN");
		expect(loading).toContain("正在水合 21 个远程候选任务...");
		expect(loading).not.toContain(phase);
	});

	it("falls back to the localized generic message for unknown phases", () => {
		const loading = renderNavigation(true, undefined, "Something unknown here");
		expect(loading).toContain("Something unknown here");
	});
});

describe("BoardPage loading and error states", () => {
	it("shows a loading panel while loading with no tasks", () => {
		const phase = "Indexing 12 recent remote branches (last 30 days)...";
		const loading = renderBoard(true, undefined, phase);
		expect(loading).toContain(phase);
		expect(loading).toContain('role="status"');
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
