import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

const renderModal = (task: Task, availableTasks: Task[] = [], locale: Locale = "en") =>
	renderToString(
		<MemoryRouter>
			<I18nProvider initialLocale={locale}>
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} availableTasks={availableTasks} />
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

const buildTask = (overrides: Partial<Task>): Task => ({
	id: "BACK-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-01-01",
	labels: [],
	dependencies: [],
	...overrides,
});

describe("Web task popup hierarchy display", () => {
	it("renders a parent row directly below the title for a subtask", () => {
		setupDom();

		const parent = buildTask({ id: "BACK-217", title: "Create web UI for sequences", status: "In Progress" });
		const task = buildTask({ id: "BACK-218", title: "Implement sequence API", parentTaskId: "BACK-217" });

		const html = renderModal(task, [parent, task]);

		expect(html).toContain("Parent");
		expect(html).toContain("BACK-217");
		expect(html).toContain("Create web UI for sequences");
		expect(html).toContain("In Progress");
	});

	it("renders a subtasks section with completion count and progress for a parent task", () => {
		setupDom();

		const task = buildTask({ id: "BACK-217", title: "Create web UI for sequences" });
		const doneSubtask = buildTask({ id: "BACK-218", title: "Implement sequence API", status: "Done", parentTaskId: "BACK-217" });
		const todoSubtask = buildTask({ id: "BACK-219", title: "Create sequence list UI", parentTaskId: "BACK-217" });

		const html = renderModal(task, [task, doneSubtask, todoSubtask]);

		expect(html).toContain("Subtasks");
		expect(html.replace(/<!-- -->/g, "")).toContain("1/2");
		expect(html).toContain("BACK-218");
		expect(html).toContain("Implement sequence API");
		expect(html).toContain("BACK-219");
		expect(html).toContain("Create sequence list UI");
	});

	it("renders both parent row and subtasks for a task in the middle of the hierarchy", () => {
		setupDom();

		const parent = buildTask({ id: "BACK-217", title: "Create web UI for sequences" });
		const task = buildTask({ id: "BACK-218", title: "Implement sequence API", parentTaskId: "BACK-217" });
		const child = buildTask({ id: "BACK-218.1", title: "Add sequence endpoint tests", parentTaskId: "BACK-218" });

		const html = renderModal(task, [parent, task, child]);

		expect(html).toContain("Parent");
		expect(html).toContain("Subtasks");
		expect(html).toContain("BACK-218.1");
	});

	it("renders no hierarchy section when the task has no parent or subtasks", () => {
		setupDom();

		const task = buildTask({ id: "BACK-300", title: "Standalone task" });

		const html = renderModal(task, [task]);

		expect(html).not.toContain(">Parent<");
		expect(html).not.toContain(">Subtasks<");
	});

	it("localizes the hierarchy section labels", () => {
		setupDom();

		const parent = buildTask({ id: "BACK-217", title: "父任务标题", status: "In Progress" });
		const task = buildTask({ id: "BACK-218", title: "子任务", parentTaskId: "BACK-217" });

		const html = renderModal(task, [parent, task], "zh-CN");

		expect(html).toContain("父任务");
		expect(html).toContain("BACK-217");
		expect(html).toContain("父任务标题");
	});
});
