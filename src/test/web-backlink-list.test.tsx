import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { BacklinkList } from "../web/components/BacklinkList.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import type { BacklinkSource } from "../web/utils/backlinks.ts";

const originalWindow = (globalThis as { window?: typeof window }).window;
const originalDocument = (globalThis as { document?: Document }).document;
const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

let root: Root | null = null;
let dom: JSDOM | null = null;

beforeEach(() => {
	dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/documentation/4/test",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof MutationObserver;
});

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	root = null;
	(globalThis as { window?: typeof window }).window = originalWindow;
	(globalThis as { document?: Document }).document = originalDocument;
	(globalThis as { navigator?: Navigator }).navigator = originalNavigator;
});

function source(taskId: string, occurrences = 1): BacklinkSource {
	return { taskId, title: `Title ${taskId}`, status: "To Do", occurrences };
}

/** Server render: the dropdown only mounts after a click, so this sees the collapsed trigger. */
function renderServer(sources: BacklinkSource[]): Document {
	const html = renderToString(
		<I18nProvider initialLocale="en">
			<BacklinkList
				sources={sources}
				label="Referenced by:"
				countLabel={(count) => `${count} task${count === 1 ? "" : "s"}`}
				onTaskClick={() => {}}
			/>
		</I18nProvider>,
	);
	return new JSDOM(html).window.document;
}

describe("BacklinkList", () => {
	it("renders nothing when no task references the entity", () => {
		expect(renderServer([]).body.textContent?.trim()).toBe("");
	});

	it("renders the label and count as static text, with only the id list as the trigger", () => {
		const document = renderServer([source("BACK-1"), source("BACK-2")]);
		expect(document.body.textContent?.replace(/\s+/g, " ")).toBe("Referenced by: 2 tasks (BACK-1/2)");
		// Exactly one trigger, and it carries only the abbreviated id list (first id keeps its prefix).
		const buttons = document.querySelectorAll("button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.textContent).toBe("BACK-1/2");
	});

	it("opens a dropdown listing each task id and title, folding the count into repeated titles", async () => {
		act(() => {
			root = createRoot(document.getElementById("root") as HTMLElement);
			root.render(
				<I18nProvider initialLocale="en">
					<BacklinkList
						sources={[source("BACK-1"), source("BACK-2", 3)]}
						label="Referenced by:"
						countLabel={(count) => `${count} tasks`}
						onTaskClick={() => {}}
					/>
				</I18nProvider>,
			);
		});
		const trigger = document.querySelector("button");
		expect(trigger).not.toBeNull();
		expect(trigger?.textContent).toBe("BACK-1/2");

		act(() => {
			trigger?.dispatchEvent(new dom!.window.MouseEvent("click", { bubbles: true, cancelable: true }));
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		const rows = document.body.querySelectorAll('a[role="menuitem"]');
		expect(rows).toHaveLength(2);
		expect(rows[0]?.textContent).toContain("BACK-1");
		expect(rows[0]?.textContent).toContain("Title BACK-1");
		expect(rows[1]?.textContent).toContain("BACK-2");
		expect(rows[1]?.textContent).toContain("Title BACK-2");
		expect(rows[1]?.textContent).toContain("3×");
	});
});
