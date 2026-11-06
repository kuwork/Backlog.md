import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { refractor as allRefractor } from "refractor/lib/all.js";
import { refractor as commonRefractor } from "refractor/lib/common.js";
import { PasteAwareMDEditor } from "../web/components/PasteAwareMDEditor.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { registerMarkdownLinkHighlight } from "../web/utils/markdown-link-highlight.ts";
import { registerTopicHighlight } from "../web/utils/topic-highlight.ts";

/**
 * The composer side of the `#topic#` syntax: the grammar the highlight overlay tokenizes with, and
 * the editor wrapper that turns the topic styling on. The saved-card rendering lives in
 * web-memos-page.test.tsx; the autocomplete menu logic in web-topic-autocomplete.test.ts.
 */

interface HighlightNode {
	type: string;
	value?: string;
	properties?: { className?: string[] | string };
	children?: HighlightNode[];
}

const classesOf = (node: HighlightNode | undefined): string[] => {
	const raw = node?.properties?.className;
	return Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\s+/) : [];
};

const flatText = (nodes: HighlightNode[] | undefined): string =>
	(nodes ?? []).map((node) => (node.type === "text" ? (node.value ?? "") : flatText(node.children))).join("");

describe("registerTopicHighlight", () => {
	it("tokenizes a closed #topic# as one uniform run instead of a heading", () => {
		registerTopicHighlight();
		for (const instance of [commonRefractor, allRefractor]) {
			const children = instance.highlight("#人类# 笔记本", "markdown").children as unknown as HighlightNode[];
			const topic = children.find((node) => classesOf(node).includes("topic"));
			expect(topic).toBeTruthy();
			expect(flatText(topic?.children)).toBe("#人类#");
			// The rest of the line stays outside the token, and no heading token swallowed the line.
			expect(children.filter((node) => classesOf(node).includes("title"))).toHaveLength(0);
		}
	});

	it("tokenizes the still-open run at end of line, which is what the menu offers to close", () => {
		const children = allRefractor.highlight("看看 #人类", "markdown").children as unknown as HighlightNode[];
		const topic = children.find((node) => classesOf(node).includes("topic"));
		expect(flatText(topic?.children)).toBe("#人类");
	});

	it("leaves real headings alone: `# ` is a title, not a topic", () => {
		for (const source of ["# Title text", "###### Deep title"]) {
			const children = allRefractor.highlight(source, "markdown").children as unknown as HighlightNode[];
			expect(children.some((node) => classesOf(node).includes("topic"))).toBe(false);
			expect(children.some((node) => classesOf(node).includes("title"))).toBe(true);
		}
	});

	it("is idempotent, so re-renders of topic-aware editors cannot stack the token", () => {
		registerTopicHighlight();
		registerTopicHighlight();
		const children = allRefractor.highlight("#once# and #twice#", "markdown").children as unknown as HighlightNode[];
		expect(children.filter((node) => classesOf(node).includes("topic"))).toHaveLength(2);
	});
});

describe("registerMarkdownLinkHighlight", () => {
	it("tokenizes a pointy-bracket destination with spaces and a fullwidth colon", () => {
		registerMarkdownLinkHighlight();
		for (const instance of [commonRefractor, allRefractor]) {
			const children = instance.highlight(
				"见 [Memos-集成](<../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>) 与 [[page]]。",
				"markdown",
			).children as unknown as HighlightNode[];
			const links = children.filter((node) => classesOf(node).includes("mdlink"));
			expect(links).toHaveLength(1);
			expect(flatText(links[0]?.children)).toBe(
				"[Memos-集成](<../../docs/memos/doc-20 - 快速笔记：Memos-集成.md:10-20>)",
			);
		}
	});

	it("covers image links and an ASCII colon inside the filename", () => {
		registerMarkdownLinkHighlight();
		const children = allRefractor.highlight("![图](<img/报告:2024版.png>)", "markdown")
			.children as unknown as HighlightNode[];
		const links = children.filter((node) => classesOf(node).includes("mdlink"));
		expect(links).toHaveLength(1);
		expect(flatText(links[0]?.children)).toBe("![图](<img/报告:2024版.png>)");
	});

	it("also colours a bare-space destination, which the render-time join pass heals", () => {
		registerMarkdownLinkHighlight();
		const children = allRefractor.highlight("[Memos-集成](doc-20 - 快速笔记：Memos-集成.md:10-20)", "markdown")
			.children as unknown as HighlightNode[];
		const links = children.filter((node) => classesOf(node).includes("mdlink"));
		expect(links).toHaveLength(1);
		expect(flatText(links[0]?.children)).toBe("[Memos-集成](doc-20 - 快速笔记：Memos-集成.md:10-20)");
	});

	it("paints both doc-34 space-bearing links and leaves the ASCII ones to the built-in grammar", () => {
		registerMarkdownLinkHighlight();
		const source = [
			"[duckdb](../../duckdb/doc-26 - DuckDB-Explorer-演示.md)",
			"[duckdb:10-50](<../../duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)",
			"[auto-port](../../../../wiki/concepts/auto-port.md)",
			"[auto-port:10-50](../../../../wiki/concepts/auto-port.md:10-50)",
		].join("\n");
		const children = allRefractor.highlight(source, "markdown").children as unknown as HighlightNode[];
		const links = children.filter((node) => classesOf(node).includes("mdlink"));
		expect(links).toHaveLength(2);
		expect(flatText(links[0]?.children)).toBe("[duckdb](../../duckdb/doc-26 - DuckDB-Explorer-演示.md)");
		expect(flatText(links[1]?.children)).toBe("[duckdb:10-50](<../../duckdb/doc-26 - DuckDB-Explorer-演示.md:10-50>)");
	});

	it("colours empty-label links, which the built-in grammar skips entirely", () => {
		registerMarkdownLinkHighlight();
		const source = ["[](doc.md)", "![](img.png)", "[](doc with space.md)"].join("\n");
		const children = allRefractor.highlight(source, "markdown").children as unknown as HighlightNode[];
		const links = children.filter((node) => classesOf(node).includes("mdlink"));
		expect(links).toHaveLength(3);
		expect(flatText(links[0]?.children)).toBe("[](doc.md)");
		expect(flatText(links[1]?.children)).toBe("![](img.png)");
		expect(flatText(links[2]?.children)).toBe("[](doc with space.md)");
	});

	it("leaves a whitespace-only label to the built-in grammar", () => {
		registerMarkdownLinkHighlight();
		const children = allRefractor.highlight("[ ](doc.md)", "markdown").children as unknown as HighlightNode[];
		expect(children.some((node) => classesOf(node).includes("mdlink"))).toBe(false);
	});

	it("leaves a space-free link to the built-in markdown grammar", () => {
		registerMarkdownLinkHighlight();
		const children = allRefractor.highlight("[plain](doc-20.md:10-20)", "markdown")
			.children as unknown as HighlightNode[];
		expect(children.some((node) => classesOf(node).includes("mdlink"))).toBe(false);
	});

	it("is idempotent, so re-renders cannot stack the token", () => {
		registerMarkdownLinkHighlight();
		registerMarkdownLinkHighlight();
		const children = allRefractor.highlight("[a](<a b.md>) and [c](<c d.md>)", "markdown")
			.children as unknown as HighlightNode[];
		expect(children.filter((node) => classesOf(node).includes("mdlink"))).toHaveLength(2);
	});
});

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
	url: "http://localhost/memos",
	pretendToBeVisual: true,
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document as unknown as Document;
globalThis.navigator = dom.window.navigator as unknown as Navigator;
globalThis.localStorage = dom.window.localStorage as unknown as Storage;
globalThis.Event = dom.window.Event as unknown as typeof globalThis.Event;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement as unknown as typeof globalThis.HTMLTextAreaElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement as unknown as typeof globalThis.HTMLInputElement;
globalThis.KeyboardEvent = dom.window.KeyboardEvent as unknown as typeof globalThis.KeyboardEvent;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as never;
globalThis.cancelAnimationFrame = ((handle: number) => clearTimeout(handle)) as never;
// WebSocket stub: the editor must not dial out from a test.
(globalThis as { WebSocket?: unknown }).WebSocket = class {
	close() {}
	addEventListener() {}
} as never;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let setValueExternal: ((value: string) => void) | null = null;

function Harness({ suggestions, initial }: { suggestions?: string[]; initial: string }) {
	const [value, setValue] = useState(initial);
	setValueExternal = setValue;
	return (
		<I18nProvider initialLocale="zh-CN">
			<PasteAwareMDEditor value={value} onChange={(next) => setValue(next ?? "")} topicSuggestions={suggestions} />
			<span id="echo">{value}</span>
		</I18nProvider>
	);
}

describe("PasteAwareMDEditor highlight overlay", () => {
	let root: Root | null = null;
	const container = document.getElementById("root") as HTMLElement;

	const renderHarness = async (props: { suggestions?: string[]; initial: string }) => {
		root = createRoot(container);
		await act(async () => {
			root?.render(<Harness {...props} />);
		});
		await wait(50);
	};

	afterEach(() => {
		act(() => root?.unmount());
		root = null;
	});

	it("marks the wrapper topic-aware and chips the typed topic in the overlay", async () => {
		await renderHarness({ suggestions: ["灵感"], initial: "#人类# 笔记本" });
		const fieldset = container.querySelector("fieldset");
		expect(fieldset?.className).toContain("topic-aware");
		// The overlay is what the user sees behind the transparent textarea: the closed topic must
		// arrive as one `token topic` run, not a heading with a lone colored hash.
		const topic = container.querySelector(".w-md-editor-text-pre .token.topic");
		expect(topic).toBeTruthy();
		expect(topic?.textContent).toBe("#人类#");
	});

	it("keeps the wrapper plain when the editor has no topic vocabulary", async () => {
		await renderHarness({ initial: "Just #人类# text" });
		const fieldset = container.querySelector("fieldset");
		expect(fieldset?.className).not.toContain("topic-aware");
	});

	it("closes the topic on Enter, exactly as the menu promised", async () => {
		await renderHarness({ suggestions: ["人类", "天气"], initial: "" });
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).toBeTruthy();
		// React's input-event polyfill reaches for IE's attachEvent on the focused element; jsdom
		// has none, so stub the pair it uses to keep the run free of stack-trace noise.
		Object.assign(textarea, { attachEvent: () => {}, detachEvent: () => {} });
		textarea.focus();

		await act(async () => {
			setValueExternal?.("#人类");
			await Promise.resolve();
		});
		textarea.selectionStart = 3;
		textarea.selectionEnd = 3;
		// keyup (not a native input event) schedules the menu evaluation: React's input polyfill
		// trips over jsdom's missing attachEvent, and keyup reaches the same listener.
		await act(async () => {
			textarea.dispatchEvent(new dom.window.KeyboardEvent("keyup", { bubbles: true }));
			await Promise.resolve();
		});
		// The 120ms menu debounce fires a state update; keep it inside act so the console stays clean.
		await act(async () => {
			await wait(300);
		});
		expect(container.querySelector('[data-testid="topic-autocomplete-menu"]')).toBeTruthy();

		await act(async () => {
			textarea.dispatchEvent(
				new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
			);
			await Promise.resolve();
		});
		await wait(100);
		expect(container.querySelector("#echo")?.textContent).toBe("#人类# ");
	});
});
