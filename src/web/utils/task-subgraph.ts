import { taskIdsEqual } from "../../utils/task-id.ts";
import type { GraphEdgeDto, GraphNodeDto } from "../lib/api.ts";

/**
 * The relationship neighborhood of one task, for the graph view in the task details modal.
 * It walks the task relationships of the global graph payload — ParentOf (父任务/子任务),
 * DependsOn (依赖于), BelongsToMilestone (里程碑) — in both directions, so the modal shows the same
 * picture the /graph page would when it is limited to tasks, centered on the open task.
 *
 * Phase 3 knowledge edges (TaggedWith / SourcedFrom / LinksTo) are deliberately **not** walked: a
 * task's relationship picture is a task view, and following `labels` would drag Tag nodes and wiki
 * pages into a modal that has no way to open them.
 */

/** The task-relationship edge types - the modal's scope, and the /graph page's default view. */
export const TASK_RELATION_EDGE_TYPES: ReadonlySet<GraphEdgeDto["type"]> = new Set([
	"ParentOf",
	"DependsOn",
	"BelongsToMilestone",
]);

export interface RelationshipSubgraph {
	/** Nodes reachable from the focus, the focus flagged with isRoot. */
	nodes: Array<GraphNodeDto & { isRoot: boolean }>;
	/** Typed edges with both ends inside the subgraph, directions preserved. */
	edges: GraphEdgeDto[];
}

export interface RelationshipGraphPayload {
	nodes: GraphNodeDto[];
	edges: GraphEdgeDto[];
}

/** Default traversal bound: deep enough for a useful picture, small enough to stay readable. */
export const SUBGRAPH_MAX_DEPTH = 4;
/** Default node bound: keeps the modal rendering cheap even on huge projects. */
export const SUBGRAPH_MAX_NODES = 80;

/**
 * The typed-edge subgraph around `focusId`, BFS in both directions, cycle-protected by a
 * visited set and bounded by `maxDepth` hops and `maxNodes` total nodes. Edge endpoints are
 * matched case-insensitively (taskIdsEqual), so a focus id in any casing still lands on its
 * canonical graph node. A focus id missing from the payload yields an empty subgraph.
 */
export function buildRelationshipSubgraph(
	payload: RelationshipGraphPayload,
	focusId: string,
	maxDepth: number = SUBGRAPH_MAX_DEPTH,
	maxNodes: number = SUBGRAPH_MAX_NODES,
): RelationshipSubgraph {
	// BFS outward from the focus through both edge directions; the visited set is the cycle
	// protection, and the queue drains breadth-first so the node budget keeps the closest
	// neighbors when it has to cut.
	const depthById = new Map<string, number>();
	const focusNode = payload.nodes.find((node) => taskIdsEqual(node.id, focusId));
	if (!focusNode) return { nodes: [], edges: [] };
	depthById.set(focusNode.id, 0);
	const queue: string[] = [focusNode.id];

	const adjacency = new Map<string, string[]>();
	const touch = (from: string, to: string) => {
		const list = adjacency.get(from);
		if (list) list.push(to);
		else adjacency.set(from, [to]);
	};
	for (const edge of payload.edges) {
		if (!TASK_RELATION_EDGE_TYPES.has(edge.type)) continue;
		touch(edge.from, edge.to);
		touch(edge.to, edge.from);
	}

	for (let index = 0; index < queue.length; index += 1) {
		if (depthById.size >= maxNodes) break;
		const current = queue[index] as string;
		const depth = depthById.get(current) as number;
		if (depth >= maxDepth) continue;
		for (const next of adjacency.get(current) ?? []) {
			if (depthById.has(next)) continue;
			depthById.set(next, depth + 1);
			queue.push(next);
			if (depthById.size >= maxNodes) break;
		}
	}

	return {
		nodes: payload.nodes
			.filter((node) => depthById.has(node.id))
			.map((node) => ({ ...node, isRoot: node.id === focusNode.id })),
		edges: payload.edges.filter(
			(edge) => TASK_RELATION_EDGE_TYPES.has(edge.type) && depthById.has(edge.from) && depthById.has(edge.to),
		),
	};
}
