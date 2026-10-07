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
import { zoom as d3Zoom, type ZoomBehavior, type ZoomTransform, zoomIdentity } from "d3-zoom";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../types";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { apiClient, type GraphEdgeDto, type GraphNodeDto, type GraphNodeKind, type GraphPayload } from "../lib/api";
import {
	canvasThemeColors,
	drawCaption,
	drawEdgeLabel,
	type EdgeBatchItem,
	ensureZoomInterrupt,
	type NodeBatchItem,
	paintNodeBatch,
	scaledRadius,
	strokeEdgeBatch,
} from "../utils/graph-canvas";
import { captionFor, captionPlateWidth } from "../utils/graph-caption";
import { knowledgeNodeHref } from "../utils/graph-node-links";
import {
	EDGE_DASH,
	edgeStroke,
	KNOWLEDGE_GRAPH_HIDDEN_STYLES,
	LegendDot,
	LegendLine,
	type NodeStyle,
	nodeFill,
	nodeStroke,
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
 * Backing-store cap. A frame is fill-rate bound, and a 4K panel at dpr 3 paints nine times the
 * pixels of dpr 1; past dpr 2 the extra sharpness is invisible in a 700-node hairball, so the
 * cap buys back the frames.
 */
const MAX_DPR = 2;
/**
 * Text layers - captions and, above all, a rotated `fillText` per relation - are the expensive
 * half of a frame and are unreadable while the picture is moving. A camera move drops them and
 * repaints once the camera has been still for this long.
 */
const TEXT_SETTLE_MS = 140;
/**
 * How long after a focus reveal starts - the fly-in landing, a gesture lifting off, a node drag
 * ending, the layout going quiet - the rest of the names come in. The focus cluster (the clicked
 * node and its neighbours) shows from the start of the move, so the eye tracks the context it went
 * to; the non-cluster names wait this long after the picture settles so they do not blur in while
 * it is still sliding.
 */
const TEXT_CLUSTER_MS = 300;
/**
 * Culling slack around the viewport, in screen pixels: room for the largest circle plus the
 * caption plate hanging below it, so a node half off-screen still paints its label.
 */
const CULL_PAD = 56;
/**
 * A drag does not change the picture, only where it is shown, so the gesture slides a copy of the
 * frame already on screen - names included - instead of painting one: one drawImage a frame
 * instead of a few thousand paths. The snapshot is taken at the live backing scale (full device
 * dpr, never reduced) so sliding the picture never softens it; the blur would be the one thing the
 * user can see mid-drag and the thing they notice first. What the drag uncovers stays blank until
 * the pointer lifts, which keeps the bitmap at viewport size instead of paying for a margin.
 */

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
	if (storedPositionsRef.current === null)
		storedPositionsRef.current = loadStoredPositions(positionKeyFor(isKnowledge));
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
	// True only while a *programmatic* camera move (fly-in, button zoom, fit, the initial frame)
	// is driving d3-zoom, so its start/end events can be told apart from a real pointer/wheel
	// gesture. A real gesture owns the snapshot and the text-reveal; a programmatic one does not.
	const programmaticRef = useRef<boolean>(false);
	const programmatic = useCallback((fn: () => void) => {
		programmaticRef.current = true;
		try {
			fn();
		} finally {
			programmaticRef.current = false;
		}
	}, []);
	const zoomCtlRef = useRef<{
		canvas: HTMLCanvasElement;
		zoom: ZoomBehavior<HTMLCanvasElement, unknown>;
	} | null>(null);
	const fitToViewRef = useRef<(() => void) | null>(null);

	const panBy = useCallback((dx: number, dy: number) => {
		const ctl = zoomCtlRef.current;
		if (ctl) select(ctl.canvas).call(ctl.zoom.translateBy, dx, dy);
	}, []);
	const zoomByFactor = useCallback(
		(factor: number) => {
			const ctl = zoomCtlRef.current;
			if (ctl) programmatic(() => select(ctl.canvas).call(ctl.zoom.scaleBy, factor));
		},
		[programmatic],
	);
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
			.force(
				"collide",
				forceCollide<SimNode>().radius((d) => d.radius + 3),
			)
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
		const fullDpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);
		let dpr = fullDpr();
		/**
		 * Changing the backing store clears the canvas, so every caller repaints straight after.
		 * Nothing else may touch `canvasEl.width/height` - a stray resize would blank a frame.
		 */
		const applyDpr = (next: number) => {
			if (next === dpr) return;
			dpr = next;
			canvasEl.width = Math.round(cssWidth * dpr);
			canvasEl.height = Math.round(cssHeight * dpr);
		};
		let cssWidth = 0;
		let cssHeight = 0;
		let quad: Quadtree<SimNode> = quadtree<SimNode>();
		// The node a press-drag is moving (null while the gesture is a canvas pan or idle). Used to
		// keep the simulation reheated and to gate the text stage so a drag does not blur to nothing,
		// but it must NOT change which node is focused - the focus stays whatever was already pinned
		// (or hovered), so a drag never switches the highlighted cluster to the dragged node.
		let dragNode: SimNode | null = null;
		let dragMoved = false;
		// Focus-derived; rebuilt only when the focus changes, see `draw`.
		let litFor: string | null = null;
		let lit: Set<string> | null = null;
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
			dpr = fullDpr();
			cssWidth = container.clientWidth || 800;
			cssHeight = container.clientHeight || 600;
			canvasEl.width = Math.round(cssWidth * dpr);
			canvasEl.height = Math.round(cssHeight * dpr);
			// The snapshot is sized off the viewport, so a resize invalidates it.
			snapTransform = null;
			scheduleDraw();
		};

		// Text is revealed in three stages as a camera move plays out, so the eye is never asked
		// to read a picture that is still sliding. "none" - the move is in flight: only the node
		// being flown to keeps its name. "focus" - the move has just landed: that node and its
		// neighbours light up. "all" - the picture has been still for a beat: every name that the
		// zoom level allows. One-off repaints (a hover, a pinned focus) stay at "all".
		type TextStage = "none" | "focus" | "all";
		let textStage: TextStage = "all";
		let settleTimer: ReturnType<typeof setTimeout> | null = null;
		let clusterTimer: ReturnType<typeof setTimeout> | null = null;
		const clearTextTimers = () => {
			if (settleTimer !== null) clearTimeout(settleTimer);
			if (clusterTimer !== null) clearTimeout(clusterTimer);
			settleTimer = null;
			clusterTimer = null;
		};
		// The camera is in motion: drop to the single name that matters (the fly target) and arm
		// the backstop - a move with no definite end snaps to full text once it has been still a
		// moment. A move that does end cancels this and runs the staged reveal instead.
		const markCameraMoving = () => {
			textStage = "none";
			if (clusterTimer !== null) clearTimeout(clusterTimer);
			clusterTimer = null;
			if (settleTimer !== null) clearTimeout(settleTimer);
			settleTimer = setTimeout(() => {
				settleTimer = null;
				textStage = "all";
				scheduleDraw();
			}, TEXT_SETTLE_MS);
		};
		// A move with a known end - the fly-in landing, a gesture lifting off, the layout going
		// quiet - reveals the focus cluster at once and the rest of the names a beat later, rather
		// than waiting the backstop out. The cluster-first beat is what made the labels feel late
		// before; now they arrive the instant the camera stops.
		const settleText = () => {
			clearTextTimers();
			// Force the cluster to rebuild from the live focus on the very next paint: a hover can
			// have shifted focusId since the last rebuild, and the landing frame must show the
			// clicked node's own neighbourhood, not a stale one.
			litFor = null;
			textStage = "focus";
			// Paint the focus cluster on the landing frame itself, not on a queued rAF: any later
			// state churn would otherwise push the reveal to the "all" beat and the neighbours
			// would only show once the picture was already still.
			draw();
			clusterTimer = setTimeout(() => {
				clusterTimer = null;
				textStage = "all";
				scheduleDraw();
			}, TEXT_CLUSTER_MS);
		};

		// Paint batches: one reusable slot per link and per node, so a repaint allocates nothing.
		// Edges bucket by (dash, alpha), nodes by (style, alpha); each bucket is one canvas path
		// instead of one per element, which is the difference between thousands of draw calls a
		// frame and a dozen.
		const edgeGroups: Array<{ alpha: number; dash: string | undefined; items: EdgeBatchItem[] }> = [];
		// Faded first, so a lit edge crossing a faded one stays on top. `EDGE_DASH` stores null for
		// a solid line; normalised to undefined here so a group key reads the same for both.
		const dashVariants: Array<string | undefined> = [
			undefined,
			...new Set(Object.values(EDGE_DASH).map((dash) => dash ?? undefined)),
		];
		for (const alpha of [FOCUS_FADE, 1]) {
			for (const dash of dashVariants) {
				edgeGroups.push({ alpha, dash, items: [] });
			}
		}
		const edgeGroupFor = new Map<string, (typeof edgeGroups)[number]>();
		for (const group of edgeGroups) edgeGroupFor.set(`${group.alpha}|${group.dash ?? ""}`, group);
		const edgeSlots: EdgeBatchItem[] = linkEnds.map(() => ({
			sx: 0,
			sy: 0,
			tx: 0,
			ty: 0,
			targetRadius: 0,
			arrowSize: 0,
			ex: 0,
			ey: 0,
			ux: 0,
			uy: 0,
		}));

		const nodeGroups: Array<{ alpha: number; style: NodeStyle; items: NodeBatchItem[] }> = [];
		for (const alpha of [FOCUS_FADE, 1]) {
			for (const style of new Set(nodes.map((node) => node.style))) {
				nodeGroups.push({ alpha, style, items: [] });
			}
		}
		const nodeGroupFor = new Map<string, (typeof nodeGroups)[number]>();
		for (const group of nodeGroups) nodeGroupFor.set(`${group.alpha}|${group.style}`, group);
		const nodeSlots: NodeBatchItem[] = nodes.map(() => ({ x: 0, y: 0, radius: 0 }));

		/**
		 * One frame of the scene, in CSS pixels at the live backing scale. `textStage` is the level
		 * of detail: the text layers are the expensive half of a frame and are unreadable while the
		 * picture moves, so they arrive in stages (see TEXT_CLUSTER_MS) instead of all at once.
		 */
		const paintScene = (surface: CanvasRenderingContext2D, transform: ZoomTransform, textStage: TextStage) => {
			const k = transform.k;
			surface.setTransform(dpr, 0, 0, dpr, 0, 0);
			surface.clearRect(0, 0, cssWidth, cssHeight);
			surface.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);
			surface.lineJoin = "round";
			// The slice of graph space the viewport shows; anything outside costs nothing to paint,
			// and a fly-in ends zoomed in, where most of the corpus is off-screen.
			const pad = CULL_PAD / k;
			const minX = -transform.x / k - pad;
			const maxX = (cssWidth - transform.x) / k + pad;
			const minY = -transform.y / k - pad;
			const maxY = (cssHeight - transform.y) / k + pad;
			// The pinned selection owns the focus cluster; a hover only supplies one when nothing is
			// pinned. A node drag deliberately does NOT contribute here - dragging or double-clicking
			// a node must never switch the focused node, it only keeps whatever focus was already set.
			const focusId = selectedIdRef.current ?? hoverIdRef.current;
			// The lit set depends on the focus alone, not on a frame, so it is built once per focus
			// rather than once per frame - a hub carries hundreds of neighbours.
			if (focusId !== litFor) {
				litFor = focusId;
				lit = focusId ? new Set([focusId, ...(neighbours.get(focusId) ?? [])]) : null;
			}
			const alphaFor = (id: string) => (lit && !lit.has(id) ? FOCUS_FADE : 1);
			const alphaForEdge = (a: string, b: string) => (lit && !(lit.has(a) && lit.has(b)) ? FOCUS_FADE : 1);
			const focusNode = focusId;
			const isCluster = (id: string) => id === focusNode || (lit?.has(id) ?? false);

			// Edges: one path per (dash, alpha) bucket instead of one per edge. BelongsToMilestone
			// is mere membership and stays plain (no arrowhead).
			for (const group of edgeGroups) group.items.length = 0;
			for (let index = 0; index < linkEnds.length; index++) {
				const link = linkEnds[index] as (typeof linkEnds)[number];
				const { source, target } = link;
				const sx = source.x ?? 0;
				const sy = source.y ?? 0;
				const tx = target.x ?? 0;
				const ty = target.y ?? 0;
				// Both ends past the same side of the window: the segment cannot cross it.
				if (Math.max(sx, tx) < minX || Math.min(sx, tx) > maxX) continue;
				if (Math.max(sy, ty) < minY || Math.min(sy, ty) > maxY) continue;
				const slot = edgeSlots[index] as EdgeBatchItem;
				slot.sx = sx;
				slot.sy = sy;
				slot.tx = tx;
				slot.ty = ty;
				slot.targetRadius = scaledRadius(target.radius, k);
				slot.arrowSize = link.type === "BelongsToMilestone" ? 0 : ARROW_SIZE;
				const group = edgeGroupFor.get(`${alphaForEdge(source.id, target.id)}|${EDGE_DASH[link.type] ?? ""}`);
				group?.items.push(slot);
			}
			for (const group of edgeGroups) {
				strokeEdgeBatch(surface, group.items, {
					k,
					arrowGap: ARROW_GAP,
					stroke: edgeStroke(theme),
					dash: group.dash,
					alpha: group.alpha,
				});
			}

			// Nodes: uniform circles with a light tint of their own fill, one path per bucket.
			const strokeWidth = Math.max(0.35, 1 / k);
			for (const group of nodeGroups) group.items.length = 0;
			for (let index = 0; index < nodes.length; index++) {
				const node = nodes[index] as SimNode;
				const x = node.x ?? 0;
				const y = node.y ?? 0;
				if (x < minX || x > maxX || y < minY || y > maxY) continue;
				const slot = nodeSlots[index] as NodeBatchItem;
				slot.x = x;
				slot.y = y;
				slot.radius = scaledRadius(node.radius, k);
				nodeGroupFor.get(`${alphaFor(node.id)}|${node.style}`)?.items.push(slot);
			}
			for (const group of nodeGroups) {
				paintNodeBatch(surface, group.items, {
					fill: nodeFill(group.style, theme),
					stroke: nodeStroke(group.style, theme),
					lineWidth: strokeWidth,
					alpha: group.alpha,
				});
			}

			// Text arrives in stages (see TEXT_CLUSTER_MS). While the camera moves, the whole
			// focus cluster - the node being flown to and its neighbours - keeps its names, so the
			// eye tracks the context it went to. Once it has landed, the cluster is already on
			// screen; everything else comes a beat later (TEXT_CLUSTER_MS), and the deep-zoom
			// relation names come only with it.
			if (textStage === "none") {
				// The camera is in flight: the focus cluster (the flown-to node and its neighbours)
				// keeps its names so the eye has the context it travelled for, while every other
				// node stays hidden. The cluster is readable from the first frame of the move.
				for (const node of nodes) {
					if (!isCluster(node.id)) continue;
					const x = node.x ?? 0;
					const y = node.y ?? 0;
					if (x < minX || x > maxX || y < minY || y > maxY) continue;
					drawCaption(
						surface,
						node.caption,
						x,
						y,
						scaledRadius(node.radius, k),
						node.captionWidth,
						k,
						alphaFor(node.id),
						colors,
					);
				}
			} else {
				// Captions: the code name on a plate under the circle. At the "focus" stage only the
				// cluster (the focus node and its neighbours) is drawn - it is what the eye went
				// looking for, so it lights up the moment the fly lands. At "all" the rest come in,
				// gated by the zoom tier (see captionVisible). The cluster is exempt from that gate.
				for (const node of nodes) {
					const x = node.x ?? 0;
					const y = node.y ?? 0;
					if (x < minX || x > maxX || y < minY || y > maxY) continue;
					if (textStage === "focus") {
						if (!isCluster(node.id)) continue;
					} else if (!isCluster(node.id) && !captionVisible(node, k)) {
						continue;
					}
					drawCaption(
						surface,
						node.caption,
						x,
						y,
						scaledRadius(node.radius, k),
						node.captionWidth,
						k,
						alphaFor(node.id),
						colors,
					);
				}

				// Relation names are a deep-zoom detail and the single most expensive thing a frame
				// does - a per-edge rotated fillText - so they wait for the full, settled picture.
				if (textStage === "all" && k >= RELATION_ZOOM_THRESHOLD) {
					for (const link of linkEnds) {
						const { source, target } = link;
						const sx = source.x ?? 0;
						const sy = source.y ?? 0;
						const tx = target.x ?? 0;
						const ty = target.y ?? 0;
						const mx = (sx + tx) / 2;
						const my = (sy + ty) / 2;
						if (mx < minX || mx > maxX || my < minY || my > maxY) continue;
						drawEdgeLabel(
							surface,
							EDGE_LABEL[link.type],
							sx,
							sy,
							tx,
							ty,
							k,
							-3.5,
							alphaForEdge(source.id, target.id),
							edgeStroke(theme),
							RELATION_FONT,
						);
					}
				}
			}
			surface.globalAlpha = 1;
		};

		// -------------------------------------------------- gesture snapshot: dragging a picture
		// A drag does not change the picture, only where it is shown. So the gesture slides a copy
		// of the frame that is already on screen - names included - instead of painting one: one
		// drawImage a frame instead of a few thousand paths. The live scene comes back on release.
		//
		// Two things follow from copying rather than painting, and both are deliberate:
		// - The gesture starts on the frame it was asked for. A copy is one scaled blit, so no full
		//   repaint - with every name in it - stands between the press and the picture moving.
		// - What the drag uncovers is blank until the pointer lifts. Nothing is painted outside the
		//   viewport to fill it, which keeps the snapshot at cssWidth * cssHeight * 4 bytes
		//   (~8 MB at 1080p) instead of paying for a margin nobody has looked at yet.
		let snapshot: HTMLCanvasElement | null = null;
		let snapTransform: ZoomTransform | null = null;
		let dragging = false;
		// True while a press-drag gesture owns the snapshot; a wheel gesture is not, so the two
		// restore their text differently on release (see the zoom end handler).
		let lastGestureWasDrag = false;

		/**
		 * The snapshot is a copy of the frame already on screen, not a repaint of it: one scaled
		 * blit, which is the difference between a gesture that starts on the press and one that
		 * starts after a full frame - with every name in it - has been painted for it. The copy
		 * is viewport-sized and taken at the live backing scale (full device dpr), so the drag
		 * costs one bitmap instead of a padded one and never softens the picture (see the note
		 * above); what it uncovers stays blank until the pointer lifts.
		 */
		const takeSnapshot = (transform: ZoomTransform): boolean => {
			if (!snapshot) snapshot = document.createElement("canvas");
			const snapDpr = fullDpr();
			const pixelsW = Math.max(1, Math.round(cssWidth * snapDpr));
			const pixelsH = Math.max(1, Math.round(cssHeight * snapDpr));
			if (snapshot.width !== pixelsW || snapshot.height !== pixelsH) {
				snapshot.width = pixelsW;
				snapshot.height = pixelsH;
			}
			const snapCtx = snapshot.getContext("2d");
			// Nothing painted yet, or a context the browser refused: fall back to painting live.
			if (!snapCtx || !canvasEl.width || !canvasEl.height) return false;
			snapCtx.setTransform(1, 0, 0, 1, 0, 0);
			snapCtx.clearRect(0, 0, pixelsW, pixelsH);
			// Full source into full destination, whatever the two backing scales are. The names
			// come along for free: the frame on screen was painted at rest, text and all.
			snapCtx.drawImage(canvasEl, 0, 0, pixelsW, pixelsH);
			snapTransform = transform;
			return true;
		};

		const blitSnapshot = (transform: ZoomTransform): boolean => {
			if (!snapshot || !snapTransform) return false;
			const factor = transform.k / snapTransform.k;
			// Bitmap point s holds graph point (s - t0) / k0, and it has to land on screen at
			// k * g + t.
			const ox = transform.x - factor * snapTransform.x;
			const oy = transform.y - factor * snapTransform.y;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cssWidth, cssHeight);
			ctx.setTransform(dpr * factor, 0, 0, dpr * factor, dpr * ox, dpr * oy);
			ctx.drawImage(snapshot, 0, 0, cssWidth, cssHeight);
			return true;
		};

		const draw = () => {
			drawHandle = null;
			const transform = transformRef.current;
			if (dragging && transform && blitSnapshot(transform)) return;
			if (!transform) {
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				ctx.clearRect(0, 0, cssWidth, cssHeight);
				return;
			}
			paintScene(ctx, transform, textStage);
		};
		scheduleDrawRef.current = scheduleDraw;

		// A tick only publishes coordinates and asks for a frame. The quadtree - a full rebuild over
		// every node - is refreshed when the layout goes quiet instead of once per tick: it only
		// serves hit-testing, and the pointer is captured by the drag while the layout runs.
		let layoutRunning = false;
		const renderPositions = () => {
			for (const node of nodes) {
				const x = node.x ?? 0;
				const y = node.y ?? 0;
				const known = existing.get(node.id);
				if (known) {
					known.x = x;
					known.y = y;
				} else {
					existing.set(node.id, { x, y });
				}
			}
			if (layoutRunning) {
				// A drag (or any layout reheat) keeps the picture moving, so blur the text down to the
				// focus cluster only - whatever was already pinned or hovered. A drag must never switch
				// the focused node, hence the cluster here is the existing focus, not the dragged node.
				markCameraMoving();
			}
			scheduleDraw();
		};
		simulation.on("tick", renderPositions);
		simulation.on("end", () => {
			layoutRunning = false;
			syncQuadtree();
			settleText();
			scheduleDraw();
		});

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
		// Positions are final; publish them to the hit-test index now that the ticks are done.
		syncQuadtree();
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

		// d3-zoom hands over the native event that opened the gesture, which is the only way to
		// tell a drag from a wheel: both arrive here as a "start".
		const isPressGesture = (event: Event) =>
			event.type === "mousedown" || event.type === "touchstart" || event.type === "pointerdown";

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
					markCameraMoving();
					scheduleDraw();
				} else {
					draw();
				}
			})
			// A gesture has a definite end - pointer up, wheel inertia spent - so the text comes
			// back on the next frame instead of waiting out the settle timer, and sharpness comes
			// back with it. Programmatic moves carry no sourceEvent; the fly-in settles itself.
			.on("start", (event) => {
				if (programmaticRef.current) {
					// A fly-in / button zoom / fit drives the camera itself, so it must never let a
					// stale snapshot from a previously interrupted drag hijack its frames.
					dragging = false;
					snapTransform = null;
					return;
				}
				if (!event.sourceEvent) return;
				// Only a press that turns into a drag borrows the picture: a drag slides it
				// around, which is exactly what a bitmap can do. A wheel rescales it, which a
				// bitmap cannot do without stretching it or uncovering blank on every notch, so
				// a wheel keeps painting (text dropped, see markCameraMoving above).
				if (!isPressGesture(event.sourceEvent)) {
					lastGestureWasDrag = false;
					return;
				}
				lastGestureWasDrag = true;
				const transform = transformRef.current;
				if (!transform) return;
				// Copy first: applyDpr resizes the canvas, and resizing clears it - the frame
				// being copied is the one the pointer went down on. Both happen in this tick, so
				// the first drag event already has a picture to move.
				dragging = takeSnapshot(transform);
				if (!dragging) return;
				blitSnapshot(transform);
			})
			.on("end", () => {
				// Always release the snapshot, whatever ended the gesture. A gesture that is
				// interrupted (pointercancel, a d3 interrupt) still fires `end` but with a null
				// sourceEvent; if we bailed on that, `dragging` would stay true and every later
				// frame would blit the frozen bitmap instead of repainting - the canvas looks
				// stuck. The flag below separates a real gesture's text-reveal from a programmatic
				// move (fly-in, button zoom, fit), which drives the camera itself and must not have
				// its own reveal clobbered by the per-frame `end` events it fires.
				dragging = false;
				snapTransform = null;
				if (programmaticRef.current) return;
				// Sharpness and text come back together, and immediately. A drag has been showing a
				// full-fidelity snapshot the whole time, so its release restores every name at once;
				// a wheel has been painting with text dropped, so it runs the staged reveal - the
				// focus cluster now, the rest a beat later - which is what the fly-in does too.
				clearTextTimers();
				if (lastGestureWasDrag) {
					textStage = "all";
				} else {
					settleText();
				}
				// applyDpr clears the canvas, so this repaints in the same tick rather than waiting
				// for a rAF.
				applyDpr(fullDpr());
				draw();
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
			programmatic(() => select(canvasEl).call(zoomBehavior.transform, transform));
		};
		const savedTransform = transformRef.current;
		if (savedTransform) {
			programmatic(() => select(canvasEl).call(zoomBehavior.transform, savedTransform));
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
				// The fly is exactly the frame budget the text layers were eating.
				markCameraMoving();
				const u = Math.min(1, (now - start) / FLY_DURATION);
				const e = easeInOutCubic(u);
				const scale = from.k * (k / from.k) ** e;
				const x = width / 2 - scale * (fromCx + (cx - fromCx) * e);
				const y = height / 2 - scale * (fromCy + (cy - fromCy) * e);
				const transform = zoomIdentity.translate(x, y).scale(scale);
				programmatic(() => select(canvasEl).call(zoomBehavior.transform, transform));
				applied = transform;
				if (u < 1) {
					flyHandle = requestAnimationFrame(step);
					return;
				}
				// Landed: the text is readable again from this frame, not one settle-timer later.
				settleText();
			};
			flyHandle = requestAnimationFrame(step);
		};

		const releaseFocus = () => {
			if (!selectedIdRef.current) return;
			selectedIdRef.current = null;
			// The pointer is usually still resting on the node that was focused, so its hover would
			// otherwise take over `focusId` and the picture would look as if focus had never left.
			// Clear it so Escape truly exits the focused view.
			hoverIdRef.current = null;
			setHover(null);
			litFor = null;
			lit = null;
			textStage = "all";
			scheduleDraw();
		};
		clearFocusRef.current = releaseFocus;

		// Pointer interaction on a canvas is manual (no per-node DOM). Hover arms a 300ms timer -
		// the tooltip and the neighbour highlight only appear once the pointer has actually settled
		// on a node, so a fast sweep across the canvas flashes nothing. Click pins the focus and
		// flies in until the node is readable, double-click opens, drag moves the node with a
		// simulation reheat. (dragNode / dragMoved are declared above, next to the draw state.)
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
			layoutRunning = true;
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
				programmatic(() =>
					select(canvasEl).call(zoomBehavior.scaleBy, 2, [event.clientX - rect.left, event.clientY - rect.top]),
				);
				return;
			}
			// Double-click opens: a task/draft record opens its modal, a knowledge page its own tab.
			// It must NOT switch the focused node - opening is separate from focusing, so whatever was
			// pinned (or hovered) stays focused and the cluster does not jump to the double-clicked node.
			stopFly();
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
			if (settleTimer !== null) clearTimeout(settleTimer);
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
		programmatic,
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
							{t.graphView.nodesAndEdges
								.replace("{1}", String(visibleCounts.nodes))
								.replace("{2}", String(visibleCounts.edges))}
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
