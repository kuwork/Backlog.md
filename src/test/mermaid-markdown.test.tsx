import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import MermaidMarkdown, { parseLocalUrl } from "../web/components/MermaidMarkdown.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

afterEach(() => {
	(globalThis as { window?: typeof window }).window = originalWindowGlobal;
	(globalThis as { document?: Document }).document = originalDocumentGlobal;
	(globalThis as { navigator?: Navigator }).navigator = originalNavigatorGlobal;
	globalThis.fetch = originalFetch;
});

function setupInteractiveDom() {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/documentation/4/test",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
	globalThis.fetch = (() => Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;

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
	return dom;
}

function cleanupInteractiveDom() {
	(globalThis as { window?: typeof window }).window = originalWindowGlobal;
	globalThis.fetch = originalFetch;
}

const render = (source: string, props?: Partial<React.ComponentProps<typeof MermaidMarkdown>>) =>
	renderToString(
		<I18nProvider initialLocale="en">
			<ImageLightboxProvider>
				<MermaidMarkdown source={source} {...props} />
			</ImageLightboxProvider>
		</I18nProvider>,
	);

describe("MermaidMarkdown", () => {
	it("renders angle-bracket type strings without throwing", () => {
		const source =
			"Implemented contracts: getDishesByMenu(String menuId) -> Result<List<MenuItem>>";

		expect(() => render(source)).not.toThrow();

		const html = render(source);
		expect(html).toContain("Result&lt;List&lt;MenuItem&gt;&gt;");
	});

	it("keeps markdown rendering functional for normal content", () => {
		const source = "## Heading\n\nRegular **markdown** content.";
		const html = render(source);

		expect(html).toContain("Heading");
		expect(html).toContain("<strong>markdown</strong>");
	});

	it("preserves non-http autolinks and email autolinks", () => {
		const source = "Links: <ftp://example.com/file> and <foo@example.com>";
		const html = render(source);

		expect(html).toContain('href="ftp://example.com/file"');
		expect(html).toContain('href="mailto:foo@example.com"');
	});

	it("keeps hash-only markdown links on the current route when a base href is present", () => {
		const dom = new JSDOM("<!doctype html><html><head><base href='/'></head><body></body></html>", {
			url: "http://localhost/tasks/BACK-536?view=detail",
		});
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = dom.window.document as unknown as Document;
		globalThis.navigator = dom.window.navigator as unknown as Navigator;

		const source = "# First Heading\n\n[First](#first-heading) [Second](#second-heading)\n\n## Second Heading";
		const html = render(source);
		const renderedDocument = new JSDOM(html).window.document;
		const links = Array.from(renderedDocument.querySelectorAll("p a")).map((link) => link.getAttribute("href"));

		expect(renderedDocument.querySelector("#first-heading")).toBeTruthy();
		expect(renderedDocument.querySelector("#second-heading")).toBeTruthy();
		expect(links).toEqual([
			"/tasks/BACK-536?view=detail#first-heading",
			"/tasks/BACK-536?view=detail#second-heading",
		]);
	});

	describe("heading github-slugger IDs with prefix metadata", () => {
		it("uses github-slugger slugs for numeric prefixed headings", () => {
			const source = "# 1.1 Section Title\n\n## 1.2 Subsection";
			const html = render(source);

			expect(html).toContain('id="11-section-title"');
			expect(html).toContain('data-heading-prefix="1.1"');
			expect(html).toContain('data-heading-prefix="1.2"');
			expect(html).toContain('href="#11-section-title"');
			expect(html).toContain('href="#12-subsection"');
		});

		it("uses github-slugger slugs for alphanumeric prefixed headings", () => {
			const source = "# A1: Section Title\n\n## A2. Subsection";
			const html = render(source);

			expect(html).toContain('id="a1-section-title"');
			expect(html).toContain('data-heading-prefix="A1"');
			expect(html).toContain('data-heading-prefix="A2"');
			expect(html).toContain('href="#a1-section-title"');
			expect(html).toContain('href="#a2-subsection"');
		});

		it("supports dot and enumeration comma separators", () => {
			const source = "# 1.1. Section Title\n\n# 1.2、 Section Title";
			const html = render(source);

			expect(html).toContain('id="11-section-title"');
			expect(html).toContain('data-heading-prefix="1.1"');
			expect(html).toContain('id="12-section-title"');
			expect(html).toContain('data-heading-prefix="1.2"');
		});

		it("falls back to auto-generated slug for headings without a prefix", () => {
			const source = "# Summary";
			const html = render(source);

			expect(html).toContain('id="summary"');
			expect(html).toContain('href="#summary"');
		});

		it("deduplicates repeated headings", () => {
			const source = "# 1.1 Task\n\n# 1.1 Task";
			const html = render(source);

			expect(html).toContain('id="11-task"');
			expect(html).toContain('id="11-task-1"');
		});
	});

	it("encodes spaces in local file link destinations so markdown parses them", () => {
		const source = "[相对路径](backlog/docs/doc-001 - Configuring VIM and Neovim as Default Editor.md)";
		const html = render(source, { onFileClick: () => {} });

		expect(html).toContain('href="backlog/docs/doc-001%20-%20Configuring');
		expect(html).toContain(">相对路径</a>");
	});

	it("renders wikilinks when wikilinkBasePath is provided", () => {
		const source = "See [[concepts/demo|Demo page]].";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain(">Demo page</a>");
	});

	it("applies markdown-it-attrs to wikilinks", () => {
		const source = '[[concepts/demo|Demo]]{style="color: red;"}';
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain('style="color:red"');
	});

	it("renders inline code alias in wikilink", () => {
		const source = "[[concepts/demo|`code`]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain("<code>code</code>");
	});

	it("renders single-line fenced code alias in wikilink", () => {
		const source = "[[concepts/demo|```code```]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain("<code>code</code>");
	});

	it("renders bold, italic and strikethrough alias in wikilink", () => {
		const source = "[[concepts/demo|**bold** *italic* ~~strike~~]]";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain("<strong>bold</strong>");
		expect(html).toContain("<em>italic</em>");
		expect(html).toContain("<del>strike</del>");
	});

	it("renders inline HTML alias in wikilink", () => {
		const source = '[[concepts/demo|<span style="color: red;">red</span>]]';
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toContain('<span style="color:red">red</span>');
	});

	it("applies class attribute to wikilink without alias", () => {
		const source = "[[concepts/demo]]{.some-class}";
		const html = render(source, { wikilinkBasePath: "index.md" });

		expect(html).toContain('href="/wiki/concepts/demo"');
		expect(html).toMatch(/class="[^"]*some-class/);
	});

	it("does not transform wikilinks without wikilinkBasePath", () => {
		const source = "See [[concepts/demo]].";
		const html = render(source);

		expect(html).toContain("[[concepts/demo]]");
	});

	describe("local URL alias rendering", () => {
		const originalWindow = (globalThis as { window?: typeof window }).window;

		beforeEach(() => {
			(globalThis as { window?: typeof window }).window = {
				location: {
					href: "http://localhost:6420/wiki/index",
					origin: "http://localhost:6420",
				},
			} as typeof window;
		});

		afterEach(() => {
			(globalThis as { window?: typeof window }).window = originalWindow;
		});

		it("renders plain local wiki links as WIKI# alias", () => {
			const source = "See [/wiki/concepts/demo](/wiki/concepts/demo).";
			const html = render(source, { onWikiClick: () => {} });

			expect(html).toContain('href="/wiki/concepts/demo"');
			expect(html).toContain(">WIKI#concepts/demo</a>");
		});

		it("still renders wikilinks with custom alias even when onWikiClick is provided", () => {
			const source = "See [[concepts/demo|Demo page]].";
			const html = render(source, { wikilinkBasePath: "index.md", onWikiClick: () => {} });

			expect(html).toContain('href="/wiki/concepts/demo"');
			expect(html).toContain(">Demo page</a>");
			expect(html).not.toContain(">WIKI#concepts/demo</a>");
		});

		it("renders local task links as TASK# alias", () => {
			const source = "See [/task/42](/task/42).";
			const html = render(source, { onTaskClick: () => {} });

			expect(html).toContain('href="/task/42"');
			expect(html).toContain(">TASK#42</a>");
		});

		it("renders local doc links as DOC# alias with line range", () => {
			const source = "See [/documentation/5:19-29](/documentation/5:19-29).";
			const html = render(source, { onDocClick: () => {} });

			expect(html).toContain('href="/documentation/5:19-29"');
			expect(html).toContain(">DOC#5:19-29</a>");
		});

		it("preserves custom label on local doc links with line range", () => {
			const source = "See [doc-5 A1](/documentation/5:16-27).";
			const html = render(source, { onDocClick: () => {} });

			expect(html).toContain('href="/documentation/5:16-27"');
			expect(html).toContain(">doc-5 A1</a>");
			expect(html).not.toContain(">DOC#5:16-27</a>");
		});

		it("preserves line-range suffix in local wiki link href", () => {
			const source = "See [/wiki/concepts/demo:10-20](/wiki/concepts/demo:10-20).";
			const html = render(source, { onWikiClick: () => {} });

			expect(html).toContain('href="/wiki/concepts/demo:10-20"');
			expect(html).toContain(">WIKI#concepts/demo:10-20</a>");
		});

		describe("parseLocalUrl", () => {
			const originalWindow = (globalThis as { window?: typeof window }).window;

			beforeEach(() => {
				(globalThis as { window?: typeof window }).window = {
					location: {
						href: "http://localhost:6420/wiki/index",
						origin: "http://localhost:6420",
					},
				} as typeof window;
			});

			afterEach(() => {
				(globalThis as { window?: typeof window }).window = originalWindow;
			});

			it("parses single-line range on task links", () => {
				const result = parseLocalUrl("/task/42:15");
				expect(result).toEqual({ type: "task", id: "42", alias: "TASK#42:15", range: { lineStart: 15, lineEnd: 15 } });
			});

			it("parses full same-origin task URLs", () => {
				const result = parseLocalUrl("http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion");
				expect(result).toEqual({ type: "task", id: "506", alias: "TASK#506" });
			});

			it("parses line range on doc links", () => {
				const result = parseLocalUrl("/documentation/5:19-29");
				expect(result).toEqual({ type: "doc", id: "5", alias: "DOC#5:19-29", range: { lineStart: 19, lineEnd: 29 } });
			});

			it("parses full same-origin documentation URLs", () => {
				const result = parseLocalUrl("http://localhost:6420/documentation/001/testing-style-guide");
				expect(result).toEqual({ type: "doc", id: "001", alias: "DOC#001" });
			});

			it("parses line range on wiki links", () => {
				const result = parseLocalUrl("/wiki/concepts/demo:10-20");
				expect(result).toEqual({ type: "wiki", id: "concepts/demo", alias: "WIKI#concepts/demo:10-20", range: { lineStart: 10, lineEnd: 20 } });
			});

			it("returns no range for plain local links", () => {
				const result = parseLocalUrl("/task/42");
				expect(result).toEqual({ type: "task", id: "42", alias: "TASK#42" });
			});

			it("parses line range on draft links", () => {
				const result = parseLocalUrl("/draft/3:8-12");
				expect(result).toEqual({ type: "draft", id: "3", alias: "DRAFT#3:8-12", range: { lineStart: 8, lineEnd: 12 } });
			});

			it("parses line range on decision links", () => {
				const result = parseLocalUrl("/decisions/7:5-10");
				expect(result).toEqual({ type: "decision", id: "7", alias: "Decisions#7:5-10", range: { lineStart: 5, lineEnd: 10 } });
			});
		});
	});

	describe("media wikilinks", () => {
		it("renders image wikilink as img tag", () => {
			const source = "![[assets/photo.png|A photo]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('src="/assets/photo.png"');
			expect(html).toContain('alt="A photo"');
			expect(html).toContain("data-lightbox-img");
		});

		it("renders video wikilink as video tag", () => {
			const source = "![[assets/demo.mp4|Demo video]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('<video');
			expect(html).toContain('src="/assets/demo.mp4"');
			expect(html).toContain('controls');
		});

		it("renders audio wikilink as audio tag", () => {
			const source = "![[assets/demo.mp3]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('<audio');
			expect(html).toContain('src="/assets/demo.mp3"');
			expect(html).toContain('controls');
		});

		it("applies dimensions to image wikilink", () => {
			const source = "![[assets/photo.png|A photo|200x300]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('width="200"');
			expect(html).toContain('height="300"');
		});

		it("applies shorthand width to image wikilink", () => {
			const source = "![[assets/photo.png|A photo|200]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('width="200"');
			expect(html).not.toContain('height=');
		});

		it("applies shorthand width to video wikilink", () => {
			const source = "![[assets/demo.mp4|Demo video|200]]";
			const html = render(source, { wikilinkBasePath: "index.md" });

			expect(html).toContain('src="/assets/demo.mp4"');
			expect(html).toContain('width="200"');
			expect(html).not.toContain('height=');
		});

		it("does not render media wikilinks without wikilinkBasePath", () => {
			const source = "![[assets/photo.png]]";
			const html = render(source);

			expect(html).toContain("![[assets/photo.png]]");
			expect(html).not.toContain('src="/assets/photo.png"');
		});
	});

	describe("file path link click", () => {
		let root: Root | null = null;
		let container: HTMLElement | null = null;
		let dom: ReturnType<typeof setupInteractiveDom> | null = null;

		beforeEach(() => {
			dom = setupInteractiveDom();
			container = document.getElementById("root");
			expect(container).toBeTruthy();
			root = createRoot(container as HTMLElement);
		});

		afterEach(() => {
			act(() => {
				root?.unmount();
			});
			cleanupInteractiveDom();
		});

		it("does not parse relative file paths as short local links", () => {
			expect(parseLocalUrl("backlog/docs/migration/doc-001.md")).toBeNull();
			expect(parseLocalUrl("task/42.md")).toBeNull();
		});

		it("calls onFileClick when a relative file path link is clicked", async () => {
			let clickedPath: string | null = null;
			const source = "[相对路径](backlog/docs/doc-001 - Configuring VIM and Neovim as Default Editor.md)";

			act(() => {
				root?.render(
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<MermaidMarkdown
								source={source}
								onFileClick={(path) => {
									clickedPath = path;
								}}
							/>
						</ImageLightboxProvider>
					</I18nProvider>,
				);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			const link = container?.querySelector("a");
			expect(link).not.toBeNull();
			expect(link?.getAttribute("href")).toContain("backlog/docs/doc-001%20");
			expect(link?.getAttribute("title")).toBe("Click to preview file");

			const MouseEventCtor = (dom?.window as unknown as { MouseEvent: typeof MouseEvent })?.MouseEvent;
			await act(async () => {
				link?.dispatchEvent(new MouseEventCtor("click", { bubbles: true, cancelable: true }));
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			expect(clickedPath).not.toBeNull();
			expect(clickedPath ?? "").toContain("backlog/docs/doc-001 - Configuring");
		});

		it("does not treat hash-only links as file links", async () => {
			let clickedPath: string | null = null;
			const source = "# Heading\n\n[Jump to heading](#heading)";

			act(() => {
				root?.render(
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<MermaidMarkdown
								source={source}
								onFileClick={(path) => {
									clickedPath = path;
								}}
							/>
						</ImageLightboxProvider>
					</I18nProvider>,
				);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			const link = container?.querySelector("a");
			expect(link).not.toBeNull();
			expect(link?.getAttribute("href")).toBe("/documentation/4/test#heading");
			expect(link?.getAttribute("title")).toBeNull();

			const MouseEventCtor = (dom?.window as unknown as { MouseEvent: typeof MouseEvent })?.MouseEvent;
			await act(async () => {
				link?.dispatchEvent(new MouseEventCtor("click", { bubbles: true, cancelable: true }));
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			expect(clickedPath).toBeNull();
		});
	});

	describe("hash link click resolution", () => {
		let root: Root | null = null;
		let container: HTMLElement | null = null;
		let dom: ReturnType<typeof setupInteractiveDom> | null = null;

		beforeEach(() => {
			dom = setupInteractiveDom();
			container = document.getElementById("root");
			expect(container).toBeTruthy();
			root = createRoot(container as HTMLElement);
		});

		afterEach(() => {
			act(() => {
				root?.unmount();
			});
			cleanupInteractiveDom();
		});

		it("resolves a prefix hash anchor to the github-slugger heading", async () => {
			const source = "## A1: Section Title\n\n[Jump to A1](#A1)";

			act(() => {
				root?.render(
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<MermaidMarkdown source={source} />
						</ImageLightboxProvider>
					</I18nProvider>,
				);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			const heading = container?.querySelector("h2");
			expect(heading).not.toBeNull();
			expect(heading?.getAttribute("id")).toBe("a1-section-title");
			expect(heading?.getAttribute("data-heading-prefix")).toBe("A1");

			const link = container?.querySelector("p a");
			expect(link).not.toBeNull();
			expect(link?.getAttribute("href")).toBe("/documentation/4/test#A1");

			const MouseEventCtor = (dom?.window as unknown as { MouseEvent: typeof MouseEvent })?.MouseEvent;
			await act(async () => {
				link?.dispatchEvent(new MouseEventCtor("click", { bubbles: true, cancelable: true }));
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			expect(window.location.hash).toBe("#A1");
		});

		it("resolves an angle-bracket full-title hash anchor to the github-slugger heading", async () => {
			const source = "## A1: Section Title (details)\n\n[Jump to A1](<#A1: Section Title (details)>)";

			act(() => {
				root?.render(
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<MermaidMarkdown source={source} />
						</ImageLightboxProvider>
					</I18nProvider>,
				);
			});

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			const heading = container?.querySelector("h2");
			expect(heading).not.toBeNull();
			expect(heading?.getAttribute("id")).toBe("a1-section-title-details");

			const link = container?.querySelector("p a");
			expect(link).not.toBeNull();
			expect(link?.getAttribute("href")).toContain("#A1:%20Section%20Title%20");

			const MouseEventCtor = (dom?.window as unknown as { MouseEvent: typeof MouseEvent })?.MouseEvent;
			await act(async () => {
				link?.dispatchEvent(new MouseEventCtor("click", { bubbles: true, cancelable: true }));
				await new Promise((resolve) => setTimeout(resolve, 100));
			});

			expect(window.location.hash).toContain("#A1:%20Section%20Title%20");
		});
	});
});
