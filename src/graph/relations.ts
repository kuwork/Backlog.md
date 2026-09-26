import type { ParsedRecord } from "./parser";
import type { GraphEdge, GraphEdgeType } from "./store";
import { edgeKey } from "./store";

/**
 * Fail-closed relation resolution (doc-014 §1.3/§1.4).
 *
 * Node identity is the file path (FileNode.path). Frontmatter references are task *ids*, so this is
 * where the two meet: the id -> record map built from every parsed file translates each reference
 * into the target file's path, which is what an edge stores. A reference that resolves to nothing -
 * unknown, duplicated, or an illegal kind - never silently drops: it is reported instead, and the
 * node still enters the graph.
 *
 * - Cross-kind ParentOf edges are legal: the file layer legitimately produces task -> draft
 *   parents (demotion keeps parentTaskId) and draft -> task parents.
 * - Milestone hierarchy is not supported in Phase 1: a milestone with a parentTaskId is reported
 *   as an invalid relation.
 */

export interface RelationResolution {
	edges: GraphEdge[];
	invalidRelations: string[];
	missingDependencies: string[];
	ambiguousIds: string[];
}

export function resolveRelations(records: ParsedRecord[]): RelationResolution {
	const recordsById = new Map<string, ParsedRecord[]>();
	for (const record of records) {
		const bucket = recordsById.get(record.id);
		if (bucket) bucket.push(record);
		else recordsById.set(record.id, [record]);
	}

	const ambiguousIds = [...recordsById.entries()].filter(([, bucket]) => bucket.length > 1).map(([id]) => id);
	const ambiguous = new Set(ambiguousIds);

	/** The one record an id names, or undefined when it is unknown or ambiguous. */
	const resolve = (id: string): ParsedRecord | undefined => {
		const bucket = recordsById.get(id);
		return bucket && bucket.length === 1 ? bucket[0] : undefined;
	};
	const matchCount = (id: string): number => recordsById.get(id)?.length ?? 0;

	// Milestone nodes indexed by title for BelongsToMilestone matching (a duplicated title is
	// ambiguous, never a silent first-match).
	const milestonesByTitle = new Map<string, ParsedRecord[]>();
	for (const record of records) {
		if (record.kind !== "milestone") continue;
		const bucket = milestonesByTitle.get(record.title);
		if (bucket) bucket.push(record);
		else milestonesByTitle.set(record.title, [record]);
	}

	const edges = new Map<string, GraphEdge>();
	const invalidRelations: string[] = [];
	const missingDependencies: string[] = [];

	const addEdge = (type: GraphEdgeType, from: ParsedRecord, to: ParsedRecord) => {
		if (ambiguous.has(from.id)) return; // ambiguous source: no edges at all
		const key = edgeKey(type, from.filePath, to.filePath);
		if (!edges.has(key)) edges.set(key, { type, from: from.filePath, to: to.filePath });
	};

	for (const record of records) {
		// ParentOf: parent -> child, any kind except milestone children (Phase 1 restriction).
		if (record.parentTaskId) {
			if (record.kind === "milestone") {
				invalidRelations.push(
					`milestone '${record.id}' has parentTaskId '${record.parentTaskId}'; milestone hierarchy is not supported in Phase 1`,
				);
			} else {
				const target = resolve(record.parentTaskId);
				if (!target) {
					invalidRelations.push(
						`parentTaskId '${record.parentTaskId}' referenced by '${record.id}' resolves to ${matchCount(record.parentTaskId)} records; edge not created`,
					);
				} else {
					addEdge("ParentOf", record, target);
				}
			}
		}

		// BelongsToMilestone: project files store the milestone by id (milestone: m-9); doc-014
		// §1.3 describes title matching, so both are accepted - id first, then unique title.
		if (record.milestone && record.kind !== "milestone") {
			const byMilestoneId = resolve(record.milestone);
			const titleBucket = milestonesByTitle.get(record.milestone);
			const byMilestoneTitle = titleBucket && titleBucket.length === 1 ? titleBucket[0] : undefined;
			const target =
				byMilestoneId && byMilestoneId.kind === "milestone" ? byMilestoneId : (byMilestoneTitle ?? undefined);
			if (!target) {
				invalidRelations.push(
					`milestone '${record.milestone}' referenced by '${record.id}' matches no unique milestone (by id or title); edge not created`,
				);
			} else {
				addEdge("BelongsToMilestone", record, target);
			}
		}

		// DependsOn: task/draft -> task/draft.
		if (record.kind !== "milestone") {
			for (const depId of record.dependencies) {
				const target = resolve(depId);
				if (!target || target.kind === "milestone") {
					missingDependencies.push(
						`dependency '${depId}' referenced by '${record.id}' resolves to ${matchCount(depId)} valid records; edge not created`,
					);
				} else {
					addEdge("DependsOn", record, target);
				}
			}
		}
	}

	return {
		edges: [...edges.values()],
		invalidRelations,
		missingDependencies,
		ambiguousIds,
	};
}
