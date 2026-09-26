import { useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
// Imported for its standalone interrupt(node): d3-zoom needs the d3-transition prototype
// patch the module carries, and the interrupt fallback below covers duplicated bundles.
import { interrupt as d3Interrupt } from "d3-transition";
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
import { drag as d3Drag } from "d3-drag";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { apiClient, type GraphEdgeDto, type GraphNodeDto } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { buildRelationshipSubgraph } from "../utils/task-subgraph";
import {
	EDGE_DASH,
	EDGE_STROKE,
	LegendDot,
	LegendLine,
	NODE_FILL,
	NODE_STROKE,
	type NodeStyle,
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
/** Opacity the focus mode dims to; the stylesheet reads it from --graph-focus-fade (same as GraphView). */
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
 * the same edge styles and labels as the full graph view. The layout is precomputed with a
 * fixed tick budget and stays interactive through zoom and drag.
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
	const svgRef = useRef<SVGSVGElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const onTaskClickRef = useRef(onTaskClick);
	useEffect(() => {
		onTaskClickRef.current = onTaskClick;
	}, [onTaskClick]);
	const filters = hiddenStyles ?? DEFAULT_FILTERS;

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

	useEffect(() => {
		const svgEl = svgRef.current;
		if (!svgEl || !visibleSubgraph || visibleSubgraph.nodes.length === 0) return;

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

		const svg = select(svgEl);
		svg.selectAll("*").remove();
		const width = svgEl.clientWidth || 800;
		const height = svgEl.clientHeight || 440;

		// Bun's bundler can duplicate the d3-selection module across a bundle, so d3-transition's
		// prototype patch may land on a different Selection class; give it an interrupt() fallback
		// that operates on the DOM node directly (same guard as GraphView).
		const selectionProto = Object.getPrototypeOf(svg) as unknown as {
			interrupt?: (name?: string) => unknown;
		};
		if (typeof selectionProto.interrupt !== "function") {
			selectionProto.interrupt = function (name?: string) {
				return (this as unknown as { each: (cb: (this: Element) => void) => unknown }).each(function (this: Element) {
					d3Interrupt(this, name);
				});
			};
		}

		// Arrowhead on the directional edges; BelongsToMilestone is mere membership and stays plain.
		const marker = svg
			.append("defs")
			.append("marker")
			.attr("id", "task-relationship-arrow")
			.attr("viewBox", "0 0 10 10")
			.attr("refX", 10)
			.attr("refY", 5)
			.attr("markerUnits", "userSpaceOnUse")
			.attr("markerWidth", ARROW_SIZE)
			.attr("markerHeight", ARROW_SIZE)
			.attr("orient", "auto-start-reverse");
		marker.append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", EDGE_STROKE);

		const g = svg.append("g");
		// The dim level of the focus mode is a custom property so the stylesheet and this constant
		// cannot drift apart (same mechanism as GraphView).
		g.style("--graph-focus-fade", `${FOCUS_FADE}`);
		const edgeSel = g
			.append("g")
			.selectAll<SVGLineElement, SimLink>("line")
			.data(links)
			.join("line")
			.attr("class", "graph-edge")
			.attr("stroke", EDGE_STROKE)
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", (d) => EDGE_DASH[d.type] ?? null)
			.attr("marker-end", (d) => (d.type === "BelongsToMilestone" ? null : "url(#task-relationship-arrow)"));

		const nodeSel = g
			.append("g")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("class", "graph-node")
			// Every node is clickable now: a single click pins the focus, on the root as well.
			.attr("cursor", "pointer");

		nodeSel
			.append("circle")
			.attr("r", (d) => d.radius)
			.attr("fill", (d) => NODE_FILL[d.style])
			.attr("stroke", (d) => (d.isRoot ? "#1d4ed8" : NODE_STROKE[d.style]))
			.attr("stroke-width", (d) => (d.isRoot ? 2.5 : 1));

		// Captions: the code name (BACK-123) under the circle, on an opaque plate like GraphView.
		const plateFill = theme === "dark" ? "#111827E6" : "#FFFFFFE6";
		const plateStroke = theme === "dark" ? "#4B5563" : "#D1D5DB";
		const captionSel = g
			.append("g")
			.attr("pointer-events", "none")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("class", "graph-caption");
		captionSel
			.append("rect")
			.attr("fill", plateFill)
			.attr("stroke", plateStroke)
			.attr("stroke-width", 1);
		captionSel
			.append("text")
			.attr("text-anchor", "middle")
			.attr("fill", "currentColor")
			.attr("font-size", 10.5)
			.text((d) => d.id);

		// Edge labels: the relation name along each edge (same locale keys as the full graph view).
		const EDGE_LABEL: Record<SimLink["type"], string> = {
			DependsOn: t.graphView.edgeDependsOn,
			ParentOf: t.graphView.edgeParentOf,
			BelongsToMilestone: t.graphView.edgeMilestone,
			SourcedFrom: t.graphView.edgeSourcedFrom,
			LinksTo: t.graphView.edgeLinksTo,
			TaggedWith: t.graphView.edgeTaggedWith,
		};
		const edgeLabelSel = g
			.append("g")
			.attr("pointer-events", "none")
			.selectAll<SVGTextElement, SimLink>("text")
			.data(links)
			.join("text")
			.attr("class", "graph-relation")
			.attr("text-anchor", "middle")
			.attr("fill", EDGE_STROKE)
			.attr("font-size", EDGE_LABEL_FONT)
			.text((d) => EDGE_LABEL[d.type]);

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
			.force("collide", forceCollide<SimNode>().radius((d) => d.radius + 6))
			.force("x", forceX(0).strength(0.05))
			.force("y", forceY(0).strength(0.05));

		let currentK = 1;
		const scaledRadius = (d: SimNode, k: number) => Math.max(2.5, Math.min(30, d.radius / k));
		const trimmedEnd = (d: SimLink) => {
			const sx = (d.source as SimNode).x ?? 0;
			const sy = (d.source as SimNode).y ?? 0;
			const tx = (d.target as SimNode).x ?? 0;
			const ty = (d.target as SimNode).y ?? 0;
			const len = Math.hypot(tx - sx, ty - sy);
			const trim = scaledRadius(d.target as SimNode, currentK) + ARROW_GAP / currentK;
			const t = len > 0 ? Math.max(0, (len - trim) / len) : 1;
			return { x: sx + (tx - sx) * t, y: sy + (ty - sy) * t };
		};
		const placeEdges = () => {
			edgeSel
				.attr("x1", (d) => (d.source as SimNode).x ?? 0)
				.attr("y1", (d) => (d.source as SimNode).y ?? 0)
				.attr("x2", (d) => trimmedEnd(d).x)
				.attr("y2", (d) => trimmedEnd(d).y);
		};
		const placeEdgeLabels = () => {
			edgeLabelSel.attr("transform", (d) => {
				const sx = (d.source as SimNode).x ?? 0;
				const sy = (d.source as SimNode).y ?? 0;
				const tx = (d.target as SimNode).x ?? 0;
				const ty = (d.target as SimNode).y ?? 0;
				let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
				// Keep the text upright: lines running right-to-left get flipped 180°.
				if (angle > 90 || angle < -90) angle += 180;
				return `translate(${(sx + tx) / 2},${(sy + ty) / 2}) rotate(${angle}) translate(0,${-7 / currentK})`;
			});
		};
		const renderPositions = () => {
			placeEdges();
			placeEdgeLabels();
			nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
			captionSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		};
		simulation.on("tick", renderPositions);

		// Precompute instead of animating: one synchronous layout pass, then the simulation idles
		// until a drag re-heats it.
		simulation.stop();
		for (let i = 0; i < PRECOMPUTE_TICKS; i++) simulation.tick();
		renderPositions();

		const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 4])
			.duration(0)
			.on("zoom", (event) => {
				g.attr("transform", event.transform.toString());
				// Remember the viewport on this task; a drill-down round trip comes back to it.
				viewports.set(focusId, event.transform);
				const k = event.transform.k;
				currentK = k;
				nodeSel
					.select<SVGCircleElement>("circle")
					.attr("r", (d) => scaledRadius(d, k))
					.attr("stroke-width", (d) => Math.max(0.35, (d.isRoot ? 2.5 : 1) / k));
				edgeSel
					.attr("stroke-width", Math.max(0.35, 1 / k))
					.attr("stroke-dasharray", (d) => {
						const dash = EDGE_DASH[d.type];
						return dash ? dash.split(" ").map((v) => Number(v) / k).join(" ") : null;
					});
				marker.attr("markerWidth", ARROW_SIZE / k).attr("markerHeight", ARROW_SIZE / k);
				captionSel.each(function (d) {
					const el = select(this);
					const plateWidth = d.id.length * 6.1 + 14;
					el.select("rect")
						.attr("x", -plateWidth / k / 2)
						.attr("y", scaledRadius(d, k) + 4 / k)
						.attr("width", plateWidth / k)
						.attr("height", 16 / k)
						.attr("rx", 8 / k)
						.attr("stroke-width", Math.max(0.35, 1 / k));
					el.select("text")
						.attr("font-size", 10.5 / k)
						.attr("x", 0)
						.attr("y", scaledRadius(d, k) + 16 / k);
				});
				edgeLabelSel.attr("font-size", EDGE_LABEL_FONT / k).attr("dy", 3.5 / k);
				placeEdges();
				placeEdgeLabels();
			});
		svg.call(zoomBehavior);

		// Fit: frame the whole subgraph, centered in the viewport. No upper bound on the zoom - a
		// neighborhood is a handful of nodes, so filling the canvas is the point; the /graph page's
		// 1.5x cap exists because it frames a whole corpus and would only ever be reached by mistake.
		const fitToView = () => {
			// A task with no relations is a subgraph of one: there is no extent to frame, and scaling
			// to the canvas would zoom in on nothing - far enough that the radius clamp draws the lone
			// node oversized. Center it at 1:1 instead.
			if (nodes.length < 2) {
				svg.call(zoomBehavior.transform, zoomIdentity.translate(width / 2, height / 2));
				return;
			}
			const pad = 24;
			const xs = nodes.map((n) => n.x ?? 0);
			const ys = nodes.map((n) => n.y ?? 0);
			const dx = Math.max(1, Math.max(...xs) - Math.min(...xs));
			const dy = Math.max(1, Math.max(...ys) - Math.min(...ys));
			const scale = Math.max(0.2, Math.min(width / (dx + 2 * pad), height / (dy + 2 * pad)));
			const transform: ZoomTransform = zoomIdentity
				.translate(
					width / 2 - scale * ((Math.min(...xs) + Math.max(...xs)) / 2),
					height / 2 - scale * ((Math.min(...ys) + Math.max(...ys)) / 2),
				)
				.scale(scale);
			svg.call(zoomBehavior.transform, transform);
		};
		// Returning to a task the user already inspected (the drill-down round trip) restores the
		// viewport they left there; a first visit frames the whole subgraph.
		const savedTransform = viewports.get(focusId);
		if (savedTransform) svg.call(zoomBehavior.transform, savedTransform);
		else fitToView();

		nodeSel.call(
			d3Drag<SVGGElement, SimNode>()
				.on("start", (event) => {
					simulation.alphaTarget(0.3).restart();
					event.subject.fx = event.subject.x;
					event.subject.fy = event.subject.y;
				})
				.on("drag", (event) => {
					event.subject.fx = event.x;
					event.subject.fy = event.y;
				})
				.on("end", (event) => {
					simulation.alphaTarget(0);
					event.subject.fx = null;
					event.subject.fy = null;
				}),
		);
		// Focus: the click-pinned node and its neighbours stay lit while the rest fades, through the
		// same stylesheet classes GraphView uses (.graph-dim on the zoom group, .lit on the lit
		// neighbourhood) - a subgraph is small, but the semantics should read identically.
		const neighbours = new Map<string, Set<string>>();
		const touchNeighbour = (id: string, other: string) => {
			if (!neighbours.has(id)) neighbours.set(id, new Set());
			neighbours.get(id)?.add(other);
		};
		for (const link of links) {
			touchNeighbour((link.source as SimNode).id, (link.target as SimNode).id);
			touchNeighbour((link.target as SimNode).id, (link.source as SimNode).id);
		}
		let selectedId: string | null = null;
		const applyStyles = () => {
			const lit = selectedId ? new Set([selectedId, ...(neighbours.get(selectedId) ?? [])]) : null;
			nodeSel.classed("lit", (d) => lit?.has(d.id) ?? false);
			captionSel.classed("lit", (d) => lit?.has(d.id) ?? false);
			edgeSel.classed("lit", (d) => {
				if (!lit) return false;
				return lit.has((d.source as SimNode).id) && lit.has((d.target as SimNode).id);
			});
			edgeLabelSel.classed("lit", (d) => {
				if (!lit) return false;
				return lit.has((d.source as SimNode).id) && lit.has((d.target as SimNode).id);
			});
			g.classed("graph-dim", lit !== null);
		};

		nodeSel.on("click", (event: MouseEvent, d: SimNode) => {
			event.stopPropagation();
			// A single click only focuses: pin the node's neighbourhood, on the root as well.
			selectedId = d.id;
			applyStyles();
		});
		nodeSel.on("dblclick", (event: MouseEvent, d: SimNode) => {
			// Double-click opens: drill into the neighbouring task's own detail view. Kept from
			// bubbling so the canvas double-click zoom (d3-zoom's own dblclick handling) does not
			// also fire. The root has nothing to open - it is already on screen.
			event.stopPropagation();
			event.preventDefault();
			if (d.isRoot) return;
			selectedId = d.id;
			applyStyles();
			onTaskClickRef.current(d.id);
		});

		// A click on the empty canvas releases the pinned focus.
		svg.on("click", () => {
			selectedId = null;
			applyStyles();
		});

		return () => {
			simulation.stop();
			svg.on("click", null);
		};
	}, [visibleSubgraph, viewports, focusId, theme, t.graphView.edgeDependsOn, t.graphView.edgeParentOf, t.graphView.edgeMilestone]);

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
							color={NODE_FILL[style]}
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
				<svg
					ref={svgRef}
					width="100%"
					height="100%"
					className={ready ? "" : "invisible"}
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
