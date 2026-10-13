import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone } from "../types/index.ts";
import MilestoneDetailsModal from "../web/components/MilestoneDetailsModal.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

const originalFetch = globalThis.fetch;

let requestedFilePaths: string[] = [];

beforeEach(() => {
	requestedFilePaths = [];
	globalThis.fetch = ((input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/api/file-content")) {
			const path = new URL(url, "http://localhost").searchParams.get("path") ?? "";
			requestedFilePaths.push(path);
			return Promise.resolve(
				new Response(JSON.stringify({ content: "# Body\n\npreviewed", path, totalLines: 2, isMarkdown: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		}
		return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
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
	return dom.window.document.getElementById("root") as HTMLElement;
};

const createMilestone = (overrides: Partial<Milestone>): Milestone => ({
	id: "m-1",
	title: "Release 1",
	description: "",
	rawContent: "",
	...overrides,
});

const renderModal = async (milestone: Milestone): Promise<HTMLElement> => {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider initialLocale="en">
				<ThemeProvider>
					<MemoryRouter>
						<MilestoneDetailsModal
							milestoneId="m-1"
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
	return container;
};

const findButton = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(text));

describe("Web milestone popup documentation preview", () => {
	it("renders a local documentation entry as a clickable preview button that opens the file preview", async () => {
		const docPath = "backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer.md";
		const container = await renderModal(createMilestone({ documentation: [docPath] }));

		const entry = findButton(container, "doc-23");
		expect(entry).toBeTruthy();
		expect((entry as HTMLButtonElement).getAttribute("title")).toBe("Click to preview");

		// Clicking the entry issues a file-content request for exactly that path, i.e. the preview opened.
		await act(async () => {
			entry?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});

		expect(requestedFilePaths).toContain(docPath);
	});

	it("renders an http(s) documentation entry as an external link, not a preview button", async () => {
		const url = "https://docs.example.com/guide";
		const container = await renderModal(createMilestone({ documentation: [url] }));

		const anchor = container.querySelector<HTMLAnchorElement>(`a[href="${url}"]`);
		expect(anchor).toBeTruthy();
		expect(anchor?.textContent).toBe(url);
		// The URL is opened as a link, so no preview button is produced for it.
		expect(findButton(container, url)).toBeUndefined();
	});

	it("shows the empty documentation hint and issues no preview request when there are none", async () => {
		const container = await renderModal(createMilestone({ documentation: [] }));

		expect(container.textContent).toContain("No documents");
		expect(requestedFilePaths).toEqual([]);
	});
});
