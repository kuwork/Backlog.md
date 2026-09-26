import type { Task } from "../types";
import { createReadinessGraph, getTaskReadiness } from "../utils/readiness";
import type { ParseReports } from "./cold-start";
import type { ParsedRecord } from "./parser";
import type { GraphStore } from "./store";

/**
 * Validation checklist (doc-014 §4).
 *
 * Fast checks are millisecond Cypher/Memory counts safe to run after every cold start. Cycle
 * detection and readiness derivation are lazy: they walk the graph/records and stay off the
 * cold-start critical path. Readiness semantics (isReady/isBlocked) have a single source of
 * truth in src/utils/readiness.ts - they are never reimplemented as graph queries.
 */

export interface FastValidation {
	nodeCount: number;
	edgeCounts: { ParentOf: number; BelongsToMilestone: number; DependsOn: number };
	expectedNodes: number;
	/** True when the parsed whitelist total matches the graph's node count. */
	nodeCountMatches: boolean;
}

export async function validateCounts(store: GraphStore, expectedNodes: number): Promise<FastValidation> {
	const [nodeCount, parentOf, belongsToMilestone, dependsOn] = await Promise.all([
		store.countNodes(),
		store.countEdges("ParentOf"),
		store.countEdges("BelongsToMilestone"),
		store.countEdges("DependsOn"),
	]);
	return {
		nodeCount,
		edgeCounts: { ParentOf: parentOf, BelongsToMilestone: belongsToMilestone, DependsOn: dependsOn },
		expectedNodes,
		nodeCountMatches: nodeCount === expectedNodes,
	};
}

/**
 * Lazy DependsOn cycle detection: `MATCH (a:FileNode)-[:DependsOn*1..]->(a)` semantics, computed
 * from the store's edge list. Returns the path of every node that sits on a dependency cycle.
 */
export async function findDependencyCycles(store: GraphStore): Promise<string[]> {
	const adjacency = new Map<string, string[]>();
	for (const edge of await store.getAllEdges()) {
		if (edge.type !== "DependsOn") continue;
		const list = adjacency.get(edge.from);
		if (list) list.push(edge.to);
		else adjacency.set(edge.from, [edge.to]);
	}

	const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
	const cyclic = new Set<string>();
	const visit = (path: string, stack: string[]): void => {
		const mark = state.get(path);
		if (mark === 2) return;
		if (mark === 1) {
			// Everything from the first occurrence of `path` in the stack up to here is on the cycle.
			const start = stack.indexOf(path);
			for (const onCycle of stack.slice(start === -1 ? 0 : start)) cyclic.add(onCycle);
			cyclic.add(path);
			return;
		}
		state.set(path, 1);
		for (const next of adjacency.get(path) ?? []) visit(next, [...stack, path]);
		state.set(path, 2);
	};
	for (const path of adjacency.keys()) visit(path, []);
	return [...cyclic].sort();
}

export interface RecordReadiness {
	id: string;
	isReady: boolean;
	isBlocked: boolean;
	blockingDependencies: string[];
	missingDependencies: string[];
}

/**
 * Readiness per record, delegated to src/utils/readiness.ts (the single source for
 * isReady/isBlocked - graph code must not duplicate status logic).
 */
export function computeRecordReadiness(records: ParsedRecord[]): RecordReadiness[] {
	// Minimal Task projection: readiness only consumes id, status and dependencies.
	const tasks = records.map(
		(record): Task =>
			({
				id: record.id,
				title: record.title,
				status: record.status,
				dependencies: record.dependencies,
			}) as Task,
	);
	// Completed-corpus evidence is already encoded in the status field the parser picked up
	// from the whitelisted completed/ directory, so a single corpus suffices here.
	const graph = createReadinessGraph({ tasks });
	return tasks.map((task) => {
		const readiness = getTaskReadiness(task, graph);
		return {
			id: task.id,
			isReady: readiness.isReady,
			isBlocked: readiness.isBlocked,
			blockingDependencies: [...readiness.blockingDependencies],
			missingDependencies: [...readiness.missingDependencies],
		};
	});
}

/**
 * Knowledge-corpus lint (doc-15 §8).
 *
 * The corpus legitimately produces two kinds of finding, and only one is a defect:
 * - informational: references that were never graph facts - placeholder text in prose, embeds of
 *   non-markdown assets, originals living outside the corpus (doc-15 §2.3). Expected noise;
 * - defects: a `source_path` naming a corpus-internal file that does not resolve, or a wikilink
 *   resolving to no unique page.
 *
 * `passed` answers the gate's question - "does this tree have a real problem?".
 */
export interface KnowledgeLint {
	defects: string[];
	informational: string[];
	passed: boolean;
}

export function lintKnowledgeCorpus(reports: ParseReports): KnowledgeLint {
	const defects = [...reports.unresolvedSources, ...reports.unresolvedLinks];
	return {
		defects,
		informational: [...reports.informational],
		passed: defects.length === 0,
	};
}
