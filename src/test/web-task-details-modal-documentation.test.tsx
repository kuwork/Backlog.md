import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

const renderModal = (task: Task) =>
	renderToString(
		<MemoryRouter>
			<I18nProvider initialLocale="en">
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
				</ThemeProvider>
			</I18nProvider>
		</MemoryRouter>,
	);

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
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
};

describe("Web task popup documentation display", () => {
	it("renders documentation entries when present", () => {
		setupDom();

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

		const html = renderModal(task);

		expect(html).toContain("Documentation");
		expect(html).toContain("README.md");
		expect(html).toContain("https://docs.example.com");
	});

	it("shows the documentation empty hint in the documentation section when empty", () => {
		setupDom();

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

		const html = renderModal(task);

		// The documentation section is always rendered (with an add form) and
		// shows a placeholder when there are no entries.
		expect(html).toContain("Documentation");
		expect(html).toContain("No documents");
		expect(html).not.toContain("No references");
	});

	it("shows the references empty hint in the references section when empty", () => {
		setupDom();

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

		const html = renderModal(task);

		expect(html).toContain("References");
		expect(html).toContain("No references");
		expect(html).not.toContain("No documents");
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
			setupDom();

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

			const html = renderToString(
				<MemoryRouter>
					<I18nProvider initialLocale={locale as Locale}>
						<ThemeProvider>
							<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
						</ThemeProvider>
					</I18nProvider>
				</MemoryRouter>,
			);

			// With references populated, only the documentation empty hint may appear.
			expect(html).toContain(hints.documentation);
			expect(html).not.toContain(hints.references);
		});
	}
});
