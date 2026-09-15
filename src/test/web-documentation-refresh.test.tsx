import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Document as BacklogDocument } from "../types/index.ts";
import DocumentationDetail from "../web/components/DocumentationDetail.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { useHashScroll } from "../web/hooks/useHashScroll.ts";

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

// JSX attribute strings keep "\n" literal, so the markdown source must be a real string.
const DOC_SOURCE = "## A1: Section Title\n\nBody text";
const DOC_PATH = "/documentation/doc-1/alpha#a1-section-title";
const BARE_PATH = "/documentation/doc-1#a1-section-title";

function docFixture(): BacklogDocument {
	return {
		id: "doc-1",
		title: "Alpha",
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent: DOC_SOURCE,
		path: "doc-1 - Alpha.md",
	};
}

function setupInteractiveDom() {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/documentation/doc-1/alpha",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

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

function installScrollSpy(dom: JSDOM): HTMLElement[] {
	const scrolled: HTMLElement[] = [];
	const proto = dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: () => void };
	proto.scrollIntoView = function scrollIntoView(this: HTMLElement) {
		scrolled.push(this);
	};
	return scrolled;
}

/** Stands in for the app shell: the hash hook plus the page under test. */
function Harness({ docs }: { docs: BacklogDocument[] }) {
	useHashScroll();
	return <DocumentationDetail docs={docs} onRefreshData={async () => {}} />;
}

describe("DocumentationDetail refresh while a hash link is open", () => {
	let root: Root | null = null;
	let container: HTMLElement | null = null;
	let scrolled: HTMLElement[] = [];
	let docFetchCount = 0;
	let currentLocation = { hash: "", pathname: "" };

	beforeEach(() => {
		const dom = setupInteractiveDom();
		scrolled = installScrollSpy(dom);
		docFetchCount = 0;
		currentLocation = { hash: "", pathname: "" };
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			if (String(input).includes("/api/docs/")) docFetchCount += 1;
			return new Response(JSON.stringify(docFixture()), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;
		container = document.getElementById("root");
		expect(container).toBeTruthy();
		root = createRoot(container as HTMLElement);
	});

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		(globalThis as { window?: typeof window }).window = originalWindowGlobal;
		(globalThis as { document?: Document }).document = originalDocumentGlobal;
		(globalThis as { navigator?: Navigator }).navigator = originalNavigatorGlobal;
		globalThis.fetch = originalFetch;
	});

	function LocationProbe() {
		const location = useLocation();
		useEffect(() => {
			currentLocation = { hash: location.hash, pathname: location.pathname };
		}, [location]);
		return null;
	}

	const renderDocs = async (docs: BacklogDocument[], entry: string = DOC_PATH) => {
		act(() => {
			root?.render(
				<ThemeProvider>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>
							<MemoryRouter initialEntries={[entry]}>
								<LocationProbe />
								<Routes>
									<Route path="/documentation/:id/:title" element={<Harness docs={docs} />} />
									<Route path="/documentation/:id" element={<Harness docs={docs} />} />
								</Routes>
							</MemoryRouter>
						</ImageLightboxProvider>
					</I18nProvider>
				</ThemeProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});
	};

	it("keeps the document and its scrolled heading when the docs array refreshes", async () => {
		// Deep link: the document renders from its own fetch before the parent has loaded docs.
		await renderDocs([]);

		const scrolledHeading = scrolled.at(-1);
		expect(scrolledHeading?.getAttribute("id")).toBe("a1-section-title");
		expect(docFetchCount).toBe(1);

		// The parent finishes loading and hands down a fresh docs array.
		await renderDocs([docFixture()]);

		expect(docFetchCount).toBe(1);
		expect(container?.querySelector("h2#a1-section-title")).toBe(scrolledHeading);
	});

	it("keeps the anchor when a bare id URL is normalized to its slugged form", async () => {
		await renderDocs([docFixture()], BARE_PATH);

		expect(currentLocation.pathname).toBe("/documentation/doc-1/alpha");
		expect(currentLocation.hash).toBe("#a1-section-title");
		expect(scrolled.map((element) => element.getAttribute("id"))).toEqual(["a1-section-title"]);
	});
});
