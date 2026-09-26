import type { ParsedRecord } from "./parser";
import type { RelationResolution } from "./relations";
import type { GraphNode, GraphStore } from "./store";

/**
 * Full import (doc-014 §2.2 step 2/3): every file becomes a FileNode keyed by its path, and every
 * edge is created only after all nodes are in place, because `resolveRelations` has already turned
 * the frontmatter ids into the paths those edges connect.
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
				path: record.filePath,
				id: record.id,
				// Empty when a knowledge file declares no usable file_type - never a folder guess.
				type: record.kind ?? "",
				title: record.title,
				status: record.status,
				updatedDate: record.updatedDate,
			}),
		),
	);
	// Tags before edges: a TaggedWith edge is only accepted once its Tag node exists.
	await store.upsertTags(relations.tags);
	await store.upsertEdges(relations.edges);
}
