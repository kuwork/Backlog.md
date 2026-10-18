import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	QueryResultProvider,
	type QueryResultRegistryApi,
	useQueryResultRegistry,
} from "../web/charts/query-result-registry.tsx";

let root: Root | null = null;
let container: HTMLElement | null = null;
let api: QueryResultRegistryApi | null = null;

function Probe() {
	api = useQueryResultRegistry();
	return null;
}

beforeEach(() => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	container = document.getElementById("root");
	root = createRoot(container as HTMLElement);
	act(() => {
		root?.render(
			<QueryResultProvider>
				<Probe />
			</QueryResultProvider>,
		);
	});
});

afterEach(() => {
	act(() => {
		root?.unmount();
	});
});

describe("QueryResultRegistry (BACK-814)", () => {
	it("stores and reads a result by id, bumping version", () => {
		expect(api).not.toBeNull();
		expect(api?.version).toBe(0);

		act(() => {
			api?.set("q", { columns: ["a"], rows: [[1]] });
		});

		expect(api?.get("q")).toEqual({ columns: ["a"], rows: [[1]] });
		expect(api?.version).toBe(1);
	});

	it("warns on a duplicate id and keeps the later result", () => {
		const warnings: unknown[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => warnings.push(args);
		try {
			act(() => {
				api?.set("q", { columns: ["a"], rows: [[1]] });
				api?.set("q", { columns: ["a"], rows: [[2]] });
			});
		} finally {
			console.warn = original;
		}

		expect(api?.get("q")).toEqual({ columns: ["a"], rows: [[2]] });
		expect(warnings.length).toBe(1);
	});

	it("is scoped to its Provider (a fresh provider starts empty)", () => {
		expect(api?.get("nope")).toBeUndefined();
	});
});
