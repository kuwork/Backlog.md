import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

const originalFetch = globalThis.fetch;

beforeEach(() => {
	// The modal preloads tasks, drafts and statuses when it opens. Answering with empty corpora
	// keeps the interactive cases off the network; the statuses list is what the create form reads.
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

const modal = (task?: Task, locale: Locale = "en") => (
	<MemoryRouter>
		<I18nProvider initialLocale={locale}>
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>
		</I18nProvider>
	</MemoryRouter>
);

const renderModal = (task?: Task, locale: Locale = "en"): HTMLElement => {
	const container = setupDom();
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(modal(task, locale));
	});
	return container;
};

const renderModalMarkup = (task?: Task, locale: Locale = "en"): string => {
	setupDom();
	return renderToString(modal(task, locale));
};

const baseTask = (overrides: Partial<Task> = {}): Task => ({
	id: "BACK-1",
	title: "Tabbed metadata",
	status: "To Do",
	assignee: [],
	createdDate: "2026-09-19",
	labels: [],
	dependencies: [],
	references: [],
	documentation: [],
	modifiedFiles: [],
	...overrides,
});

const tabLabels = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent ?? "");

// Tab captions carry their list length, e.g. "Modified Files(12)".
const tabCaption = (container: HTMLElement, label: string): string | undefined =>
	tabLabels(container).find((caption) => caption.startsWith(label));

const selectedTab = (container: HTMLElement): string | null =>
	container.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null;

const panel = (container: HTMLElement): HTMLElement => {
	const body = container.querySelector('[role="tabpanel"]');
	expect(body).toBeTruthy();
	return body as HTMLElement;
};

const selectTab = (container: HTMLElement, label: string) => {
	const tab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find(
		(candidate) => (candidate.textContent ?? "").startsWith(label),
	);
	expect(tab).toBeTruthy();
	act(() => {
		(tab as HTMLElement).click();
	});
};

const submitMetadataForm = async (container: HTMLElement, inputName: string, value: string) => {
	const input = container.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);
	expect(input).toBeTruthy();
	const form = (input as HTMLInputElement).closest("form");
	expect(form).toBeTruthy();
	await act(async () => {
		(input as HTMLInputElement).value = value;
		(form as HTMLFormElement).dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

describe("Web task modal metadata tabs", () => {
	it("opens on References for a task under way that lists both references and modified files", () => {
		const container = renderModal(
			baseTask({ status: "In Progress", references: ["src/one.ts"], modifiedFiles: ["src/two.ts"] }),
		);

		// A task under way reads left to right, so the leftmost filled list opens.
		const tabs = tabLabels(container);
		expect(tabs).toContain("References(1)");
		expect(tabs).toContain("Documentation");
		expect(tabs).toContain("Modified Files(1)");
		expect(selectedTab(container)).toBe("References(1)");
		expect(panel(container).textContent).toContain("src/one.ts");
		expect(panel(container).textContent).not.toContain("src/two.ts");
	});

	it("opens on Modified Files for a finished task that also lists references", () => {
		const container = renderModal(
			baseTask({ status: "Done", references: ["src/one.ts"], modifiedFiles: ["src/two.ts"] }),
		);

		// A finished task is opened for the paths it touched, so files outrank references there.
		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/two.ts");
		expect(panel(container).textContent).not.toContain("src/one.ts");

		selectTab(container, "References");
		expect(panel(container).textContent).toContain("src/one.ts");
	});

	it("opens on References for a finished task whose modified files are empty", () => {
		const container = renderModal(baseTask({ status: "Done", references: ["src/one.ts"], modifiedFiles: [] }));

		// Modified Files leads on a finished task, but an empty list yields to the next one.
		expect(selectedTab(container)).toBe("References(1)");
		expect(panel(container).textContent).toContain("src/one.ts");
	});

	it("opens on Modified Files once references has no entries", () => {
		const container = renderModal(
			baseTask({ status: "In Progress", modifiedFiles: ["src/web/components/TaskDetailsModal.tsx"] }),
		);

		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/web/components/TaskDetailsModal.tsx");
		expect(panel(container).querySelector("button")?.textContent).toBe("src/web/components/TaskDetailsModal.tsx");
	});

	it("falls back to References when an in-progress task lists no modified files", () => {
		const container = renderModal(baseTask({ status: "In Progress", references: ["README.md"], modifiedFiles: [] }));

		expect(selectedTab(container)).toBe("References(1)");
		expect(panel(container).textContent).toContain("README.md");
		expect(panel(container).textContent).not.toContain("No modified files");
	});

	it("opens on Modified Files for a finished task that lists no references or documents", () => {
		const container = renderModal(baseTask({ status: "Done", modifiedFiles: ["src/core/backlog.ts"] }));

		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/core/backlog.ts");
	});

	it("prefers Modified Files over Documentation when references has no entries", () => {
		const container = renderModal(
			baseTask({ status: "Done", documentation: ["docs/spec.md"], modifiedFiles: ["src/core/backlog.ts"] }),
		);

		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/core/backlog.ts");
		expect(panel(container).textContent).not.toContain("docs/spec.md");
	});

	it("opens on Documentation when it is the only filled list", () => {
		const container = renderModal(baseTask({ status: "To Do", documentation: ["docs/spec.md"] }));

		expect(selectedTab(container)).toBe("Documentation(1)");
		expect(panel(container).textContent).toContain("docs/spec.md");
	});

	it("lands on References when every list is empty", () => {
		const container = renderModal(baseTask({ status: "Done" }));

		expect(selectedTab(container)).toBe("References");
		expect(panel(container).textContent).toContain("No references");
	});

	it("hides the count of a tab whose list is empty", () => {
		const container = renderModal(baseTask({ references: ["README.md"] }));

		expect(tabCaption(container, "References")).toBe("References(1)");
		expect(tabCaption(container, "Documentation")).toBe("Documentation");
		expect(tabCaption(container, "Modified Files")).toBe("Modified Files");
	});

	it("re-evaluates the default when an unsaved edit empties the open list", () => {
		const container = renderModal(
			baseTask({ status: "In Progress", references: ["README.md"], modifiedFiles: ["src/core/backlog.ts"] }),
		);

		expect(selectedTab(container)).toBe("References(1)");

		const remove = container.querySelector<HTMLElement>('[title="Remove reference"]');
		expect(remove).toBeTruthy();
		act(() => {
			(remove as HTMLElement).click();
		});

		// Nothing is pinned until a tab is clicked, so the rule runs again on the edited lists.
		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/core/backlog.ts");
	});

	it("never renders a modified file as an external link", () => {
		const container = renderModal(
			baseTask({ status: "Done", modifiedFiles: ["https://docs.example.com/spec.md", "src/core/backlog.ts"] }),
		);

		expect(panel(container).textContent).toContain("https://docs.example.com/spec.md");
		expect(container.querySelector('a[href="https://docs.example.com/spec.md"]')).toBeNull();
		expect(container.querySelectorAll('[role="tabpanel"] a')).toHaveLength(0);
	});

	it("renders the lists without add or remove controls for an off-board task", () => {
		const container = renderModal(
			baseTask({
				status: "Done",
				branch: "other-branch",
				modifiedFiles: ["src/core/backlog.ts"],
				references: ["README.md"],
			}),
		);

		// Both lists are filled and the record is finished, so the file list opens, read-only.
		expect(selectedTab(container)).toBe("Modified Files(1)");
		expect(panel(container).textContent).toContain("src/core/backlog.ts");
		expect(container.querySelector('[title="Remove modified file"]')).toBeNull();
		expect(container.querySelector('input[name="newModifiedFile"]')).toBeNull();

		selectTab(container, "References");
		expect(panel(container).textContent).toContain("README.md");
		expect(container.querySelector('[title="Remove reference"]')).toBeNull();
		expect(container.querySelector('input[name="newRef"]')).toBeNull();
	});

	it("keeps the tab labels localized", () => {
		const cases: Array<[Locale, string]> = [
			["en", "Modified Files"],
			["zh-CN", "文件变更"],
			["zh-TW", "檔案變更"],
			["ja", "変更ファイル"],
		];

		for (const [locale, label] of cases) {
			const markup = renderModalMarkup(baseTask(), locale);
			expect(markup).toContain(label);
			expect(markup).toContain('aria-selected="true"');
		}
	});
});

describe("Web task modal modified files tab interaction", () => {
	it("switches panels when another tab is selected", () => {
		const container = renderModal(baseTask({ references: ["src/one.ts"] }));

		expect(container.querySelector('input[name="newRef"]')).not.toBeNull();
		expect(container.querySelector('input[name="newModifiedFile"]')).toBeNull();

		selectTab(container, "Modified Files");
		expect(selectedTab(container)).toBe("Modified Files");
		expect(panel(container).textContent).toContain("No modified files");
		expect(container.querySelector('input[name="newRef"]')).toBeNull();
		expect(container.querySelector('input[name="newModifiedFile"]')).not.toBeNull();

		selectTab(container, "Documentation");
		expect(panel(container).textContent).toContain("No documents");
		expect(container.querySelector('input[name="newModifiedFile"]')).toBeNull();
	});

	it("adds and removes a modified file path, and refuses URLs and duplicates", async () => {
		const container = renderModal(baseTask({ status: "In Progress" }));
		expect(selectedTab(container)).toBe("References");

		selectTab(container, "Modified Files");
		await submitMetadataForm(container, "newModifiedFile", "src/web/App.tsx");
		expect(panel(container).textContent).toContain("src/web/App.tsx");

		await submitMetadataForm(container, "newModifiedFile", "src/web/App.tsx");
		expect(container.querySelectorAll('[title="Remove modified file"]')).toHaveLength(1);

		await submitMetadataForm(container, "newModifiedFile", "https://docs.example.com/spec.md");
		expect(panel(container).textContent).not.toContain("https://docs.example.com/spec.md");

		await submitMetadataForm(container, "newModifiedFile", "ftp://files.example.com/spec.md");
		expect(panel(container).textContent).not.toContain("ftp://files.example.com/spec.md");

		const remove = container.querySelector<HTMLElement>('[title="Remove modified file"]');
		act(() => {
			(remove as HTMLElement).click();
		});
		expect(panel(container).textContent).not.toContain("src/web/App.tsx");
		expect(panel(container).textContent).toContain("No modified files");
	});

	it("keeps the tab captions in step with the unsaved list edits", async () => {
		const container = renderModal(baseTask({ status: "In Progress", references: ["README.md"] }));

		expect(tabCaption(container, "References")).toBe("References(1)");
		expect(tabCaption(container, "Modified Files")).toBe("Modified Files");

		selectTab(container, "Modified Files");
		await submitMetadataForm(container, "newModifiedFile", "src/web/App.tsx");
		expect(tabCaption(container, "Modified Files")).toBe("Modified Files(1)");

		const remove = container.querySelector<HTMLElement>('[title="Remove modified file"]');
		act(() => {
			(remove as HTMLElement).click();
		});
		expect(tabCaption(container, "Modified Files")).toBe("Modified Files");
	});

	it("shows the localized empty hint for the modified files tab", () => {
		const cases: Array<[Locale, string]> = [
			["en", "No modified files"],
			["zh-CN", "暂无文件变更"],
			["zh-TW", "暫無檔案變更"],
			["ja", "変更ファイルがありません"],
		];

		for (const [locale, hint] of cases) {
			const container = renderModal(baseTask(), locale);
			selectTab(container, tabLabels(container)[2] ?? "");
			expect(panel(container).textContent).toContain(hint);
		}
	});
});
