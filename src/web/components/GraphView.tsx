import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../types";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type GraphEdgeDto, type GraphNodeDto, type GraphPayload } from "../lib/api";
import { degreeRadius } from "../utils/graph-canvas";
import { captionFor } from "../utils/graph-caption";
import { knowledgeNodeHref } from "../utils/graph-node-links";
import CypherSearchDialog from "./CypherSearchDialog";
import GraphCanvas, { type GraphCanvasNode, type GraphCanvasVisual } from "./GraphCanvas";
import {
	EDGE_DASH,
	KNOWLEDGE_GRAPH_HIDDEN_STYLES,
	LegendDot,
	LegendLine,
	type NodeStyle,
	nodeFill,
	nodeStroke,
	nodeStyle,
	selectFilteredGraph,
	selectVisibleGraph,
	stylesMatchedByKeys,
	TASK_GRAPH_HIDDEN_STYLES,
} from "./GraphLegend";

interface GraphViewProps {
	/** Bumped by the shell on every graph-updated WebSocket message; drives an in-place refetch. */
	graphVersion: number;
	onEditTask: (task: Task) => void;
	/**
	 * Which reading of the same payload this is. The task graph (`/graph`, the default) keeps the
	 * phase-3 kinds out of the picture; the knowledge graph passes every work kind instead. The
	 * legend can still reveal anything - the variant only decides what the view is *about*.
	 */
	variant?: "task" | "knowledge";
}

/**
 * Task/knowledge graph view (doc-014 §4): the corpus graph page.
 *
 * The view owns everything that is *about the corpus* - fetching `/api/graph`, the legend, the
 * Cypher search that filters the canvas to a result set - and hands the picture itself to
 * `GraphCanvas`, the shared engine every graph view draws with. The engine holds the layout, the
 * camera and the pointer interactions; this file decides which nodes and edges it shows.
 *
 * One subtlety stays here: the Cypher filter's camera rules. Entering a filter fits the result
 * set, a new query on top of one fits its own, and clearing puts the pre-search viewport back.
 * The engine expresses all three through its camera token (see `GraphCanvas`), so this file only
 * has to mint a fresh token per successful query.
 */

export default function GraphView({ graphVersion, onEditTask, variant = "task" }: GraphViewProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const [payload, setPayload] = useState<GraphPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Cypher search: `cypherOpen` toggles the popup; a successful query filters the canvas down to
	// the matched result set until 清除 (or the next query) lifts the filter. The filter opens every
	// legend category (its picture is the result set, so nothing reads as hidden), re-lays-out and
	// re-frames the result set; the pre-search viewport and legend state are remembered so clearing
	// restores them (恢复原状).
	const [cypherOpen, setCypherOpen] = useState(false);
	const [cypherFilter, setCypherFilter] = useState<Set<string> | null>(null);
	// One per successful query: a fresh token makes the engine fit the new result set, and going
	// back to "no filter" is a token change the engine answers with the remembered pre-search
	// camera (its camera-token rule, see GraphCanvas).
	const [filterToken, setFilterToken] = useState(0);
	const preFilterHiddenRef = useRef<Set<NodeStyle> | null>(null);
	// The same payload read two ways: `/graph` shows the task relationships, the knowledge graph
	// shows pages, decisions, documents and tags. A legend click can reveal the other half.
	const isKnowledge = variant === "knowledge";
	const heading = isKnowledge ? t.graphView.knowledgeTitle : t.graphView.title;
	const [hiddenStyles, setHiddenStyles] = useState<Set<NodeStyle>>(
		() => new Set(isKnowledge ? KNOWLEDGE_GRAPH_HIDDEN_STYLES : TASK_GRAPH_HIDDEN_STYLES),
	);

	// A successful Cypher query filters the canvas to the matched result set: only hit nodes and the
	// edges whose both ends hit are drawn. The legend opens exactly the categories the result set
	// has (nothing in it may read as filtered out) and counts the result set; 清除 lifts the filter
	// and restores the pre-search legend and viewport. An empty hit set (e.g. RETURN count(*))
	// leaves the view untouched.
	const handleCypherSuccess = useCallback(
		(nodeKeys: string[]) => {
			if (nodeKeys.length === 0) {
				setCypherFilter(null);
				return;
			}
			const next = new Set(nodeKeys);
			// Entering the filter remembers the pre-search legend; a new query on top of an active
			// filter keeps that snapshot and just fits its own result set (a fresh token).
			if (!cypherFilter) preFilterHiddenRef.current = hiddenStyles;
			setFilterToken((token) => token + 1);
			const matched = stylesMatchedByKeys(payload?.nodes ?? [], next);
			setHiddenStyles((prev) => {
				const opened = new Set(prev);
				for (const style of matched) opened.delete(style);
				return opened;
			});
			setCypherFilter(next);
		},
		[cypherFilter, hiddenStyles, payload],
	);
	const handleCypherClear = useCallback(() => {
		setCypherFilter(null);
		const restoreHidden = preFilterHiddenRef.current;
		if (restoreHidden) {
			preFilterHiddenRef.current = null;
			setHiddenStyles(restoreHidden);
		}
	}, []);

	const openNode = useCallback(
		(node: GraphNodeDto) => {
			if (node.kind === "milestone") {
				// Carry this view as the background location, the same way task nodes do: the
				// milestone details modal then opens on top of the graph instead of swapping the
				// page for the milestones list, and closing it lands back here. The node id is the
				// milestone's own id (m-3), so it resolves against the loaded entities directly.
				navigate(`/milestone/${encodeURIComponent(node.id)}`, {
					state: { backgroundLocation: location },
				});
				return;
			}
			// Task/draft records travel with the navigation like every other view: the modal opens
			// from the stub immediately and resolves the real record from the URL id.
			// Phase 3: a knowledge page opens its own page in a new tab, so the graph stays where it
			// is; a Tag node is a virtual classification with no page behind it.
			if (node.kind !== "task" && node.kind !== "draft") {
				const href = knowledgeNodeHref(node);
				if (href) window.open(href, "_blank", "noopener,noreferrer");
				return;
			}
			onEditTask({
				id: node.id,
				title: node.title,
				status: node.status as Task["status"],
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
			} as Task);
		},
		[navigate, location, onEditTask],
	);
	// The canvas must not rebuild just because a handler moved: opening a task popup navigates,
	// which gives the shell a new location and therefore new callback identities. The engine reads
	// the handler through a ref, so the graph - and the viewport the user zoomed to - stays put.
	const openNodeRef = useRef(openNode);
	useEffect(() => {
		openNodeRef.current = openNode;
	}, [openNode]);
	const onOpenNode = useCallback(
		(node: GraphCanvasNode) => {
			const record = payload?.nodes.find((candidate: GraphNodeDto) => candidate.id === node.id);
			if (record) openNodeRef.current(record);
		},
		[payload],
	);

	const toggleStyle = useCallback((style: NodeStyle) => {
		setHiddenStyles((prev) => {
			const next = new Set(prev);
			if (next.has(style)) next.delete(style);
			else next.add(style);
			return next;
		});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped
	useEffect(() => {
		let cancelled = false;
		let retryTimer: ReturnType<typeof setTimeout> | null = null;
		const load = () => {
			apiClient
				.getGraph()
				.then((data) => {
					if (!cancelled) {
						setError(null);
						setPayload(data);
					}
				})
				.catch((err: unknown) => {
					if (cancelled) return;
					// 503: the single-holder lock is taken by another Backlog instance.
					// The server re-attempts the lock on every request, so poll until it wins.
					setError((err as { status?: number })?.status === 503 ? t.graphView.locked : t.graphView.error);
					retryTimer = setTimeout(load, 5000);
				});
		};
		load();
		return () => {
			cancelled = true;
			if (retryTimer) clearTimeout(retryTimer);
		};
	}, [graphVersion, t.graphView.error, t.graphView.locked]);

	// The subset the engine draws: the payload read through the variant's legend and, while a
	// filter is active, narrowed to the result set. Positions are carried over by the engine, so
	// only newly revealed nodes are laid out from scratch.
	const subset = useMemo(() => {
		if (!payload) return { nodes: [] as GraphNodeDto[], edges: [] as GraphEdgeDto[] };
		return cypherFilter
			? selectFilteredGraph(payload.nodes, payload.edges, cypherFilter, hiddenStyles)
			: selectVisibleGraph(payload.nodes, payload.edges, hiddenStyles);
	}, [payload, cypherFilter, hiddenStyles]);

	// The engine's visual vocabulary: this view's node kinds and relation types, in this locale.
	const visual = useMemo<GraphCanvasVisual>(() => {
		const edgeVisual = (edgeType: GraphEdgeDto["type"]) => ({
			dash: EDGE_DASH[edgeType] ?? undefined,
			// BelongsToMilestone is mere membership and stays plain (no arrowhead).
			arrow: edgeType === "BelongsToMilestone" ? ("none" as const) : ("end" as const),
			label:
				edgeType === "DependsOn"
					? t.graphView.edgeDependsOn
					: edgeType === "ParentOf"
						? t.graphView.edgeParentOf
						: edgeType === "BelongsToMilestone"
							? t.graphView.edgeMilestone
							: edgeType === "SourcedFrom"
								? t.graphView.edgeSourcedFrom
								: edgeType === "LinksTo"
									? t.graphView.edgeLinksTo
									: t.graphView.edgeTaggedWith,
		});
		return {
			node: (style, viewTheme) => ({
				fill: nodeFill(style as NodeStyle, viewTheme),
				stroke: nodeStroke(style as NodeStyle, viewTheme),
			}),
			// The engine buckets edges by whatever string the view's edge type is.
			edge: (type: string) => edgeVisual(type as GraphEdgeDto["type"]),
			// doc-15 §7 wants Tag nodes small and recessive, so they keep one size whatever their
			// degree; every other kind scales with its relation count.
			radius: (style, degree, maxDegree) => ((style as NodeStyle) === "tag" ? 5 : degreeRadius(degree, maxDegree)),
			recessive: (style) => (style as NodeStyle) === "tag",
		};
	}, [
		t.graphView.edgeDependsOn,
		t.graphView.edgeParentOf,
		t.graphView.edgeMilestone,
		t.graphView.edgeSourcedFrom,
		t.graphView.edgeLinksTo,
		t.graphView.edgeTaggedWith,
	]);

	const canvasNodes = useMemo<GraphCanvasNode[]>(
		() =>
			subset.nodes.map((node) => {
				const caption = captionFor(node);
				return {
					id: node.id,
					title: node.title || node.id,
					caption,
					style: nodeStyle(node),
				};
			}),
		[subset],
	);
	const canvasLinks = useMemo(
		() => subset.edges.map((edge) => ({ source: edge.from, target: edge.to, type: edge.type })),
		[subset],
	);

	const ready = payload?.status === "ready" && payload.nodes.length > 0;
	// The camera token: one picture per filter state, a fresh one per successful query. The engine
	// fits a token's first build and restores the camera a returning token was left with.
	const cameraToken = cypherFilter ? `filter:${filterToken}` : "full";

	// The result set itself, legend-independent: which categories and relation types it has decide
	// which legend entries exist at all, so toggling one off never removes its entry while a filter
	// is active - there would be no way to toggle it back on.
	const filtered = useMemo(
		() => (cypherFilter ? selectFilteredGraph(payload?.nodes ?? [], payload?.edges ?? [], cypherFilter) : null),
		[payload, cypherFilter],
	);
	const resultSetStyles = useMemo(() => {
		if (!filtered) return null;
		const styles = new Set<NodeStyle>();
		for (const node of filtered.nodes) styles.add(nodeStyle(node));
		return styles;
	}, [filtered]);
	const resultSetEdgeTypes = useMemo(() => {
		if (!filtered) return null;
		const types = new Set<GraphEdgeDto["type"]>();
		for (const edge of filtered.edges) types.add(edge.type);
		return types;
	}, [filtered]);

	// The headline counts what this reading actually draws, not what the payload holds: the task
	// graph and the knowledge graph are two subsets of one payload, and a legend click changes the
	// subset - including on top of an active Cypher filter. Same helper the layout uses, so the
	// number can never disagree with the picture.
	const visibleCounts = useMemo(() => {
		const current = cypherFilter
			? selectFilteredGraph(payload?.nodes ?? [], payload?.edges ?? [], cypherFilter, hiddenStyles)
			: selectVisibleGraph(payload?.nodes ?? [], payload?.edges ?? [], hiddenStyles);
		return { nodes: current.nodes.length, edges: current.edges.length };
	}, [payload, hiddenStyles, cypherFilter]);

	// Legend: one toggle per node style, with the live count so the filter also reads as a summary.
	// While a Cypher filter is active the counts describe what is drawn - the result set minus
	// whatever the legend hides - not the whole payload.
	const counts = useMemo(() => {
		const out: Partial<Record<NodeStyle, number>> = {};
		const pool = cypherFilter
			? (filtered?.nodes ?? []).filter((node) => !hiddenStyles.has(nodeStyle(node)))
			: (payload?.nodes ?? []);
		for (const node of pool) {
			const style = nodeStyle(node);
			out[style] = (out[style] ?? 0) + 1;
		}
		return out;
	}, [payload, cypherFilter, hiddenStyles, filtered]);
	const legendEntries: Array<{ style: NodeStyle; label: string }> = [
		{ style: "task", label: t.graphView.legendTask },
		{ style: "completed", label: t.graphView.legendCompleted },
		{ style: "draft", label: t.graphView.legendDraft },
		{ style: "milestone", label: t.graphView.legendMilestone },
		{ style: "wiki", label: t.graphView.legendWiki },
		{ style: "decision", label: t.graphView.legendDecision },
		{ style: "document", label: t.graphView.legendDocument },
		{ style: "tag", label: t.graphView.legendTag },
	];
	const shownLegendEntries = resultSetStyles
		? legendEntries.filter((entry) => resultSetStyles.has(entry.style))
		: legendEntries;
	const edgeLegendEntries: Array<{ type: GraphEdgeDto["type"]; label: string }> = [
		{ type: "DependsOn", label: t.graphView.edgeDependsOn },
		{ type: "ParentOf", label: t.graphView.edgeParentOf },
		{ type: "BelongsToMilestone", label: t.graphView.edgeMilestone },
		{ type: "SourcedFrom", label: t.graphView.edgeSourcedFrom },
		{ type: "LinksTo", label: t.graphView.edgeLinksTo },
		{ type: "TaggedWith", label: t.graphView.edgeTaggedWith },
	];
	const shownEdgeLegendEntries = resultSetEdgeTypes
		? edgeLegendEntries.filter((entry) => resultSetEdgeTypes.has(entry.type))
		: edgeLegendEntries;

	// The engine pins known positions for every picture except a filtered result set, whose few
	// hits must re-cluster instead of staying scattered across the full-graph canvas.
	const pinPositions = !cypherFilter;

	const searchButton: ReactNode = (
		<button
			type="button"
			onClick={() => setCypherOpen(true)}
			title={t.graphView.cypherSearch}
			aria-label={t.graphView.cypherSearch}
			className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
		>
			<SearchIcon />
		</button>
	);

	return (
		<div className="flex h-full flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
			<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-baseline gap-3">
					<h2 className="text-xl font-bold">{heading}</h2>
					{ready && (
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{t.graphView.nodesAndEdges
								.replace("{1}", String(visibleCounts.nodes))
								.replace("{2}", String(visibleCounts.edges))}
						</span>
					)}
				</div>
				{ready && (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
						{shownLegendEntries.map(({ style, label }) => (
							<LegendDot
								key={style}
								color={nodeFill(style, theme)}
								label={label}
								count={counts[style] ?? 0}
								active={!hiddenStyles.has(style)}
								onToggle={() => toggleStyle(style)}
								hint={t.graphView.filterToggle}
							/>
						))}
						{shownEdgeLegendEntries.map(({ type, label }) => (
							<LegendLine key={type} dash={EDGE_DASH[type]} label={label} />
						))}
					</div>
				)}
			</div>
			<div className="relative flex-1 min-h-0">
				{error ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-red-500 dark:text-red-400">{error}</p>
					</div>
				) : !payload ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.loading}</p>
					</div>
				) : payload.status === "building" ? (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
						<span
							className="h-6 w-6 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600 dark:border-blue-400/30 dark:border-t-blue-400"
							aria-hidden="true"
						/>
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.building}</p>
					</div>
				) : payload.nodes.length === 0 ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.empty}</p>
					</div>
				) : null}
				<GraphCanvas
					nodes={canvasNodes}
					links={canvasLinks}
					theme={theme}
					visual={visual}
					positionKey={`backlog.graph.positions.${isKnowledge ? "knowledge" : "task"}`}
					cameraToken={cameraToken}
					pinPositions={pinPositions}
					active={Boolean(ready)}
					ariaLabel={heading}
					headerControls={searchButton}
					onOpenNode={onOpenNode}
				/>
				<CypherSearchDialog
					open={cypherOpen}
					onClose={() => setCypherOpen(false)}
					onSearchSuccess={handleCypherSuccess}
					onClear={handleCypherClear}
				/>
			</div>
		</div>
	);
}

function SearchIcon() {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	);
}
