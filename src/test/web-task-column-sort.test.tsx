import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import TaskColumn from "../web/components/TaskColumn.tsx";
import type { ReorderTaskPayload } from "../web/lib/api.ts";

const createTask = (overrides: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
};

const renderTaskColumn = (
	tasks: Task[],
	onTaskReorder: (payload: ReorderTaskPayload) => void,
	options: {
		title?: string;
		onCleanup?: () => void;
		selectedTaskIds?: string[];
		selectionOrderIds?: string[];
		draggedTaskId?: string | null;
		laneId?: string;
		dragSourceStatus?: string | null;
		dragSourceLane?: string | null;
		onBatchMove?: (targetStatus: string, targetMilestone?: string | null, orderedTaskIds?: string[]) => void;
	} = {},
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<TaskColumn
					title={options.title ?? "To Do"}
					tasks={tasks}
					onTaskUpdate={() => {}}
					onEditTask={() => {}}
					onTaskReorder={onTaskReorder}
					onCleanup={options.onCleanup}
					selectedTaskIds={options.selectedTaskIds}
					selectionOrderIds={options.selectionOrderIds}
					draggedTaskId={options.draggedTaskId}
					laneId={options.laneId}
					dragSourceStatus={options.dragSourceStatus}
					dragSourceLane={options.dragSourceLane}
					onBatchMove={options.onBatchMove}
				/>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const openActionsMenu = async (container: HTMLElement) => {
	const actionsButton = container.querySelector("button[title='Column actions']");
	expect(actionsButton).toBeTruthy();
	await clickElement(actionsButton as Element);
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskColumn priority sorting", () => {
	it("emits a full-column reorder payload sorted by priority", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "Low", priority: "low" }),
				createTask({ id: "TASK-2", title: "High", priority: "high" }),
				createTask({ id: "TASK-3", title: "None" }),
				createTask({ id: "TASK-4", title: "Medium", priority: "medium" }),
			],
			(payload) => payloads.push(payload),
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Apply Priority Order"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(payloads).toEqual([
			{
				taskId: "TASK-2",
				targetStatus: "To Do",
				orderedTaskIds: ["TASK-2", "TASK-4", "TASK-1", "TASK-3"],
			},
		]);
	});

	it("does not emit a reorder payload when priority order is unchanged", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-2", title: "High", priority: "high" }),
				createTask({ id: "TASK-4", title: "Medium", priority: "medium" }),
				createTask({ id: "TASK-1", title: "Low", priority: "low" }),
				createTask({ id: "TASK-3", title: "None" }),
			],
			(payload) => payloads.push(payload),
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Apply Priority Order"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(payloads).toEqual([]);
	});
});

const getTaskOrderFromDom = (container: HTMLElement): string[] => {
	const cards = Array.from(container.querySelectorAll(".space-y-3 > div.relative"));
	return cards.map((card) => {
		const match = card.textContent?.match(/TASK-\d+/);
		return match?.[0] ?? "";
	}).filter(Boolean);
};

describe("TaskColumn creation-date sorting", () => {
	it("sorts tasks by created date ascending locally", async () => {
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "Third", createdDate: "2026-01-03" }),
				createTask({ id: "TASK-2", title: "First", createdDate: "2026-01-01" }),
				createTask({ id: "TASK-3", title: "Second", createdDate: "2026-01-02" }),
			],
			() => {},
		);

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("↑Created"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-2", "TASK-3", "TASK-1"]);
	});

	it("sorts tasks by created date descending locally", async () => {
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "First", createdDate: "2026-01-01" }),
				createTask({ id: "TASK-2", title: "Third", createdDate: "2026-01-03" }),
				createTask({ id: "TASK-3", title: "Second", createdDate: "2026-01-02" }),
			],
			() => {},
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("↓Created"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-2", "TASK-3", "TASK-1"]);
	});

	it("keeps tasks without createdDate at the end when sorting ascending", async () => {
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-3", title: "No date 2", createdDate: "" }),
				createTask({ id: "TASK-1", title: "Has date", createdDate: "2026-01-02" }),
				createTask({ id: "TASK-2", title: "No date 1", createdDate: "" }),
			],
			() => {},
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("↑Created"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	it("clears the active sort when the same created-date option is clicked again", async () => {
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "Third", createdDate: "2026-01-03" }),
				createTask({ id: "TASK-2", title: "First", createdDate: "2026-01-01" }),
			],
			() => {},
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("↑Created"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-2", "TASK-1"]);

		await openActionsMenu(container);
		const sortButtonAgain = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("↑Created"),
		);
		expect(sortButtonAgain).toBeTruthy();
		await clickElement(sortButtonAgain as Element);
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2"]);
	});
});

describe("TaskColumn cleanup affordance", () => {
	it("renders cleanup when supplied for a non-Done terminal column", async () => {
		let cleanupCalls = 0;
		const container = renderTaskColumn([createTask({ status: "Closed" })], () => {}, {
			title: "Closed",
			onCleanup: () => {
				cleanupCalls += 1;
			},
		});

		const cleanupButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Clean Up Old Tasks"),
		);
		expect(cleanupButton).toBeTruthy();

		await clickElement(cleanupButton as Element);
		expect(cleanupCalls).toBe(1);
	});
});

const applyColumnSortOption = async (container: HTMLElement, optionText: string) => {
	await openActionsMenu(container);
	const option = Array.from(container.querySelectorAll("button")).find((button) =>
		button.textContent?.includes(optionText),
	);
	expect(option).toBeTruthy();
	await clickElement(option as Element);
};

/** An active sort is only visible in the menu: the active row owns the clear-sort affordance. */
const activeSortLabel = async (container: HTMLElement): Promise<string | null> => {
	await openActionsMenu(container);
	const active = Array.from(container.querySelectorAll('button[role="menuitem"]')).find((item) =>
		item.querySelector('button[aria-label="Clear sort"]'),
	);
	return active ? active.textContent?.trim() ?? "" : null;
};

/** Fires a drag event on the column root: the handlers sit there, so the event has to start inside
 * the column (bubbling only travels upwards). */
const dragEventOnColumn = async (
	container: HTMLElement,
	type: string,
	data: Record<string, string> = {},
) => {
	const column = container.querySelector("h3")?.closest(".rounded-lg");
	expect(column).toBeTruthy();
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", {
		value: { setData: () => {}, getData: (key: string) => data[key] ?? "", effectAllowed: "" },
	});
	// A dragleave only counts as leaving the column when the pointer went somewhere outside it.
	if (type === "dragleave") {
		Object.defineProperty(event, "relatedTarget", { value: document.body });
	}
	await act(async () => {
		(column as Element).dispatchEvent(event);
		await Promise.resolve();
	});
};

/** Drops onto the column itself. A real drop is always preceded by the drag entering the column,
 * and that entry is the only thing that tells the column a drag from elsewhere is over it, so it is
 * replayed here. The hover that picks a position is a separate step: it is the dragover on a card,
 * which `hoverOnCard` fires, and a dragover on the column root would clear it again. */
const dropOnColumn = async (container: HTMLElement, data: Record<string, string>) => {
	await dragEventOnColumn(container, "dragenter", data);
	await dragEventOnColumn(container, "drop", data);
};

/** Hovers a card: the column reads the preview from the dragover events on the card wrappers.
 * JSDOM lays nothing out, so the rect is supplied and the column can read which half the pointer is
 * in, the same way a real hover decides between inserting above and below the card. */
const hoverOnCard = async (container: HTMLElement, taskId: string, half: "top" | "bottom" = "bottom") => {
	const card = Array.from(container.querySelectorAll(".space-y-3 > div.relative")).find((element) =>
		element.textContent?.includes(taskId),
	);
	expect(card).toBeTruthy();
	(card as HTMLElement).getBoundingClientRect = () =>
		({ top: 0, height: 40, left: 0, right: 100, bottom: 40, width: 100, x: 0, y: 0 }) as DOMRect;
	const event = new window.Event("dragover", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clientY", { value: half === "top" ? 5 : 35 });
	await act(async () => {
		(card as Element).dispatchEvent(event);
		await Promise.resolve();
	});
};

describe("TaskColumn cross-column drop and manual sort", () => {
	const renderSortedTarget = (
		onTaskReorder: (payload: ReorderTaskPayload) => void,
		options: {
			selectedTaskIds?: string[];
			selectionOrderIds?: string[];
			draggedTaskId?: string | null;
			laneId?: string;
			dragSourceStatus?: string | null;
			dragSourceLane?: string | null;
			onBatchMove?: (targetStatus: string, targetMilestone?: string | null, orderedTaskIds?: string[]) => void;
		} = {},
	) =>
		renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "First" }),
				createTask({ id: "TASK-2", title: "Second" }),
				createTask({ id: "TASK-3", title: "Third" }),
			],
			onTaskReorder,
			{ title: "In Progress", ...options },
		);

	it("clears the target column's manual sort when a card is dropped in from another column", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload));
		await applyColumnSortOption(container, "↓ID");
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);

		await dropOnColumn(container, { "text/plain": "TASK-9", "text/status": "To Do" });

		// The drag entering the column stands the sort down, so the order that goes out is the default
		// one the column showed for as long as the card was over it - not the order the sort reads in.
		expect(payloads).toEqual([
			{
				taskId: "TASK-9",
				targetStatus: "In Progress",
				orderedTaskIds: ["TASK-1", "TASK-2", "TASK-3", "TASK-9"],
			},
		]);
		expect(await activeSortLabel(container)).toBeNull();
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	it("clears the target column's manual sort when a selection is dropped in from another column", async () => {
		const batchOrders: (string[] | undefined)[] = [];
		const container = renderSortedTarget(() => {}, {
			selectedTaskIds: ["TASK-1", "TASK-2"],
			selectionOrderIds: ["TASK-1", "TASK-2"],
			onBatchMove: (_targetStatus, _targetMilestone, orderedTaskIds) => batchOrders.push(orderedTaskIds),
		});
		await applyColumnSortOption(container, "↓ID");
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);

		await dropOnColumn(container, { "text/plain": "TASK-1", "text/status": "To Do" });

		// The selection keeps the order the default view read in, with the cards left behind ahead of it.
		expect(batchOrders).toEqual([["TASK-3", "TASK-1", "TASK-2"]]);
		expect(await activeSortLabel(container)).toBeNull();
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	it("clears the column's manual sort when a card is reordered inside its own column", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload), {
			dragSourceStatus: "In Progress",
		});
		await applyColumnSortOption(container, "↓ID");
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);

		// Released over the column's empty space, which appends: the sorted view promised one order
		// and the drop writes another, so the sort cannot stay and lie about where the card went.
		await dropOnColumn(container, { "text/plain": "TASK-3", "text/status": "In Progress" });

		expect(payloads).toEqual([
			{ taskId: "TASK-3", targetStatus: "In Progress", orderedTaskIds: ["TASK-2", "TASK-1", "TASK-3"] },
		]);
		expect(await activeSortLabel(container)).toBeNull();
	});

	it("keeps the column's manual sort when a card is released where it already sits", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload), {
			draggedTaskId: "TASK-3",
			laneId: "lane:none",
			dragSourceStatus: "In Progress",
			dragSourceLane: "lane:none",
		});
		await applyColumnSortOption(container, "↓ID");

		await hoverOnCard(container, "TASK-3");
		await dropOnColumn(container, {
			"text/plain": "TASK-3",
			"text/status": "In Progress",
			"text/lane": "lane:none",
		});

		// Nothing moved, so nothing was written and the reader keeps the sort they chose.
		expect(payloads).toEqual([]);
		expect(await activeSortLabel(container)).not.toBeNull();
	});

	it("clears the target column's manual sort when a drop only changes the lane", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload), { laneId: "lane:none" });
		await applyColumnSortOption(container, "↓ID");

		// Same status, different lane: the board draws one column per lane and status, so this lands
		// in another column and that column's sort retires exactly like a cross-status drop.
		await dropOnColumn(container, {
			"text/plain": "TASK-9",
			"text/status": "In Progress",
			"text/lane": "lane:milestone:release-1",
		});

		expect(payloads).toEqual([
			{
				taskId: "TASK-9",
				targetStatus: "In Progress",
				orderedTaskIds: ["TASK-1", "TASK-2", "TASK-3", "TASK-9"],
			},
		]);
		expect(await activeSortLabel(container)).toBeNull();
	});
});

describe("TaskColumn manual sort under a drag from another column", () => {
	const renderSortedTarget = (
		onTaskReorder: (payload: ReorderTaskPayload) => void,
		options: {
			draggedTaskId?: string | null;
			dragSourceStatus?: string | null;
			dragSourceLane?: string | null;
			laneId?: string;
		} = {},
	) =>
		renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "First" }),
				createTask({ id: "TASK-2", title: "Second" }),
				createTask({ id: "TASK-3", title: "Third" }),
			],
			onTaskReorder,
			{ title: "In Progress", ...options },
		);

	it("stands the manual sort down while a drag from another column is over the column", async () => {
		const container = renderSortedTarget(() => {});
		await applyColumnSortOption(container, "↓ID");
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);

		await dragEventOnColumn(container, "dragenter", { "text/plain": "TASK-9", "text/status": "To Do" });

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
		// Standing down is a visit and not a retirement: the reader still owns the sort.
		expect(await activeSortLabel(container)).not.toBeNull();
	});

	it("brings the sorted order back when the drag leaves without dropping", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload));
		await applyColumnSortOption(container, "↓ID");

		await dragEventOnColumn(container, "dragenter", { "text/plain": "TASK-9", "text/status": "To Do" });
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);

		await dragEventOnColumn(container, "dragleave");

		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);
		expect(payloads).toEqual([]);
	});

	it("keeps the sorted order while a drag from the column itself is over it", async () => {
		const container = renderSortedTarget(() => {}, {
			draggedTaskId: "TASK-3",
			dragSourceStatus: "In Progress",
		});
		await applyColumnSortOption(container, "↓ID");

		await dragEventOnColumn(container, "dragenter", { "text/plain": "TASK-3", "text/status": "In Progress" });

		// The order under the cursor stays put for a drag that started here, which is what makes an
		// in-column reposition readable.
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);
	});

	it("reads the hovered index in the default order the column is showing", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderSortedTarget((payload) => payloads.push(payload), {
			draggedTaskId: "TASK-9",
		});
		await applyColumnSortOption(container, "↓ID");
		expect(getTaskOrderFromDom(container)).toEqual(["TASK-3", "TASK-2", "TASK-1"]);

		await dragEventOnColumn(container, "dragenter", { "text/plain": "TASK-9", "text/status": "To Do" });
		// The second card of the order on screen is TASK-2, so a hover above it means index 1 there.
		await hoverOnCard(container, "TASK-2", "top");
		await dropOnColumn(container, { "text/plain": "TASK-9", "text/status": "To Do" });

		expect(payloads).toEqual([
			{
				taskId: "TASK-9",
				targetStatus: "In Progress",
				orderedTaskIds: ["TASK-1", "TASK-9", "TASK-2", "TASK-3"],
			},
		]);
		expect(await activeSortLabel(container)).toBeNull();
	});
});
