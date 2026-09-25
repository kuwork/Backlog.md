import type { DependencyCorpus, DependencyRecordLike, DependencyReferenceKind } from "./dependency-closure.ts";
import { canonicalTaskId } from "./task-id.ts";

/**
 * The dependency defects only a whole-corpus view can see: a cycle in the DependsOn graph, a
 * reference that resolves to nothing, a reference naming a record that may never be a target, a
 * reference whose only remaining record is archived, and one claimed by more than one record.
 *
 * These are gathered from records the caller already loaded - this module reads nothing, starts no
 * service and needs no GraphStore, so `backlog doctor` stays correct on a machine where no server
 * is running. The vocabulary is `DependencyCorpus`'s, so a defect the gate would refuse to write is
 * named the same way here as it is there.
 */

/** One reference the corpus cannot accept as written. */
export interface DependencyDefect {
	/** The record carrying the reference, canonical. */
	source: string;
	/** The reference exactly as it is written on disk, so the reader can find it. */
	reference: string;
	kind: DependencyReferenceKind;
	/** The identities an ambiguous reference matched, canonical. */
	matches: string[];
}

export interface DependencyDefectReport {
	/** Each cycle once, in walk order, with the first id repeated at the end. */
	cycles: string[][];
	/** References that resolve to nothing. */
	dangling: DependencyDefect[];
	/** References naming a draft or a milestone: an existing record that may not be depended on. */
	ineligible: DependencyDefect[];
	/** References whose only remaining record is archived, so the id is free again. */
	released: DependencyDefect[];
	/** References claimed by more than one record. */
	ambiguous: DependencyDefect[];
}

export function hasDependencyDefects(report: DependencyDefectReport): boolean {
	return (
		report.cycles.length > 0 ||
		report.dangling.length > 0 ||
		report.ineligible.length > 0 ||
		report.released.length > 0 ||
		report.ambiguous.length > 0
	);
}

/** An empty report, so callers can start from a shape rather than from five arrays. */
function emptyReport(): DependencyDefectReport {
	return { cycles: [], dangling: [], ineligible: [], released: [], ambiguous: [] };
}

/**
 * Collect every reference defect in `sources`, plus every cycle among them.
 *
 * `sources` are the records whose references get examined, which is more than the target pool: a
 * draft's own references are validated by the same gate, and a draft is one of the places a
 * historical misspelling survives - measured on 2026-09-25, five drafts in this repository depend on
 * `task-7` and `task-8`, neither of which resolves. Cycles need no such care: an edge only ever
 * points into the target pool, because nothing may depend on a draft, so a cycle can only live there.
 */
export function collectDependencyDefects(
	corpus: DependencyCorpus,
	sources: readonly DependencyRecordLike[],
): DependencyDefectReport {
	const report = emptyReport();

	for (const source of sources) {
		const sourceId = canonicalTaskId(source.id);
		for (const reference of source.dependencies ?? []) {
			const verdict = corpus.classify(reference);
			if (verdict.kind === "resolved") continue;
			const defect: DependencyDefect = {
				source: sourceId,
				reference,
				kind: verdict.kind,
				matches: verdict.matches,
			};
			switch (verdict.kind) {
				case "ambiguous":
					report.ambiguous.push(defect);
					break;
				case "draft":
				case "milestone":
					report.ineligible.push(defect);
					break;
				case "released":
					report.released.push(defect);
					break;
				default:
					report.dangling.push(defect);
					break;
			}
		}
	}

	// A cycle is a property of the edges rather than of one reference, so it is found per node: for
	// each record, can any of its predecessors reach it back? Deduplicated by the ids on the cycle,
	// so a two-node loop is one line instead of one line per record sitting on it.
	const closure = corpus.closure();
	const reported = new Set<string>();
	for (const source of sources) {
		const id = canonicalTaskId(source.id);
		for (const dependency of closure.dependenciesOf(id)) {
			const chain = closure.pathTo(dependency, id);
			if (!chain) continue;
			const cycle = [id, ...chain];
			const key = [...new Set(cycle)].sort().join(",");
			if (reported.has(key)) continue;
			reported.add(key);
			report.cycles.push(cycle);
		}
	}

	return report;
}
