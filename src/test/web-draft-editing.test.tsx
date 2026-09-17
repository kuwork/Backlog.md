import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import DraftsList from "../web/components/DraftsList.tsx";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const STATUSES = ["To Do", "In Progress", "Done"];

function draft(id: string, title: string): Task {
	return {
		id,
		title,
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-08-15 10:00",
	};
}

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

/** Serves the statuses the popup needs and an empty list for every other collection endpoint. */
function serveApi(drafts: () => Task[] = () => []): void {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const body = url.includes("/api/statuses") ? STATUSES : url.includes("/api/drafts") ? drafts() : [];
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}) as unknown as typeof globalThis.fetch;
}

async function renderDrafts(onEditTask: (task: Task) => void): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<I18nProvider initialLocale="en">
					<MemoryRouter initialEntries={["/drafts"]}>
						<DraftsList onEditTask={onEditTask} onNewDraft={() => {}} />
					</MemoryRouter>
				</I18nProvider>
			</ThemeProvider>,
		);
		await Promise.resolve();
	});
	return container;
}

async function renderModal(task: Task): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/"]}>
				<I18nProvider initialLocale="en">
					<ThemeProvider>
						<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
					</ThemeProvider>
				</I18nProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container;
}

function statusSelect(container: HTMLElement): HTMLSelectElement {
	const selects = Array.from(container.querySelectorAll("select")) as HTMLSelectElement[];
	const select = selects.find((candidate) =>
		Array.from(candidate.options).some((option) => [...STATUSES, "Draft"].includes(option.value)),
	);
	expect(select).toBeTruthy();
	return select as HTMLSelectElement;
}

afterEach(async () => {
	if (activeRoot) {
		await act(async () => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe("Web drafts list", () => {
	it("opens the clicked draft for editing", async () => {
		serveApi(() => [draft("DRAFT-1", "First draft"), draft("DRAFT-2", "Second draft")]);
		const edited: Task[] = [];
		const container = await renderDrafts((task) => edited.push(task));

		const headings = Array.from(container.querySelectorAll("h3"));
		const target = headings.find((heading) => heading.textContent === "Second draft");
		expect(target).toBeTruthy();

		await act(async () => {
			target?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(edited.map((task) => task.id)).toEqual(["DRAFT-2"]);
	});

	// The app dispatches this event from its shared refresh, so a saved edit shows up without a reload.
	it("reloads the drafts when a drafts-updated event fires", async () => {
		let drafts = [draft("DRAFT-1", "First draft")];
		serveApi(() => drafts);
		const container = await renderDrafts(() => {});
		expect(container.textContent).toContain("First draft");

		drafts = [draft("DRAFT-1", "Reviewed scope")];
		await act(async () => {
			window.dispatchEvent(new window.Event("drafts-updated"));
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Reviewed scope");
		expect(container.textContent).not.toContain("First draft");
	});
});

describe("Web task popup status field", () => {
	it("shows the status a draft actually has instead of the first configured status", async () => {
		serveApi();
		const container = await renderModal(draft("DRAFT-1", "Draft under review"));

		const select = statusSelect(container);
		expect(Array.from(select.options).map((option) => option.value)).toEqual(["Draft", ...STATUSES]);
		expect(select.value).toBe("Draft");
		// Promotion stays on the drafts page action, which is the only place that reports the new id.
		expect(select.disabled).toBe(true);
	});

	it("offers only the configured statuses for a task", async () => {
		serveApi();
		const container = await renderModal({
			id: "BACK-1",
			title: "Ordinary task",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-08-15 10:00",
		});

		const select = statusSelect(container);
		expect(Array.from(select.options).map((option) => option.value)).toEqual(STATUSES);
		expect(select.value).toBe("To Do");
		expect(select.disabled).toBe(false);
	});
});
