import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Decision as BacklogDecision, Document as BacklogDocument } from "../types/index.ts";
import { I18nProvider } from "../web/contexts/I18nContext.tsx";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import DocumentationDetail from "../web/components/DocumentationDetail.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const AMBIGUOUS_DOCUMENT_MESSAGE = [
	"Document ID doc-1 is ambiguous; 2 files match:",
	"  - doc-1 - Alpha.md",
	"  - nested/doc-01 - Beta.md",
	"Rename or delete the conflicting files so exactly one of them carries this ID.",
].join("\n");

const AMBIGUOUS_DECISION_MESSAGE = [
	"Decision ID decision-1 is ambiguous; 2 files match:",
	"  - decision-001 - Beta.md",
	"  - decision-1 - Alpha.md",
	"Rename or delete the conflicting files so exactly one of them carries this ID.",
].join("\n");

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

function respondWithConflict(message: string): void {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ error: message }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof globalThis.fetch;
}

async function renderRoute(path: string, pattern: string, element: React.ReactElement): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<I18nProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path={pattern} element={element} />
					</Routes>
				</MemoryRouter>
			</I18nProvider>,
		);
	});
	return container;
}

afterEach(async () => {
	await act(async () => {
		activeRoot?.unmount();
	});
	activeRoot = null;
	globalThis.fetch = originalFetch;
});

describe("ambiguous identity rendering", () => {
	it("DocumentationDetail shows the server candidates and never falls back to cached entries", async () => {
		respondWithConflict(AMBIGUOUS_DOCUMENT_MESSAGE);
		const docs: BacklogDocument[] = [
			{
				id: "doc-1",
				title: "Alpha (cached)",
				type: "other",
				createdDate: "2026-08-01 00:00",
				rawContent: "# Alpha cached body",
				path: "doc-1 - Alpha (cached).md",
			},
		];

		const container = await renderRoute("/documentation/doc-1", "/documentation/:id", <DocumentationDetail docs={docs} onRefreshData={async () => {}} />);

		const text = container.textContent ?? "";
		expect(text).toContain("Document ID doc-1 is ambiguous");
		expect(text).toContain("doc-1 - Alpha.md");
		expect(text).not.toContain("Alpha (cached)");
		expect(text).not.toContain("Alpha cached body");
	});

	it("DecisionDetail shows the server candidates instead of the props entry", async () => {
		respondWithConflict(AMBIGUOUS_DECISION_MESSAGE);
		const decisions: BacklogDecision[] = [
			{
				id: "decision-1",
				title: "Alpha (cached)",
				date: "2026-08-01",
				status: "proposed",
				context: "",
				decision: "",
				consequences: "",
				rawContent: "",
			},
		];

		const container = await renderRoute("/decisions/decision-1", "/decisions/:id", <DecisionDetail decisions={decisions} onRefreshData={async () => {}} />);

		const text = container.textContent ?? "";
		expect(text).toContain("Decision ID decision-1 is ambiguous");
		expect(text).toContain("decision-001 - Beta.md");
		expect(text).not.toContain("Alpha (cached)");
	});
});
