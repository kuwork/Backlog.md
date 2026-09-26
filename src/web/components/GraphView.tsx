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
import { captionFor, captionPlateWidth } from "../utils/graph-caption";
import { knowledgeNodeHref } from "../utils/graph-node-links";
import { apiClient, type GraphEdgeDto, type GraphNodeDto, type GraphNodeKind, type GraphPayload } from "../lib/api";
import {
	EDGE_DASH,
	EDGE_STROKE,
	KNOWLEDGE_GRAPH_HIDDEN_STYLES,
	LegendDot,
	LegendLine,
	NODE_FILL,
	NODE_STROKE,
	type NodeStyle,
	nodeStyle,
	selectVisibleGraph,
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

interface SimNode extends SimulationNodeDatum {
	id: string;
	title: string;
	/** Short label drawn under the circle: a task code name, or a knowledge page's file name. */
	caption: string;
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

/** Screen-space length of the edge arrowhead; kept constant by rescaling on zoom. */
const ARROW_SIZE = 7;
/** Screen-space gap between the arrowhead tip and the target node's rim. */
const ARROW_GAP = 2;

// Node radius encodes degree: sqrt keeps the area readable instead of letting one hub dwarf the
// rest. Hubs (half the max degree, at least 2 relations) get a caption at the overview zoom.
const NODE_RADIUS_MIN = 6;
const NODE_RADIUS_MAX = 20;
/** doc-15 §7 wants Tag nodes small and recessive, so they keep one size whatever their degree. */
const TAG_RADIUS = 5;
const CAPTION_FONT = 10.5;
const RELATION_FONT = 10;

// Captions disclose in tiers as the zoom deepens: hubs -> connected nodes -> everything.
// Relation names stay a deep-zoom detail (at the overview a 700+ node graph's text blurs into
// an unreadable wall).
const CAPTION_HUB_ZOOM = 0.55;
const CAPTION_MID_ZOOM = 1.1;
const CAPTION_ALL_ZOOM = 2;
const RELATION_ZOOM_THRESHOLD = 1.8;
/** Tick budget of a layout start that has no cached positions at all (a first visit). */
const PRECOMPUTE_TICKS = 250;
/**
 * Tick budget when the corpus is already laid out and only some nodes are new: 40 ticks to settle
 * the newcomers, plus two each, capped at 80. Measured on the real corpus (755 newcomers pinned
 * against 513 settled nodes): 60 ticks already reach the same picture as a full 250-tick re-layout
 * of everything - mean edge length 138 vs 140, no overlapping pair in either - for a third of the
 * time, and 250 ticks bought nothing measurable over 60.
 */
const REHEAT_TICKS = 40;
const REHEAT_TICKS_PER_NEW_NODE = 2;
const REHEAT_TICKS_MAX = 80;
/** Duration of the camera fly-in when a node is clicked before its name is readable. */
const FLY_DURATION = 600;
const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Opacity kept by everything that is neither the focused node nor one of its neighbours. */
const FOCUS_FADE = 0.18;

/**
 * Layout positions are persisted per view, because the layout is hundreds of milliseconds of
 * synchronous force ticks (measured: 250 ticks over 513 nodes and 2251 edges costs ~570 ms, and it
 * doubles with the edge count) and it only depends on the node set. A reload, or a return to the
 * view, therefore reuses the picture it was left with instead of paying for it again - the same
 * reason positions are already carried across an in-session rebuild. One key per view: a task graph
 * position must never be reused by the knowledge graph.
 */
const POSITION_KEY_PREFIX = "backlog.graph.positions";
/** Cap on a stored layout, so an unusually large corpus cannot exhaust the storage budget. */
const POSITION_LIMIT = 4000;

function positionKeyFor(isKnowledge: boolean): string {
	return `${POSITION_KEY_PREFIX}.${isKnowledge ? "knowledge" : "task"}`;
}

function loadStoredPositions(key: string): Map<string, { x: number; y: number }> {
	const positions = new Map<string, { x: number; y: number }>();
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return positions;
		const parsed = JSON.parse(raw) as { v?: number; positions?: Record<string, [number, number]> };
		if (parsed?.v !== 1 || !parsed.positions) return positions;
		for (const [id, point] of Object.entries(parsed.positions)) {
			if (Array.isArray(point) && point.length === 2) {
				positions.set(id, { x: Number(point[0]), y: Number(point[1]) });
			}
		}
	} catch {
		// Disabled, unreadable or foreign content: the layout simply runs from scratch.
	}
	return positions;
}

function storePositions(key: string, positions: Map<string, { x: number; y: number }>): void {
	try {
		// Rounded to whole graph units: the layout is a picture, not a measurement, and integers
		// halve the JSON that goes into a 5 MB budget.
		const entries = [...positions.entries()].slice(-POSITION_LIMIT);
		const payload: Record<string, [number, number]> = {};
		for (const [id, point] of entries) payload[id] = [Math.round(point.x), Math.round(point.y)];
		window.localStorage.setItem(key, JSON.stringify({ v: 1, positions: payload }));
	} catch {
		// Quota or private mode: the in-memory layout still works, only persistence is skipped.
	}
}

/**
 * Task graph view (doc-014 §4): a D3 force-directed rendering of /api/graph. The layout is
 * precomputed with a fixed tick budget instead of an idle animation loop, so a 700+ node graph
 * renders once and stays interactive; dragging re-heats only the simulation. Refetches happen
 * when graphVersion is bumped by a graph-updated WebSocket message, and existing node positions
 * are carried over so an incremental update does not reshuffle the whole picture.
 */
export default function GraphView({ graphVersion, onEditTask, variant = "task" }: GraphViewProps) {
	const { t } = useI18n();
	const { theme } = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const [payload, setPayload] = useState<GraphPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
	// The same payload read two ways: `/graph` shows the task relationships, the knowledge graph
	// shows pages, decisions, documents and tags. A legend click can reveal the other half.
	const isKnowledge = variant === "knowledge";
	const heading = isKnowledge ? t.graphView.knowledgeTitle : t.graphView.title;
	const [hiddenStyles, setHiddenStyles] = useState<Set<NodeStyle>>(
		() => new Set(isKnowledge ? KNOWLEDGE_GRAPH_HIDDEN_STYLES : TASK_GRAPH_HIDDEN_STYLES),
	);
	const svgRef = useRef<SVGSVGElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const positionsRef = useRef(new Map<string, { x: number; y: number }>());
	// Read once per mount: the persisted layout of this view, folded into the in-session map by the
	// first build so a reload does not re-run the force layout.
	const storedPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
	if (storedPositionsRef.current === null) storedPositionsRef.current = loadStoredPositions(positionKeyFor(isKnowledge));
	const positionKey = positionKeyFor(isKnowledge);
	// The viewport the user is looking at. A data refresh rebuilds the simulation, and re-framing
	// the whole graph at that point would yank the view away from whatever was being inspected, so
	// later runs restore this transform instead of fitting again (the overview button still fits).
	const transformRef = useRef<ZoomTransform | null>(null);
	// Focus lives in refs because it is applied to the live selections, not through a re-render:
	// putting it in the render effect's deps would rebuild the whole layout on every hover.
	// `selectedId` is the click-pinned focus, `hoverId` the transient one.
	const hoverIdRef = useRef<string | null>(null);
	const selectedIdRef = useRef<string | null>(null);
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

	// The layout effect below must not re-run just because a handler moved: opening a task popup
	// navigates, which gives the shell a new location and therefore new callback identities. The
	// effect reads the handler through this ref instead of depending on it, so navigating to a
	// modal keeps the graph - and the viewport the user zoomed to - exactly where it was.
	const openNodeRef = useRef(openNode);
	useEffect(() => {
		openNodeRef.current = openNode;
	}, [openNode]);

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
		if (!svgEl || !payload || payload.status !== "ready") return;

		const existing = positionsRef.current;
		// Fold the persisted layout in on the first build of this mount, so a reload starts from the
		// picture it was left with and a corpus with nothing new costs no ticks at all.
		if (existing.size === 0) {
			for (const [id, point] of storedPositionsRef.current ?? []) existing.set(id, point);
		}
		// The layout runs on the visible subset only - not on everything painted transparent
		// afterwards: the task graph must not be pushed around by nodes it does not draw, and the
		// simulation must not pay for them. A legend click rebuilds with the new subset; positions
		// survive in `existing`, so only newly revealed nodes get placed from scratch.
		const subset = selectVisibleGraph(payload.nodes, payload.edges, hiddenStyles);
		if (subset.nodes.length === 0) return;
		const visible = subset.nodes;
		const nodeIds = new Set(visible.map((node: GraphNodeDto) => node.id));
		// Radius encodes degree (Neo4j-style): sqrt keeps a hub from dwarfing everything else, and
		// the same relation count always lands on the same size. Captions are truncated once here so
		// the plate width is known and zooming only has to rescale it.
		const degree = new Map<string, number>();
		for (const edge of subset.edges) {
			degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
			degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
		}
		// Tags are excluded from the scale: a classification node carrying hundreds of pages would
		// otherwise set the maximum and shrink every real page towards the minimum.
		let maxDegree = 1;
		for (const node of visible) {
			if (nodeStyle(node) === "tag") continue;
			maxDegree = Math.max(maxDegree, degree.get(node.id) ?? 0);
		}
		// doc-15 §7 asks for small, recessive Tag nodes, so a tag never grows with its degree.
		const radiusFor = (node: GraphNodeDto) =>
			nodeStyle(node) === "tag"
				? TAG_RADIUS
				: NODE_RADIUS_MIN +
					(NODE_RADIUS_MAX - NODE_RADIUS_MIN) * Math.sqrt((degree.get(node.id) ?? 0) / maxDegree);
		const nodes: SimNode[] = visible.map((node: GraphNodeDto) => {
			const style = nodeStyle(node);
			const caption = captionFor(node);
			return {
				id: node.id,
				title: node.title,
				caption,
				kind: node.kind,
				completed: style === "completed",
				style,
				degree: degree.get(node.id) ?? 0,
				radius: radiusFor(node),
				captionWidth: captionPlateWidth(caption),
				...(existing.get(node.id) ?? {}),
			};
		});
		const links: SimLink[] = payload.edges
			.filter((edge: GraphEdgeDto) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
			.map((edge: GraphEdgeDto) => ({ type: edge.type, source: edge.from, target: edge.to }));

		const svg = select(svgEl);
		// Everything inside the svg belongs to this render: the previous build is dropped wholesale
		// rather than reconciled against.
		svgEl.replaceChildren();
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
		//
		// Built imperatively, as the same tree the d3 joins used to produce. A graph this size is
		// 7075 elements and ~28 000 attributes, and a `Selection.attr(fn)` call measured ~4 µs, so
		// the joins were most of the ~150 ms a rebuild cost - creating the identical DOM with
		// createElement measured 12.7 ms. d3 still owns what it is actually needed for: the data
		// bound to the node groups that the hover, click and drag handlers read.
		const NS = "http://www.w3.org/2000/svg";
		const create = <T extends SVGElement>(tag: string): T => document.createElementNS(NS, tag) as T;

		const defs = create<SVGDefsElement>("defs");
		const marker = create<SVGMarkerElement>("marker");
		marker.setAttribute("id", "graph-arrow");
		marker.setAttribute("viewBox", "0 0 10 10");
		marker.setAttribute("refX", "10");
		marker.setAttribute("refY", "5");
		marker.setAttribute("markerUnits", "userSpaceOnUse");
		marker.setAttribute("markerWidth", `${ARROW_SIZE}`);
		marker.setAttribute("markerHeight", `${ARROW_SIZE}`);
		marker.setAttribute("orient", "auto-start-reverse");
		const arrowPath = create<SVGPathElement>("path");
		arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
		arrowPath.setAttribute("fill", EDGE_STROKE);
		marker.appendChild(arrowPath);
		defs.appendChild(marker);

		// The zoomable group. The dim level of the focus mode is a custom property so the stylesheet
		// and this constant cannot drift apart.
		const gEl = create<SVGGElement>("g");
		gEl.style.setProperty("--graph-focus-fade", `${FOCUS_FADE}`);

		const edgeGroupEl = create<SVGGElement>("g");
		const edgeLines = links.map((link) => {
			const line = create<SVGLineElement>("line");
			line.setAttribute("class", "graph-edge");
			line.setAttribute("stroke", EDGE_STROKE);
			line.setAttribute("stroke-width", "1");
			const dash = EDGE_DASH[link.type];
			if (dash) line.setAttribute("stroke-dasharray", dash);
			if (link.type !== "BelongsToMilestone") line.setAttribute("marker-end", "url(#graph-arrow)");
			edgeGroupEl.appendChild(line);
			return line;
		});

		// Uniform circles with a light tint of their own fill: nodes read as tiles rather than
		// flat dots. The stroke is rescaled with the zoom so it stays a hairline on screen.
		const nodeGroupEl = create<SVGGElement>("g");
		const nodeEls = nodes.map((node) => {
			const group = create<SVGGElement>("g");
			group.setAttribute("class", "graph-node");
			group.setAttribute("cursor", "pointer");
			const circle = create<SVGCircleElement>("circle");
			circle.setAttribute("r", `${node.radius}`);
			circle.setAttribute("fill", NODE_FILL[node.style]);
			circle.setAttribute("stroke", NODE_STROKE[node.style]);
			circle.setAttribute("stroke-width", "1");
			group.appendChild(circle);
			nodeGroupEl.appendChild(group);
			return group;
		});
		const nodeCircles = nodeEls.map((group) => group.firstElementChild as SVGCircleElement);

		// Captions: the code name (BACK-123) on a plate under the circle - a title would be far too
		// long to read at a glance, and hovering still surfaces the full one. Always on for hubs and
		// disclosed in tiers as the zoom deepens (see captionVisible). Kept in graph space and
		// divided by the zoom factor, so the text keeps a constant screen size.
		const plateFill = theme === "dark" ? "#111827E6" : "#FFFFFFE6";
		const plateStroke = theme === "dark" ? "#4B5563" : "#D1D5DB";
		const captionGroupEl = create<SVGGElement>("g");
		captionGroupEl.setAttribute("pointer-events", "none");
		const captionEls = nodes.map((node) => {
			const group = create<SVGGElement>("g");
			group.setAttribute("class", "graph-caption");
			const plate = create<SVGRectElement>("rect");
			plate.setAttribute("fill", plateFill);
			plate.setAttribute("stroke", plateStroke);
			plate.setAttribute("stroke-width", "1");
			const text = create<SVGTextElement>("text");
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("fill", "currentColor");
			text.textContent = node.caption;
			group.appendChild(plate);
			group.appendChild(text);
			captionGroupEl.appendChild(group);
			return group;
		});
		const captionPlates = captionEls.map((group) => group.firstElementChild as SVGRectElement);
		const captionTexts = captionEls.map((group) => group.lastElementChild as SVGTextElement);

		// Zoom-gated labels: node ids (BACK-123) and, rotated along each edge, the relation name.
		// Group opacity carries the zoom gate, the per-element class the hover dimming.
		const EDGE_LABEL: Record<SimLink["type"], string> = {
			DependsOn: t.graphView.edgeDependsOn,
			ParentOf: t.graphView.edgeParentOf,
			BelongsToMilestone: t.graphView.edgeMilestone,
			SourcedFrom: t.graphView.edgeSourcedFrom,
			LinksTo: t.graphView.edgeLinksTo,
			TaggedWith: t.graphView.edgeTaggedWith,
		};
		const edgeLabelGroupEl = create<SVGGElement>("g");
		edgeLabelGroupEl.setAttribute("pointer-events", "none");
		edgeLabelGroupEl.setAttribute("opacity", "0");
		const edgeLabels = links.map((link) => {
			const text = create<SVGTextElement>("text");
			text.setAttribute("class", "graph-relation");
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("fill", EDGE_STROKE);
			text.textContent = EDGE_LABEL[link.type];
			edgeLabelGroupEl.appendChild(text);
			return text;
		});

		gEl.appendChild(edgeGroupEl);
		gEl.appendChild(nodeGroupEl);
		gEl.appendChild(captionGroupEl);
		gEl.appendChild(edgeLabelGroupEl);
		svgEl.replaceChildren(defs, gEl);
		// Data binding for the handlers only: the elements already exist, so this just stores each
		// node on its group (no join, no enter/exit).
		const nodeSel = select(nodeGroupEl).selectAll<SVGGElement, SimNode>("g").data(nodes);

		// ---------------------------------------------------------------- hot-path handles
		// A zoom frame, a wheel gesture, a hover and every drag tick rewrite the same attributes on
		// the same elements, and with d3's `.attr(fn)` / `.style(fn)` each write allocated a
		// Selection and called an accessor per element - measured ~4 µs, so one wheel delta over
		// 513 nodes and 2251 edges spent 97 ms on 24 363 of them, once per delta of the gesture.
		// The arrays above hold the elements directly and the links are resolved once here, so every
		// hot path writes with setAttribute / classList instead of going through d3.
		// d3 resolves a link's string endpoints into node objects on the first tick, which an
		// all-cached rebuild (no ticks at all) would never run. Resolve them here, once.
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]));
		const linkEnds = links.map((link) => ({
			source: nodeById.get(link.source as unknown as string) as SimNode,
			target: nodeById.get(link.target as unknown as string) as SimNode,
		}));
		// stroke-dasharray is a property of the edge *type* (a handful of values), but it has to be
		// divided by the live zoom - so build each distinct string once per zoom step instead of
		// split/map/join per edge per event.
		const dashSlots = [...new Set(links.map((link) => EDGE_DASH[link.type] ?? null))];
		const dashSlotOf = links.map((link) => dashSlots.indexOf(EDGE_DASH[link.type] ?? null));
		const dashAtZoom: Array<string | null> = new Array(dashSlots.length).fill(null);
		const rebuildDashes = (k: number) => {
			for (let slot = 0; slot < dashSlots.length; slot += 1) {
				const dash = dashSlots[slot];
				if (!dash) continue;
				dashAtZoom[slot] = dash
					.split(" ")
					.map((value) => Number(value) / k)
					.join(" ");
			}
		};

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

		// The label rides above the line by a screen-space offset, so it needs the live zoom factor;
		// the zoom handler re-places the labels whenever k changes. The offset is folded into the
		// same transform as the rotation, because `dy` is not an inherited attribute: keeping it
		// per element would be one more write per edge per frame.
		let currentK = 1;
		const placeEdgeLabels = () => {
			const lift = -3.5 / currentK;
			for (let index = 0; index < edgeLabels.length; index += 1) {
				const { source, target } = linkEnds[index] as { source: SimNode; target: SimNode };
				const sx = source.x ?? 0;
				const sy = source.y ?? 0;
				const tx = target.x ?? 0;
				const ty = target.y ?? 0;
				let angle = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
				// Keep the text upright: lines running right-to-left get flipped 180°.
				if (angle > 90 || angle < -90) angle += 180;
				edgeLabels[index]?.setAttribute(
					"transform",
					`translate(${(sx + tx) / 2},${(sy + ty) / 2}) rotate(${angle}) translate(0,${lift})`,
				);
			}
		};
		// Constant screen size: circles are drawn at radius/k so dots stay legible at any zoom (745
		// nodes fit at ~0.4x, where a fixed 6px dot would shrink to ~2px). Clamped so extreme zooms
		// stay sane. Shared with the edge trim and the captions, so the arrowhead and the plate
		// always follow the circle that is actually on screen.
		const scaledRadius = (d: SimNode, k: number) => Math.max(2.5, Math.min(30, d.radius / k));
		const placeEdges = () => {
			const k = currentK;
			const gap = ARROW_GAP / k;
			for (let index = 0; index < edgeLines.length; index += 1) {
				const { source, target } = linkEnds[index] as { source: SimNode; target: SimNode };
				const sx = source.x ?? 0;
				const sy = source.y ?? 0;
				const tx = target.x ?? 0;
				const ty = target.y ?? 0;
				// The line stops at the target's rim plus a small gap, so the arrowhead tip lands
				// just outside the circle instead of being buried under the node (both ends are
				// drawn at node centers; the source end stays covered by its own circle). Both terms
				// are graph-space, so the trim must be recomputed whenever k changes - otherwise the
				// arrowhead drifts off the rim, which is very visible on a wheel zoom. One hypot per
				// edge: computing both ends separately used to call this twice.
				const length = Math.hypot(tx - sx, ty - sy);
				const trim = scaledRadius(target, k) + gap;
				const t = length > 0 ? Math.max(0, (length - trim) / length) : 1;
				const line = edgeLines[index];
				if (!line) continue;
				line.setAttribute("x1", `${sx}`);
				line.setAttribute("y1", `${sy}`);
				line.setAttribute("x2", `${sx + (tx - sx) * t}`);
				line.setAttribute("y2", `${sy + (ty - sy) * t}`);
			}
		};
		const renderPositions = () => {
			placeEdges();
			// Relation names are a deep-zoom detail: below the gate the whole group is transparent,
			// so there is nothing to place - the zoom handler places them when the gate opens.
			if (currentK >= RELATION_ZOOM_THRESHOLD) placeEdgeLabels();
			for (let index = 0; index < nodeEls.length; index += 1) {
				const node = nodes[index] as SimNode;
				const transform = `translate(${node.x ?? 0},${node.y ?? 0})`;
				nodeEls[index]?.setAttribute("transform", transform);
				captionEls[index]?.setAttribute("transform", transform);
			}
			for (const node of nodes) {
				existing.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
			}
		};
		simulation.on("tick", renderPositions);

		// Incremental precompute instead of animating: every node this view has already placed is
		// pinned and reused, and only the newcomers are laid out. A rebuild that adds a handful of
		// nodes costs a few ticks instead of the whole budget, and a rebuild that adds none - a
		// legend toggle back, a theme switch, a data refresh - costs no ticks at all. A corpus the
		// cache has never seen still pays the full budget. Dragging re-heats the simulation after.
		const unseen = nodes.filter((node) => !existing.has(node.id));
		for (const node of nodes) {
			const known = existing.get(node.id);
			if (!known) continue;
			node.x = known.x;
			node.y = known.y;
			node.fx = known.x;
			node.fy = known.y;
		}
		// A newcomer that has laid-out neighbours starts at their centroid instead of d3's default
		// spiral around the origin - which is where the forces would push it anyway, so the same
		// picture is reached in fewer ticks. Deterministic (no randomness), so a reload reproduces
		// the layout, with a golden-angle nudge to keep co-located newcomers apart.
		let centreX = 0;
		let centreY = 0;
		for (const point of existing.values()) {
			centreX += point.x;
			centreY += point.y;
		}
		const settled = Math.max(1, existing.size);
		centreX /= settled;
		centreY /= settled;
		let newcomer = 0;
		for (let index = 0; index < nodes.length; index += 1) {
			const node = nodes[index] as SimNode;
			if (existing.has(node.id)) continue;
			const angle = index * 2.399963;
			let sumX = 0;
			let sumY = 0;
			let known = 0;
			for (const other of neighbours.get(node.id) ?? []) {
				const point = existing.get(other);
				if (!point) continue;
				sumX += point.x;
				sumY += point.y;
				known += 1;
			}
			newcomer += 1;
			if (known > 0) {
				node.x = sumX / known + Math.cos(angle) * 12;
				node.y = sumY / known + Math.sin(angle) * 12;
				continue;
			}
			// Nothing to anchor to: put it on a ring around the settled mass, not at the origin,
			// where it would fight the whole cluster for room.
			const ring = 40 + 6 * Math.sqrt(newcomer);
			node.x = centreX + Math.cos(angle) * ring;
			node.y = centreY + Math.sin(angle) * ring;
		}
		simulation.stop();
		const ticks =
			unseen.length === 0
				? 0
				: existing.size === 0
					? PRECOMPUTE_TICKS
					: Math.min(REHEAT_TICKS_MAX, REHEAT_TICKS + unseen.length * REHEAT_TICKS_PER_NEW_NODE);
		for (let i = 0; i < ticks; i++) simulation.tick();
		for (const node of nodes) {
			node.fx = null;
			node.fy = null;
		}
		renderPositions();
		// The layout is a function of the node set alone, so it is worth keeping for the next visit.
		storePositions(positionKey, existing);

		// Caption tiers are calibrated from the view's own degree distribution instead of fixed
		// cut-offs. The task corpus is sparse - most tasks carry no relations - while the knowledge
		// corpus is dense (a wiki page holds links, citations and tags at once), so a fixed
		// "degree >= 6" names 8 hubs on /graph but floods 278 of 513 nodes the moment /knowledge
		// crosses the first tier. Ranking by degree keeps the same progressive disclosure in every
		// view: about 1% of real nodes at the hub tier, about 7.5% at the mid tier - the shares the
		// task graph's old cut-offs happened to produce on this corpus.
		const nonTagDegrees = visible
			.filter((node: GraphNodeDto) => nodeStyle(node) !== "tag")
			.map((node: GraphNodeDto) => degree.get(node.id) ?? 0)
			.sort((a: number, b: number) => b - a);
		const degreeAtShare = (share: number) => {
			if (nonTagDegrees.length === 0) return 0;
			const rank = Math.max(1, Math.round(nonTagDegrees.length * share));
			return nonTagDegrees[rank - 1] ?? 0;
		};
		const hubDegree = degreeAtShare(0.01);
		// hubDegree >= midDegree holds by construction: a 1% rank in a descending list can never
		// carry a smaller degree than a 7.5% rank, so the mid tier is always a superset of the hub.
		const midDegree = degreeAtShare(0.075);
		// Tags stay recessive (doc-15 §7): they sit on top of the degree distribution, so letting
		// them into the calibration would name tags instead of pages - they get their captions only
		// at the deep tier, together with everything else.
		const captionVisible = (d: SimNode, k: number) => {
			if (k >= CAPTION_ALL_ZOOM) return true;
			if (d.style === "tag") return false;
			if (k >= CAPTION_MID_ZOOM) return d.degree >= midDegree;
			return k >= CAPTION_HUB_ZOOM && d.degree >= hubDegree;
		};
		// The zoom at which this node's own code name becomes readable. Mirrors the tiers above, so
		// a fly-in always ends with the name on screen and the next click opens the details.
		const captionTierZoom = (d: SimNode) => {
			if (d.style === "tag") return CAPTION_ALL_ZOOM;
			if (d.degree >= midDegree) return CAPTION_MID_ZOOM;
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
			const fontSize = CAPTION_FONT / k;
			const plateHeight = 16 / k;
			const plateRadius = 8 / k;
			const plateStroke = Math.max(0.35, 1 / k);
			for (let index = 0; index < captionEls.length; index += 1) {
				const node = nodes[index] as SimNode;
				const caption = captionEls[index];
				const visible = captionVisible(node, k);
				if (caption) caption.style.display = visible ? "" : "none";
				if (!visible) continue;
				const rim = scaledRadius(node, k);
				const plate = captionPlates[index];
				if (plate) {
					plate.setAttribute("x", `${-node.captionWidth / k / 2}`);
					plate.setAttribute("y", `${rim + 4 / k}`);
					plate.setAttribute("width", `${node.captionWidth / k}`);
					plate.setAttribute("height", `${plateHeight}`);
					plate.setAttribute("rx", `${plateRadius}`);
					// The outline is in graph space too, so without the compensation the plate
					// grows a thicker border the further the user zooms in.
					plate.setAttribute("stroke-width", `${plateStroke}`);
				}
				const text = captionTexts[index];
				if (text) {
					text.setAttribute("font-size", `${fontSize}`);
					text.setAttribute("x", "0");
					text.setAttribute("y", `${rim + plateHeight}`);
				}
			}
		};

		// Same for the relation names: without the compensation they grow into poster-sized text
		// while the captions stay at reading size. font-size is inherited, so it goes on the group
		// once; the vertical offset rides along in each label's own transform (see
		// placeEdgeLabels), because `dy` is not inherited.
		const rescaleRelationLabels = (k: number) => {
			edgeLabelGroupEl.setAttribute("font-size", `${RELATION_FONT / k}`);
		};

		// -------------------------------------------------------------- zoom application
		// One application rewrites the whole picture (24 363 attributes on the current knowledge
		// graph), and a wheel or trackpad gesture fires many events per frame. So a gesture does no
		// DOM work at all: the transform is stashed and the whole frame - camera and attributes -
		// is written once from a rAF. Writing the group transform in the handler instead would
		// invalidate the 7000-element subtree *between* events, and d3-zoom reads the pointer
		// geometry on every one of them (getScreenCTM), which forces that invalidation to be
		// recalculated synchronously: measured 39 ms per event even after the per-element writes
		// were gone. A programmatic camera move - fit, restored viewport, buttons, fly-in - applies
		// immediately instead, because it has to be on screen by the frame that asked for it.
		let zoomWorkHandle: number | null = null;
		const applyZoom = () => {
			zoomWorkHandle = null;
			const transform = transformRef.current;
			if (transform) gEl.setAttribute("transform", transform.toString());
			const k = currentK;
			const strokeWidth = `${Math.max(0.35, 1 / k)}`;
			// Constant screen size: compensate node radius by 1/k so dots stay legible at the
			// full-graph fit zoom (755 nodes fit at ~0.4x, where a fixed 6px radius shrinks to an
			// invisible ~2px). Clamped so extreme zooms stay sane.
			for (let index = 0; index < nodeCircles.length; index += 1) {
				const circle = nodeCircles[index];
				if (!circle) continue;
				circle.setAttribute("r", `${scaledRadius(nodes[index] as SimNode, k)}`);
				// The stroke is rescaled with the zoom so it stays a hairline on screen.
				circle.setAttribute("stroke-width", strokeWidth);
			}
			// Same compensation for the edges: without it lines, dashes and the arrowhead all grow
			// with the zoom (the arrow alone reached ~24px at k=4). The dash strings are built once
			// per edge *type* per step, not once per edge.
			rebuildDashes(k);
			for (let index = 0; index < edgeLines.length; index += 1) {
				const line = edgeLines[index];
				if (!line) continue;
				line.setAttribute("stroke-width", strokeWidth);
				const dash = dashAtZoom[dashSlotOf[index] as number];
				if (dash) line.setAttribute("stroke-dasharray", dash);
			}
			marker.setAttribute("markerWidth", `${ARROW_SIZE / k}`);
			marker.setAttribute("markerHeight", `${ARROW_SIZE / k}`);
			const labelsOn = k >= RELATION_ZOOM_THRESHOLD;
			edgeLabelGroupEl.setAttribute("opacity", labelsOn ? "1" : "0");
			rescaleCaptions(k);
			// Relation names are a deep-zoom detail. While their group is transparent there is
			// nothing to rescale or to place - and at the overview that is 2251 edges' worth of work
			// per zoom step.
			if (labelsOn) {
				rescaleRelationLabels(k);
				placeEdgeLabels();
			}
			// Edge ends live in graph space and depend on k too: without this the arrowhead drifts
			// off the target's rim as the user zooms.
			placeEdges();
		};

		const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.05, 4])
			// Double-click zooms instantly (no d3 transition): the transition-based path calls
			// selection.transition(), which is the other half of the prototype patch above and is
			// not guaranteed to exist on this Selection class.
			.duration(0)
			.on("zoom", (event) => {
				transformRef.current = event.transform;
				currentK = event.transform.k;
				if (event.sourceEvent) {
					if (zoomWorkHandle === null) zoomWorkHandle = requestAnimationFrame(applyZoom);
				} else {
					applyZoom();
				}
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
		// everything else fades. The dimming itself lives in the stylesheet (`.graph-dim` on the
		// zoom group), so entering or leaving the focus is one class plus the lit neighbourhood
		// instead of 5529 inline opacity writes - those only became expensive when something read
		// geometry afterwards, because the whole written set then had to be recalculated at once
		// (~176 ms measured). The untouched majority is left to CSS and never written at all.
		let focusedIds: Set<string> | null = null;
		// An edge dims when both of its ends are lit, which a CSS rule cannot express on its own, so
		// each edge carries a mark - and only edges whose mark changes are touched.
		const edgeLitMarks = new Uint8Array(links.length);
		const applyStyles = () => {
			const focusId = hoverIdRef.current ?? selectedIdRef.current;
			const lit = focusId ? new Set([focusId, ...(neighbours.get(focusId) ?? [])]) : null;
			const previous = focusedIds;

			if (previous) {
				for (const id of previous) {
					const index = nodeIndexById.get(id);
					if (index === undefined) continue;
					nodeEls[index]?.classList.remove("lit");
					captionEls[index]?.classList.remove("lit");
				}
			}
			if (lit) {
				for (const id of lit) {
					const index = nodeIndexById.get(id);
					if (index === undefined) continue;
					nodeEls[index]?.classList.add("lit");
					captionEls[index]?.classList.add("lit");
				}
			}
			for (let index = 0; index < linkEnds.length; index += 1) {
				const { source, target } = linkEnds[index] as { source: SimNode; target: SimNode };
				const mark = lit?.has(source.id) && lit.has(target.id) ? 1 : 0;
				if (mark === edgeLitMarks[index]) continue;
				edgeLitMarks[index] = mark;
				if (mark) {
					edgeLines[index]?.classList.add("lit");
					edgeLabels[index]?.classList.add("lit");
				} else {
					edgeLines[index]?.classList.remove("lit");
					edgeLabels[index]?.classList.remove("lit");
				}
			}
			gEl.classList.toggle("graph-dim", lit !== null);
			focusedIds = lit;
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
						// The user just chose part of the picture by hand, so it is worth keeping for
						// the next visit too.
						storePositions(positionKey, existing);
					}),
			)
			.on("click", (event: MouseEvent, d: SimNode) => {
				if (event.defaultPrevented) return;
				event.stopPropagation();
				// A single click only focuses: pin the node's neighbourhood and, while it is not
				// readable yet, fly in until its code name and, if it has relations, the relation
				// names along its edges are on screen. Opening is the double-click's job now.
				selectedIdRef.current = d.id;
				applyStyles();
				if (!readable(d, currentK)) flyTo(readableZoom(d), d.x ?? 0, d.y ?? 0);
			})
			.on("dblclick", (event: MouseEvent, d: SimNode) => {
				// Double-click opens: a task/draft record opens its modal, a knowledge page its own
				// tab. The event is kept from bubbling so the canvas double-click zoom (d3-zoom's
				// own dblclick handling on the svg) does not also fire.
				event.stopPropagation();
				event.preventDefault();
				stopFly();
				selectedIdRef.current = d.id;
				applyStyles();
				const record = payload.nodes.find((node: GraphNodeDto) => node.id === d.id);
				if (record) openNodeRef.current(record);
			});

		// A click on the empty canvas releases the pinned focus.
		svg.on("click", clearFocus);

		return () => {
			simulation.stop();
			stopFly();
			if (zoomWorkHandle !== null) cancelAnimationFrame(zoomWorkHandle);
			fitToViewRef.current = null;
			zoomCtlRef.current = null;
			applyStylesRef.current = null;
			svg.on("click", null);
			setHover(null);
		};
	}, [
		payload,
		theme,
		// A legend click changes the node set the layout runs on, so it must rebuild; positions are
		// carried over (and persisted), so only newly revealed nodes are laid out from scratch.
		hiddenStyles,
		positionKey,
		clearFocus,
		t.graphView.edgeDependsOn,
		t.graphView.edgeParentOf,
		t.graphView.edgeMilestone,
		t.graphView.edgeSourcedFrom,
		t.graphView.edgeLinksTo,
		t.graphView.edgeTaggedWith,
	]);

	const ready = payload?.status === "ready" && payload.nodes.length > 0;

	// The headline counts what this reading actually draws, not what the payload holds: the task
	// graph and the knowledge graph are two subsets of one payload, and a legend click changes the
	// subset. Same helper the layout uses, so the number can never disagree with the picture.
	const visibleCounts = useMemo(() => {
		const subset = selectVisibleGraph(payload?.nodes ?? [], payload?.edges ?? [], hiddenStyles);
		return { nodes: subset.nodes.length, edges: subset.edges.length };
	}, [payload, hiddenStyles]);

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
		{ style: "wiki", label: t.graphView.legendWiki },
		{ style: "decision", label: t.graphView.legendDecision },
		{ style: "document", label: t.graphView.legendDocument },
		{ style: "tag", label: t.graphView.legendTag },
	];

	return (
		<div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
			<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-baseline gap-3">
					<h2 className="text-xl font-bold">{heading}</h2>
					{ready && (
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{t.graphView.nodesAndEdges.replace("{1}", String(visibleCounts.nodes)).replace("{2}", String(visibleCounts.edges))}
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
						<LegendLine dash={EDGE_DASH.SourcedFrom} label={t.graphView.edgeSourcedFrom} />
						<LegendLine dash={EDGE_DASH.LinksTo} label={t.graphView.edgeLinksTo} />
						<LegendLine dash={EDGE_DASH.TaggedWith} label={t.graphView.edgeTaggedWith} />
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
					aria-label={heading}
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
					<span className="block">{t.graphView.mouseHint}</span>
					<span className="block">{t.graphView.keyboardHint}</span>
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
