import { resolveFromQuery } from "./from-query";
import type { ChartEngine, ChartRenderer } from "./types";

let registered = false;

/**
 * ECharts engine. The heavy `echarts` bundle is imported lazily inside `load()`
 * so it lands in its own chunk and never blocks first paint. Every built-in
 * series and the components most charts need are registered via `echarts.use`,
 * giving the widest possible chart coverage from a single fence language.
 */
export const echartsEngine: ChartEngine = {
	id: "echarts",
	languages: ["echarts"],
	containerClassName: "chart-block",
	containerStyle: { width: "100%", minHeight: 320 },
	async load(): Promise<ChartRenderer> {
		const echarts = await import("echarts/core");
		const charts = await import("echarts/charts");
		const components = await import("echarts/components");
		const renderers = await import("echarts/renderers");

		if (!registered) {
			echarts.use([
				// Series — every built-in type, so no chart kind is missing from the fence.
				charts.BarChart,
				charts.LineChart,
				charts.PieChart,
				charts.ScatterChart,
				charts.RadarChart,
				charts.HeatmapChart,
				charts.CandlestickChart,
				charts.GaugeChart,
				charts.GraphChart,
				charts.TreeChart,
				charts.TreemapChart,
				charts.SunburstChart,
				charts.ParallelChart,
				charts.SankeyChart,
				charts.FunnelChart,
				charts.BoxplotChart,
				charts.EffectScatterChart,
				charts.LinesChart,
				charts.PictorialBarChart,
				charts.ThemeRiverChart,
				charts.CustomChart,
				charts.MapChart,
				charts.ChordChart,
				// Components — a series alone is not enough: `themeRiver` needs singleAxis, `calendar`
				// heatmaps need calendar, `polar` needs polar, and so on. Missing one makes setOption
				// throw (`singleAxisModel.get is not a function`) and the block renders blank.
				components.GridComponent,
				components.GridSimpleComponent,
				components.TooltipComponent,
				components.LegendComponent,
				components.DataZoomComponent,
				components.VisualMapComponent,
				components.TitleComponent,
				components.DatasetComponent,
				components.TransformComponent,
				components.GeoComponent,
				components.MarkPointComponent,
				components.MarkLineComponent,
				components.MarkAreaComponent,
				components.ToolboxComponent,
				components.AxisPointerComponent,
				components.SingleAxisComponent,
				components.PolarComponent,
				components.RadarComponent,
				components.ParallelComponent,
				components.CalendarComponent,
				components.GraphicComponent,
				components.TimelineComponent,
				components.BrushComponent,
				components.AriaComponent,
				components.MatrixComponent,
				components.ThumbnailComponent,
				renderers.CanvasRenderer,
			]);
			registered = true;
		}

		return {
			render({ container, source, mode, resolveQuery }) {
				let option: unknown;
				try {
					option = JSON.parse(source);
				} catch {
					// Invalid JSON: fall back to the raw block instead of crashing.
					container.textContent = source;
					container.classList.add("chart-block-error");
					return;
				}

				// Approach A (BACK-814): resolve `fromQuery` references before drawing. An option with
				// no `fromQuery` passes through untouched; a missing id is reported inline.
				const resolution = resolveFromQuery(option, resolveQuery ?? (() => undefined));
				if (!resolution.ok) {
					container.textContent = resolution.error;
					container.classList.add("chart-block-error");
					return;
				}
				option = resolution.option;

				const chart = echarts.init(container, mode === "dark" ? "dark" : undefined, { renderer: "canvas" });
				chart.setOption(option as Parameters<typeof chart.setOption>[0]);

				const ro = new ResizeObserver(() => chart.resize());
				ro.observe(container);

				const store = container as unknown as Record<string, unknown>;
				store.__echartsInstance = chart;
				store.__echartsRO = ro;
			},
			dispose(container) {
				const store = container as unknown as Record<string, unknown>;
				const chart = store.__echartsInstance as { dispose: () => void } | undefined;
				if (chart) {
					chart.dispose();
					store.__echartsInstance = undefined;
				}
				const ro = store.__echartsRO as { disconnect: () => void } | undefined;
				if (ro) {
					ro.disconnect();
					store.__echartsRO = undefined;
				}
			},
		};
	},
};
