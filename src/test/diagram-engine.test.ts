import { afterEach, describe, expect, it } from "bun:test";
import { getActiveDiagramEngine, normalizeDiagramEngine, setActiveDiagramEngine } from "../web/charts/diagram-engine";
import { getChartEngine } from "../web/charts/registry";

describe("diagram-engine store", () => {
	afterEach(() => {
		setActiveDiagramEngine("pele");
	});

	it("defaults to pele", () => {
		expect(getActiveDiagramEngine()).toBe("pele");
	});

	it("normalizeDiagramEngine coerces unknown values to pele", () => {
		expect(normalizeDiagramEngine("mermaid")).toBe("mermaid");
		expect(normalizeDiagramEngine("Pele")).toBe("pele");
		expect(normalizeDiagramEngine(undefined)).toBe("pele");
		expect(normalizeDiagramEngine("foobar")).toBe("pele");
	});

	it("flips between backends and is idempotent on the same value", () => {
		setActiveDiagramEngine("mermaid");
		expect(getActiveDiagramEngine()).toBe("mermaid");
		// Re-setting the same value is a no-op (the store guards against redundant notifications).
		setActiveDiagramEngine("mermaid");
		expect(getActiveDiagramEngine()).toBe("mermaid");
		setActiveDiagramEngine("pele");
		expect(getActiveDiagramEngine()).toBe("pele");
	});
});

describe("chart engine resolution by active backend", () => {
	afterEach(() => {
		setActiveDiagramEngine("pele");
	});

	it("resolves mermaid fences to the active engine", () => {
		setActiveDiagramEngine("pele");
		expect(getChartEngine("mermaid")?.id).toBe("pele");
		setActiveDiagramEngine("mermaid");
		expect(getChartEngine("mermaid")?.id).toBe("mermaid");
	});

	it("is case-insensitive on the fence language", () => {
		setActiveDiagramEngine("mermaid");
		expect(getChartEngine("MERMAID")?.id).toBe("mermaid");
	});

	it("resolves non-mermaid languages independently of the active backend", () => {
		setActiveDiagramEngine("mermaid");
		expect(getChartEngine("echarts")?.id).toBe("echarts");
		setActiveDiagramEngine("pele");
		expect(getChartEngine("echarts")?.id).toBe("echarts");
	});
});
