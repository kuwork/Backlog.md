import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Switch from "../web/components/Switch.tsx";

let activeRoot: { root: Root; container: HTMLElement } | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.root.unmount());
		activeRoot = null;
	}
});

function renderSwitch(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
	const container = dom.window.document.getElementById("root") as unknown as HTMLElement;
	const root = createRoot(container);
	activeRoot = { root, container };
	act(() => {
		root.render(<Switch checked={false} onChange={() => {}} />);
	});
	return container;
}

describe("Switch", () => {
	it("keeps the sr-only checkbox inside a positioned wrapper", () => {
		const container = renderSwitch();
		const input = container.querySelector("input[role='switch']") as HTMLInputElement | null;
		expect(input).not.toBeNull();
		// The checkbox is `position: absolute` via sr-only. Without a positioned ancestor it
		// resolves against the initial containing block, stays at its unscrolled document
		// position while an inner scroll container moves, and focusing it (clicking the label)
		// scroll-into-views the window to that stale spot — the blank-page jump of BACK-797.
		const wrapper = input?.parentElement;
		expect(wrapper?.className.split(/\s+/)).toContain("relative");
		// The track span stays the input's following sibling so `peer-checked:` still applies.
		expect(wrapper?.lastElementChild?.className).toContain("w-9");
	});
});
