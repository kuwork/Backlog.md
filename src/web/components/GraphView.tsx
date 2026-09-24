import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// Imported for its standalone interrupt(node) below: d3-zoom needs it, and the module also
// carries d3-transition's Selection prototype patch (see the runtime patch in the effect).
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
import { select, type Selection } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { Task } from "../../types";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type GraphEdgeDto, type GraphNodeDto, type GraphNodeKind, type GraphPayload } from "../lib/api";

interface GraphViewProps {
	/** Bumped by the shell on every graph-updated WebSocket message; drives an in-place refetch. */
	graphVersion: number;
	onEditTask: (task: Task) => void;
}

interface SimNode extends SimulationNodeDatum {
	id: string;
	title: string;
	kind: GraphNodeKind;
	completed: boolean;
	style: NodeStyle;
	/** Relation count, drives the radius. */
	degree: number;
	radius: number;
	/** Estimated plate width for the caption under the circle. */
	captionWidth: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
	type: GraphEdgeDto["type"];
}

type NodeStyle = "task" | "completed" | "draft" | "milestone";

const NODE_FILL: Record<NodeStyle, string> = {
	task: "#3b82f6",
	completed: "#10b981",
	draft: "#f59e0b",
	milestone: "#a855f7",
};

/** Light tint of each fill, so nodes read as tiles instead of flat dots (Neo4j-style). */
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
/** Screen-space length of the edge arrowhead; kept constant by rescaling on zoom. */
const ARROW_SIZE = 7;
/** Screen-space gap between the arrowhead tip and the target node's rim. */
const ARROW_GAP = 2;

// Node radius encodes degree: sqrt keeps the area readable instead of letting one hub dwarf the
// rest. Hubs (half the max degree, at least 2 relations) get a caption at the overview zoom.
const NODE_RADIUS_MIN = 6;
const NODE_RADIUS_MAX = 20;
const CAPTION_FONT = 10.5;
const CAPTION_CHAR_WIDTH = 6.1;
const CAPTION_PAD = 14;
const RELATION_FONT = 10;

// Captions disclose in tiers as the zoom deepens: hubs -> connected nodes -> everything.
// Relation names stay a deep-zoom detail (at the overview a 700+ node graph's text blurs into
// an unreadable wall).
const CAPTION_HUB_ZOOM = 0.55;
const CAPTION_MID_ZOOM = 1.1;
const CAPTION_ALL_ZOOM = 2;
const RELATION_ZOOM_THRESHOLD = 1.8;
const PRECOMPUTE_TICKS = 250;
/** Duration of the camera fly-in when a node is clicked before its name is readable. */
const FLY_DURATION = 600;
const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Opacity kept by everything that is neither the focused node nor one of its neighbours. */
const FOCUS_FADE = 0.18;

const nodeStyle = (node: GraphNodeDto): NodeStyle => {
	if (node.kind === "milestone") return "milestone";
	if (node.kind === "draft") return "draft";
	return node.filePath.startsWith("completed/") ? "completed" : "task";
};

/**
 * Task graph view (doc-014 §4): a D3 force-directed rendering of /api/graph. The layout is
 * precomputed with a fixed tick budget instead of an idle animation loop, so a 700+ node graph
 * renders once and stays interactive; dragging re-heats only the simulation. Refetches happen
 * when graphVersion is bumped by a graph-updated WebSocket message, and existing node positions
 * are carried over so an incremental update does not reshuffle the whole picture.
 */
export default function GraphView({ graphVersion, onEditTask }: GraphViewProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const [payload, setPayload] = useState<GraphPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
	const [hiddenStyles, setHiddenStyles] = useState<Set<NodeStyle>>(() => new Set());
	const svgRef = useRef<SVGSVGElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const positionsRef = useRef(new Map<string, { x: number; y: number }>());
	// The viewport the user is looking at. A data refresh rebuilds the simulation, and re-framing
	// the whole graph at that point would yank the view away from whatever was being inspected, so
	// later runs restore this transform instead of fitting again (the overview button still fits).
	const transformRef = useRef<ZoomTransform | null>(null);
	// Focus and filters live in refs because they are applied to the live selections, not through
	// a re-render: putting them in the render effect's deps would rebuild the whole layout on
	// every hover. `selectedId` is the click-pinned focus, `hoverId` the transient one.
	const hoverIdRef = useRef<string | null>(null);
	const selectedIdRef = useRef<string | null>(null);
	const hiddenStylesRef = useRef<Set<NodeStyle>>(hiddenStyles);
	const applyStylesRef = useRef<(() => void) | null>(null);
	// Zoom controls live inside the render effect; the buttons below reach them via these refs.
	const zoomCtlRef = useRef<{
		svg: Selection<SVGSVGElement, unknown, null, undefined>;
		zoom: ZoomBehavior<SVGSVGElement, unknown>;
	} | null>(null);
	const fitToViewRef = useRef<(() => void) | null>(null);

	const panBy = useCallback((dx: number, dy: number) => {
		const ctl = zoomCtlRef.current;
		if (ctl) ctl.svg.call(ctl.zoom.translateBy, dx, dy);
	}, []);
	const zoomByFactor = useCallback((factor: number) => {
		const ctl = zoomCtlRef.current;
		if (ctl) ctl.svg.call(ctl.zoom.scaleBy, factor);
	}, []);
	const fitOverview = useCallback(() => {
		fitToViewRef.current?.();
	}, []);
	// Releases the click-pinned focus, so the whole graph comes back to full opacity. Shared by
	// the empty-canvas click and Escape.
	const clearFocus = useCallback(() => {
		if (!selectedIdRef.current) return;
		selectedIdRef.current = null;
		applyStylesRef.current?.();
	}, []);

	// Keyboard equivalents of the control buttons: arrows pan, Ctrl+[ / Ctrl+] zoom, Escape
	// releases the pinned focus. Bound on the window because the canvas is not focusable, but
	// only while this view owns the page - with a modal on top, Escape belongs to the modal.
	useEffect(() => {
		const PAN_STEP = 120;
		const PAN_KEYS: Record<string, [number, number]> = {
			ArrowUp: [0, PAN_STEP],
			ArrowDown: [0, -PAN_STEP],
			ArrowLeft: [PAN_STEP, 0],
			ArrowRight: [-PAN_STEP, 0],
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.altKey || event.metaKey) return;
			if (document.querySelector('[role="dialog"]')) return;
			const target = event.target as HTMLElement | null;
			if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
			if (event.key === "Escape") {
				clearFocus();
				return;
			}
			if (event.ctrlKey) {
				// Match on the physical key as well: some layouts report a different character.
				// The bracket pair follows the zoom keys they sit next to: ] in, [ out.
				if (event.key === "]" || event.code === "BracketRight") {
					event.preventDefault();
					zoomByFactor(1.25);
				} else if (event.key === "[" || event.code === "BracketLeft") {
					event.preventDefault();
					zoomByFactor(0.8);
				} else if (event.key === "0" || event.code === "Digit0" || event.code === "Numpad0") {
					// Also the browser's own "reset page zoom" - claim it for the graph overview.
					event.preventDefault();
					fitOverview();
				}
				return;
			}
			const pan = PAN_KEYS[event.key];
			if (!pan) return;
			event.preventDefault();
			panBy(pan[0], pan[1]);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [panBy, zoomByFactor, fitOverview, clearFocus]);

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

	// The layout effect below must not re-run just because a handler moved: opening a task popup
	// navigates, which gives the shell a new location and therefore new callback identities. The
	// effect reads the handler through this ref instead of depending on it, so navigating to a
	// modal keeps the graph - and the viewport the user zoomed to - exactly where it was.
	const openNodeRef = useRef(openNode);
	useEffect(() => {
		openNodeRef.current = openNode;
	}, [openNode]);

	// Re-apply the legend filter to the live selections. The render effect owns the styling
	// function; this one just asks it to run again once the new filter has been committed.
	useEffect(() => {
		hiddenStylesRef.current = hiddenStyles;
		applyStylesRef.current?.();
	}, [hiddenStyles]);

	const toggleStyle = useCallback((style: NodeStyle) => {
		setHiddenStyles((prev) => {
			const next = new Set(prev);
			if (next.has(style)) next.delete(style);
			else next.add(style);
			return next;
		});
	}, []);

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

	useEffect(() => {
		const svgEl = svgRef.current;
		if (!svgEl || !payload || payload.status !== "ready" || payload.nodes.length === 0) return;

		const existing = positionsRef.current;
		const nodeIds = new Set(payload.nodes.map((node: GraphNodeDto) => node.id));
		// Radius encodes degree (Neo4j-style): sqrt keeps a hub from dwarfing everything else, and
		// the same relation count always lands on the same size. Captions are truncated once here so
		// the plate width is known and zooming only has to rescale it.
		const degree = new Map<string, number>();
		for (const edge of payload.edges) {
			if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
			degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
			degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
		}
		const maxDegree = Math.max(1, ...degree.values());
		const radiusFor = (nodeId: string) =>
			NODE_RADIUS_MIN + (NODE_RADIUS_MAX - NODE_RADIUS_MIN) * Math.sqrt((degree.get(nodeId) ?? 0) / maxDegree);
		const nodes: SimNode[] = payload.nodes.map((node: GraphNodeDto) => {
			const style = nodeStyle(node);
			return {
				id: node.id,
				title: node.title,
				kind: node.kind,
				completed: style === "completed",
				style,
				degree: degree.get(node.id) ?? 0,
				radius: radiusFor(node.id),
				captionWidth: node.id.length * CAPTION_CHAR_WIDTH + CAPTION_PAD,
				...(existing.get(node.id) ?? {}),
			};
		});
		const links: SimLink[] = payload.edges
			.filter((edge: GraphEdgeDto) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
			.map((edge: GraphEdgeDto) => ({ type: edge.type, source: edge.from, target: edge.to }));

		const svg = select(svgEl);
		svg.selectAll("*").remove();
		const width = svgEl.clientWidth || 800;
		const height = svgEl.clientHeight || 600;

		// Bun's bundler can duplicate the d3-selection module across a bundle (observed with the
		// mermaid dependency graph), so d3-transition's prototype patch may land on a different
		// Selection class than the selections this view creates. d3-zoom's zoom.transform() - used
		// for the initial fit and double-click zooming - calls selection.interrupt(), so make sure
		// the prototype of the selections we hold actually has it. The standalone interrupt()
		// operates on the DOM node, so it works regardless of which class instance it came from.
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

		// Defs: an arrowhead for the directional edges. DependsOn points at the dependency,
		// ParentOf at the parent (edges are stored child/dependent -> parent/dependency, so the
		// marker sits on the target end). BelongsToMilestone is mere membership and stays plain.
		// userSpaceOnUse decouples the size from the line's stroke width; the zoom handler keeps
		// it at ARROW_SIZE screen pixels.
		const marker = svg
			.append("defs")
			.append("marker")
			.attr("id", "graph-arrow")
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
			.attr("marker-end", (d) => (d.type === "BelongsToMilestone" ? null : "url(#graph-arrow)"))
			.style("opacity", 0.5)
			.style("transition", "opacity 150ms ease");

		const nodeSel = g
			.append("g")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("cursor", "pointer")
			.style("transition", "opacity 150ms ease");

		// Uniform circles with a light tint of their own fill: nodes read as tiles rather than
		// flat dots. The stroke is rescaled with the zoom so it stays a hairline on screen.
		nodeSel
			.append("circle")
			.attr("r", (d) => d.radius)
			.attr("fill", (d) => NODE_FILL[d.style])
			.attr("stroke", (d) => NODE_STROKE[d.style])
			.attr("stroke-width", 1);

		// Captions: the code name (BACK-123) on a plate under the circle - a title would be far too
		// long to read at a glance, and hovering still surfaces the full one. Always on for hubs and
		// disclosed in tiers as the zoom deepens (see captionVisible). Kept in graph space and
		// divided by the zoom factor, so the text keeps a constant screen size.
		const plateFill = theme === "dark" ? "#111827E6" : "#FFFFFFE6";
		const plateStroke = theme === "dark" ? "#4B5563" : "#D1D5DB";
		const captionGroup = g.append("g").attr("pointer-events", "none");
		const captionSel = captionGroup
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.style("transition", "opacity 150ms ease");
		captionSel
			.append("rect")
			.attr("fill", plateFill)
			.attr("stroke", plateStroke)
			.attr("stroke-width", 1);
		captionSel
			.append("text")
			.attr("text-anchor", "middle")
			.attr("fill", "currentColor")
			.text((d) => d.id);

		// Zoom-gated labels: node ids (BACK-123) and, rotated along each edge, the relation
		// name. Group opacity carries the zoom gate, per-element opacity the hover dimming.
		const EDGE_LABEL: Record<SimLink["type"], string> = {
			DependsOn: t.graphView.edgeDependsOn,
			ParentOf: t.graphView.edgeParentOf,
			BelongsToMilestone: t.graphView.edgeMilestone,
		};
		const edgeLabelGroup = g.append("g").style("opacity", 0).attr("pointer-events", "none");
		const edgeLabelSel = edgeLabelGroup
			.selectAll<SVGTextElement, SimLink>("text")
			.data(links)
			.join("text")
			.attr("text-anchor", "middle")
			.attr("fill", EDGE_STROKE)
			.style("transition", "opacity 150ms ease")
			.text((d) => EDGE_LABEL[d.type]);

		// Adjacency drives the focus: the hovered or pinned node plus its neighbours stay lit while
		// the rest fades. Both directions are recorded so either end of an edge can be the focus.
		const neighbours = new Map<string, Set<string>>();
		const touchNeighbour = (id: string, other: string) => {
			if (!neighbours.has(id)) neighbours.set(id, new Set());
			neighbours.get(id)?.add(other);
		};
		for (const link of links) {
			const source = typeof link.source === "string" ? link.source : (link.source as SimNode).id;
			const target = typeof link.target === "string" ? link.target : (link.target as SimNode).id;
			touchNeighbour(source, target);
			touchNeighbour(target, source);
		}

		const simulation = forceSimulation<SimNode, SimLink>(nodes)
			.force(
				"link",
				forceLink<SimNode, SimLink>(links)
					.id((d) => d.id)
					.distance(55)
					.strength(0.35),
			)
			.force("charge", forceManyBody().strength(-90))
			.force("center", forceCenter(0, 0))
			// Collide with the real radius so hubs get the room their circle needs.
			.force("collide", forceCollide<SimNode>().radius((d) => d.radius + 3))
			.force("x", forceX(0).strength(0.05))
			.force("y", forceY(0).strength(0.05));

		// The label rides above the line by a screen-space offset, so it needs the live zoom
		// factor; the zoom handler re-places the labels whenever k changes.
		let currentK = 1;
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
		// Constant screen size: circles are drawn at radius/k so dots stay legible at any zoom (745
		// nodes fit at ~0.4x, where a fixed 6px dot would shrink to ~2px). Clamped so extreme zooms
		// stay sane. Shared with the edge trim and the captions, so the arrowhead and the plate
		// always follow the circle that is actually on screen.
		const scaledRadius = (d: SimNode, k: number) => Math.max(2.5, Math.min(30, d.radius / k));
		// The line stops at the target's rim plus a small gap, so the arrowhead tip lands just
		// outside the circle instead of being buried under the node (both ends are drawn at node
		// centers; the source end stays covered by its own circle). Both terms are graph-space, so
		// the trim must be recomputed whenever k changes - otherwise the arrowhead drifts off the
		// rim, which is very visible on a wheel zoom.
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
		const renderPositions = () => {
			placeEdges();
			placeEdgeLabels();
			nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
			captionSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
			for (const node of nodes) {
				existing.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
			}
		};
		simulation.on("tick", renderPositions);

		// Precompute instead of animating: one synchronous layout pass, then the simulation idles
		// (alpha 0) until a drag re-heats it. Keeps a 700+ node graph off the rAF loop entirely.
		simulation.stop();
		for (let i = 0; i < PRECOMPUTE_TICKS; i++) simulation.tick();
		renderPositions();

		// Hubs are the nodes worth naming at the overview: half the max degree, and at least two
		// relations, so both a 700-node project and a 6-node one have something to label.
		const hubDegree = Math.min(6, Math.max(2, Math.ceil(maxDegree / 2)));
		const captionVisible = (d: SimNode, k: number) => {
			if (hiddenStylesRef.current.has(d.style)) return false;
			if (k >= CAPTION_ALL_ZOOM) return true;
			if (k >= CAPTION_MID_ZOOM) return d.degree >= 2;
			return k >= CAPTION_HUB_ZOOM && d.degree >= hubDegree;
		};
		// The zoom at which this node's own code name becomes readable. Mirrors the tiers above, so
		// a fly-in always ends with the name on screen and the next click opens the details.
		const captionTierZoom = (d: SimNode) => {
			if (d.degree >= 2) return CAPTION_MID_ZOOM;
			if (d.degree >= hubDegree) return CAPTION_HUB_ZOOM;
			return CAPTION_ALL_ZOOM;
		};
		// A node is "readable" once its own name is on screen and, when it has relations, the
		// relation names along its edges are readable too - a connected node whose edges are still
		// unlabelled has not shown what it is connected to yet.
		const readable = (d: SimNode, k: number) =>
			captionVisible(d, k) && (d.degree === 0 || k >= RELATION_ZOOM_THRESHOLD);
		// Relation labels fade in exactly at the threshold, so land just past it instead of on it.
		const readableZoom = (d: SimNode) =>
			Math.max(captionTierZoom(d), d.degree > 0 ? RELATION_ZOOM_THRESHOLD + 0.05 : CAPTION_MID_ZOOM);

		// Captions live in graph space (they must follow nodes), so the plate, its outline and the
		// text are divided by the zoom factor to keep a constant screen size.
		const rescaleCaptions = (k: number) => {
			captionSel.each(function (d) {
				const el = select(this);
				const visible = captionVisible(d, k);
				el.style("display", visible ? "" : "none");
				if (!visible) return;
				el.select("rect")
					.attr("x", -d.captionWidth / k / 2)
					.attr("y", scaledRadius(d, k) + 4 / k)
					.attr("width", d.captionWidth / k)
					.attr("height", 16 / k)
					.attr("rx", 8 / k)
					// The outline is in graph space too, so without the compensation the plate
					// grows a thicker border the further the user zooms in.
					.attr("stroke-width", Math.max(0.35, 1 / k));
				el.select("text")
					.attr("font-size", CAPTION_FONT / k)
					.attr("x", 0)
					.attr("y", scaledRadius(d, k) + 16 / k);
			});
		};

		// Same for the relation names: without the compensation they grow into poster-sized text
		// while the captions stay at reading size.
		const rescaleRelationLabels = (k: number) => {
			edgeLabelSel.attr("font-size", RELATION_FONT / k).attr("dy", 3.5 / k);
		};

		const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.05, 4])
			// Double-click zooms instantly (no d3 transition): the transition-based path calls
			// selection.transition(), which is the other half of the prototype patch above and is
			// not guaranteed to exist on this Selection class.
			.duration(0)
			.on("zoom", (event) => {
				g.attr("transform", event.transform.toString());
				transformRef.current = event.transform;
				// Constant screen size: compensate node radius by 1/k so dots stay legible
				// at the full-graph fit zoom (745 nodes fit at ~0.4x, where a fixed 5px
				// radius shrinks to an invisible ~2px). Clamped so extreme zooms stay sane.
				const k = event.transform.k;
				currentK = k;
				nodeSel
					.select<SVGCircleElement>("circle")
					.attr("r", (d) => scaledRadius(d, k))
					.attr("stroke-width", Math.max(0.35, 1 / k));
				// Same compensation for the edges: without it lines, dashes and the arrowhead all
				// grow with the zoom (the arrow alone reached ~24px at k=4).
				edgeSel
					.attr("stroke-width", Math.max(0.35, 1 / k))
					.attr("stroke-dasharray", (d) => {
						const dash = EDGE_DASH[d.type];
						return dash ? dash.split(" ").map((v) => Number(v) / k).join(" ") : null;
					});
				marker.attr("markerWidth", ARROW_SIZE / k).attr("markerHeight", ARROW_SIZE / k);
				edgeLabelGroup.style("opacity", k >= RELATION_ZOOM_THRESHOLD ? 1 : 0);
				rescaleCaptions(k);
				rescaleRelationLabels(k);
				// Edge ends and labels live in graph space and depend on k, so they follow the wheel
				// too: without this the arrowhead drifts off the target's rim as the user zooms.
				placeEdges();
				placeEdgeLabels();
			});
		svg.call(zoomBehavior);

		// Fit: frame the whole graph with a uniform (isotropic) scale so the layout keeps its
		// natural circular shape and is centered in the viewport. Shared by the initial render
		// and the overview button — after node drags it reframes around current positions.
		const fitToView = () => {
			const pad = 24;
			const xs = nodes.map((n) => n.x ?? 0);
			const ys = nodes.map((n) => n.y ?? 0);
			const minX = Math.min(...xs);
			const maxX = Math.max(...xs);
			const minY = Math.min(...ys);
			const maxY = Math.max(...ys);
			const dx = Math.max(1, maxX - minX);
			const dy = Math.max(1, maxY - minY);
			const scale = Math.min(1.5, Math.max(0.05, Math.min(width / (dx + 2 * pad), height / (dy + 2 * pad))));
			const transform: ZoomTransform = zoomIdentity
				.translate(width / 2 - scale * ((minX + maxX) / 2), height / 2 - scale * ((minY + maxY) / 2))
				.scale(scale);
			svg.call(zoomBehavior.transform, transform);
		};
		const savedTransform = transformRef.current;
		if (savedTransform) {
			svg.call(zoomBehavior.transform, savedTransform);
		} else {
			fitToView();
		}
		fitToViewRef.current = fitToView;
		zoomCtlRef.current = { svg, zoom: zoomBehavior };

		// Camera fly-in (Neo4j-style "pull in"): centre and zoom are interpolated together with one
		// easing, so the move reads as a single camera push rather than a pan plus a zoom. Driven by
		// rAF instead of d3 transitions, which are unusable on these selections (see the prototype
		// patch above).
		let flyHandle: number | null = null;
		const stopFly = () => {
			if (flyHandle === null) return;
			cancelAnimationFrame(flyHandle);
			flyHandle = null;
		};
		const flyTo = (k: number, cx: number, cy: number) => {
			stopFly();
			const from = transformRef.current ?? zoomIdentity;
			const fromCx = (width / 2 - from.x) / from.k;
			const fromCy = (height / 2 - from.y) / from.k;
			const start = performance.now();
			let applied: ZoomTransform | null = null;
			const step = (now: number) => {
				flyHandle = null;
				// Whoever else moved the camera meanwhile (wheel, buttons, drag) wins over the fly.
				const live = transformRef.current;
				if (applied && (!live || live.k !== applied.k || live.x !== applied.x || live.y !== applied.y)) return;
				const u = Math.min(1, (now - start) / FLY_DURATION);
				const e = easeInOutCubic(u);
				const scale = from.k * (k / from.k) ** e;
				const x = width / 2 - scale * (fromCx + (cx - fromCx) * e);
				const y = height / 2 - scale * (fromCy + (cy - fromCy) * e);
				const transform = zoomIdentity.translate(x, y).scale(scale);
				svg.call(zoomBehavior.transform, transform);
				applied = transform;
				if (u < 1) flyHandle = requestAnimationFrame(step);
			};
			flyHandle = requestAnimationFrame(step);
		};

		// Focus (Neo4j-style): the hovered or click-pinned node and its neighbours stay lit while
		// everything else fades. Legend filters zero out a whole node style, edges included. Both
		// are applied to the live selections so they cost nothing in React re-renders, and every
		// group carries a CSS transition so the change reads as a fade rather than a cut.
		const applyStyles = () => {
			const hidden = hiddenStylesRef.current;
			const focusId = hoverIdRef.current ?? selectedIdRef.current;
			const lit = focusId ? new Set([focusId, ...(neighbours.get(focusId) ?? [])]) : null;
			const absent = (style: NodeStyle) => hidden.has(style);
			const level = (id: string, style: NodeStyle) => (absent(style) ? 0 : lit && !lit.has(id) ? FOCUS_FADE : 1);

			nodeSel.style("opacity", (d) => level(d.id, d.style)).style("pointer-events", (d) => (absent(d.style) ? "none" : null));
			captionSel.style("opacity", (d) => level(d.id, d.style));
			edgeSel
				.style("opacity", (l) => {
					const source = (l.source as SimNode).style;
					const target = (l.target as SimNode).style;
					if (absent(source) || absent(target)) return 0;
					if (!lit) return 0.5;
					return lit.has((l.source as SimNode).id) && lit.has((l.target as SimNode).id) ? 1 : 0.06;
				})
				.style("pointer-events", (l) =>
					absent((l.source as SimNode).style) || absent((l.target as SimNode).style) ? "none" : null,
				);
			edgeLabelSel.style("opacity", (l) => {
				const source = (l.source as SimNode).style;
				const target = (l.target as SimNode).style;
				if (absent(source) || absent(target)) return 0;
				if (!lit) return 1;
				return lit.has((l.source as SimNode).id) && lit.has((l.target as SimNode).id) ? 1 : 0.08;
			});
		};
		applyStylesRef.current = applyStyles;
		applyStyles();

		nodeSel
			.on("mouseover", (event: MouseEvent, d: SimNode) => {
				hoverIdRef.current = d.id;
				applyStyles();
				// Captions are truncated and ids only appear deep in the zoom, so surface the full
				// title on hover.
				const rect = containerRef.current?.getBoundingClientRect();
				setHover({
					x: event.clientX - (rect?.left ?? 0),
					y: event.clientY - (rect?.top ?? 0),
					label: d.title || d.id,
				});
			})
			.on("mouseout", () => {
				hoverIdRef.current = null;
				applyStyles();
				setHover(null);
			})
			.call(
				d3Drag<SVGGElement, SimNode>()
					.on("start", (event) => {
						simulation.alphaTarget(0.3).restart();
						event.subject.fx = event.subject.x;
						event.subject.fy = event.subject.y;
						setHover(null);
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
			)
			.on("click", (event: MouseEvent, d: SimNode) => {
				if (event.defaultPrevented) return;
				event.stopPropagation();
				// Pin the focus first, whichever branch below runs: a click selects the node, so its
				// neighbourhood stays lit while the camera flies in - and after the popup closes.
				selectedIdRef.current = d.id;
				applyStyles();
				// Progressive disclosure: while this node is not fully readable yet, a click means
				// "bring me in" - fly in until its code name and, if it has relations, the relation
				// names along its edges are on screen. Once readable the same click opens the
				// details, so the fly never stops short of that.
				if (!readable(d, currentK)) {
					flyTo(readableZoom(d), d.x ?? 0, d.y ?? 0);
					return;
				}
				const record = payload.nodes.find((node: GraphNodeDto) => node.id === d.id);
				if (record) openNodeRef.current(record);
			});

		// A click on the empty canvas releases the pinned focus.
		svg.on("click", clearFocus);

		return () => {
			simulation.stop();
			stopFly();
			fitToViewRef.current = null;
			zoomCtlRef.current = null;
			applyStylesRef.current = null;
			svg.on("click", null);
			setHover(null);
		};
	}, [
		payload,
		theme,
		clearFocus,
		t.graphView.edgeDependsOn,
		t.graphView.edgeParentOf,
		t.graphView.edgeMilestone,
	]);

	const ready = payload?.status === "ready" && payload.nodes.length > 0;

	// Legend: one toggle per node style, with the live count so the filter also reads as a summary.
	const counts = useMemo(() => {
		const out: Partial<Record<NodeStyle, number>> = {};
		for (const node of payload?.nodes ?? []) {
			const style = nodeStyle(node);
			out[style] = (out[style] ?? 0) + 1;
		}
		return out;
	}, [payload]);
	const legendEntries: Array<{ style: NodeStyle; label: string }> = [
		{ style: "task", label: t.graphView.legendTask },
		{ style: "completed", label: t.graphView.legendCompleted },
		{ style: "draft", label: t.graphView.legendDraft },
		{ style: "milestone", label: t.graphView.legendMilestone },
	];

	return (
		<div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
			<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-baseline gap-3">
					<h2 className="text-xl font-bold">{t.graphView.title}</h2>
					{ready && (
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{t.graphView.nodesAndEdges.replace("{1}", String(payload.nodes.length)).replace("{2}", String(payload.edges.length))}
						</span>
					)}
				</div>
				{ready && (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
						{legendEntries.map(({ style, label }) => (
							<LegendDot
								key={style}
								color={NODE_FILL[style]}
								label={label}
								count={counts[style] ?? 0}
								active={!hiddenStyles.has(style)}
								onToggle={() => toggleStyle(style)}
								hint={t.graphView.filterToggle}
							/>
						))}
						<LegendLine dash={EDGE_DASH.DependsOn} label={t.graphView.edgeDependsOn} />
						<LegendLine dash={EDGE_DASH.ParentOf} label={t.graphView.edgeParentOf} />
						<LegendLine dash={EDGE_DASH.BelongsToMilestone} label={t.graphView.edgeMilestone} />
					</div>
				)}
			</div>
			<div ref={containerRef} className="relative flex-1 min-h-0 text-gray-700 dark:text-gray-300">
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
				<svg
					ref={svgRef}
					className={`w-full h-full ${ready ? "" : "invisible"}`}
					role="img"
					aria-label={t.graphView.title}
				/>
				{ready && (
					// Solid panel (not a transparent cluster): the whole footprint, gaps included,
					// is an opaque block, so nodes underneath are neither visible nor clickable
					// through the spacing between buttons. Three grid columns keep every key in
					// place: overview owns the top-left cell instead of sitting between the zoom
					// pair (a near miss there read as zoom in/out), the pan cross stays centred,
					// and the zoom pair keeps its outer columns of the bottom row.
					<div
						className="absolute top-3 left-3 z-10 grid grid-cols-3 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/90"
						onPointerDown={(event) => event.stopPropagation()}
					>
						<CtrlButton onClick={fitOverview} label={<FitIcon />} title={`${t.graphView.fitOverview} (Ctrl+0)`} />
						<CtrlButton onClick={() => panBy(0, 120)} label="↑" title={`${t.graphView.panUp} (↑)`} />
						<span aria-hidden="true" />
						<CtrlButton onClick={() => panBy(120, 0)} label="←" title={`${t.graphView.panLeft} (←)`} />
						<CtrlButton onClick={() => panBy(0, -120)} label="↓" title={`${t.graphView.panDown} (↓)`} />
						<CtrlButton onClick={() => panBy(-120, 0)} label="→" title={`${t.graphView.panRight} (→)`} />
						<CtrlButton onClick={() => zoomByFactor(0.8)} label="−" title={`${t.graphView.zoomOut} (Ctrl+[)`} />
						<span aria-hidden="true" />
						<CtrlButton onClick={() => zoomByFactor(1.25)} label="+" title={`${t.graphView.zoomIn} (Ctrl+])`} />
					</div>
				)}
				{ready && (
					<div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md border border-gray-200 bg-white/80 px-2 py-1 text-[11px] text-gray-500 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
						{t.graphView.keyboardHint}
					</div>
				)}
				{hover && (
					<div
						className="pointer-events-none absolute z-20 max-w-xs -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 bg-white/95 px-2 py-1 text-xs text-gray-700 shadow-md dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200"
						style={{ left: hover.x, top: hover.y - 8 }}
					>
						{hover.label}
					</div>
				)}
			</div>
		</div>
	);
}

function LegendDot({
	color,
	label,
	count,
	active,
	onToggle,
	hint,
}: {
	color: string;
	label: string;
	count: number;
	active: boolean;
	onToggle: () => void;
	hint: string;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			title={hint}
			aria-pressed={active}
			className={`flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 ${
				active ? "" : "opacity-40"
			}`}
		>
			<span className="h-2.5 w-2.5 rounded-circle" style={{ backgroundColor: color }} aria-hidden="true" />
			<span className={active ? "" : "line-through"}>{label}</span>
			<span className="text-gray-400 dark:text-gray-500">{count}</span>
		</button>
	);
}

function CtrlButton({ onClick, label, title }: { onClick: () => void; label: ReactNode; title: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			aria-label={title}
			className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
		>
			{label}
		</button>
	);
}

// Two outward right angles (top-left, bottom-right) read as "fit the whole graph in view" -
// the diagonal arrow of the old glyph is not needed to say it.
function FitIcon() {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 16 16"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M6 2H2v4" />
			<path d="M10 14h4v-4" />
		</svg>
	);
}

function LegendLine({ dash, label }: { dash: string | null; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<svg width="22" height="6" aria-hidden="true">
				<line x1="0" y1="3" x2="22" y2="3" stroke={EDGE_STROKE} strokeWidth="1" strokeDasharray={dash ?? undefined} />
			</svg>
			{label}
		</span>
	);
}
