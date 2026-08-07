import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";

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

describe("Web task popup acceptance criteria display", () => {
	it("renders existing acceptance criteria numbers in preview", () => {
		setupDom();

		const task: Task = {
			id: "TASK-1",
			title: "Task with acceptance criteria",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			acceptanceCriteriaItems: [
				{ index: 1, text: "First criterion", checked: false },
				{ index: 3, text: "Third criterion", checked: true },
			],
		};

		const html = renderToString(
			<MemoryRouter><I18nProvider initialLocale="en"><ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider></I18nProvider></MemoryRouter>,
		);

		expect(html).toContain("Acceptance Criteria (1/2)");
		expect(html).toContain("#1");
		expect(html).toContain("First criterion");
		expect(html).toContain("#3");
		expect(html).toContain("Third criterion");
	});

	it("does not add acceptance criteria details to board cards", () => {
		setupDom();

		const task: Task = {
			id: "TASK-7",
			title: "Board card task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			acceptanceCriteriaItems: [{ index: 7, text: "Hidden criterion", checked: false }],
		};

		const html = renderToString(
			<MemoryRouter><I18nProvider initialLocale="en"><ThemeProvider>
				<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} />
			</ThemeProvider></I18nProvider></MemoryRouter>,
		);

		expect(html).toContain("Board card task");
		expect(html).not.toContain("Hidden criterion");
		expect(html).not.toContain("#7");
	});
});
