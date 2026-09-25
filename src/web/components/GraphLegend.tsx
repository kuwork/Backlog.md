import type { GraphEdgeDto, GraphNodeDto } from "../lib/api";

/**
 * Shared visual language of the graph views (/graph page and the relationship graph in the task
 * details modal): node palette, edge styles and the legend that explains them. Both views must
 * stay indistinguishable in look, so the palette and the legend live here instead of being
 * restated per view.
 */

/** Node kinds a graph view colors, one per legend entry. */
export type NodeStyle = "task" | "completed" | "draft" | "milestone";

/** Blue for open work, amber for drafts, green for completed, purple for milestones. */
export const NODE_FILL: Record<NodeStyle, string> = {
	task: "#3b82f6",
	completed: "#10b981",
	draft: "#f59e0b",
	milestone: "#a855f7",
};

/** Light tint of each fill, so nodes read as tiles instead of flat dots (Neo4j-style). */
export const NODE_STROKE: Record<NodeStyle, string> = {
	task: "#93c5fd",
	completed: "#6ee7b7",
	draft: "#fcd34d",
	milestone: "#d8b4fe",
};

export const EDGE_STROKE = "#94a3b8";

/** DependsOn is the semantic backbone: solid with an arrowhead. The structural relations are dashed. */
export const EDGE_DASH: Record<GraphEdgeDto["type"], string | null> = {
	DependsOn: null,
	ParentOf: "6 3",
	BelongsToMilestone: "2 3",
};

/** Which legend entry a graph node belongs to. */
export function nodeStyle(node: Pick<GraphNodeDto, "kind" | "filePath">): NodeStyle {
	if (node.kind === "milestone") return "milestone";
	if (node.kind === "draft") return "draft";
	return node.filePath.startsWith("completed/") ? "completed" : "task";
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
