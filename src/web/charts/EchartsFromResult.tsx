import { useEffect, useRef } from "react";
import type { QueryBlockResult } from "../components/SqlQueryBlock";
import { useOptionalTheme } from "../contexts/ThemeContext";
import { echartsEngine } from "./echarts-engine";
import { buildEchartsOption } from "./echarts-query";

interface Props {
	/** The executed query result to chart. */
	result: QueryBlockResult;
	/** Raw `chart` field text from the block (JSON); parsed and validated here. */
	chart: string;
}

/**
 * Renders a query result as an ECharts chart, mirroring how the ` ```echarts ` fence reuses the
 * same engine. The `chart` JSON is turned into a standard ECharts `option` (simple mapping or
 * advanced `@result` form) and handed to `echartsEngine` — so registration, theme, ResizeObserver
 * and dispose all come for free. Invalid config shows an inline message instead of crashing.
 */
export default function EchartsFromResult({ result, chart }: Props) {
	const ref = useRef<HTMLDivElement | null>(null);
	const mode = useOptionalTheme();

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		let cancelled = false;
		let renderer: Awaited<ReturnType<typeof echartsEngine.load>> | null = null;

		let optionJson: string;
		try {
			optionJson = JSON.stringify(buildEchartsOption(chart, result));
		} catch (err) {
			el.textContent = `chart 配置无效：${err instanceof Error ? err.message : String(err)}`;
			el.classList.add("chart-block-error");
			return;
		}

		const frame = requestAnimationFrame(() => {
			if (cancelled) return;
			echartsEngine
				.load()
				.then((r) => {
					if (cancelled) return;
					renderer = r;
					r.render({ container: el, source: optionJson, mode });
				})
				.catch((err: unknown) => {
					console.warn("echarts-from-result failed to render", err);
				});
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			if (renderer && el) renderer.dispose?.(el);
		};
	}, [chart, result, mode]);

	return <div ref={ref} className="chart-block" style={{ width: "100%", minHeight: 320 }} />;
}
