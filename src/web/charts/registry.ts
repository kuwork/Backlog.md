import { echartsEngine } from "./echarts-engine";
import { mermaidEngine } from "./mermaid-engine";
import type { ChartEngine } from "./types";

const engines = new Map<string, ChartEngine>();

export function registerChartEngine(engine: ChartEngine): void {
	for (const lang of engine.languages) {
		engines.set(lang.toLowerCase(), engine);
	}
}

export function getChartEngine(lang: string): ChartEngine | undefined {
	return engines.get(lang.toLowerCase());
}

// Register the built-in engines. Importing this module (via ChartBlock) is enough
// to make every chart language resolvable through getChartEngine.
registerChartEngine(mermaidEngine);
registerChartEngine(echartsEngine);
