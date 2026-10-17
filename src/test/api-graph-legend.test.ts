import { afterEach, describe, expect, it } from "bun:test";
import { apiClient } from "../web/lib/api";
import { type GraphLegendConfig, hasLegendConfig, saveLegendConfig } from "../web/utils/graph-legend-config.ts";

const originalFetch = globalThis.fetch;

const SAMPLE: GraphLegendConfig = {
	types: { Person: { caption: "{{name}}", color: "#3b82f6", rules: [] } },
	captionsVisible: true,
	relations: {},
	hidden: [],
};

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
		handler(String(input), init)) as unknown as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("apiClient graph legend (BACK-807)", () => {
	it("fetchGraphLegend returns the normalized config on 200", async () => {
		mockFetch((url) => {
			expect(url).toContain("/api/graph/legend?database=demo");
			return new Response(JSON.stringify(SAMPLE), { status: 200 });
		});
		const cfg = await apiClient.fetchGraphLegend("demo");
		expect(cfg?.types?.Person?.color).toBe("#3b82f6");
	});

	it("fetchGraphLegend returns null on 204 (no stored config)", async () => {
		mockFetch(() => new Response(null, { status: 204 }));
		expect(await apiClient.fetchGraphLegend("demo")).toBeNull();
	});

	it("fetchGraphLegend throws on a server error", async () => {
		mockFetch(() => new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
		await expect(apiClient.fetchGraphLegend("demo")).rejects.toThrow();
	});

	it("saveGraphLegend PUTs the config (and tolerates null for reset)", async () => {
		let seen: { method?: string; body?: string } = {};
		mockFetch((_url, init) => {
			seen = { method: init?.method, body: typeof init?.body === "string" ? init.body : undefined };
			return new Response(null, { status: 204 });
		});
		await apiClient.saveGraphLegend("demo", SAMPLE);
		expect(seen.method).toBe("PUT");
		expect(JSON.parse(seen.body ?? "{}")).toEqual({ database: "demo", config: SAMPLE });

		await apiClient.saveGraphLegend("demo", null);
		expect(JSON.parse(seen.body ?? "{}")).toEqual({ database: "demo", config: null });
	});

	it("saveGraphLegend throws on a server error", async () => {
		mockFetch(() => new Response(JSON.stringify({ error: "boom" }), { status: 500 }));
		await expect(apiClient.saveGraphLegend("demo", SAMPLE)).rejects.toThrow();
	});
});

describe("hasLegendConfig (BACK-807)", () => {
	const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
	const store = new Map<string, string>();

	afterEach(() => {
		store.clear();
		(globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
	});

	function stubStorage() {
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			clear: () => store.clear(),
			key: () => null,
			length: 0,
		} as unknown as Storage;
	}

	it("is false without a stored config and true once saved", () => {
		stubStorage();
		expect(hasLegendConfig("demo")).toBe(false);
		saveLegendConfig("demo", SAMPLE);
		expect(hasLegendConfig("demo")).toBe(true);
	});
});
