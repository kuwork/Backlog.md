import {
	forceCenter,
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	forceX,
	forceY,
	type SimulationLinkDatum,
	type SimulationNodeDatum,
} from "d3-force";
import { type Quadtree, quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom as d3Zoom, type ZoomTransform, zoomIdentity } from "d3-zoom";
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type GraphEdgeDto, type GraphNodeDto } from "../lib/api";
import {
	canvasThemeColors,
	drawCaption,
	drawEdgeLabel,
	ensureZoomInterrupt,
	scaledRadius,
	strokeEdge,
} from "../utils/graph-canvas";
import { buildRelationshipSubgraph } from "../utils/task-subgraph";
import {
	EDGE_DASH,
	EDGE_STROKE,
	LegendDot,
	LegendLine,
	NODE_STROKE,
	type NodeStyle,
	nodeFill,
	nodeStyle,
	TASK_GRAPH_HIDDEN_STYLES,
} from "./GraphLegend";

/** Where each task's graph viewport was left (`d3-zoom` transform), keyed by task id. */
export type GraphViewports = Map<string, ZoomTransform>;

interface Props {
	/** Canonical id of the open task; the subgraph is centered on it. */
	focusId: string;
	/** Bumped by the app when the server graph changes (graph-updated WebSocket); triggers a refetch. */
	graphVersion?: number;
	/**
	 * Per-task reading state, owned by the modal. This component is unmounted while a drilled-into
	 * neighbour shows its detail view, so anything that has to survive the round trip - how a task
	 * was being read, where its viewport was left, which kinds were hidden - lives one level up.
	 */
	viewports: GraphViewports;
	hiddenStyles?: ReadonlySet<NodeStyle>;
	onHiddenStylesChange: (next: ReadonlySet<NodeStyle>) => void;
	onTaskClick: (taskId: string) => void;
}

const ARROW_SIZE = 7;
const ARROW_GAP = 2;
const NODE_RADIUS = 14;
const ROOT_RADIUS = 18;
const PRECOMPUTE_TICKS = 200;
const EDGE_LABEL_FONT = 10;
/** Opacity everything outside the focused node's neighbourhood is drawn at. */
const FOCUS_FADE = 0.18;
/**
 * The filter set a task the modal holds no state for falls back to. It is the same one `/graph`
 * starts with (`GraphLegend.TASK_GRAPH_HIDDEN_STYLES`): every phase-3 kind hidden, so the modal
 * stays a task relationship picture. The subgraph traversal already refuses to walk knowledge
 * edges, so this is the view's own declaration of its scope rather than a second guarantee.
 */
const DEFAULT_FILTERS: ReadonlySet<NodeStyle> = new Set(TASK_GRAPH_HIDDEN_STYLES);
/**
 * Canvas height: as tall as the modal can show without scrolling (the modal tops out at 94vh;
 * header, padding, title row and legend claim ~9.5rem). The width is the modal's own, so the
 * neighborhood gets the whole reading area instead of a small square floating in it.
 */
const CANVAS_HEIGHT = "min(calc(94vh - 9.5rem), 44rem)";

interface SimNode extends SimulationNodeDatum {
	id: string;
	title: string;
	kind: GraphNodeDto["kind"];
	style: NodeStyle;
	isRoot: boolean;
	radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
	type: GraphEdgeDto["type"];
}

/**
 * Relationship graph (关联关系图) for the task details modal: a d3-force rendering of the
 * neighborhood around the open task, cut from the same /api/graph payload the main /graph
 * page renders. All relation types (parent, children, depends-on, milestone) show up with
 * the same edge styles and labels as the full graph view. Painted on Canvas 2D through the
 * helpers shared with GraphView (src/web/utils/graph-canvas.ts); hit-testing uses a d3-quadtree.
 * The layout is precomputed with a fixed tick budget and stays interactive through zoom and drag.
 */
export const TaskDependencyGraph: FC<Props> = ({
	focusId,
	graphVersion,
	viewports,
	hiddenStyles,
	onHiddenStylesChange,
	onTaskClick,
}) => {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [payload, setPayload] = useState<Awaited<ReturnType<typeof apiClient.getGraph>> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const onTaskClickRef = useRef(onTaskClick);
	useEffect(() => {
		onTaskClickRef.current = onTaskClick;
	}, [onTaskClick]);
	const filters = hiddenStyles ?? DEFAULT_FILTERS;

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped
	useEffect(() => {
		let cancelled = false;
		apiClient
			.getGraph()
			.then((data) => {
				if (!cancelled) {
					setError(null);
					setPayload(data);
				}
			})
			.catch(() => {
				if (!cancelled) setError(t.graphView.error);
			});
		return () => {
			cancelled = true;
		};
	}, [t.graphView.error, graphVersion]);

	const subgraph = useMemo(
		() => (payload?.status === "ready" ? buildRelationshipSubgraph(payload, focusId) : null),
		[payload, focusId],
	);

	// Legend filters: hidden kinds drop their nodes and every edge touching them.
	const visibleSubgraph = useMemo(() => {
		if (!subgraph) return null;
		if (filters.size === 0) return subgraph;
		const visible = new Set(
			subgraph.nodes.filter((node) => node.isRoot || !filters.has(nodeStyle(node))).map((node) => node.id),
		);
		return {
			nodes: subgraph.nodes.filter((node) => visible.has(node.id)),
			edges: subgraph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)),
		};
	}, [subgraph, filters]);

	// A toggle only ever applies to the task being read; the modal keeps one filter set per task.
	const toggleStyle = useCallback(
		(style: NodeStyle) => {
			const next = new Set(filters);
			if (next.has(style)) next.delete(style);
			else next.add(style);
			onHiddenStylesChange(next);
		},
		[filters, onHiddenStylesChange],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scoped
	useEffect(() => {
		const canvasEl = canvasRef.current;
		const container = containerRef.current;
		if (!canvasEl || !container || !visibleSubgraph || visibleSubgraph.nodes.length === 0) return;
		const ctx = canvasEl.getContext("2d");
		if (!ctx) return;

		const nodes: SimNode[] = visibleSubgraph.nodes.map((node) => ({
			id: node.id,
			title: node.title,
			kind: node.kind,
			style: nodeStyle(node),
			isRoot: node.isRoot,
			radius: node.isRoot ? ROOT_RADIUS : NODE_RADIUS,
		}));
		const links: SimLink[] = visibleSubgraph.edges.map((edge) => ({
			type: edge.type,
			source: edge.from,
			target: edge.to,
		}));

		// Edge labels: the relation name along each edge (same locale keys as the full graph view).
		const EDGE_LABEL: Record<SimLink["type"], string> = {
			DependsOn: t.graphView.edgeDependsOn,
			ParentOf: t.graphView.edgeParentOf,
			BelongsToMilestone: t.graphView.edgeMilestone,
			SourcedFrom: t.graphView.edgeSourcedFrom,
			LinksTo: t.graphView.edgeLinksTo,
			TaggedWith: t.graphView.edgeTaggedWith,
		};

		// Resolve link endpoints BEFORE creating the simulation: forceLink's initialize mutates
		// links, replacing the string ids with node objects, and a later lookup by string id
		// would find nothing.
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const linkEnds = links.map((link) => ({
			type: link.type,
			source: nodeById.get(link.source as string) as SimNode,
			target: nodeById.get(link.target as string) as SimNode,
		}));
		// Focus: the click-pinned node and its neighbours stay lit while the rest fades - a subgraph
		// is small, but the semantics should read identically to the full graph view.
		const neighbours = new Map<string, Set<string>>();
		const touchNeighbour = (id: string, other: string) => {
			if (!neighbours.has(id)) neighbours.set(id, new Set());
			neighbours.get(id)?.add(other);
		};
		for (const link of links) {
			touchNeighbour(link.source as string, link.target as string);
			touchNeighbour(link.target as string, link.source as string);
		}
		let selectedId: string | null = null;

		const colors = canvasThemeColors(theme);

		const simulation = forceSimulation<SimNode, SimLink>(nodes)
			.force(
				"link",
				forceLink<SimNode, SimLink>(links)
					.id((d) => d.id)
					.distance(80)
					.strength(0.4),
			)
			.force("charge", forceManyBody().strength(-160))
			.force("center", forceCenter(0, 0))
			.force(
				"collide",
				forceCollide<SimNode>().radius((d) => d.radius + 6),
			)
			.force("x", forceX(0).strength(0.05))
			.force("y", forceY(0).strength(0.05));

		// Draw-on-demand, same plumbing as GraphView: state changes schedule a single rAF.
		let drawHandle: number | null = null;
		let dpr = window.devicePixelRatio || 1;
		let cssWidth = 0;
		let cssHeight = 0;
		let transform: ZoomTransform | null = null;
		let quad: Quadtree<SimNode> = quadtree<SimNode>();
		const syncQuadtree = () => {
			quad = quadtree<SimNode>()
				.x((d) => d.x ?? 0)
				.y((d) => d.y ?? 0)
				.addAll(nodes);
		};
		function scheduleDraw() {
			if (drawHandle === null) drawHandle = requestAnimationFrame(draw);
		}
		const resize = () => {
			dpr = window.devicePixelRatio || 1;
			cssWidth = container.clientWidth || 800;
			cssHeight = container.clientHeight || 440;
			canvasEl.width = Math.round(cssWidth * dpr);
			canvasEl.height = Math.round(cssHeight * dpr);
			scheduleDraw();
		};

		const draw = () => {
			drawHandle = null;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cssWidth, cssHeight);
			if (!transform) return;
			const k = transform.k;
			ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);
			ctx.lineJoin = "round";
			const lit = selectedId ? new Set([selectedId, ...(neighbours.get(selectedId) ?? [])]) : null;
			const alphaFor = (...ids: string[]) => (lit && !ids.every((id) => lit.has(id)) ? FOCUS_FADE : 1);

			for (const link of linkEnds) {
				const { source, target } = link;
				strokeEdge(ctx, source.x ?? 0, source.y ?? 0, target.x ?? 0, target.y ?? 0, {
					k,
					targetRadius: scaledRadius(target.radius, k),
					arrowGap: ARROW_GAP,
					arrowSize: link.type === "BelongsToMilestone" ? 0 : ARROW_SIZE,
					stroke: EDGE_STROKE,
					dash: EDGE_DASH[link.type] ?? undefined,
					alpha: alphaFor(source.id, target.id),
				});
			}

			for (const node of nodes) {
				ctx.globalAlpha = alphaFor(node.id);
				ctx.beginPath();
				ctx.arc(node.x ?? 0, node.y ?? 0, scaledRadius(node.radius, k), 0, Math.PI * 2);
				ctx.fillStyle = nodeFill(node.style, theme);
				ctx.fill();
				ctx.lineWidth = Math.max(0.35, (node.isRoot ? 2.5 : 1) / k);
				ctx.strokeStyle = node.isRoot ? "#1d4ed8" : NODE_STROKE[node.style];
				ctx.stroke();
			}

			// A neighbourhood is a handful of nodes, so captions and relation names stay on at every
			// zoom - the full graph's tiers exist for a corpus, not for a modal.
			for (const node of nodes) {
				drawCaption(
					ctx,
					node.id,
					node.x ?? 0,
					node.y ?? 0,
					scaledRadius(node.radius, k),
					node.id.length * 6.1 + 14,
					k,
					alphaFor(node.id),
					colors,
				);
			}
			for (const link of linkEnds) {
				const { source, target } = link;
				drawEdgeLabel(
					ctx,
					EDGE_LABEL[link.type],
					source.x ?? 0,
					source.y ?? 0,
					target.x ?? 0,
					target.y ?? 0,
					k,
					-3.5,
					alphaFor(source.id, target.id),
					EDGE_STROKE,
					EDGE_LABEL_FONT,
				);
			}
			ctx.globalAlpha = 1;
		};

		const renderPositions = () => {
			syncQuadtree();
			scheduleDraw();
		};
		simulation.on("tick", renderPositions);

		// Precompute instead of animating: one synchronous layout pass, then the simulation idles
		// until a drag re-heats it.
		simulation.stop();
		for (let i = 0; i < PRECOMPUTE_TICKS; i++) simulation.tick();
		renderPositions();

		const hitTest = (clientX: number, clientY: number): SimNode | null => {
			const rect = canvasEl.getBoundingClientRect();
			if (!transform) return null;
			const [gx, gy] = transform.invert([clientX - rect.left, clientY - rect.top]);
			const found = quad.find(gx, gy, 30 + 4 / transform.k);
			if (!found) return null;
			const radius = scaledRadius(found.radius, transform.k) + 3 / transform.k;
			return Math.hypot((found.x ?? 0) - gx, (found.y ?? 0) - gy) <= radius ? found : null;
		};

		const zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
			.scaleExtent([0.2, 4])
			.duration(0)
			.on("zoom", (event) => {
				transform = event.transform;
				// Remember the viewport on this task; a drill-down round trip comes back to it.
				viewports.set(focusId, event.transform);
				if (event.sourceEvent) scheduleDraw();
				else draw();
			});
		// A mousedown that lands on a node belongs to the drag gesture, not to zoom's pan.
		const defaultFilter = zoomBehavior.filter();
		zoomBehavior.filter((event: Event) => {
			if (event.type === "mousedown" && event instanceof MouseEvent) {
				if (hitTest(event.clientX, event.clientY)) return false;
			}
			return defaultFilter.call(canvasEl, event, undefined);
		});
		ensureZoomInterrupt(select(canvasEl));
		select(canvasEl).call(zoomBehavior);
		// d3-zoom's dblclick.zoom would stopImmediatePropagation() and swallow our handler;
		// disable it - the handler below owns double-click (node -> drill, empty -> zoom).
		select(canvasEl).on("dblclick.zoom", null);

		const width = cssWidth || container.clientWidth || 800;
		const height = cssHeight || container.clientHeight || 440;
		// Fit: frame the whole subgraph, centered in the viewport. No upper bound on the zoom - a
		// neighborhood is a handful of nodes, so filling the canvas is the point; the /graph page's
		// 1.5x cap exists because it frames a whole corpus and would only ever be reached by mistake.
		const fitToView = () => {
			// A task with no relations is a subgraph of one: there is no extent to frame, and scaling
			// to the canvas would zoom in on nothing - far enough that the radius clamp draws the lone
			// node oversized. Center it at 1:1 instead.
			if (nodes.length < 2) {
				select(canvasEl).call(zoomBehavior.transform, zoomIdentity.translate(width / 2, height / 2));
				return;
			}
			const pad = 24;
			const xs = nodes.map((n) => n.x ?? 0);
			const ys = nodes.map((n) => n.y ?? 0);
			const dx = Math.max(1, Math.max(...xs) - Math.min(...xs));
			const dy = Math.max(1, Math.max(...ys) - Math.min(...ys));
			const scale = Math.max(0.2, Math.min(width / (dx + 2 * pad), height / (dy + 2 * pad)));
			const fitted = zoomIdentity
				.translate(
					width / 2 - scale * ((Math.min(...xs) + Math.max(...xs)) / 2),
					height / 2 - scale * ((Math.min(...ys) + Math.max(...ys)) / 2),
				)
				.scale(scale);
			select(canvasEl).call(zoomBehavior.transform, fitted);
		};
		// Returning to a task the user already inspected (the drill-down round trip) restores the
		// viewport they left there; a first visit frames the whole subgraph.
		const savedTransform = viewports.get(focusId);
		if (savedTransform) select(canvasEl).call(zoomBehavior.transform, savedTransform);
		else fitToView();

		let dragNode: SimNode | null = null;
		let dragMoved = false;
		const onPointerMove = (event: PointerEvent) => {
			if (dragNode) {
				dragMoved = true;
				const rect = canvasEl.getBoundingClientRect();
				if (!transform) return;
				const [gx, gy] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
				dragNode.fx = gx;
				dragNode.fy = gy;
				return;
			}
			canvasEl.style.cursor = hitTest(event.clientX, event.clientY) ? "pointer" : "";
		};
		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			const found = hitTest(event.clientX, event.clientY);
			if (!found) return;
			dragNode = found;
			dragMoved = false;
			canvasEl.setPointerCapture(event.pointerId);
			simulation.alphaTarget(0.3).restart();
			found.fx = found.x;
			found.fy = found.y;
			canvasEl.style.cursor = "grabbing";
		};
		const onPointerUp = (event: PointerEvent) => {
			if (!dragNode) return;
			simulation.alphaTarget(0);
			dragNode.fx = null;
			dragNode.fy = null;
			dragNode = null;
			canvasEl.style.cursor = "";
			try {
				canvasEl.releasePointerCapture(event.pointerId);
			} catch {
				// Already released (e.g. pointercancel).
			}
		};
		const onClick = (event: MouseEvent) => {
			// The mouseup that ends a real drag is followed by a click - swallow it.
			if (dragMoved) {
				dragMoved = false;
				return;
			}
			const found = hitTest(event.clientX, event.clientY);
			// A single click only focuses: pin the node's neighbourhood, on the root as well.
			// A click on the empty canvas releases the pinned focus.
			selectedId = found?.id ?? null;
			scheduleDraw();
		};
		const onDoubleClick = (event: MouseEvent) => {
			event.preventDefault();
			const found = hitTest(event.clientX, event.clientY);
			if (!found) {
				// Empty canvas: the double-click zoom d3-zoom used to own.
				const rect = canvasEl.getBoundingClientRect();
				select(canvasEl).call(zoomBehavior.scaleBy, 2, [event.clientX - rect.left, event.clientY - rect.top]);
				return;
			}
			// Double-click opens: drill into the neighbouring task's own detail view.
			// The root has nothing to open - it is already on screen.
			if (found.isRoot) return;
			selectedId = found.id;
			scheduleDraw();
			onTaskClickRef.current(found.id);
		};
		canvasEl.addEventListener("pointermove", onPointerMove);
		canvasEl.addEventListener("pointerdown", onPointerDown);
		canvasEl.addEventListener("pointerup", onPointerUp);
		canvasEl.addEventListener("click", onClick);
		canvasEl.addEventListener("dblclick", onDoubleClick);

		const observer = new ResizeObserver(resize);
		observer.observe(container);
		resize();

		return () => {
			simulation.stop();
			if (drawHandle !== null) cancelAnimationFrame(drawHandle);
			observer.disconnect();
			select(canvasEl).on(".zoom", null);
			canvasEl.removeEventListener("pointermove", onPointerMove);
			canvasEl.removeEventListener("pointerdown", onPointerDown);
			canvasEl.removeEventListener("pointerup", onPointerUp);
			canvasEl.removeEventListener("click", onClick);
			canvasEl.removeEventListener("dblclick", onDoubleClick);
		};
	}, [
		visibleSubgraph,
		viewports,
		focusId,
		theme,
		t.graphView.edgeDependsOn,
		t.graphView.edgeParentOf,
		t.graphView.edgeMilestone,
	]);

	const loading = !payload;
	const building = payload?.status === "building";
	const empty = !!visibleSubgraph && visibleSubgraph.nodes.length === 0;
	const ready = !!visibleSubgraph && visibleSubgraph.nodes.length > 0;

	// Legend: one toggle per node style, with the count the subgraph holds - the same legend the
	// /graph page shows, on this task's neighborhood instead of the whole corpus.
	const counts = useMemo(() => {
		const out: Partial<Record<NodeStyle, number>> = {};
		for (const node of subgraph?.nodes ?? []) {
			const style = nodeStyle(node);
			out[style] = (out[style] ?? 0) + 1;
		}
		return out;
	}, [subgraph]);
	const legendEntries: Array<{ style: NodeStyle; label: string }> = [
		{ style: "task", label: t.graphView.legendTask },
		{ style: "completed", label: t.graphView.legendCompleted },
		{ style: "draft", label: t.graphView.legendDraft },
		{ style: "milestone", label: t.graphView.legendMilestone },
	];

	return (
		<div>
			{/* No close control here: the modal header carries the arrow that leaves this view, in the
			    same slot a drill-down uses, so there is one way out instead of a second, easy-to-miss one. */}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
					{t.taskDetails.dependencyGraphTitle}
				</h3>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
					{legendEntries.map(({ style, label }) => (
						<LegendDot
							key={style}
							color={nodeFill(style, theme)}
							label={label}
							count={counts[style] ?? 0}
							active={!filters.has(style)}
							onToggle={() => toggleStyle(style)}
							hint={t.graphView.filterToggle}
						/>
					))}
					<LegendLine dash={EDGE_DASH.DependsOn} label={t.graphView.edgeDependsOn} />
					<LegendLine dash={EDGE_DASH.ParentOf} label={t.graphView.edgeParentOf} />
					<LegendLine dash={EDGE_DASH.BelongsToMilestone} label={t.graphView.edgeMilestone} />
				</div>
			</div>
			{/* The canvas takes the whole modal body: a wide reading area lets the neighborhood spread
			    out instead of bunching inside a small square with empty space on either side. */}
			<div
				ref={containerRef}
				className="relative w-full text-gray-700 dark:text-gray-300"
				style={{ height: CANVAS_HEIGHT }}
			>
				{error ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-red-500 dark:text-red-400">{error}</p>
					</div>
				) : loading ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.loading}</p>
					</div>
				) : building ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.building}</p>
					</div>
				) : empty ? (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-gray-500 dark:text-gray-400">{t.graphView.empty}</p>
					</div>
				) : null}
				<canvas
					ref={canvasRef}
					className={`w-full h-full ${ready ? "" : "invisible"}`}
					role="img"
					aria-label={t.taskDetails.dependencyGraphTitle}
				/>
				{ready && (
					<div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md border border-gray-200 bg-white/80 px-2 py-1 text-[11px] text-gray-500 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
						{t.graphView.mouseHint}
					</div>
				)}
			</div>
		</div>
	);
};

export default TaskDependencyGraph;
