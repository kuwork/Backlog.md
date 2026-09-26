import { posix } from "node:path";
import { matchRecords } from "../utils/dependency-closure";
import type { ParsedRecord } from "./parser";
import type { GraphEdge, GraphEdgeType } from "./store";
import { edgeKey, isKnowledgeKind } from "./store";

/**
 * Fail-closed relation resolution (doc-014 §1.3/§1.4, doc-15 "关系来源").
 *
 * Node identity is the file path (FileNode.path). Frontmatter references are task *ids*, so this is
 * where the two meet: the id -> record map built from every parsed file translates each reference
 * into the target file's path, which is what an edge stores. A reference that resolves to nothing -
 * unknown, duplicated, or an illegal kind - never silently drops: it is reported instead, and the
 * node still enters the graph.
 *
 * Phase 1 edges (unchanged):
 * - Cross-kind ParentOf edges are legal: the file layer legitimately produces task -> draft
 *   parents (demotion keeps parentTaskId) and draft -> task parents.
 * - Milestone hierarchy is not supported in Phase 1: a milestone with a parentTaskId is reported
 *   as an invalid relation.
 *
 * Phase 3 edges (doc-15), all mechanical, none inferred:
 * - TaggedWith: frontmatter `labels` -> a Tag node. There is no parallel `tags` field.
 * - SourcedFrom: frontmatter `source_path` -> the file it came from. Task sources are matched by
 *   the FileNode.id property, knowledge sources by the path primary key; a reference that matches
 *   no unique file produces no edge.
 * - LinksTo: body `[[wikilink]]` -> the page it references. Purely a citation fact - semantic
 *   meanings stay in the deferred `relations` field and are never guessed here.
 */

export interface RelationResolution {
	edges: GraphEdge[];
	/** Tag names to register as Tag nodes (one per distinct frontmatter label value). */
	tags: string[];
	invalidRelations: string[];
	missingDependencies: string[];
	ambiguousIds: string[];
	/** `source_path` values that named a location inside the corpus but matched 0 or >1 records. */
	unresolvedSources: string[];
	/** Wikilinks that named a page in the corpus but did not resolve to exactly one (fail-closed). */
	unresolvedLinks: string[];
	/**
	 * Findings that were never graph facts to begin with, so they are expected noise rather than
	 * defects (doc-15 §8): placeholder text in prose (`[[path/to/page]]`), embeds of non-markdown
	 * assets, targets outside the whitelist (`wiki_output/`), and `source_path` values pointing at
	 * an original that lives outside the corpus - `src/file-system/operations.ts` is a legitimate
	 * provenance target (doc-15 §2.3), it is simply not a node.
	 */
	informational: string[];
}

/** `assets/photo.png` is an embed, not a page reference: only `.md` (or a bare name) is a node. */
const HAS_FILE_EXTENSION = /\.[A-Za-z0-9]{1,8}$/;

function isMarkdownTarget(target: string): boolean {
	const extension = HAS_FILE_EXTENSION.exec(target);
	return extension === null || extension[0].toLowerCase() === ".md";
}

/**
 * A `source_path` carrying no file extension is not a file location at all: one wiki page
 * documents the corpus itself with `backlog/docs/ + backlog/decisions/`, and a directory such as
 * `src/` names a tree rather than a file. Treating either as a broken reference would report a
 * real page as defective.
 */
function looksLikeLocation(value: string): boolean {
	return HAS_FILE_EXTENSION.test(value);
}

/** Normalise a candidate to the `/`-separated, backlog-relative form FileNode.path uses. */
function normalizeRelative(path: string): string {
	return posix.normalize(path).replace(/^\.\//, "");
}

export function resolveRelations(records: ParsedRecord[]): RelationResolution {
	const recordsById = new Map<string, ParsedRecord[]>();
	for (const record of records) {
		// A knowledge file carries no id (doc-15 §2.2): it must never join the duplicate-id pool.
		if (record.id.length === 0) continue;
		const bucket = recordsById.get(record.id);
		if (bucket) bucket.push(record);
		else recordsById.set(record.id, [record]);
	}

	const ambiguousIds = [...recordsById.entries()].filter(([, bucket]) => bucket.length > 1).map(([id]) => id);
	const ambiguous = new Set(ambiguousIds);

	const recordsByPath = new Map<string, ParsedRecord>();
	for (const record of records) recordsByPath.set(record.filePath, record);

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
	const tags = new Set<string>();
	const invalidRelations: string[] = [];
	const missingDependencies: string[] = [];
	const unresolvedSources: string[] = [];
	const unresolvedLinks: string[] = [];
	const informational: string[] = [];

	/** `to` is a node path, except for TaggedWith where it is a Tag name. */
	const addEdge = (type: GraphEdgeType, from: ParsedRecord, to: string) => {
		if (from.id.length > 0 && ambiguous.has(from.id)) return; // ambiguous source: no edges at all
		const key = edgeKey(type, from.filePath, to);
		if (!edges.has(key)) edges.set(key, { type, from: from.filePath, to });
	};

	/**
	 * `source_path` resolution (doc-15 §5): the recorded path first, then - for a source that was
	 * renamed - the stable task id its file name still carries. `inCorpus` records whether the
	 * reference named a location inside the whitelisted corpus at all, which is what separates a
	 * genuinely broken reference from a legitimate external original (doc-15 §2.3).
	 */
	const resolveSource = (raw: string): { record?: ParsedRecord; count: number; inCorpus: boolean } => {
		const normalized = raw.replace(/\\/g, "/");
		const inCorpus = normalized.startsWith("backlog/");
		const relative = normalizeRelative(inCorpus ? normalized.slice(8) : normalized);
		const direct = recordsByPath.get(relative);
		if (direct) return { record: direct, count: 1, inCorpus };

		const stem = posix.basename(relative, ".md");
		const idPart = (stem.split(" ")[0] ?? "").replace(/-+$/, "");
		if (idPart.length > 0) {
			const matches = matchRecords(records, idPart);
			const only = matches[0];
			if (matches.length === 1 && only) return { record: only, count: 1, inCorpus };
			if (matches.length > 1) return { count: matches.length, inCorpus };
		}
		return { count: 0, inCorpus };
	};

	/**
	 * Wikilink resolution (doc-15 §3.1): targets are written without the `.md` suffix and read
	 * against the `backlog/wiki/` root. The page-relative form (`[[../developer-notes/x]]`, the
	 * semantics BACK-482 settled for the wiki reader) is honoured as well. Both bases are tried and
	 * the matches deduplicated, so a target two bases name differently is still one reference.
	 */
	const resolveWikilink = (
		target: string,
		currentFilePath: string,
	):
		| { kind: "edge"; path: string }
		| { kind: "unresolved"; count: number }
		| { kind: "informational"; reason: string } => {
		if (target.length === 0) return { kind: "informational", reason: "empty target" };
		if (!isMarkdownTarget(target)) return { kind: "informational", reason: "not a markdown page" };
		const withExtension = HAS_FILE_EXTENSION.test(target) ? target : `${target}.md`;
		const candidates = new Set<string>();
		const fromWikiRoot = normalizeRelative(posix.join("wiki", withExtension));
		if (recordsByPath.has(fromWikiRoot)) candidates.add(fromWikiRoot);
		const fromPage = normalizeRelative(posix.join(posix.dirname(currentFilePath), withExtension));
		if (recordsByPath.has(fromPage)) candidates.add(fromPage);
		const only = candidates.size === 1 ? [...candidates][0] : undefined;
		if (only) return { kind: "edge", path: only };
		if (candidates.size > 1) return { kind: "unresolved", count: candidates.size };
		return { kind: "informational", reason: "no such page in the whitelisted corpus" };
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
					addEdge("ParentOf", record, target.filePath);
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
				addEdge("BelongsToMilestone", record, target.filePath);
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
					addEdge("DependsOn", record, target.filePath);
				}
			}
		}

		// TaggedWith: one Tag per distinct label value, on knowledge files only. doc-15 §4 defines the
		// tag vocabulary for the knowledge layer; a task's `labels` are Backlog's own task
		// classification - a different vocabulary which, sharing the one Tag table, would mix
		// `bug`/`critical` into the knowledge graph's counts and leave unwired Tags behind whenever
		// the work kinds are hidden.
		if (isKnowledgeKind(record.kind)) {
			for (const label of record.labels) {
				const tag = label.trim();
				if (tag.length === 0) continue;
				tags.add(tag);
				addEdge("TaggedWith", record, tag);
			}
		}

		// SourcedFrom: the recorded original this page was compiled from.
		if (record.sourcePath) {
			const source = resolveSource(record.sourcePath);
			if (source.record) {
				addEdge("SourcedFrom", record, source.record.filePath);
			} else if (!looksLikeLocation(record.sourcePath)) {
				informational.push(`source_path '${record.sourcePath}' in '${record.filePath}': not a file location`);
			} else if (!source.inCorpus) {
				// doc-15 §2.3: an original may legitimately live outside the corpus (src/*.ts, the
				// repository README). It has no node, but it is not a broken reference either.
				informational.push(
					`source_path '${record.sourcePath}' in '${record.filePath}': original lives outside the graph corpus`,
				);
			} else {
				unresolvedSources.push(
					`source_path '${record.sourcePath}' in '${record.filePath}' resolves to ${source.count} records; edge not created`,
				);
			}
		}

		// LinksTo: the pages this body cites.
		for (const target of record.wikilinks) {
			const resolved = resolveWikilink(target, record.filePath);
			if (resolved.kind === "edge") {
				addEdge("LinksTo", record, resolved.path);
			} else if (resolved.kind === "unresolved") {
				unresolvedLinks.push(
					`wikilink '[[${target}]]' in '${record.filePath}' resolves to ${resolved.count} pages; edge not created`,
				);
			} else {
				informational.push(`wikilink '[[${target}]]' in '${record.filePath}': ${resolved.reason}`);
			}
		}
	}

	return {
		edges: [...edges.values()],
		tags: [...tags].sort(),
		invalidRelations,
		missingDependencies,
		ambiguousIds,
		unresolvedSources,
		unresolvedLinks,
		informational,
	};
}
