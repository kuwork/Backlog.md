import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage.tsx";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;

const createMilestone = (overrides: Partial<Milestone>): Milestone => ({
	id: "m-1",
	title: "Release 1",
	description: "",
	rawContent: "",
	...overrides,
});

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
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

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const renderPage = (milestoneEntities: Milestone[]): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider>
				<MemoryRouter>
					<MilestonesPage
						tasks={[]}
						statuses={["To Do", "In Progress", "Done"]}
						milestoneEntities={milestoneEntities}
						archivedMilestones={[]}
						onEditTask={() => {}}
					/>
				</MemoryRouter>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const renderDetailsModal = (milestone: Milestone): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<I18nProvider>
				<ThemeProvider>
					<MemoryRouter>
						<MilestoneDetailsModal
							milestoneId={milestone.id}
							milestone={milestone}
							tasks={[]}
							isOpen={true}
							onClose={() => {}}
							onEditTask={() => {}}
						/>
					</MemoryRouter>
				</ThemeProvider>
			</I18nProvider>,
		);
	});
	return container as HTMLElement;
};

const findRow = (container: HTMLElement, label: string): string | undefined =>
	Array.from(container.querySelectorAll("span,div"))
		.map((element) => element.textContent ?? "")
		.find((text) => text.startsWith(`${label}:`));

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web milestone timestamps", () => {
	describe("milestones page card", () => {
		it("shows Last Updated from updatedDate when present", () => {
			const milestone = createMilestone({
				createdDate: "2025-01-01 08:00",
				updatedDate: "2026-09-07 17:01",
			});
			const container = renderPage([milestone]);
			const row = findRow(container, "Last Updated");
			expect(row).toBeDefined();
			expect(row).toContain("2026");
			expect(row).not.toContain("2025");
		});

		it("falls back to createdDate when updatedDate is missing", () => {
			const milestone = createMilestone({
				createdDate: "2025-03-04 09:30",
			});
			const container = renderPage([milestone]);
			const row = findRow(container, "Last Updated");
			expect(row).toBeDefined();
			expect(row).toContain("2025");
		});

		it("shows nothing for legacy milestones without timestamps", () => {
			const milestone = createMilestone({ plannedStart: "2026-10-01" });
			const container = renderPage([milestone]);
			expect(container.textContent).toContain("Planned Start: 2026-10-01");
			expect(findRow(container, "Last Updated")).toBeUndefined();
		});
	});

	describe("milestone details modal", () => {
		it("shows Created and Updated times when both exist", () => {
			const milestone = createMilestone({
				createdDate: "2025-01-01 08:00",
				updatedDate: "2026-09-07 17:01",
			});
			const container = renderDetailsModal(milestone);
			expect(container.textContent).toContain("Created");
			expect(container.textContent).toContain("Updated");
			expect(container.textContent).toContain("2025");
			expect(container.textContent).toContain("2026");
		});

		it("shows only Created when the milestone was never updated", () => {
			const milestone = createMilestone({
				createdDate: "2025-03-04 09:30",
			});
			const container = renderDetailsModal(milestone);
			expect(container.textContent).toContain("Created");
			expect(container.textContent).toContain("2025");
			expect(container.textContent).not.toContain("Updated");
		});

		it("shows no timestamp rows for legacy milestones", () => {
			const milestone = createMilestone({ dueDate: "2026-12-31" });
			const container = renderDetailsModal(milestone);
			const text = container.textContent ?? "";
			expect(text).not.toContain("Created");
			expect(text).not.toContain("Updated");
		});
	});
});
