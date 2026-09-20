import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import StoredDate from "../web/components/StoredDate";

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
	const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as globalThis.Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	return dom.window.document.getElementById("root") as HTMLElement;
};

const renderDate = (container: HTMLElement, props: Parameters<typeof StoredDate>[0]) => {
	if (!activeRoot) activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(<StoredDate {...props} />);
	});
};

/**
 * Expectations are derived from the runtime timezone rather than hard-coded: the visible value is
 * local time, so a fixed string would only hold on one machine. The hover is zone-independent.
 */
const localDateTime = (utc: [number, number, number, number, number]) =>
	new Date(Date.UTC(utc[0], utc[1], utc[2], utc[3], utc[4], 0)).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

const localDate = (utc: [number, number, number]) =>
	new Date(Date.UTC(utc[0], utc[1], utc[2], 0, 0, 0)).toLocaleDateString();

describe("StoredDate", () => {
	it("renders a stored timestamp in local time and keeps the canonical UTC value on hover", () => {
		const container = setupDom();
		renderDate(container, { value: "2026-02-09 06:01" });

		const span = container.querySelector("span");
		expect(span?.textContent).toBe(localDateTime([2026, 1, 9, 6, 1]));
		expect(span?.getAttribute("title")).toBe("2026-02-09 06:01 (UTC)");
	});

	it("renders a date-only value without claiming a time on hover", () => {
		const container = setupDom();
		renderDate(container, { value: "2026-02-09" });

		const span = container.querySelector("span");
		expect(span?.textContent).toBe(localDate([2026, 1, 9]));
		expect(span?.hasAttribute("title")).toBe(false);
	});

	it("renders the compact relative label with the same hover", () => {
		const container = setupDom();
		renderDate(container, {
			value: "2026-02-21 06:00",
			compact: true,
			now: new Date(Date.UTC(2026, 1, 21, 12, 0, 0)),
		});

		const span = container.querySelector("span");
		expect(span?.textContent).toBe("today");
		expect(span?.getAttribute("title")).toBe("2026-02-21 06:00 (UTC)");
	});

	it("renders missing and unparsable values without a hover", () => {
		const container = setupDom();
		renderDate(container, { value: "" });
		expect(container.querySelector("span")?.hasAttribute("title")).toBe(false);

		renderDate(container, { value: "not-a-date" });
		const span = container.querySelector("span");
		expect(span?.textContent).toBe("not-a-date");
		expect(span?.hasAttribute("title")).toBe(false);
	});

	it("keeps the classes the host applied to the date node", () => {
		const container = setupDom();
		renderDate(container, { value: "2026-02-09 06:01", className: "text-gray-500" });
		expect(container.querySelector("span")?.className).toBe("text-gray-500");
	});
});
