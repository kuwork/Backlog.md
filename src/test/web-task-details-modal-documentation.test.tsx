import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
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

	it("shows an empty documentation section when empty", () => {
		setupDom();

		const task: Task = {
			id: "TASK-2",
			title: "No docs task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			documentation: [],
		};

		const html = renderModal(task);

		// The documentation section is always rendered (with an add form) and
		// shows a placeholder when there are no entries.
		expect(html).toContain("Documentation");
		expect(html).toContain("No references");
	});
});
