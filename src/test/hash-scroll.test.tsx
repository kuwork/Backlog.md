import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter } from "react-router-dom";
import MermaidMarkdown from "../web/components/MermaidMarkdown.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { useHashScroll } from "../web/hooks/useHashScroll.ts";

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
		url: "http://localhost:6421/documentation/4",
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

type ScrollSpy = HTMLElement[];

function installScrollSpy(dom: JSDOM): ScrollSpy {
	const scrolled: ScrollSpy = [];
	const proto = dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: () => void };
	proto.scrollIntoView = function scrollIntoView(this: HTMLElement) {
		scrolled.push(this);
	};
	return scrolled;
}

// JSX attribute strings keep "\n" literal, so the markdown source must be a real string.
const SECTION_SOURCE = "## A1: Section Title\n\nBody text";

function Harness({ source }: { source: string }) {
	useHashScroll();
	return <MermaidMarkdown source={source} />;
}

function StagedHarness({ source }: { source: string }) {
	useHashScroll();
	const [staged, setStaged] = React.useState("");
	React.useEffect(() => {
		const id = setTimeout(() => setStaged(source), 20);
		return () => clearTimeout(id);
	}, [source]);
	return <MermaidMarkdown source={staged} />;
}

describe("useHashScroll", () => {
	let root: Root | null = null;
	let container: HTMLElement | null = null;
	let dom: ReturnType<typeof setupInteractiveDom> | null = null;
	let scrolled: ScrollSpy = [];

	beforeEach(() => {
		dom = setupInteractiveDom();
		scrolled = installScrollSpy(dom);
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

	const renderAt = async (path: string, node: React.ReactNode) => {
		act(() => {
			root?.render(
				<MemoryRouter initialEntries={[path]}>
					<I18nProvider initialLocale="en">
						<ImageLightboxProvider>{node}</ImageLightboxProvider>
					</I18nProvider>
				</MemoryRouter>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});
	};

	it("scrolls to the slug anchor already present in the URL", async () => {
		await renderAt("/documentation/4#a1-section-title", <Harness source={SECTION_SOURCE} />);

		expect(scrolled.map((element) => element.getAttribute("id"))).toEqual(["a1-section-title"]);
	});

	it("scrolls to a human-readable prefix anchor already present in the URL", async () => {
		await renderAt("/documentation/4#A1", <Harness source={SECTION_SOURCE} />);

		expect(scrolled.map((element) => element.getAttribute("data-heading-prefix"))).toEqual(["A1"]);
	});

	it("waits for content that renders after the initial mount", async () => {
		await renderAt("/documentation/4#a1-section-title", <StagedHarness source={SECTION_SOURCE} />);

		expect(scrolled.map((element) => element.getAttribute("id"))).toEqual(["a1-section-title"]);
	});

	it("does not scroll when the route carries no hash", async () => {
		await renderAt("/documentation/4", <Harness source={SECTION_SOURCE} />);

		expect(scrolled).toEqual([]);
	});

	it("does not scroll when the hash targets no heading", async () => {
		await renderAt("/documentation/4#not-a-heading", <Harness source={SECTION_SOURCE} />);

		expect(scrolled).toEqual([]);
	});
});
