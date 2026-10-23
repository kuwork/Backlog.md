import { getActiveDiagramEngine } from "./diagram-engine";
import { echartsEngine } from "./echarts-engine";
import { mermaidEngine } from "./mermaid-engine";
import { peleEngine } from "./pele-engine";
import type { ChartEngine } from "./types";

const enginesById = new Map<string, ChartEngine>();
const enginesByLang = new Map<string, ChartEngine>();

export function registerChartEngine(engine: ChartEngine): void {
	enginesById.set(engine.id, engine);
	for (const lang of engine.languages) {
		enginesByLang.set(lang.toLowerCase(), engine);
	}
}

export function getChartEngine(lang: string): ChartEngine | undefined {
	const normalized = lang.toLowerCase();
	// `mermaid` blocks can be served by either the Pele or the classic Mermaid
	// backend, chosen at runtime through the active engine setting.
	if (normalized === "mermaid") {
		return enginesById.get(getActiveDiagramEngine());
	}
	return enginesByLang.get(normalized);
}

// Register the built-in engines. Importing this module (via ChartBlock) is enough
// to make every chart language resolvable through getChartEngine.
registerChartEngine(peleEngine);
registerChartEngine(mermaidEngine);
registerChartEngine(echartsEngine);
