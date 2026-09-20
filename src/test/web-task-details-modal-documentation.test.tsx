import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

const originalFetch = globalThis.fetch;

beforeEach(() => {
	// The modal preloads tasks, drafts and statuses when it opens; empty corpora keep the cases
	// off the network.
	globalThis.fetch = ((input: RequestInfo | URL) => {
		const url = String(input);
		const body = url.includes("/api/statuses") ? ["To Do", "In Progress", "Done"] : [];
		return Promise.resolve(
			new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
		);
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

let activeRoot: Root | null = null;
afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

const setupDom = (): HTMLElement => {
	const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;

	if (!window.matchMedia) {
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
	}
	return dom.window.document.getElementById("root") as HTMLElement;
};

const modal = (task: Task, locale: Locale = "en") => (
	<MemoryRouter>
		<I18nProvider initialLocale={locale}>
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>
		</I18nProvider>
	</MemoryRouter>
);

const renderModal = (task: Task, locale: Locale = "en"): HTMLElement => {
	const container = setupDom();
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(modal(task, locale));
	});
	return container;
};

const panel = (container: HTMLElement): HTMLElement => {
	const body = container.querySelector('[role="tabpanel"]');
	expect(body).toBeTruthy();
	return body as HTMLElement;
};

// The three metadata lists share one panel, so a case has to open the tab it asserts on.
const selectTab = (container: HTMLElement, label: string) => {
	// Captions carry their list length ("Documentation(2)"), so match on the label prefix.
	const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find(
		(candidate) => (candidate.textContent ?? "").startsWith(label),
	);
	expect(tab).toBeTruthy();
	act(() => {
		(tab as HTMLElement).click();
	});
};

describe("Web task popup documentation display", () => {
	it("renders documentation entries when the documentation tab is selected", () => {
		const task: Task = {
			id: "TASK-1",
			title: "Documented task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			documentation: ["README.md", "https://docs.example.com"],
		};

		const container = renderModal(task);
		selectTab(container, "Documentation");

		const text = panel(container).textContent ?? "";
		expect(text).toContain("README.md");
		expect(text).toContain("https://docs.example.com");
	});

	it("shows the documentation empty hint in the documentation tab when empty", () => {
		const task: Task = {
			id: "TASK-2",
			title: "No docs task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			references: ["src/example.ts"],
			documentation: [],
		};

		const container = renderModal(task);
		// A filled references list outranks the other lists, so that is what opens.
		expect(panel(container).textContent).toContain("src/example.ts");
		expect(panel(container).textContent).not.toContain("No documents");

		selectTab(container, "Documentation");
		const text = panel(container).textContent ?? "";
		expect(text).toContain("No documents");
		expect(text).not.toContain("No references");
	});

	it("shows the references empty hint in the references tab when empty", () => {
		const task: Task = {
			id: "TASK-3",
			title: "No refs task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			references: [],
			documentation: ["docs/example.md"],
		};

		const container = renderModal(task);
		// The documentation list is the only filled one, so that is the tab that opens.
		expect(panel(container).textContent).toContain("docs/example.md");

		const captions = Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent ?? "");
		expect(captions).toContain("References");
		expect(captions).toContain("Modified Files");

		selectTab(container, "References");
		const text = panel(container).textContent ?? "";
		expect(text).toContain("No references");
		expect(text).not.toContain("No documents");
		expect(text).not.toContain("docs/example.md");
	});
});

describe("Web task popup empty hints across locales", () => {
	const localeHints: Array<[string, { references: string; documentation: string }]> = [
		["en", { references: "No references", documentation: "No documents" }],
		["zh-CN", { references: "暂无引用", documentation: "暂无文档" }],
		["zh-TW", { references: "暫無引用", documentation: "暫無文檔" }],
		["ja", { references: "参照がありません", documentation: "ドキュメントがありません" }],
	];

	for (const [locale, hints] of localeHints) {
		it(`shows section-specific empty hints in ${locale}`, () => {
			const task: Task = {
				id: "TASK-4",
				title: "Empty task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
				references: ["src/example.ts"],
				documentation: [],
			};

			const container = renderModal(task, locale as Locale);

			// With references populated, only the documentation tab carries an empty hint.
			selectTab(container, container.querySelectorAll('[role="tab"]')[1]?.textContent ?? "");
			const text = panel(container).textContent ?? "";
			expect(text).toContain(hints.documentation);
			expect(text).not.toContain(hints.references);
		});
	}
});
