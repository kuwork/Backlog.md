/**
 * Cell coercion for the `cypher-query` block (doc-27 §5.4).
 *
 * `runCypher` deliberately keeps ryu's internal handles (`_id` / `_src` / `_dst`) on node and
 * relationship values so the databases page can join edges back to their endpoints. A table, list,
 * value or CSV render has no use for handles, so the block's endpoints coerce every cell to a plain
 * `SqliteCell` before it leaves the server: nodes become a JSON string without the handles,
 * relationships and paths become compact `(a)-[TYPE]->(b)` text, scalars pass through. The `graph`
 * view (BACK-803) consumes the raw structures instead and never goes through here.
 */

import type { SqliteCell } from "../sqlite/query.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A ryu node value: has `_label` and no relationship endpoints (same predicate as store.ts). */
function isCypherNode(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && "_label" in value && !("_src" in value);
}

/** A ryu relationship value: carries `_src` / `_dst` endpoints. */
function isCypherRel(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && "_src" in value && "_dst" in value;
}

/** A ryu path value: a node/relationship chain. */
function isCypherPath(value: unknown): value is { _nodes: unknown[]; _rels: unknown[] } {
	return isRecord(value) && Array.isArray((value as { _nodes?: unknown })._nodes);
}

/** A node without its internal handle, as the JSON string a table cell shows. */
function nodeToJson(node: Record<string, unknown>): string {
	const shown: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node)) {
		if (key === "_id" || key === "_src" || key === "_dst") continue;
		shown[key] = value;
	}
	return JSON.stringify(shown);
}

/** A node inside a path, kept short: `(:Task BACK-1)` - the full property bag would bury the chain. */
function pathNodeText(node: unknown): string {
	if (!isCypherNode(node)) return String(coerceCypherCell(node) ?? "");
	const id = node.id ?? node.path;
	return `(${String(node._label)}${id === undefined || id === null ? "" : ` ${String(id)}`})`;
}

/** `(src)-[TYPE]->(dst)`, with the endpoints as their `table:offset` handles. */
function relToText(rel: Record<string, unknown>): string {
	return `(${String(rel._src)})-[${String(rel._label ?? "")}]->(${String(rel._dst)})`;
}

/** Nodes and relationships alternating: `(a)-[T]->(b)-[U]->(c)`. */
function pathToText(path: { _nodes: unknown[]; _rels: unknown[] }): string {
	const parts: string[] = [];
	path._nodes.forEach((node, index) => {
		if (index > 0) {
			const rel = path._rels[index - 1];
			parts.push(isCypherRel(rel) ? `-[${String(rel._label ?? "")}]->` : "-[]->");
		}
		parts.push(pathNodeText(node));
	});
	return parts.join("");
}

/** Coerce one `runCypher` cell to a JSON-safe scalar for table / list / value / CSV rendering. */
export function coerceCypherCell(value: unknown): SqliteCell {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (typeof value === "bigint") {
		const asNumber = Number(value);
		return Number.isSafeInteger(asNumber) ? asNumber : String(value);
	}
	if (isCypherPath(value)) return pathToText(value);
	if (isCypherRel(value)) return relToText(value);
	if (isCypherNode(value)) return nodeToJson(value);
	if (Array.isArray(value)) return JSON.stringify(value.map(coerceCypherCell));
	return String(value);
}

/** Coerce every row of a flattened Cypher result; columns and row order are untouched. */
export function coerceCypherRows(rows: readonly (readonly unknown[])[]): SqliteCell[][] {
	return rows.map((row) => row.map(coerceCypherCell));
}
