import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Decision as BacklogDecision } from "../types/index.ts";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import { ImageLightboxProvider } from "../web/contexts/ImageLightboxContext.tsx";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import { TocProvider } from "../web/contexts/TocContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { useHashScroll } from "../web/hooks/useHashScroll.ts";

const originalFetch = globalThis.fetch;
const originalWindowGlobal = (globalThis as { window?: typeof window }).window;
const originalDocumentGlobal = (globalThis as { document?: Document }).document;
const originalNavigatorGlobal = (globalThis as { navigator?: Navigator }).navigator;

// JSX attribute strings keep "\n" literal, so the markdown source must be a real string.
const DECISION_SOURCE = "## A1: Section Title\n\nBody text";
const SLUGGED_ENTRY = "/decisions/decision-1/alpha#a1-section-title";
const BARE_ENTRY = "/decisions/decision-1#a1-section-title";

function decisionFixture(): BacklogDecision {
	return {
		id: "decision-1",
		title: "Alpha",
		date: "2026-08-01",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: DECISION_SOURCE,
	};
}

function setupInteractiveDom() {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost:6421/decisions/decision-1",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom;
}

/** Stands in for the app shell: the hash hook plus the page under test. */
function Harness({ decisions }: { decisions: BacklogDecision[] }) {
	useHashScroll();
	return <DecisionDetail decisions={decisions} onRefreshData={async () => {}} />;
}

describe("DecisionDetail hash links", () => {
	let root: Root | null = null;
	let container: HTMLElement | null = null;
	let scrolled: HTMLElement[] = [];
	let currentLocation = { hash: "", pathname: "" };
	let decisionFetchCount = 0;

	beforeEach(() => {
		const dom = setupInteractiveDom();
		scrolled = [];
		const proto = dom.window.HTMLElement.prototype as unknown as { scrollIntoView?: () => void };
		proto.scrollIntoView = function scrollIntoView(this: HTMLElement) {
			scrolled.push(this);
		};
		currentLocation = { hash: "", pathname: "" };
		decisionFetchCount = 0;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			if (String(input).includes("/api/decisions/")) decisionFetchCount += 1;
			return new Response(JSON.stringify(decisionFixture()), {
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

	const renderDecisions = async (entry: string, decisions: BacklogDecision[]) => {
		act(() => {
			root?.render(
				<TocProvider>
					<ThemeProvider>
						<I18nProvider initialLocale="en">
							<ImageLightboxProvider>
								<MemoryRouter initialEntries={[entry]}>
									<LocationProbe />
									<Routes>
										<Route path="/decisions/:id/:title" element={<Harness decisions={decisions} />} />
										<Route path="/decisions/:id" element={<Harness decisions={decisions} />} />
									</Routes>
								</MemoryRouter>
							</ImageLightboxProvider>
						</I18nProvider>
					</ThemeProvider>
				</TocProvider>,
			);
		});
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 120));
		});
	};

	it("keeps the scrolled heading when the decisions array refreshes", async () => {
		// Deep link: the decision renders from its own fetch before the parent has loaded decisions.
		await renderDecisions(SLUGGED_ENTRY, []);

		const scrolledHeading = scrolled.at(-1);
		expect(scrolledHeading?.getAttribute("id")).toBe("a1-section-title");
		expect(decisionFetchCount).toBe(1);

		// The parent finishes loading and hands down a fresh decisions array.
		await renderDecisions(SLUGGED_ENTRY, [decisionFixture()]);

		expect(decisionFetchCount).toBe(1);
		expect(container?.querySelector("h2#a1-section-title")).toBe(scrolledHeading);
	});

	it("keeps the anchor when a bare id URL is normalized to its slugged form", async () => {
		await renderDecisions(BARE_ENTRY, [decisionFixture()]);

		expect(currentLocation.pathname).toBe("/decisions/decision-1/alpha");
		expect(currentLocation.hash).toBe("#a1-section-title");
		expect(scrolled.map((element) => element.getAttribute("id"))).toEqual(["a1-section-title"]);
	});
});
