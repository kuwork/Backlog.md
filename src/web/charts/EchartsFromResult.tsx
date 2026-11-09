import ChartBlock from "../components/ChartBlock";
import type { QueryBlockResult } from "../components/SqlQueryBlock";
import { buildEchartsOption } from "./echarts-query";

interface Props {
	/** The executed query result to chart. */
	result: QueryBlockResult;
	/** Raw `chart` field text from the block (JSON); parsed and validated here. */
	chart: string;
}

/**
 * Renders a query result as an ECharts chart (doc-30 §8.3.B: the block is its own
 * chart, no separate visible data source needed).
 *
 * The `chart` JSON is turned into a standard ECharts `option` (simple mapping or
 * advanced `@result` form), then handed to ChartBlock with `lang="echarts"` —
 * the very same component the ` ```echarts ` fence uses. Keeping a single render
 * path means theme switching, ResizeObserver, dispose and the CSS fullscreen
 * entry all work here too; the old bespoke render effect had none of the overlay
 * behaviour and silently lost the fullscreen button (BACK-847 follow-up).
 * Invalid config shows an inline message instead of crashing.
 */
export default function EchartsFromResult({ result, chart }: Props) {
	let source: string;
	try {
		source = JSON.stringify(buildEchartsOption(chart, result));
	} catch (err) {
		return (
			<div className="chart-block chart-block-error" style={{ width: "100%", minHeight: 320 }}>
				{`chart 配置无效：${err instanceof Error ? err.message : String(err)}`}
			</div>
		);
	}

	return <ChartBlock lang="echarts" source={source} />;
}
