import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;
const originalConfirm = globalThis.confirm;

const STATUSES = ["To Do", "In Progress", "Done"];

const demoteCalls: string[] = [];
const updateCalls: string[] = [];
const alerts: string[] = [];
const pendingDemotes: Array<() => Promise<Response>> = [];

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	// The popup dispatches this event through the bare global, so it has to come from the same
	// realm as the window it is dispatched on.
	globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof globalThis.CustomEvent;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	window.confirm = (() => true) as typeof window.confirm;
	window.alert = ((message?: unknown) => {
		alerts.push(String(message ?? ""));
	}) as typeof window.alert;
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

/** Serves the collections the popup loads, and records every demote and update it sends. */
function serveApi(): void {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (url.includes("/demote")) {
			demoteCalls.push(url);
			const next = pendingDemotes.shift();
			return next ? await next() : json({ success: true });
		}
		if (init?.method === "PUT") {
			updateCalls.push(url);
			return json({});
		}
		if (url.includes("/api/statuses")) return json(STATUSES);
		return json([]);
	}) as unknown as typeof globalThis.fetch;
}

function task(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-08-15 10:00",
	};
}

function renderPopup(taskToShow: Task, onClose: () => void, onSaved?: () => void) {
	return (
		<ThemeProvider>
			<I18nProvider initialLocale="en">
				<MemoryRouter initialEntries={["/"]}>
					<TaskDetailsModal task={taskToShow} isOpen={true} onClose={onClose} onSaved={onSaved} />
				</MemoryRouter>
			</I18nProvider>
		</ThemeProvider>
	);
}

async function openPopup(taskToShow: Task, onClose: () => void, onSaved?: () => void): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(renderPopup(taskToShow, onClose, onSaved));
		await Promise.resolve();
	});
	return container;
}

async function showTask(taskToShow: Task, onClose: () => void, onSaved?: () => void): Promise<void> {
	await act(async () => {
		activeRoot?.render(renderPopup(taskToShow, onClose, onSaved));
		await Promise.resolve();
	});
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
		(candidate.textContent ?? "").includes(text),
	);
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
}

async function click(target: Element | null): Promise<void> {
	await act(async () => {
		target?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
		await Promise.resolve();
	});
}

async function press(key: string): Promise<void> {
	await act(async () => {
		window.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
		await Promise.resolve();
	});
}

afterEach(async () => {
	if (activeRoot) {
		await act(async () => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
	globalThis.confirm = originalConfirm;
	demoteCalls.length = 0;
	updateCalls.length = 0;
	alerts.length = 0;
	pendingDemotes.length = 0;
});

describe("Web demote-to-draft action", () => {
	// Demotion allocates a new draft id and moves the file, so a replay would report a task that no
	// longer exists instead of the original failure.
	it("does not retry the demotion request when the server rejects it", async () => {
		serveApi();
		pendingDemotes.push(async () => json({ error: "demote failed" }, 500));
		const closes: number[] = [];
		const container = await openPopup(task("BACK-1", "Ship the migration"), () => closes.push(1));

		await click(buttonByText(container, "Demote to draft"));

		expect(demoteCalls.length).toBe(1);
		expect(closes.length).toBe(0);
		expect(container.textContent).toContain("demote failed");
	});

	// A continuation of an in-flight demotion must not close or refresh a popup it no longer owns.
	it("ignores a demotion that lands after the popup switched task", async () => {
		serveApi();
		let resolveDemote: ((response: Response) => void) | undefined;
		pendingDemotes.push(
			() =>
				new Promise<Response>((resolve) => {
					resolveDemote = resolve;
				}),
		);
		const closes: number[] = [];
		const saves: number[] = [];
		const container = await openPopup(task("BACK-1", "Ship the migration"), () => closes.push(1), () => {
			saves.push(1);
		});

		await click(buttonByText(container, "Demote to draft"));
		expect(demoteCalls.length).toBe(1);

		// The user moved on before the response arrived.
		await showTask(task("BACK-2", "Unrelated work"), () => closes.push(2), () => {
			saves.push(2);
		});
		await act(async () => {
			resolveDemote?.(json({ success: true }));
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(closes).toEqual([]);
		expect(saves).toEqual([]);
	});

	it("warns that a lost response may still have moved the task", async () => {
		serveApi();
		pendingDemotes.push(async () => {
			throw new TypeError("Failed to fetch");
		});
		const closes: number[] = [];
		const saves: number[] = [];
		const container = await openPopup(task("BACK-1", "Ship the migration"), () => closes.push(1), () => {
			saves.push(1);
		});

		await click(buttonByText(container, "Demote to draft"));

		expect(alerts.length).toBe(1);
		expect(alerts[0]).toContain("may have succeeded");
		// The views are refreshed first so the user can verify the drafts list.
		expect(saves.length).toBe(1);
		expect(closes.length).toBe(1);
	});

	it("blocks the other writes, the shortcuts and a second demotion while the move runs", async () => {
		serveApi();
		let resolveDemote: ((response: Response) => void) | undefined;
		pendingDemotes.push(
			() =>
				new Promise<Response>((resolve) => {
					resolveDemote = resolve;
				}),
		);
		const container = await openPopup(task("BACK-1", "Ship the migration"), () => {});

		await click(buttonByText(container, "Demote to draft"));

		const demoteButton = buttonByText(container, "Demoting");
		expect(demoteButton.disabled).toBe(true);
		expect(buttonByText(container, "Edit").disabled).toBe(true);

		// Neither a repeat click nor the shortcut may start another move.
		await click(demoteButton);
		await press("d");
		await press("e");
		expect(demoteCalls.length).toBe(1);
		expect(container.textContent).not.toContain("Save");

		await act(async () => {
			resolveDemote?.(json({ success: true }));
			await Promise.resolve();
			await Promise.resolve();
		});
	});

	it("refreshes the drafts and closes the popup on success", async () => {
		serveApi();
		const events: string[] = [];
		const closes: number[] = [];
		const saves: number[] = [];
		const container = await openPopup(task("BACK-1", "Ship the migration"), () => closes.push(1), () => {
			saves.push(1);
		});
		window.addEventListener("drafts-updated", () => events.push("drafts-updated"));

		await click(buttonByText(container, "Demote to draft"));

		expect(demoteCalls.length).toBe(1);
		expect(saves.length).toBe(1);
		expect(events).toEqual(["drafts-updated"]);
		expect(closes.length).toBe(1);
	});
});
