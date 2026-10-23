import { useEffect, useRef } from "react";
import { useDiagramEngine } from "../charts/diagram-engine";
import { useQueryResultRegistry } from "../charts/query-result-registry";
import { getChartEngine } from "../charts/registry";
import { useOptionalTheme } from "../contexts/ThemeContext";

interface ChartBlockProps {
	/** Fence language, e.g. `mermaid` or `echarts`. */
	lang: string;
	/** Fenced block body, exactly as authored. */
	source: string;
}

/**
 * Renders any chart-language block through the engine registry. The component
 * owns the container node itself, so the engine draws into it and disposes on
 * unmount/theme change — no post-render DOM replacement, unlike the old
 * `renderMermaidIn` pass.
 */
export default function ChartBlock({ lang, source }: ChartBlockProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const mode = useOptionalTheme();
	const engineId = useDiagramEngine();
	const engine = getChartEngine(lang);
	const registry = useQueryResultRegistry();
	const resolveQuery = registry?.get;
	// Only charts that actually reference a query result need to re-render when the registry changes;
	// keep the dependency key at 0 otherwise so an unrelated result update does not redraw this chart.
	const registryKey = source.includes("fromQuery") ? (registry?.version ?? 0) : 0;

	useEffect(() => {
		// `registryKey` is the subscription signal: bumped, never read, so a query result arriving
		// later re-runs the effect (and therefore `setOption`) for charts that use `fromQuery`.
		void registryKey;
		// `engineId` is the active diagram backend; a Settings switch must re-render the diagram.
		void engineId;
		const el = ref.current;
		const engine = getChartEngine(lang);
		if (!el || !engine) return;

		let cancelled = false;
		let renderer: Awaited<ReturnType<typeof engine.load>> | null = null;

		const frame = requestAnimationFrame(() => {
			if (cancelled) return;
			engine
				.load()
				.then((r) => {
					if (cancelled) return;
					renderer = r;
					void r.render({ container: el, source, mode, resolveQuery });
				})
				.catch((err: unknown) => {
					console.warn("chart engine failed to render", err);
				});
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
			if (renderer && el) renderer.dispose?.(el);
		};
		// `engineId` is the active diagram backend; a Settings switch must re-render the diagram.
	}, [lang, source, mode, resolveQuery, registryKey, engineId]);

	return <div ref={ref} className={engine?.containerClassName ?? "chart-block"} style={engine?.containerStyle} />;
}
