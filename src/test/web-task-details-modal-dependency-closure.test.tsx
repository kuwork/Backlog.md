import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { Locale } from "../web/locales";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { apiClient, ApiError } from "../web/lib/api.ts";
import type { DependencyQueryAnswer } from "../utils/dependency-query.ts";

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

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

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
};

const buildTask = (overrides: Partial<Task>): Task => ({
	id: "BACK-1",
	title: "Subject",
	status: "In Progress",
	assignee: [],
	createdDate: "2025-01-01",
	labels: [],
	dependencies: [],
	...overrides,
});

const renderModal = (task: Task, locale: Locale = "en") => {
	const container = document.getElementById("root") as HTMLElement;
	const root = createRoot(container);
	activeRoot = root;
	act(() => {
		root.render(
			<MemoryRouter>
				<I18nProvider initialLocale={locale}>
					<ThemeProvider>
						<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} availableTasks={[task]} />
					</ThemeProvider>
				</I18nProvider>
			</MemoryRouter>,
		);
	});
	return container;
};

const closureAnswer = {
	subject: { id: "BACK-1", title: "Subject", status: "In Progress", hops: 0, terminal: false },
	dependencies: {
		direction: "dependencies",
		rows: [
			{ id: "BACK-2", title: "Middle", status: "In Progress", hops: 1, terminal: false },
			{ id: "BACK-3", title: "Root", status: "To Do", hops: 2, terminal: false },
			{ id: "BACK-4", title: "Finished", status: "Done", hops: 3, terminal: true },
		],
		blockers: [{ id: "BACK-3", title: "Root", status: "To Do", hops: 2, terminal: false }],
		cycle: [],
		truncated: false,
	},
	dependents: {
		direction: "dependents",
		rows: [{ id: "BACK-9", title: "Waiting", status: "To Do", hops: 1, terminal: false }],
		blockers: [],
		cycle: [],
		truncated: false,
	},
	unresolved: [{ source: "BACK-1", reference: "task-404", kind: "unresolvable", matches: [] }],
	corpus: { tasks: 5, completed: 0, drafts: 0, milestones: 0, released: 0 },
} as DependencyQueryAnswer;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web task popup dependency closure display", () => {
	it("fetches the closure once per open and renders both directions with hop counts", async () => {
		setupDom();

		const original = apiClient.fetchDependencyClosure.bind(apiClient);
		let calls = 0;
		apiClient.fetchDependencyClosure = async () => {
			calls += 1;
			return closureAnswer;
		};
		try {
			const container = renderModal(buildTask({ dependencies: ["BACK-2"] }));
			await waitFor(() => container.textContent?.includes("Waits for") === true);

			expect(calls).toBe(1);
			expect(container.textContent).toContain("BACK-2 (1 hop)");
			expect(container.textContent).toContain("BACK-3 (2 hops)");
			expect(container.textContent).toContain("BACK-4 (3 hops)");
			expect(container.textContent).toContain("Waited on by: BACK-9 (1 hop)");
			// A root blocker and an unresolved reference are the two things only this answer can show.
			expect(container.textContent).toContain("Unresolved references: BACK-1 → task-404");
			expect(container.textContent).not.toContain("Cycle:");
		} finally {
			apiClient.fetchDependencyClosure = original;
		}
	});

	it("does not fetch while the popup is closed", async () => {
		setupDom();

		const original = apiClient.fetchDependencyClosure.bind(apiClient);
		let calls = 0;
		apiClient.fetchDependencyClosure = async () => {
			calls += 1;
			return closureAnswer;
		};
		try {
			const container = document.getElementById("root") as HTMLElement;
			const root = createRoot(container);
			activeRoot = root;
			act(() => {
				root.render(
					<MemoryRouter>
						<I18nProvider initialLocale="en">
							<ThemeProvider>
								<TaskDetailsModal task={buildTask({})} isOpen={false} onClose={() => {}} availableTasks={[buildTask({})]} />
							</ThemeProvider>
						</I18nProvider>
					</MemoryRouter>,
				);
			});
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
			expect(calls).toBe(0);
			expect(container.textContent).not.toContain("Waits for");
		} finally {
			apiClient.fetchDependencyClosure = original;
		}
	});

	it("does not fetch in create mode and shows a muted note when the endpoint fails", async () => {
		setupDom();

		const original = apiClient.fetchDependencyClosure.bind(apiClient);
		let calls = 0;
		apiClient.fetchDependencyClosure = async () => {
			calls += 1;
			throw new Error("404");
		};
		try {
			const container = renderModal(buildTask({}));
			await waitFor(() => container.textContent?.includes("Dependency closure unavailable") === true);
			expect(calls).toBe(1);
			expect(container.textContent).not.toContain("Waits for");
		} finally {
			apiClient.fetchDependencyClosure = original;
		}
	});

	it("refetches only after an inline edit has settled on the server", async () => {
		setupDom();

		const originalFetchClosure = apiClient.fetchDependencyClosure.bind(apiClient);
		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		let closureCalls = 0;
		let updateCalls = 0;
		let releaseUpdate: (() => void) | null = null;
		apiClient.fetchDependencyClosure = async () => {
			closureCalls += 1;
			return closureAnswer;
		};
		apiClient.updateTask = async () => {
			updateCalls += 1;
			// The refetch must not run while the write is still in flight: the write stays pending
			// until the test releases it, after asserting the count has not moved.
			await new Promise<void>((resolve) => {
				releaseUpdate = resolve;
			});
			return buildTask({}) as Task;
		};
		try {
			const container = renderModal(buildTask({ dependencies: ["BACK-2"] }));
			await waitFor(() => container.textContent?.includes("Waits for") === true);
			expect(closureCalls).toBe(1);

			// Change the priority through the select, exactly the inline-edit path the popup uses.
			// The native change event alone drives React's onChange - do not also call the react
			// props handler by hand, that would run the inline-edit path twice.
			const prioritySelect = Array.from(container.querySelectorAll("select")).find((select) =>
				Array.from(select.options).some((option) => option.value === "low"),
			);
			expect(prioritySelect).toBeDefined();
			const ownerWindow = prioritySelect?.ownerDocument.defaultView ?? window;
			const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(prioritySelect), "value")?.set;
			valueSetter?.call(prioritySelect, "high");
			prioritySelect?.dispatchEvent(new ownerWindow.Event("change", { bubbles: true }));

			// The write is still in flight: the optimistic state changed, but the refetch must wait.
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
			expect(updateCalls).toBe(1);
			expect(closureCalls).toBe(1);

			// Settle the write; the refetch follows it.
			await act(async () => {
				releaseUpdate?.();
			});
			await waitFor(() => closureCalls === 2);
			expect(closureCalls).toBe(2);
		} finally {
			apiClient.fetchDependencyClosure = originalFetchClosure;
			apiClient.updateTask = originalUpdateTask;
		}
	});

	it("rolls the chip back and shows the server reason when a dependency write is rejected", async () => {
		setupDom();

		const originalFetchClosure = apiClient.fetchDependencyClosure.bind(apiClient);
		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		let closureCalls = 0;
		apiClient.fetchDependencyClosure = async () => {
			closureCalls += 1;
			return closureAnswer;
		};
		// The gate rejects a write that would close a cycle; the optimistic chip must not survive it.
		apiClient.updateTask = async () => {
			throw new Error("Dependency cycle detected: BACK-1 → BACK-2 → BACK-1");
		};
		try {
			// BACK-2 must be in the corpus so the chip renders as "BACK-2 - Middle" like in the app.
			const subject = buildTask({ dependencies: ["BACK-2"] });
			const middle = buildTask({ id: "BACK-2", title: "Middle" });
			const container = document.getElementById("root") as HTMLElement;
			const root = createRoot(container);
			activeRoot = root;
			act(() => {
				root.render(
					<MemoryRouter>
						<I18nProvider initialLocale="en">
							<ThemeProvider>
								<TaskDetailsModal task={subject} isOpen={true} onClose={() => {}} availableTasks={[subject, middle]} />
							</ThemeProvider>
						</I18nProvider>
					</MemoryRouter>,
				);
			});
			await waitFor(() => container.textContent?.includes("Waits for") === true);
			expect(container.textContent).toContain("BACK-2 - Middle");

			// Remove the chip through the same button the popup renders.
			const removeButton = Array.from(container.querySelectorAll("button")).find(
				(button) => button.getAttribute("aria-label") === "Remove BACK-2",
			);
			expect(removeButton).toBeDefined();
			await act(async () => {
				removeButton?.click();
			});

			// Rejected: the chip comes back, the server's reason is shown next to the input, and the
			// settled write still triggers the closure refetch so the display matches the file.
			await waitFor(() => closureCalls === 2);
			expect(container.textContent).toContain("BACK-2 - Middle");
			expect(container.textContent).toContain("Dependency cycle detected: BACK-1 → BACK-2 → BACK-1");
			expect(closureCalls).toBe(2);
		} finally {
			apiClient.fetchDependencyClosure = originalFetchClosure;
			apiClient.updateTask = originalUpdateTask;
		}
	});

	it("renders a structured gate rejection in the popup locale instead of the raw English text", async () => {
		setupDom();

		const originalFetchClosure = apiClient.fetchDependencyClosure.bind(apiClient);
		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		apiClient.fetchDependencyClosure = async () => closureAnswer;
		// What the server now sends on a cycle rejection: the English message plus a machine-
		// readable code and the chain, so the client can render it in the user's locale.
		apiClient.updateTask = async () => {
			throw new ApiError("This dependency would close a cycle: BACK-1 -> BACK-2 -> BACK-1.", 400, "Bad Request", {
				code: "dependency_cycle",
				detail: { chain: ["BACK-1", "BACK-2", "BACK-1"] },
			});
		};
		try {
			const container = renderModal(buildTask({ dependencies: ["BACK-2"] }), "zh-CN");
			await waitFor(() => container.textContent?.includes("等待") === true);
			const removeButton = Array.from(container.querySelectorAll("button")).find(
				(button) => button.getAttribute("aria-label")?.includes("BACK-2"),
			);
			expect(removeButton).toBeDefined();
			await act(async () => {
				removeButton?.click();
			});

			await waitFor(() => container.textContent?.includes("该依赖会形成循环") === true);
			expect(container.textContent).toContain("该依赖会形成循环：BACK-1 → BACK-2 → BACK-1");
			expect(container.textContent).not.toContain("would close a cycle");
		} finally {
			apiClient.fetchDependencyClosure = originalFetchClosure;
			apiClient.updateTask = originalUpdateTask;
		}
	});
});
