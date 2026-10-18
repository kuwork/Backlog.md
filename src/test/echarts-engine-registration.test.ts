import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ENGINE_PATH = join(process.cwd(), "src", "web", "charts", "echarts-engine.ts");
const source = readFileSync(ENGINE_PATH, "utf8");

/**
 * Guards BACK-812's "widest possible coverage" promise. A series that is not registered does not
 * just render nothing — `setOption` throws (e.g. `themeRiver` without singleAxis) and the block
 * goes blank, which is invisible in review. These checks fail loudly instead.
 */
describe("echarts engine registration coverage", () => {
	it("registers every built-in series exported by echarts/charts", async () => {
		const charts = await import("echarts/charts");
		const missing = Object.keys(charts).filter((name) => !source.includes(`charts.${name}`));
		expect(missing).toEqual([]);
	});

	it("registers the coordinate systems the supported series depend on", () => {
		// Series names alone are not enough; these are the components whose absence blanks a chart.
		const required = [
			"GridComponent",
			"PolarComponent",
			"SingleAxisComponent",
			"CalendarComponent",
			"ParallelComponent",
			"RadarComponent",
			"GeoComponent",
			"DatasetComponent",
			"TransformComponent",
			"VisualMapComponent",
			"DataZoomComponent",
			"MarkAreaComponent",
		];
		const missing = required.filter((name) => !source.includes(`components.${name}`));
		expect(missing).toEqual([]);
	});
});
