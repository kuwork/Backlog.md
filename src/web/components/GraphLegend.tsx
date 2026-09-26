import type { GraphEdgeDto, GraphNodeDto } from "../lib/api";

/**
 * Shared visual language of the graph views (/graph page and the relationship graph in the task
 * details modal): node palette, edge styles and the legend that explains them. Both views must
 * stay indistinguishable in look, so the palette and the legend live here instead of being
 * restated per view.
 */

/** Node kinds a graph view colors, one per legend entry. */
export type NodeStyle = "task" | "completed" | "draft" | "milestone" | "wiki" | "decision" | "document" | "tag";

/**
 * Blue for open work, amber for drafts, green for completed, purple for milestones; phase 3 adds
 * one hue per knowledge kind plus a low-contrast grey for Tag nodes (doc-15 §7 wants them
 * recessive).
 */
export const NODE_FILL: Record<NodeStyle, string> = {
	task: "#3b82f6",
	completed: "#10b981",
	draft: "#f59e0b",
	milestone: "#a855f7",
	wiki: "#06b6d4",
	decision: "#ec4899",
	document: "#6366f1",
	tag: "#9ca3af",
};

/** Light tint of each fill, so nodes read as tiles instead of flat dots (Neo4j-style). */
export const NODE_STROKE: Record<NodeStyle, string> = {
	task: "#93c5fd",
	completed: "#6ee7b7",
	draft: "#fcd34d",
	milestone: "#d8b4fe",
	wiki: "#67e8f9",
	decision: "#f9a8d4",
	document: "#a5b4fc",
	tag: "#d1d5db",
};

export const EDGE_STROKE = "#94a3b8";

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

/** Which legend entry a graph node belongs to. */
export function nodeStyle(node: Pick<GraphNodeDto, "kind" | "filePath">): NodeStyle {
	switch (node.kind) {
		case "tag":
			return "tag";
		case "milestone":
			return "milestone";
		case "draft":
			return "draft";
		case "wiki":
			return "wiki";
		case "decision":
			return "decision";
		case "document":
			return "document";
		default:
			return node.filePath.startsWith("completed/") ? "completed" : "task";
	}
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
 * The subset of a payload one reading shows: every kind it does not hide, minus any Tag whose
 * TaggedWith edges all fell outside that subset.
 *
 * A Tag is a virtual classification node with no content of its own - it exists only through the
 * pages that carry it. Hide the carriers and the tag has nothing left to say, so it is dropped
 * rather than drawn as an unwired dot (79 of the 216 tags when the work kinds are hidden, because
 * a task's labels no longer count). Real pages are never dropped this way: a wiki page with no
 * link is still a wiki page.
 *
 * Shared by the force layout and the headline count, so the number always matches the picture.
 */
export function selectVisibleGraph(
	nodes: readonly GraphNodeDto[],
	edges: readonly GraphEdgeDto[],
	hidden: ReadonlySet<NodeStyle>,
): { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] } {
	const shown = nodes.filter((node) => !hidden.has(nodeStyle(node)));
	const shownIds = new Set(shown.map((node) => node.id));
	const supporting = edges.filter((edge) => shownIds.has(edge.from) && shownIds.has(edge.to));
	const supportedTags = new Set<string>();
	for (const edge of supporting) {
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
			<span className={active ? "" : "line-through"}>{label}</span>
			<span className="text-gray-400 dark:text-gray-500">{count}</span>
		</button>
	);
}

/** Legend entry for an edge style, drawn as a sample of the line itself. */
export function LegendLine({ dash, label }: { dash: string | null; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<svg width="22" height="6" aria-hidden="true">
				<line x1="0" y1="3" x2="22" y2="3" stroke={EDGE_STROKE} strokeWidth="1" strokeDasharray={dash ?? undefined} />
			</svg>
			{label}
		</span>
	);
}
