import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { INTERNAL_LABELS, type ResultGraph } from "../utils/cypher-graph";
import { degreeRadius } from "../utils/graph-canvas";
import { labelNodeColors } from "../utils/graph-palette";
import GraphCanvas, { type GraphCanvasNode, type GraphCanvasVisual } from "./GraphCanvas";
import { LegendDot, LegendLine } from "./GraphLegend";

/**
 * The Cypher result, drawn as a knowledge graph.
 *
 * Same engine, same interactions as the corpus graph page (`GraphView` uses the very same
 * `GraphCanvas`): zoom and pan, the control cluster and its keyboard shortcuts, delayed hover
 * with tooltip and neighbour dimming, click-to-focus with the camera fly-in, node drags with a
 * simulation reheat, caption tiers with relation names at deep zoom, and a legend that toggles
 * node labels. What it deliberately does not have is the corpus graph's in-view Cypher search -
 * this pane *is* a query result, and the Cypher box that produced it sits right above it.
 *
 * A double-click zooms in rather than opening anything: a query result has no detail page behind
 * its nodes, and that is the one interaction the corpus graph cannot share.
 */
/**
 * Past this many nodes the force layout - 250 synchronous ticks over the whole set - stops being
 * an interaction and becomes a freeze, so the pane declines to draw and says why instead. The
 * table still shows every row; only the picture is bowing out.
 */
const GRAPH_NODE_LIMIT = 3000;

interface CypherResultGraphProps {
	graph: ResultGraph;
	/**
	 * Changes whenever a new result arrives: the engine fits a token's first build and restores
	 * the camera a returning token was left with, so a re-run of the same statement comes back to
	 * where that result was being read.
	 */
	cameraToken: string;
}

export default function CypherResultGraph({ graph, cameraToken }: CypherResultGraphProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set(INTERNAL_LABELS));
	const containerRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// Internal bookkeeping nodes (the store's own `Meta` table) start hidden so the picture counts
	// what a reader would count - a 1599-node corpus draws 1599 circles, not 1600. They are only
	// hidden while the result carries something else: a query that asked for them (MATCH (m:Meta))
	// must not open onto an empty pane. The legend keeps their entry either way, so they can be
	// switched back on.
	const hasExternal = useMemo(() => graph.nodes.some((node) => !node.internal), [graph]);
	const effectiveHidden = useMemo(() => (hasExternal ? hiddenLabels : new Set<string>()), [hasExternal, hiddenLabels]);

	// Fullscreen is a browser state the reader can leave without us - Esc, or the browser's own
	// chrome - so the icon follows document.fullscreenElement rather than counting its own clicks.
	useEffect(() => {
		const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);
	const toggleFullscreen = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
		// Safari exposes the API behind a vendor prefix and jsdom does not ship it at all; a
		// missing fullscreen is a degraded pane, not a broken one.
		else void container.requestFullscreen?.().catch(() => undefined);
	}, []);

	const visible = useMemo(() => {
		const nodes = graph.nodes.filter((node) => !effectiveHidden.has(node.label));
		const ids = new Set(nodes.map((node) => node.id));
		const edges = graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
		return { nodes, edges };
	}, [graph, effectiveHidden]);

	// Radius encodes degree; captions are trimmed by the extraction (captionPlateWidth is the
	// engine's job). No label is recessive here: every kind of a user database is a real kind.
	const visual = useMemo<GraphCanvasVisual>(
		() => ({
			node: (style, viewTheme) => labelNodeColors(style, viewTheme),
			// A relationship table has no dash vocabulary of its own: solid, arrowed, named.
			edge: (type) => ({ arrow: true, label: type }),
			radius: (_style, degree, maxDegree) => degreeRadius(degree, maxDegree),
		}),
		[],
	);

	const canvasNodes = useMemo<GraphCanvasNode[]>(
		() => visible.nodes.map((node) => ({ id: node.id, title: node.title, caption: node.caption, style: node.label })),
		[visible],
	);
	const canvasLinks = useMemo(
		() => visible.edges.map((edge) => ({ source: edge.from, target: edge.to, type: edge.type })),
		[visible],
	);

	// The legend reads the whole result, not what is currently drawn: an entry that vanished the
	// moment it was switched off could never be switched back on. The headline above counts what is
	// actually drawn, so the two together still say "Person 12 · 9 drawn".
	const labelCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const node of graph.nodes) counts.set(node.label, (counts.get(node.label) ?? 0) + 1);
		return counts;
	}, [graph]);
	const edgeTypes = useMemo(() => [...new Set(graph.edges.map((edge) => edge.type))].sort(), [graph]);
	// Say it out loud when something is being kept out of the picture: a count that disagrees with
	// what the reader expects has to explain itself.
	const hiddenInternalCount = useMemo(
		() => graph.nodes.filter((node) => node.internal && effectiveHidden.has(node.label)).length,
		[graph, effectiveHidden],
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
			className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
				isFullscreen ? "h-screen" : "h-full"
			}`}
		>
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
					{[...labelCounts.entries()].map(([label, count]) => (
						<LegendDot
							key={label}
							color={labelNodeColors(label, theme).fill}
							label={label}
							count={count}
							active={!effectiveHidden.has(label)}
							onToggle={() =>
								setHiddenLabels((prev) => {
									const next = new Set(prev);
									if (next.has(label)) next.delete(label);
									else next.add(label);
									return next;
								})
							}
							hint={
								graph.nodes.find((node) => node.label === label)?.internal
									? t.databases.graphInternalHint
									: t.graphView.filterToggle
							}
						/>
					))}
					{edgeTypes.map((type) => (
						<LegendLine key={type} dash={null} label={type} />
					))}
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
