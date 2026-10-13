import type { CypherResult } from "../lib/api.ts";
import { truncateCaption } from "./graph-caption.ts";

/**
 * Turn a Cypher result set into the node/edge shape a graph view can draw.
 *
 * A result row is whatever the user's RETURN clause asked for, so the cells arrive in several
 * shapes and all of them are honoured:
 *
 * - `MATCH (a)-[r]->(b) RETURN a, r, b` - a node, a relationship and a node. The relationship
 *   carries `_src`/`_dst`, the internal ids of its two endpoints, so the edge joins the nodes
 *   that share those ids (BACK-793 keeps the handles in the transport; before that they were
 *   stripped and an edge could not be re-attached at all).
 * - `MATCH p = (a)-[r]->(b) RETURN p` - a path value, which is its own `_nodes`/`_rels` chain.
 * - `MATCH (n) RETURN n` / `RETURN collect(n)` - nodes only; the view draws them unconnected.
 * - `RETURN count(*)` or `RETURN n.path` - no node values at all; the graph comes back empty and
 *   the view says so instead of drawing a broken canvas.
 *
 * The walk is deliberately dumb about order: a relationship cell may precede its endpoints in
 * the row, so nodes are collected from the whole result first and edges are joined in a second
 * pass. A relationship whose endpoints the result does not carry is counted and skipped - an
 * edge to a node that was never returned cannot be drawn, and inventing a placeholder node
 * would put a nameless dot on the canvas.
 */

/** The internal handles ryu attaches to node and relationship values. Never shown to a reader. */
const INTERNAL_KEYS = new Set(["_id", "_src", "_dst"]);

/**
 * Node tables Backlog.md owns rather than the user: `Meta` is the store's own key/value shelf
 * (the corpus fingerprint lives there). It is a real node table, so `MATCH (n) RETURN n` returns
 * it - and a 1599-node corpus then reads as 1600, with nothing to say which one the extra is.
 * Tagged here so a view can keep it out of the picture without making it unreachable.
 */
export const INTERNAL_LABELS = new Set(["Meta"]);

/** One node of the result graph. */
export interface ResultGraphNode {
	/** Stable identity within one result set: the node's internal id, or a property fingerprint. */
	id: string;
	/** The node table the node came from (its label), e.g. `FileNode` or `Person`. */
	label: string;
	/** True for a table Backlog.md writes for itself (see INTERNAL_LABELS), not user data. */
	internal: boolean;
	/** Short name drawn under the circle, trimmed to the caption budget. */
	caption: string;
	/** Full name for the tooltip - the caption before trimming. */
	title: string;
}

/** One relationship of the result graph, already joined to its endpoints. */
export interface ResultGraphEdge {
	/** Internal id of the source node. */
	from: string;
	/** Internal id of the target node. */
	to: string;
	/** The relationship table the edge came from, e.g. `KNOWS`. */
	type: string;
}

export interface ResultGraph {
	nodes: ResultGraphNode[];
	edges: ResultGraphEdge[];
	/** Relationships whose endpoints were not part of the result: counted, not drawn. */
	danglingEdges: number;
}

/** Properties that name a node, best first. `key` is the CSV importer's primary key column. */
const DISPLAY_KEYS = ["name", "title", "key", "path", "filePath", "id", "label", "code", "slug"];

/** A ryu node value: labelled, and without relationship endpoints. */
function isNodeValue(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"_label" in value &&
		!("_src" in value) &&
		!("_nodes" in value)
	);
}

/** A ryu relationship value: carries both endpoint handles. */
function isRelValue(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) && "_src" in value && "_dst" in value;
}

/** A ryu path value: its own node/relationship chain. */
function isPathValue(value: unknown): value is { _nodes: unknown[]; _rels: unknown[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Array.isArray((value as { _nodes?: unknown })._nodes) &&
		Array.isArray((value as { _rels?: unknown })._rels)
	);
}

/** The identity of a node value: its internal id when it has one, else a property fingerprint. */
function nodeId(value: Record<string, unknown>): string {
	const internal = value._id;
	if (typeof internal === "string" || typeof internal === "number") return String(internal);
	const fingerprint = Object.keys(value)
		.filter((key) => !INTERNAL_KEYS.has(key))
		.sort()
		.map((key) => `${key}=${String(value[key])}`)
		.join(",");
	return `${String(value._label)}#${fingerprint}`;
}

/** The string a reader recognises this node by: the first display property that carries one. */
function nodeTitle(value: Record<string, unknown>): string {
	for (const key of DISPLAY_KEYS) {
		const candidate = value[key];
		if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
	}
	for (const [key, candidate] of Object.entries(value)) {
		if (INTERNAL_KEYS.has(key) || key === "_label") continue;
		if (typeof candidate === "string" && candidate.trim().length > 0) return candidate;
		if (typeof candidate === "number" || typeof candidate === "boolean") return String(candidate);
	}
	return typeof value._label === "string" ? value._label : "";
}

/** Every node value reachable from one cell: the cell itself, list members, or a path's chain. */
function collectNodeValues(value: unknown, found: Record<string, unknown>[]): void {
	if (isNodeValue(value)) {
		found.push(value);
		return;
	}
	if (isPathValue(value)) {
		for (const node of value._nodes) collectNodeValues(node, found);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectNodeValues(item, found);
	}
}

/** Every relationship value reachable from one cell, alongside the cell it came from. */
function collectRelValues(value: unknown, found: Record<string, unknown>[]): void {
	if (isRelValue(value)) {
		found.push(value);
		return;
	}
	if (isPathValue(value)) {
		for (const rel of value._rels) collectRelValues(rel, found);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectRelValues(item, found);
	}
}

/**
 * Build the drawable graph of a Cypher result. Pure and synchronous: the caller owns fetching,
 * the row cap and truncation, and this only decides what the rows mean.
 */
export function graphFromCypherResult(result: CypherResult): ResultGraph {
	const rawNodes: Record<string, unknown>[] = [];
	const rawRels: Record<string, unknown>[] = [];
	for (const row of result.rows) {
		for (const cell of row) {
			collectNodeValues(cell, rawNodes);
			collectRelValues(cell, rawRels);
		}
	}

	const nodes: ResultGraphNode[] = [];
	const byId = new Map<string, ResultGraphNode>();
	for (const value of rawNodes) {
		const id = nodeId(value);
		const existing = byId.get(id);
		if (existing) continue; // the same node on many rows is one circle
		const title = nodeTitle(value);
		const label = typeof value._label === "string" ? value._label : "";
		const node: ResultGraphNode = {
			id,
			label,
			internal: INTERNAL_LABELS.has(label),
			caption: truncateCaption(title),
			title,
		};
		byId.set(id, node);
		nodes.push(node);
	}

	const edges: ResultGraphEdge[] = [];
	const seenEdges = new Set<string>();
	let danglingEdges = 0;
	for (const value of rawRels) {
		const from = String(value._src);
		const to = String(value._dst);
		if (!byId.has(from) || !byId.has(to)) {
			// An endpoint the result never returned: the edge has nothing to connect.
			danglingEdges += 1;
			continue;
		}
		const type = typeof value._label === "string" ? value._label : "";
		const key = `${from}\u0000${to}\u0000${type}`;
		if (seenEdges.has(key)) continue; // MERGE never stacks duplicates; neither do we
		seenEdges.add(key);
		edges.push({ from, to, type });
	}
	return { nodes, edges, danglingEdges };
}

/**
 * How one result cell reads in a table: text as-is, structured values as compact JSON with the
 * internal handles removed - they exist so the graph view can join an edge to its endpoints,
 * and a reader has no use for them. The CLI printer applies the same rule (see printCypherResult).
 */
export function cellDisplayText(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") {
		if (Array.isArray(value)) return JSON.stringify(value);
		const shown: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			if (INTERNAL_KEYS.has(key)) continue;
			shown[key] = entry;
		}
		return JSON.stringify(shown);
	}
	return String(value);
}
