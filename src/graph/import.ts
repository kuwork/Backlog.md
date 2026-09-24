import type { ParsedRecord } from "./parser";
import type { RelationResolution } from "./relations";
import type { GraphNode, GraphStore } from "./store";

/**
 * Full import (doc-014 §2.2 step 2/3): every node is inserted first in batches, and every edge is
 * created only after all nodes are in place so cross-file references always resolve.
 */
export async function fullImport(
	store: GraphStore,
	records: ParsedRecord[],
	relations: RelationResolution,
): Promise<void> {
	await store.clear();
	await store.upsertNodes(
		records.map(
			(record): GraphNode => ({
				id: record.id,
				title: record.title,
				kind: record.kind,
				status: record.status,
				filePath: record.filePath,
			}),
		),
	);
	await store.upsertEdges(relations.edges);
}
