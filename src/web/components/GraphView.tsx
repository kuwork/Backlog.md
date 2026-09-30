import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { quadtree, type Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { Task } from "../../types";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { captionFor, captionPlateWidth } from "../utils/graph-caption";
import { knowledgeNodeHref } from "../utils/graph-node-links";
import {
	canvasThemeColors,
	drawCaption,
	drawEdgeLabel,
	ensureZoomInterrupt,
	scaledRadius,
	strokeEdge,
} from "../utils/graph-canvas";
import { apiClient, type GraphEdgeDto, type GraphNodeDto, type GraphNodeKind, type GraphPayload } from "../lib/api";
import {
	EDGE_DASH,
	EDGE_STROKE,
	KNOWLEDGE_GRAPH_HIDDEN_STYLES,
	LegendDot,
	LegendLine,
	NODE_STROKE,
	type NodeStyle,
	nodeFill,
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

/** Screen-space length of the edge arrowhead. */
const ARROW_SIZE = 7;
/** Screen-space gap between the arrowhead tip and the target node's rim. */
const ARROW_GAP = 2;

// Node radius encodes degree: sqrt keeps the area readable instead of letting one hub dwarf the
// rest. Hubs (half the max degree, at least 2 relations) get a caption at the overview zoom.
const NODE_RADIUS_MIN = 6;
const NODE_RADIUS_MAX = 20;
/** doc-15 §7 wants Tag nodes small and recessive, so they keep one size whatever their degree. */
const TAG_RADIUS = 5;
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
 * of everything for a third of the time, and 250 ticks bought nothing measurable over 60.
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
 * Hover needs a deliberate delay: without it, sweeping the pointer across the canvas flashes the
 * tooltip and the neighbour highlight for every node on the path. The hit-test itself stays
 * instant (cursor feedback), only the tooltip and the focus dimming wait.
 */
const HOVER_DELAY_MS = 300;

/**
 * Layout positions are persisted per view, because the layout is hundreds of milliseconds of
 * synchronous force ticks (measured: 250 ticks over 513 nodes and 2251 edges costs ~570 ms, and it
 * doubles with the edge count) and it only depends on the node set. A reload, or a return to the
 * view, therefore reuses the picture it was left with instead of paying for it again. One key per
 * view: a task graph position must never be reused by the knowledge graph.
 */
const POSITION_KEY_PREFIX = "backlog.graph.positions";
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
 * Task/knowledge graph view (doc-014 §4): a Canvas 2D rendering of /api/graph with a d3-force
 * layout. The layout is precomputed with a fixed tick budget instead of an idle animation loop, so
 * a 700+ node graph renders once and stays interactive; dragging re-heats only the simulation.
 * Canvas replaces the old SVG scene: at this graph's size a zoom frame used to rewrite ~24 000 DOM
 * attributes, while the canvas repaint is a single imperative pass. Hit-testing goes through a
 * d3-quadtree over node positions since a canvas has no per-node elements to bind handlers to.
 * Refetches happen when graphVersion is bumped by a graph-updated WebSocket message, and existing
 * node positions are carried over so an incremental update does not reshuffle the whole picture.
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
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
	// Focus lives in refs because it is applied by the draw pass, not through a re-render: putting
	// it in the effect's deps would rebuild the whole layout on every hover.
	// `selectedId` is the click-pinned focus, `hoverId` the delayed transient one.
	const hoverIdRef = useRef<string | null>(null);
	const selectedIdRef = useRef<string | null>(null);
	const scheduleDrawRef = useRef<() => void>(() => {});
	const clearFocusRef = useRef<() => void>(() => {});
	const zoomCtlRef = useRef<{
		canvas: HTMLCanvasElement;
		zoom: ZoomBehavior<HTMLCanvasElement, unknown>;
	} | null>(null);
	const fitToViewRef = useRef<(() => void) | null>(null);

	const panBy = useCallback((dx: number, dy: number) => {
		const ctl = zoomCtlRef.current;
		if (ctl) select(ctl.canvas).call(ctl.zoom.translateBy, dx, dy);
	}, []);
	const zoomByFactor = useCallback((factor: number) => {
		const ctl = zoomCtlRef.current;
		if (ctl) select(ctl.canvas).call(ctl.zoom.scaleBy, factor);
	}, []);
	const fitOverview = useCallback(() => {
		fitToViewRef.current?.();
	}, []);
	const clearFocus = useCallback(() => {
		clearFocusRef.current();
	}, []);

	// Keyboard equivalents of the control buttons: arrows pan, Ctrl+[ / Ctrl+] zoom, Ctrl+0 fits,
	// Escape releases the pinned focus. Bound on the window because the canvas is not focusable,
	// but only while this view owns the page - with a modal on top, Escape belongs to the modal.
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
		const canvasEl = canvasRef.current;
		const container = containerRef.current;
		if (!canvasEl || !container || !payload || payload.status !== "ready") return;
		const ctx = canvasEl.getContext("2d");
		if (!ctx) return;

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
		if (subset.nodes.length === 0) {
			// Every kind is hidden via the legend: clear the picture explicitly. The SVG version
			// dropped all children on rebuild; a canvas keeps the last frame, and returning early
			// would leave a stale, inert image (the previous build's listeners are already gone).
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
			return;
		}
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
				: NODE_RADIUS_MIN + (NODE_RADIUS_MAX - NODE_RADIUS_MIN) * Math.sqrt((degree.get(node.id) ?? 0) / maxDegree);
		const nodes: SimNode[] = visible.map((node: GraphNodeDto) => {
			const style = nodeStyle(node);
			const caption = captionFor(node);
			return {
				id: node.id,
				title: node.title,
				caption,
				kind: node.kind,
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

		// Zoom-gated labels: node ids (BACK-123) and, rotated along each edge, the relation name.
		const EDGE_LABEL: Record<SimLink["type"], string> = {
			DependsOn: t.graphView.edgeDependsOn,
			ParentOf: t.graphView.edgeParentOf,
			BelongsToMilestone: t.graphView.edgeMilestone,
			SourcedFrom: t.graphView.edgeSourcedFrom,
			LinksTo: t.graphView.edgeLinksTo,
			TaggedWith: t.graphView.edgeTaggedWith,
		};

		// Adjacency drives the focus: the hovered or pinned node plus its neighbours stay lit while
		// the rest fades. Both directions are recorded so either end of an edge can be the focus.
		const neighbours = new Map<string, Set<string>>();
		const touchNeighbour = (id: string, other: string) => {
			if (!neighbours.has(id)) neighbours.set(id, new Set());
			neighbours.get(id)?.add(other);
		};
		for (const link of links) {
			touchNeighbour(link.source as string, link.target as string);
			touchNeighbour(link.target as string, link.source as string);
		}
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const linkEnds = links.map((link) => ({
			type: link.type,
			source: nodeById.get(link.source as string) as SimNode,
			target: nodeById.get(link.target as string) as SimNode,
		}));

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

		let currentK = 1;
		const colors = canvasThemeColors(theme);

		// Caption tiers are calibrated from the view's own degree distribution instead of fixed
		// cut-offs. The task corpus is sparse - most tasks carry no relations - while the knowledge
		// corpus is dense, so a fixed "degree >= 6" names 8 hubs on /graph but floods the knowledge
		// view the moment it crosses the first tier. Ranking by degree keeps the same progressive
		// disclosure in every view: about 1% of real nodes at the hub tier, about 7.5% at the mid
		// tier - the shares the task graph's old cut-offs happened to produce on this corpus.
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

		// ------------------------------------------------------------- canvas plumbing
		// Draw-on-demand: state changes (zoom frame, hover, drag tick, simulation tick) schedule a
		// single rAF; nothing paints outside of it.
		let drawHandle: number | null = null;
		let dpr = window.devicePixelRatio || 1;
		let cssWidth = 0;
		let cssHeight = 0;
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
			cssHeight = container.clientHeight || 600;
			canvasEl.width = Math.round(cssWidth * dpr);
			canvasEl.height = Math.round(cssHeight * dpr);
			scheduleDraw();
		};

		const draw = () => {
			drawHandle = null;
			const transform = transformRef.current;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cssWidth, cssHeight);
			if (!transform) return;
			const k = transform.k;
			ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);
			ctx.lineJoin = "round";
			const focusId = hoverIdRef.current ?? selectedIdRef.current;
			const lit = focusId ? new Set([focusId, ...(neighbours.get(focusId) ?? [])]) : null;
			const alphaFor = (...ids: string[]) =>
				lit && !ids.every((id) => lit.has(id)) ? FOCUS_FADE : 1;

			// Edges: BelongsToMilestone is mere membership and stays plain (no arrowhead).
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

			// Nodes: uniform circles with a light tint of their own fill.
			const strokeWidth = Math.max(0.35, 1 / k);
			for (const node of nodes) {
				ctx.globalAlpha = alphaFor(node.id);
				ctx.beginPath();
				ctx.arc(node.x ?? 0, node.y ?? 0, scaledRadius(node.radius, k), 0, Math.PI * 2);
				ctx.fillStyle = nodeFill(node.style, theme);
				ctx.fill();
				ctx.lineWidth = strokeWidth;
				ctx.strokeStyle = NODE_STROKE[node.style];
				ctx.stroke();
			}

			// Captions: the code name on a plate under the circle, disclosed in tiers as the zoom
			// deepens (see captionVisible). Constant screen size via the shared helper.
			for (const node of nodes) {
				if (!captionVisible(node, k)) continue;
				drawCaption(
					ctx,
					node.caption,
					node.x ?? 0,
					node.y ?? 0,
					scaledRadius(node.radius, k),
					node.captionWidth,
					k,
					alphaFor(node.id),
					colors,
				);
			}

			// Relation names are a deep-zoom detail: below the gate there is nothing to place.
			if (k >= RELATION_ZOOM_THRESHOLD) {
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
						RELATION_FONT,
					);
				}
			}
			ctx.globalAlpha = 1;
		};
		scheduleDrawRef.current = scheduleDraw;

		const renderPositions = () => {
			for (const node of nodes) {
				existing.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
			}
			syncQuadtree();
			scheduleDraw();
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
		for (let index = 0; index < nodes.length; index++) {
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

		// ------------------------------------------------------------- camera and hits
		// Hit-testing goes through the quadtree: the candidate is the nearest node within the
		// largest possible drawn radius (30 graph units, plus padding), then confirmed against its
		// own radius so the rim is easy to grab.
		const hitTest = (clientX: number, clientY: number): SimNode | null => {
			const rect = canvasEl.getBoundingClientRect();
			const transform = transformRef.current;
			if (!transform) return null;
			const [gx, gy] = transform.invert([clientX - rect.left, clientY - rect.top]);
			const k = transform.k;
			const found = quad.find(gx, gy, 30 + 4 / k);
			if (!found) return null;
			const radius = scaledRadius(found.radius, k) + 3 / k;
			return Math.hypot((found.x ?? 0) - gx, (found.y ?? 0) - gy) <= radius ? found : null;
		};

		const zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
			.scaleExtent([0.05, 4])
			// Double-click zooms instantly (no d3 transition).
			.duration(0)
			.on("zoom", (event) => {
				transformRef.current = event.transform;
				currentK = event.transform.k;
				if (event.sourceEvent) {
					// A gesture fires many events per frame; batch them into one rAF draw. A
					// programmatic camera move applies immediately, because it has to be on screen
					// by the frame that asked for it.
					scheduleDraw();
				} else {
					draw();
				}
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
		// d3-zoom's own dblclick.zoom handler calls stopImmediatePropagation(), which would swallow
		// the canvas's dblclick before our handler opens the node. Disable it: the handler below
		// owns double-click entirely (node -> open, empty canvas -> zoom in).
		select(canvasEl).on("dblclick.zoom", null);

		const width = cssWidth || container.clientWidth || 800;
		const height = cssHeight || container.clientHeight || 600;
		// Fit: frame the whole graph with a uniform (isotropic) scale so the layout keeps its
		// natural circular shape and is centered in the viewport. Shared by the initial render
		// and the overview button - after node drags it reframes around current positions.
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
			select(canvasEl).call(zoomBehavior.transform, transform);
		};
		const savedTransform = transformRef.current;
		if (savedTransform) {
			select(canvasEl).call(zoomBehavior.transform, savedTransform);
		} else {
			fitToView();
		}
		fitToViewRef.current = fitToView;
		zoomCtlRef.current = { canvas: canvasEl, zoom: zoomBehavior };

		// Camera fly-in (Neo4j-style "pull in"): centre and zoom are interpolated together with one
		// easing, so the move reads as a single camera push rather than a pan plus a zoom.
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
				select(canvasEl).call(zoomBehavior.transform, transform);
				applied = transform;
				if (u < 1) flyHandle = requestAnimationFrame(step);
			};
			flyHandle = requestAnimationFrame(step);
		};

		const releaseFocus = () => {
			if (!selectedIdRef.current) return;
			selectedIdRef.current = null;
			scheduleDraw();
		};
		clearFocusRef.current = releaseFocus;

		// Pointer interaction on a canvas is manual (no per-node DOM). Hover arms a 300ms timer -
		// the tooltip and the neighbour highlight only appear once the pointer has actually settled
		// on a node, so a fast sweep across the canvas flashes nothing. Click pins the focus and
		// flies in until the node is readable, double-click opens, drag moves the node with a
		// simulation reheat.
		let dragNode: SimNode | null = null;
		let dragMoved = false;
		let hoverTimer: ReturnType<typeof setTimeout> | null = null;
		const clearHover = () => {
			if (hoverTimer !== null) {
				clearTimeout(hoverTimer);
				hoverTimer = null;
			}
			if (hoverIdRef.current !== null) {
				hoverIdRef.current = null;
				scheduleDraw();
			}
			setHover(null);
		};
		const armHover = (node: SimNode, event: PointerEvent) => {
			if (hoverTimer !== null) clearTimeout(hoverTimer);
			const rect = container.getBoundingClientRect();
			const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
			hoverTimer = setTimeout(() => {
				hoverTimer = null;
				hoverIdRef.current = node.id;
				setHover({ ...point, label: node.title || node.id });
				scheduleDraw();
			}, HOVER_DELAY_MS);
		};
		const onPointerMove = (event: PointerEvent) => {
			if (dragNode) {
				dragMoved = true;
				const rect = canvasEl.getBoundingClientRect();
				const transform = transformRef.current;
				if (!transform) return;
				const [gx, gy] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
				dragNode.fx = gx;
				dragNode.fy = gy;
				return;
			}
			const found = hitTest(event.clientX, event.clientY);
			// Cursor feedback stays instant; only the tooltip and highlight are delayed.
			canvasEl.style.cursor = found ? "pointer" : "";
			if (!found) {
				clearHover();
				return;
			}
			if (hoverIdRef.current === found.id) {
				// Highlight already on: the tooltip just follows the pointer.
				const rect = container.getBoundingClientRect();
				setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top, label: found.title || found.id });
				return;
			}
			// A new candidate: drop any hover state immediately, arm the delay for this node.
			clearHover();
			armHover(found, event);
		};
		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			const found = hitTest(event.clientX, event.clientY);
			if (!found) return;
			// Zoom's filter already kept the pan away; own the pointer for the drag.
			dragNode = found;
			dragMoved = false;
			canvasEl.setPointerCapture(event.pointerId);
			// Reheat: the simulation wakes gently while the node is dragged.
			simulation.alphaTarget(0.3).restart();
			found.fx = found.x;
			found.fy = found.y;
			clearHover();
			canvasEl.style.cursor = "grabbing";
		};
		const onPointerUp = (event: PointerEvent) => {
			if (!dragNode) return;
			simulation.alphaTarget(0);
			dragNode.fx = null;
			dragNode.fy = null;
			if (dragMoved) {
				// The user just chose part of the picture by hand, so it is worth keeping.
				storePositions(positionKey, existing);
			}
			dragNode = null;
			canvasEl.style.cursor = "";
			try {
				canvasEl.releasePointerCapture(event.pointerId);
			} catch {
				// Already released (e.g. pointercancel).
			}
		};
		const onPointerLeave = () => {
			clearHover();
		};
		const onClick = (event: MouseEvent) => {
			// The mouseup that ends a real drag is followed by a click - swallow it.
			if (dragMoved) {
				dragMoved = false;
				return;
			}
			const found = hitTest(event.clientX, event.clientY);
			if (!found) {
				// A click on the empty canvas releases the pinned focus.
				releaseFocus();
				return;
			}
			// A single click only focuses: pin the node's neighbourhood and, while it is not
			// readable yet, fly in until its code name and, if it has relations, the relation
			// names along its edges are on screen. Opening is the double-click's job.
			selectedIdRef.current = found.id;
			scheduleDraw();
			if (!readable(found, currentK)) flyTo(readableZoom(found), found.x ?? 0, found.y ?? 0);
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
			// Double-click opens: a task/draft record opens its modal, a knowledge page its own tab.
			stopFly();
			selectedIdRef.current = found.id;
			scheduleDraw();
			const record = payload.nodes.find((node: GraphNodeDto) => node.id === found.id);
			if (record) openNodeRef.current(record);
		};
		canvasEl.addEventListener("pointermove", onPointerMove);
		canvasEl.addEventListener("pointerdown", onPointerDown);
		canvasEl.addEventListener("pointerup", onPointerUp);
		canvasEl.addEventListener("pointerleave", onPointerLeave);
		canvasEl.addEventListener("click", onClick);
		canvasEl.addEventListener("dblclick", onDoubleClick);

		const observer = new ResizeObserver(resize);
		observer.observe(container);
		resize();

		return () => {
			simulation.stop();
			stopFly();
			if (hoverTimer !== null) clearTimeout(hoverTimer);
			if (drawHandle !== null) cancelAnimationFrame(drawHandle);
			observer.disconnect();
			fitToViewRef.current = null;
			zoomCtlRef.current = null;
			scheduleDrawRef.current = () => {};
			clearFocusRef.current = () => {};
			select(canvasEl).on(".zoom", null);
			canvasEl.removeEventListener("pointermove", onPointerMove);
			canvasEl.removeEventListener("pointerdown", onPointerDown);
			canvasEl.removeEventListener("pointerup", onPointerUp);
			canvasEl.removeEventListener("pointerleave", onPointerLeave);
			canvasEl.removeEventListener("click", onClick);
			canvasEl.removeEventListener("dblclick", onDoubleClick);
			setHover(null);
		};
	}, [
		payload,
		theme,
		// A legend click changes the node set the layout runs on, so it must rebuild; positions are
		// carried over (and persisted), so only newly revealed nodes are laid out from scratch.
		hiddenStyles,
		positionKey,
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
								color={nodeFill(style, theme)}
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
				<canvas
					ref={canvasRef}
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
