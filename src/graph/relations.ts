import type { ParsedRecord } from "./parser";
import type { GraphEdge, GraphEdgeType } from "./store";
import { edgeKey } from "./store";

/**
 * Fail-closed relation resolution (doc-014 §1.3/§1.4).
 *
 * - Cross-kind ParentOf edges are legal: the file layer legitimately produces task -> draft
 *   parents (demotion keeps parentTaskId) and draft -> task parents.
 * - A dangling or ambiguous reference never silently drops an edge: it is reported instead, and
 *   the node still enters the graph.
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

	// Milestone nodes indexed by title for BelongsToMilestone matching.
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

	const addEdge = (type: GraphEdgeType, from: ParsedRecord, toId: string) => {
		if (ambiguous.has(from.id)) return false; // ambiguous source: no edges at all
		if (ambiguous.has(toId)) return false;
		const targets = recordsById.get(toId);
		if (!targets || targets.length !== 1) return false;
		const key = edgeKey(type, from.id, toId);
		if (!edges.has(key)) edges.set(key, { type, from: from.id, to: toId });
		return true;
	};

	for (const record of records) {
		// ParentOf: parent -> child, any kind except milestone children (Phase 1 restriction).
		if (record.parentTaskId) {
			if (record.kind === "milestone") {
				invalidRelations.push(
					`milestone '${record.id}' has parentTaskId '${record.parentTaskId}'; milestone hierarchy is not supported in Phase 1`,
				);
			} else {
				const targets = recordsById.get(record.parentTaskId);
				if (!targets || targets.length !== 1) {
					invalidRelations.push(
						`parentTaskId '${record.parentTaskId}' referenced by '${record.id}' resolves to ${targets ? targets.length : 0} records; edge not created`,
					);
				} else {
					addEdge("ParentOf", record, record.parentTaskId);
				}
			}
		}

		// BelongsToMilestone: project files store the milestone by id (milestone: m-9); doc-014
		// §1.3 describes title matching, so both are accepted - id first, then unique title.
		if (record.milestone && record.kind !== "milestone") {
			const idBucket = recordsById.get(record.milestone);
			const byMilestoneId =
				idBucket && idBucket.length === 1 && idBucket[0] && idBucket[0].kind === "milestone"
					? idBucket[0]
					: undefined;
			const milestones = milestonesByTitle.get(record.milestone);
			const byMilestoneTitle = milestones && milestones.length === 1 ? milestones[0] : undefined;
			const target = byMilestoneId ?? byMilestoneTitle;
			if (!target) {
				invalidRelations.push(
					`milestone '${record.milestone}' referenced by '${record.id}' matches no unique milestone (by id or title); edge not created`,
				);
			} else {
				addEdge("BelongsToMilestone", record, target.id);
			}
		}

		// DependsOn: task/draft -> task/draft.
		if (record.kind !== "milestone") {
			for (const depId of record.dependencies) {
				const targets = recordsById.get(depId);
				const target = targets?.length === 1 ? targets[0] : undefined;
				if (!target || target.kind === "milestone") {
					missingDependencies.push(
						`dependency '${depId}' referenced by '${record.id}' resolves to ${targets ? targets.length : 0} valid records; edge not created`,
					);
				} else {
					addEdge("DependsOn", record, depId);
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
