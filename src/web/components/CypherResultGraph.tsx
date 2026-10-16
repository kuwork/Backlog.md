import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import type { ResultGraph } from "../utils/cypher-graph";
import { degreeRadius } from "../utils/graph-canvas";
import {
	defaultLegendConfig,
	fieldsByType,
	type GraphLegendConfig,
	LINE_DASH,
	loadLegendConfig,
	NEUTRAL_BUCKET,
	OTHER_BUCKET,
	relationStyle,
	resolveLegend,
	saveLegendConfig,
} from "../utils/graph-legend-config";
import { neutralNodeColors } from "../utils/graph-palette";
import GraphCanvas, { type GraphCanvasNode, type GraphCanvasVisual } from "./GraphCanvas";
import { LegendDot, LegendRelation } from "./GraphLegend";
import GraphLegendSettings from "./GraphLegendSettings";

/**
 * The Cypher result, drawn as a knowledge graph.
 *
 * Same engine, same interactions as the corpus graph page (`GraphView` uses the very same
 * `GraphCanvas`): zoom and pan, the control cluster and its keyboard shortcuts, delayed hover
 * with tooltip and neighbour dimming, click-to-focus with the camera fly-in, node drags with a
 * simulation reheat, caption tiers with relation names at deep zoom, and a legend that toggles
 * its entries. What it deliberately does not have is the corpus graph's in-view Cypher search -
 * this pane *is* a query result, and the Cypher box that produced it sits right above it.
 *
 * A double-click zooms in rather than opening anything: a query result has no detail page behind
 * its nodes, and that is the one interaction the corpus graph cannot share.
 *
 * Unlike the corpus graph, whose eight kinds were decided when it was written, this pane cannot
 * know what matters in a reader's own database - so the legend is configurable (BACK-794) and
 * kept per database: what a circle is called, which property decides its colour, and how each
 * relationship is drawn.
 */
/** Past this many nodes the force layout - 250 synchronous ticks over the whole set - stops being an interaction and becomes a freeze, so the pane declines to draw and says why instead. Exported so the `cypher-query` block's graph view falls back to its table at the same line (BACK-803). */
export const GRAPH_NODE_LIMIT = 3000;

interface CypherResultGraphProps {
	graph: ResultGraph;
	/** Which database the result came from. The legend configuration is stored per database. */
	database: string;
	/**
	 * Changes whenever a new result arrives: the engine fits a token's first build and restores
	 * the camera a returning token was left with, so a re-run of the same statement comes back to
	 * where that result was being read.
	 */
	cameraToken: string;
}

export default function CypherResultGraph({ graph, database, cameraToken }: CypherResultGraphProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [config, setConfig] = useState<GraphLegendConfig>(() => loadLegendConfig(database));
	const [settingsOpen, setSettingsOpen] = useState(false);
	// The configuration as it stood when the panel opened: edits preview live on the canvas but
	// only reach storage on 保存; 取消 and the X restore this snapshot.
	const [snapshot, setSnapshot] = useState<GraphLegendConfig | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// Switching databases switches configurations: a corpus database and a user database want
	// different defaults, and what was tuned for one is meaningless to the other.
	useEffect(() => {
		setConfig(loadLegendConfig(database));
		setSettingsOpen(false);
	}, [database]);

	// While the panel is open the edits are a draft: the canvas previews them, storage keeps the
	// last saved configuration until 保存 asks to persist it.
	useEffect(() => {
		if (!settingsOpen) saveLegendConfig(database, config);
	}, [database, config, settingsOpen]);

	const openSettings = () => {
		setSnapshot(config);
		setSettingsOpen(true);
	};
	const saveSettings = useCallback(() => {
		saveLegendConfig(database, config);
		setSettingsOpen(false);
	}, [database, config]);
	const cancelSettings = useCallback(() => {
		if (snapshot !== null) setConfig(snapshot);
		setSnapshot(null);
		setSettingsOpen(false);
	}, [snapshot]);

	const resolved = useMemo(() => resolveLegend(graph.nodes, config, theme), [graph, config, theme]);

	// Internal bookkeeping nodes (the store's own `Meta` table) start hidden so the picture counts
	// what a reader would count - a 1599-node corpus draws 1599 circles, not 1600. They are only
	// hidden while the result carries something else: a query that asked for them (MATCH (m:Meta))
	// must not open onto an empty pane.
	const hidden = useMemo(() => new Set(config.hidden), [config.hidden]);
	const hasExternal = useMemo(() => graph.nodes.some((node) => !node.internal), [graph]);

	// The settings panel never offers the store's bookkeeping as a type to style: while the result
	// carries real data, the type cards, quick-adds and bucket list read only the reader's nodes.
	const panelNodes = useMemo(
		() => (hasExternal ? graph.nodes.filter((node) => !node.internal) : graph.nodes),
		[graph, hasExternal],
	);
	// The panel reads each type's own fields and size: a quick-add splits Person by Person's values.
	const typeFields = useMemo(() => fieldsByType(panelNodes), [panelNodes]);
	const typeCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const node of panelNodes) counts.set(node.label, (counts.get(node.label) ?? 0) + 1);
		return counts;
	}, [panelNodes]);
	// The bucket keys to keep hidden by default. Held as an array - never as a `|`-joined string,
	// because the keys themselves contain `|` (`t:Meta|s:type:only`), and splitting on it would
	// shatter a key into fragments that match nothing.
	const internalKeys = useMemo(
		() => resolved.buckets.filter((bucket) => bucket.internal).map((bucket) => bucket.key),
		[resolved],
	);
	// Re-applied per result (cameraToken), which is what "hidden by default" means: a reader who
	// showed an internal node for this result keeps it shown until the next run. internalKeys and
	// hasExternal are read from the closure on purpose - if they were dependencies, toggling a
	// bucket back on would re-trigger this effect and silently re-hide the node the reader just
	// un-hid.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only a new result should re-trigger default-hide
	useEffect(() => {
		if (!hasExternal || internalKeys.length === 0) return;
		setConfig((prev) => {
			const missing = internalKeys.filter((key) => !prev.hidden.includes(key));
			return missing.length === 0 ? prev : { ...prev, hidden: [...prev.hidden, ...missing] };
		});
	}, [cameraToken]);

	// Fullscreen is a CSS maximise (fixed inset-0), not the Fullscreen API: the browser reserves a
	// short Esc for leaving native fullscreen, which collided with the canvas's "Esc releases the
	// pinned focus". Owning the key ourselves splits the two - a short Esc still releases the focus
	// (the canvas's own handler), and holding Esc (600 ms) leaves the maximised pane.
	useEffect(() => {
		if (!isFullscreen) return;
		let holdTimer: number | null = null;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.repeat || holdTimer !== null) return;
			holdTimer = window.setTimeout(() => {
				holdTimer = null;
				setIsFullscreen(false);
			}, 600);
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (holdTimer !== null) {
				window.clearTimeout(holdTimer);
				holdTimer = null;
			}
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			if (holdTimer !== null) window.clearTimeout(holdTimer);
		};
	}, [isFullscreen]);
	const toggleFullscreen = useCallback(() => setIsFullscreen((value) => !value), []);

	const visible = useMemo(() => {
		const nodes = graph.nodes.filter((node) => !hidden.has(resolved.bucketOf.get(node.id) ?? ""));
		const ids = new Set(nodes.map((node) => node.id));
		const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
		return { nodes, edges };
	}, [graph, hidden, resolved]);

	const edgeTypes = useMemo(() => [...new Set(graph.edges.map((edge) => edge.type))].sort(), [graph]);

	// Internal bookkeeping buckets (the store's own Meta table) never appear in the legend while
	// the result carries real data - they are hidden from the canvas anyway, and a legend entry
	// for them is noise. A query that asked for them alone (MATCH (m:Meta)) still lists them.
	const legendBuckets = useMemo(
		() => resolved.buckets.filter((bucket) => !bucket.internal || !hasExternal),
		[resolved, hasExternal],
	);

	// Radius encodes degree; captions are written from the template by the resolver and trimmed by
	// the engine's own plate budget. No bucket is recessive here: every group of a user database is
	// a real group.
	const visual = useMemo<GraphCanvasVisual>(() => {
		const colors = new Map(resolved.buckets.map((bucket) => [bucket.key, bucket.colors]));
		return {
			node: (style) => colors.get(style) ?? neutralNodeColors(theme),
			edge: (type) => {
				const style = relationStyle(type, config, edgeTypes);
				return {
					dash: LINE_DASH[style.dash] ?? undefined,
					arrow: style.arrow,
					label: style.name ?? type,
					stroke: style.color,
				};
			},
			radius: (_style, degree, maxDegree) => degreeRadius(degree, maxDegree),
		};
	}, [resolved, config, theme, edgeTypes]);

	const canvasNodes = useMemo<GraphCanvasNode[]>(
		() =>
			visible.nodes.map((node) => ({
				id: node.id,
				title: node.title,
				caption: resolved.captionOf.get(node.id) ?? "",
				style: resolved.bucketOf.get(node.id) ?? "",
			})),
		[visible, resolved],
	);
	const canvasLinks = useMemo(
		() => visible.edges.map((edge) => ({ source: edge.from, target: edge.to, type: edge.type })),
		[visible],
	);

	const toggleBucket = useCallback((key: string) => {
		setConfig((prev) => {
			const next = new Set(prev.hidden);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return { ...prev, hidden: [...next] };
		});
	}, []);

	const resetConfig = useCallback(() => {
		setConfig(defaultLegendConfig(database));
	}, [database]);

	// The legend reads the whole result, not what is currently drawn: an entry that vanished the
	// moment it was switched off could never be switched back on. The headline above counts what is
	// actually drawn, so the two together still say "Person 12 · 9 drawn".
	const hiddenInternalCount = useMemo(
		() => graph.nodes.filter((node) => node.internal && hidden.has(resolved.bucketOf.get(node.id) ?? "")).length,
		[graph, hidden, resolved],
	);

	if (graph.nodes.length === 0) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
				<p className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.databases.graphEmpty}</p>
			</div>
		);
	}

	if (graph.nodes.length > GRAPH_NODE_LIMIT) {
		return (
			<div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
				<p className="text-sm text-gray-600 dark:text-gray-400">
					{t.databases.graphTooLarge.replace("{1}", String(graph.nodes.length))}
				</p>
				<p className="text-xs text-gray-500 dark:text-gray-400">{t.databases.graphTooLargeHint}</p>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={`flex min-h-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
				isFullscreen ? "fixed inset-0 z-50" : "relative h-full rounded-lg"
			}`}
		>
			{settingsOpen && (
				<GraphLegendSettings
					database={database}
					fieldsByType={typeFields}
					typeCounts={typeCounts}
					buckets={legendBuckets}
					edgeTypes={edgeTypes}
					nodes={panelNodes}
					config={config}
					onChange={setConfig}
					onReset={resetConfig}
					onSave={saveSettings}
					onCancel={cancelSettings}
				/>
			)}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
				<span className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
					{t.databases.graphTitle}
					<button
						type="button"
						onClick={toggleFullscreen}
						aria-label={isFullscreen ? t.databases.exitFullscreen : t.databases.fullscreen}
						title={isFullscreen ? t.databases.exitFullscreen : t.databases.fullscreen}
						className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					>
						{isFullscreen ? (
							<svg
								aria-hidden="true"
								className="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
							</svg>
						) : (
							<svg
								aria-hidden="true"
								className="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
							</svg>
						)}
					</button>
					<button
						type="button"
						onClick={() => (settingsOpen ? cancelSettings() : openSettings())}
						aria-label={t.databases.legendSettings}
						aria-expanded={settingsOpen}
						title={t.databases.legendSettings}
						className={`rounded p-0.5 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 ${
							settingsOpen ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
						}`}
					>
						<svg
							aria-hidden="true"
							className="h-3.5 w-3.5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M7 4v4M12 10v4M17 16v4" />
						</svg>
					</button>
				</span>
				<span className="text-gray-500 dark:text-gray-400">
					{t.graphView.nodesAndEdges
						.replace("{1}", String(visible.nodes.length))
						.replace("{2}", String(visible.edges.length))}
				</span>
				{hiddenInternalCount > 0 && (
					<span className="text-gray-400 dark:text-gray-500" title={t.databases.graphInternalHint}>
						{t.databases.graphInternalHidden.replace("{1}", String(hiddenInternalCount))}
					</span>
				)}
				{graph.danglingEdges > 0 && (
					<span className="text-gray-500 dark:text-gray-400">
						{t.databases.graphDangling.replace("{1}", String(graph.danglingEdges))}
					</span>
				)}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					{legendBuckets.map((bucket) => (
						<LegendDot
							key={bucket.key}
							color={bucket.colors.fill}
							label={
								bucket.key.endsWith(`|${OTHER_BUCKET}`) || bucket.key === NEUTRAL_BUCKET
									? bucket.key === NEUTRAL_BUCKET
										? bucket.label
										: t.databases.legendOther
									: bucket.label
							}
							count={bucket.count}
							active={!hidden.has(bucket.key)}
							onToggle={() => toggleBucket(bucket.key)}
							hint={bucket.internal ? t.databases.graphInternalHint : t.graphView.filterToggle}
						/>
					))}
					{edgeTypes.map((type) => {
						const style = relationStyle(type, config, edgeTypes);
						return (
							<LegendRelation
								key={type}
								dash={LINE_DASH[style.dash]}
								arrow={style.arrow}
								color={style.color}
								label={style.name ?? type}
							/>
						);
					})}
				</div>
			</div>
			<div className="relative flex-1 min-h-0">
				<GraphCanvas
					nodes={canvasNodes}
					links={canvasLinks}
					theme={theme}
					visual={visual}
					positionKey={null}
					cameraToken={cameraToken}
					active
					ariaLabel={t.databases.graphTitle}
				/>
			</div>
		</div>
	);
}
