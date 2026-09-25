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

interface Props {
	/** Canonical id of the open task; the subgraph is centered on it. */
	focusId: string;
	/** Bumped by the app when the server graph changes (graph-updated WebSocket); triggers a refetch. */
	graphVersion?: number;
	onTaskClick: (taskId: string) => void;
	onClose: () => void;
}

type NodeStyle = "task" | "completed" | "draft" | "milestone";

// Same palette family as GraphView: blue for open work, amber for drafts, green for
// completed, purple for milestones.
const NODE_FILL: Record<NodeStyle, string> = {
	task: "#3b82f6",
	completed: "#10b981",
	draft: "#f59e0b",
	milestone: "#a855f7",
};
const NODE_STROKE: Record<NodeStyle, string> = {
	task: "#93c5fd",
	completed: "#6ee7b7",
	draft: "#fcd34d",
	milestone: "#d8b4fe",
};
const EDGE_STROKE = "#94a3b8";
const EDGE_DASH: Record<GraphEdgeDto["type"], string | null> = {
	// DependsOn is the semantic backbone: solid with an arrowhead. The structural relations are dashed.
	DependsOn: null,
	ParentOf: "6 3",
	BelongsToMilestone: "2 3",
};
const ARROW_SIZE = 7;
const ARROW_GAP = 2;
const NODE_RADIUS = 14;
const ROOT_RADIUS = 18;
const PRECOMPUTE_TICKS = 200;
const EDGE_LABEL_FONT = 10;

const nodeStyle = (node: GraphNodeDto): NodeStyle => {
	if (node.kind === "milestone") return "milestone";
	if (node.kind === "draft") return "draft";
	return node.filePath.startsWith("completed/") ? "completed" : "task";
};

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
export const TaskDependencyGraph: FC<Props> = ({ focusId, graphVersion, onTaskClick, onClose }) => {
	const { t } = useI18n();
	const { theme } = useTheme();
	const [payload, setPayload] = useState<Awaited<ReturnType<typeof apiClient.getGraph>> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hiddenStyles, setHiddenStyles] = useState<ReadonlySet<NodeStyle>>(() => new Set<NodeStyle>());
	const svgRef = useRef<SVGSVGElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const onTaskClickRef = useRef(onTaskClick);
	useEffect(() => {
		onTaskClickRef.current = onTaskClick;
	}, [onTaskClick]);

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
		if (hiddenStyles.size === 0) return subgraph;
		const visible = new Set(
			subgraph.nodes.filter((node) => node.isRoot || !hiddenStyles.has(nodeStyle(node))).map((node) => node.id),
		);
		return {
			nodes: subgraph.nodes.filter((node) => visible.has(node.id)),
			edges: subgraph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)),
		};
	}, [subgraph, hiddenStyles]);

	const toggleStyle = useCallback((style: NodeStyle) => {
		setHiddenStyles((previous) => {
			const next = new Set(previous);
			if (next.has(style)) next.delete(style);
			else next.add(style);
			return next;
		});
	}, []);

	const LEGEND: Array<{ style: NodeStyle; label: string }> = [
		{ style: "task", label: t.graphView.legendTask },
		{ style: "completed", label: t.graphView.legendCompleted },
		{ style: "draft", label: t.graphView.legendDraft },
		{ style: "milestone", label: t.graphView.legendMilestone },
	];

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
		const edgeSel = g
			.append("g")
			.selectAll<SVGLineElement, SimLink>("line")
			.data(links)
			.join("line")
			.attr("stroke", EDGE_STROKE)
			.attr("stroke-width", 1)
			.attr("stroke-dasharray", (d) => EDGE_DASH[d.type] ?? null)
			.attr("marker-end", (d) => (d.type === "BelongsToMilestone" ? null : "url(#task-relationship-arrow)"))
			.style("opacity", 0.6);

		const nodeSel = g
			.append("g")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("cursor", (d) => (d.isRoot ? "default" : "pointer"));

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
			.join("g");
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
		};
		const edgeLabelSel = g
			.append("g")
			.attr("pointer-events", "none")
			.selectAll<SVGTextElement, SimLink>("text")
			.data(links)
			.join("text")
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

		// Fit: frame the whole subgraph, centered in the viewport.
		const fitToView = () => {
			const pad = 24;
			const xs = nodes.map((n) => n.x ?? 0);
			const ys = nodes.map((n) => n.y ?? 0);
			const dx = Math.max(1, Math.max(...xs) - Math.min(...xs));
			const dy = Math.max(1, Math.max(...ys) - Math.min(...ys));
			const scale = Math.min(1.5, Math.max(0.2, Math.min(width / (dx + 2 * pad), height / (dy + 2 * pad))));
			const transform: ZoomTransform = zoomIdentity
				.translate(
					width / 2 - scale * ((Math.min(...xs) + Math.max(...xs)) / 2),
					height / 2 - scale * ((Math.min(...ys) + Math.max(...ys)) / 2),
				)
				.scale(scale);
			svg.call(zoomBehavior.transform, transform);
		};
		fitToView();

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
		nodeSel.on("click", (event: MouseEvent, d: SimNode) => {
			event.stopPropagation();
			if (!d.isRoot) onTaskClickRef.current(d.id);
		});

		return () => {
			simulation.stop();
			svg.on("click", null);
		};
	}, [visibleSubgraph, theme, t.graphView.edgeDependsOn, t.graphView.edgeParentOf, t.graphView.edgeMilestone]);

	const loading = !payload;
	const building = payload?.status === "building";
	const empty = !!visibleSubgraph && visibleSubgraph.nodes.length === 0;
	const ready = !!visibleSubgraph && visibleSubgraph.nodes.length > 0;

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
					{t.taskDetails.dependencyGraphTitle}
				</h3>
				<button
					type="button"
					onClick={onClose}
					title={t.taskDetails.dependencyGraphClose}
					aria-label={t.taskDetails.dependencyGraphClose}
					className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200 leading-none w-7 h-7 flex items-center justify-center"
				>
					×
				</button>
			</div>
			<div className="flex flex-wrap items-center gap-1.5 mb-2">
				{LEGEND.map(({ style, label }) => {
					const hidden = hiddenStyles.has(style);
					return (
						<button
							key={style}
							type="button"
							onClick={() => toggleStyle(style)}
							aria-pressed={!hidden}
							title={t.graphView.filterToggle}
							className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors duration-200 ${
								hidden
									? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 line-through"
									: "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
							}`}
						>
							<span
								className="w-2.5 h-2.5 rounded-full"
								style={{ backgroundColor: NODE_FILL[style], opacity: hidden ? 0.3 : 1 }}
							/>
							{label}
						</button>
					);
				})}
			</div>
			<div ref={containerRef} className="relative text-gray-700 dark:text-gray-300">
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
					height={440}
					className={ready ? "" : "invisible"}
					role="img"
					aria-label={t.taskDetails.dependencyGraphTitle}
				/>
			</div>
		</div>
	);
};

export default TaskDependencyGraph;
