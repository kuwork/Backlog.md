import { useTheme } from "../contexts/ThemeContext";
import type { GraphEdgeDto, GraphNodeDto } from "../lib/api";
import type { TranslationDict } from "../locales/types";
import { edgeStroke } from "../utils/graph-canvas";
import type { ArrowMode, LegendBucket } from "../utils/graph-legend-config";
import { NEUTRAL_BUCKET, OTHER_BUCKET } from "../utils/graph-legend-config";
import { corpusNodeStyle, type NodeStyle, nodeFill, nodeStroke } from "../utils/graph-palette";

/**
 * Shared visual language of the graph views (/graph page, the relationship graph in the task
 * details modal, and the Cypher result graph on the databases page): the legend's entries, its
 * filter behaviour and the sample line that explains an edge style. Both corpus views must stay
 * indistinguishable in look, so the legend lives here instead of being restated per view.
 *
 * The colours themselves are not here - they moved to `utils/graph-palette.ts`, which the result
 * graph's configurable legend also reads. They are re-exported below so the corpus views keep
 * importing them from the module that describes the legend.
 */

export type { NodeStyle };
/**
 * Edge stroke with theme compensation. The slate-400 base is tuned for the dark canvas — on a
 * light surface it washes out and the relationships read as gaps, so the light theme steps two
 * shades darker (slate-500 is still clearly a line, not a wireframe of text). It lives with the
 * other canvas colours (the graph views paint edges with it); re-exported here because the
 * legend's sample line is the same colour.
 */
export { edgeStroke, nodeFill, nodeStroke };

/** DependsOn is the semantic backbone: solid with an arrowhead. The structural relations are dashed. */
export const EDGE_DASH: Record<GraphEdgeDto["type"], string | null> = {
	DependsOn: null,
	ParentOf: "6 3",
	BelongsToMilestone: "2 3",
	// Phase 3 (doc-15 §7): citation and provenance are solid; tag membership is a fine dotted line.
	SourcedFrom: null,
	LinksTo: null,
	TaggedWith: "1 2",
};

/**
 * Which legend entry a graph node belongs to. A thin alias of the palette's classifier, which the
 * result graph calls directly from its node properties (`type` and `path`, the corpus tables' own
 * column names).
 */
export function nodeStyle(node: Pick<GraphNodeDto, "kind" | "filePath">): NodeStyle {
	return corpusNodeStyle(node);
}

/**
 * The styles a Cypher result set touches: which node styles contain a node whose id or filePath is
 * among the result keys. A search opens exactly these legend categories, so the legend reads as
 * the result set's own summary.
 */
export function stylesMatchedByKeys(
	nodes: readonly Pick<GraphNodeDto, "id" | "kind" | "filePath">[],
	keys: ReadonlySet<string>,
): Set<NodeStyle> {
	const matched = new Set<NodeStyle>();
	for (const node of nodes) {
		if (keys.has(node.id) || keys.has(node.filePath)) matched.add(nodeStyle(node));
	}
	return matched;
}

/**
 * The induced subgraph on a Cypher result set: nodes whose id or filePath is among the keys, plus
 * the edges whose both ends survived. `hidden` (the legend category filter) applies on top, so
 * legend toggles keep working while a filter is active - a struck-through category hides even its
 * matched nodes. Without `hidden` the result set alone decides the picture.
 */
export function selectFilteredGraph(
	nodes: readonly GraphNodeDto[],
	edges: readonly GraphEdgeDto[],
	keys: ReadonlySet<string>,
	hidden?: ReadonlySet<NodeStyle>,
): { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] } {
	const visible = nodes.filter(
		(node) => (keys.has(node.id) || keys.has(node.filePath)) && !hidden?.has(nodeStyle(node)),
	);
	const visibleIds = new Set(visible.map((node) => node.id));
	return { nodes: visible, edges: edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)) };
}

/**
 * Styles the task graph (`/graph`) and the task relationship modal start with hidden: every
 * phase-3 kind. The task graph is the view a user has always had, so knowledge pages and Tag nodes
 * stay out of the picture until the legend asks for them. It also keeps tags recessive as doc-15 §7
 * wants: one `domain/wiki` tag would otherwise connect hundreds of pages into a hub that hides the
 * relationships worth seeing.
 */
export const TASK_GRAPH_HIDDEN_STYLES: NodeStyle[] = ["wiki", "decision", "document", "tag"];

/**
 * Styles the knowledge graph starts with hidden: every work kind. The same `/api/graph` payload
 * then reads as the knowledge base's own picture (doc-15) - wiki pages, decisions, documents and
 * the tags that classify them.
 */
export const KNOWLEDGE_GRAPH_HIDDEN_STYLES: NodeStyle[] = ["task", "completed", "draft", "milestone"];

/**
 * The subset of a payload one reading shows: every kind it does not hide, minus any Tag that
 * has no TaggedWith edge anywhere in the payload.
 *
 * A Tag is a virtual classification node with no content of its own - it exists only through the
 * pages that carry it. A tag with no TaggedWith edge at all (e.g. one only tasks use, since task
 * labels never enter the graph) can never connect to anything here and is dropped rather than
 * drawn as an unwired dot (79 of the 216 tags at the time of measurement). But a tag whose
 * carriers are merely *hidden by the legend* stays: the legend entry being lit promises the node
 * is in the picture, and hiding the wiki pages must not silently take the tags with them. The
 * edges still appear only when both ends are visible, so such a tag shows as a lone node - which
 * is exactly the "this tag exists but its pages are hidden" state. Real pages are never dropped
 * this way: a wiki page with no link is still a wiki page.
 *
 * Shared by the force layout and the headline count, so the number always matches the picture.
 */
export function selectVisibleGraph(
	nodes: readonly GraphNodeDto[],
	edges: readonly GraphEdgeDto[],
	hidden: ReadonlySet<NodeStyle>,
): { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] } {
	const shown = nodes.filter((node) => !hidden.has(nodeStyle(node)));
	const supportedTags = new Set<string>();
	for (const edge of edges) {
		if (edge.type !== "TaggedWith") continue;
		supportedTags.add(edge.from);
		supportedTags.add(edge.to);
	}
	const visible = shown.filter((node) => nodeStyle(node) !== "tag" || supportedTags.has(node.id));
	const visibleIds = new Set(visible.map((node) => node.id));
	return { nodes: visible, edges: edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)) };
}

/** Legend entry for a node style: the label comes from the active locale. */
export interface LegendEntry {
	style: NodeStyle;
	label: string;
}

/**
 * A node-kind legend entry. Doubles as a filter: clicking it hides every node of that kind, so
 * the count it carries also reads as a summary of what the view holds.
 */
export function LegendDot({
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
			<span className={active ? "text-gray-700 dark:text-gray-200" : "text-gray-700 line-through dark:text-gray-200"}>
				{label}
			</span>
			<span className="text-gray-400 dark:text-gray-500">{count}</span>
		</button>
	);
}

/** Legend entry for an edge style, drawn as a sample of the line itself. */
export function LegendLine({ dash, label }: { dash: string | null; label: string }) {
	const { theme } = useTheme();
	return (
		<span className="flex items-center gap-1.5">
			<svg width="22" height="6" aria-hidden="true">
				<line
					x1="0"
					y1="3"
					x2="22"
					y2="3"
					stroke={edgeStroke(theme)}
					strokeWidth="1"
					strokeDasharray={dash ?? undefined}
				/>
			</svg>
			{label}
		</span>
	);
}

/**
 * Legend entry for one relationship of the result graph: a sample of the line carrying whatever
 * arrowheads and colour the reader chose, then the type. A list of names says nothing about how a
 * dotted line reads next to a long-dashed one, so the sample is drawn rather than described.
 */
export function LegendRelation({
	dash,
	arrow,
	color,
	label,
}: {
	dash: string | null;
	arrow: ArrowMode;
	/** Line colour; absent falls back to the theme's default edge grey. */
	color?: string;
	label: string;
}) {
	const { theme } = useTheme();
	const stroke = color ?? edgeStroke(theme);
	const startArrow = arrow === "start" || arrow === "both";
	const endArrow = arrow === "end" || arrow === "both";
	const left = startArrow ? 6 : 1;
	const right = endArrow ? 24 : 29;
	return (
		<span className="flex items-center gap-1.5">
			<svg width="30" height="8" aria-hidden="true" className="shrink-0">
				<line x1={left} y1="4" x2={right} y2="4" stroke={stroke} strokeWidth="1" strokeDasharray={dash ?? undefined} />
				{endArrow && <polygon points="24,1.5 29,4 24,6.5" fill={stroke} />}
				{startArrow && <polygon points="6,1.5 1,4 6,6.5" fill={stroke} />}
			</svg>
			{label}
		</span>
	);
}

/** The corpus legend's own word for one kind - the word `/graph` labels it with. */
export function corpusLegendLabel(style: NodeStyle, t: TranslationDict): string {
	switch (style) {
		case "task":
			return t.graphView.legendTask;
		case "completed":
			return t.graphView.legendCompleted;
		case "draft":
			return t.graphView.legendDraft;
		case "milestone":
			return t.graphView.legendMilestone;
		case "wiki":
			return t.graphView.legendWiki;
		case "decision":
			return t.graphView.legendDecision;
		case "document":
			return t.graphView.legendDocument;
		default:
			return t.graphView.legendTag;
	}
}

/**
 * How a result graph bucket names itself. A corpus kind borrows the corpus page's word; a rule is
 * named by the reader, or by its condition until they do; a band is named by its interval; and the
 * two catch-alls - Other, and the nodes the mode could not place - have words of their own.
 */
export function bucketLabel(bucket: LegendBucket, t: TranslationDict): string {
	if (bucket.corpus) return corpusLegendLabel(bucket.corpus, t);
	if (bucket.label.length > 0) return bucket.label;
	if (bucket.key === OTHER_BUCKET) return t.databases.legendOther;
	if (bucket.key === NEUTRAL_BUCKET) return t.databases.legendNoValue;
	return t.databases.legendUntitled;
}
