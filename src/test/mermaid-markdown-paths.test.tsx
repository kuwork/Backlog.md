import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";

const originalWindow = (globalThis as { window?: typeof window }).window;
const originalDocument = (globalThis as { document?: Document }).document;
const originalNavigator = (globalThis as { navigator?: Navigator }).navigator;

const render = (source: string, filePath?: string) =>
	renderToString(
		<I18nProvider initialLocale="en">
			<ImageLightboxProvider>
				<MermaidMarkdown source={source} filePath={filePath} />
			</ImageLightboxProvider>
		</I18nProvider>,
	);

describe("BACK-835 rendered HTML destinations", () => {
	beforeEach(() => {
		const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
			url: "http://localhost:6421/documentation/4/test",
		});
		(globalThis as { window?: typeof window }).window = dom.window as unknown as Window & typeof globalThis;
		(globalThis as { document?: Document }).document = dom.window.document as unknown as Document;
		(globalThis as { navigator?: Navigator }).navigator = dom.window.navigator as unknown as Navigator;
		globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	});

	afterEach(() => {
		(globalThis as { window?: typeof window }).window = originalWindow;
		(globalThis as { document?: Document }).document = originalDocument;
		(globalThis as { navigator?: Navigator }).navigator = originalNavigator;
	});

	it("writes the joined path into the emitted img src and a href", () => {
		const html = render(
			"![diagram](./fig.png)\n\n[spec](../shared/spec.md:12-20)",
			"backlog/docs/PRDS/sqlite/doc-24.md",
		);
		expect(html).toContain('src="/backlog/docs/PRDS/sqlite/fig.png"');
		expect(html).toContain('href="/backlog/docs/PRDS/shared/spec.md:12-20"');
	});

	it("leaves entity short links and URL-layer destinations alone", () => {
		const html = render("[doc](/documentation/10:55-74)\n\n[img](/assets/paste/x.png)", "backlog/docs/doc.md");
		expect(html).toContain("/documentation/10:55-74");
		expect(html).toContain("/assets/paste/x.png");
	});

	it("does not rewrite destinations inside a code fence", () => {
		const html = render("```\n[a](./inside.md)\n```", "backlog/docs/doc.md");
		expect(html).not.toContain("/backlog/docs/inside.md");
	});

	it("emits a dead anchor for a reference that escapes the project root", () => {
		const html = render("[bad](../../../../../etc/passwd)", "backlog/docs/doc.md");
		// The hash guard turns the rejected destination into an in-page dead anchor.
		expect(html).toMatch(/href="[^"]*#"/);
		expect(html).not.toContain("etc/passwd");
	});
});
