import type { Decision, Document, Task } from "../../types";
import { stripAnyPrefix } from "../../utils/prefix-config";
import { canonicalTaskId } from "../../utils/task-id";

/** Entity kinds covered by the canonical auto-link index. */
export type EntityKind = "task" | "doc" | "decision" | "draft";

/** Fallback prefix used when canonicalizing an ID that carries no explicit prefix. */
const KIND_PREFIX: Record<EntityKind, string> = {
	task: "task",
	doc: "doc",
	decision: "decision",
	draft: "draft",
};

/** Plural map field per entity kind. */
const KIND_MAP_FIELD: Record<EntityKind, "tasks" | "docs" | "decisions" | "drafts"> = {
	task: "tasks",
	doc: "docs",
	decision: "decisions",
	draft: "drafts",
};

export interface EntityIndexInput {
	tasks?: Task[];
	docs?: Document[];
	decisions?: Decision[];
	drafts?: Task[];
	/** Wiki page paths (extensionless, e.g. "patterns/cross-surface") for prefix queries. */
	wikiPaths?: string[];
}

/** Canonical entity lookup: canonical ID -> the entity it identifies, per kind. */
export interface EntityIndex {
	tasks: Map<string, Task>;
	docs: Map<string, Document>;
	decisions: Map<string, Decision>;
	drafts: Map<string, Task>;
	/** Wiki page paths sorted ascending (plain lexicographic). */
	wikiPaths: string[];
}

export const EMPTY_ENTITY_INDEX: EntityIndex = {
	tasks: new Map(),
	docs: new Map(),
	decisions: new Map(),
	drafts: new Map(),
	wikiPaths: [],
};

function indexByCanonicalId<T extends { id: string }>(entities: T[], prefix: string): Map<string, T> {
	const index = new Map<string, T>();
	const seen = new Set<string>();
	for (const entity of entities) {
		const canonical = canonicalTaskId(entity.id, prefix);
		if (seen.has(canonical)) {
			// Canonical collision (BACK-1 and BACK-01 both loaded): drop rather than
			// guess, matching how route resolution refuses ambiguous IDs (fail-closed).
			index.delete(canonical);
			continue;
		}
		seen.add(canonical);
		index.set(canonical, entity);
	}
	return index;
}

/**
 * Build the canonical entity index shared by the render-side auto-linker and the
 * input-side insert-link hint. Purely in-memory; performs no API calls.
 */
export function buildEntityIndex(input: EntityIndexInput): EntityIndex {
	return {
		tasks: indexByCanonicalId(input.tasks ?? [], KIND_PREFIX.task),
		docs: indexByCanonicalId(input.docs ?? [], KIND_PREFIX.doc),
		decisions: indexByCanonicalId(input.decisions ?? [], KIND_PREFIX.decision),
		drafts: indexByCanonicalId(input.drafts ?? [], KIND_PREFIX.draft),
		wikiPaths: [...(input.wikiPaths ?? [])].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
	};
}

/** Canonical comparison key for an entity reference of the given kind. */
export function canonicalEntityId(kind: EntityKind, reference: string): string {
	return canonicalTaskId(reference, KIND_PREFIX[kind]);
}

/**
 * Resolve an entity reference (any case/zero-padding/prefix variant) through the
 * same canonical identity the markdown links use. Ambiguous canonical IDs were
 * dropped at index time, so they resolve to undefined (fail-closed).
 */
export function resolveEntityReference<K extends EntityKind>(
	index: EntityIndex,
	kind: K,
	reference: string,
): (K extends "task" | "draft" ? Task : K extends "doc" ? Document : Decision) | undefined {
	const map = index[KIND_MAP_FIELD[kind]] as Map<string, Task | Document | Decision>;
	return map.get(canonicalTaskId(reference, KIND_PREFIX[kind])) as
		| (K extends "task" | "draft" ? Task : K extends "doc" ? Document : Decision)
		| undefined;
}

/**
 * Single-route href for an entity on the singular route family, with any ID
 * prefix stripped (BACK-506 -> /task/506, DOC-001 -> /documentation/001);
 * the numeric body keeps its original zero-padding.
 */
export function entityHref(kind: EntityKind, id: string): string {
	const body = stripAnyPrefix(id);
	switch (kind) {
		case "task":
			return `/task/${body}`;
		case "doc":
			return `/documentation/${body}`;
		case "decision":
			return `/decisions/${body}`;
		case "draft":
			return `/draft/${body}`;
	}
}

/** Compare two canonical IDs ascending: numerically per body segment, then lexically. */
function compareCanonicalIds(left: string, right: string): number {
	const leftBody = left.slice(left.indexOf("-") + 1);
	const rightBody = right.slice(right.indexOf("-") + 1);
	const leftSegments = leftBody.split(".");
	const rightSegments = rightBody.split(".");
	const shared = Math.min(leftSegments.length, rightSegments.length);
	for (let i = 0; i < shared; i++) {
		const leftSegment = leftSegments[i] ?? "";
		const rightSegment = rightSegments[i] ?? "";
		const leftNumeric = /^\d+$/.test(leftSegment);
		const rightNumeric = /^\d+$/.test(rightSegment);
		if (leftNumeric && rightNumeric) {
			const diff = Number.parseInt(leftSegment, 10) - Number.parseInt(rightSegment, 10);
			if (diff !== 0) return diff;
		} else {
			const diff = leftSegment.localeCompare(rightSegment);
			if (diff !== 0) return diff;
		}
	}
	if (leftSegments.length !== rightSegments.length) return leftSegments.length - rightSegments.length;
	return left.localeCompare(right);
}

/** Strip leading zeroes from every numeric segment ("01" -> "1", "0012" -> "12"). */
function stripLeadingZeroes(value: string): string {
	return value
		.split(".")
		.map((segment) => (/^\d+$/.test(segment) ? segment.replace(/^0+(?=\d)/, "") : segment))
		.join(".");
}

/**
 * Zero-padding-aware prefix query over the canonical IDs of one entity kind.
 * The numeric body is canonicalized (leading zeroes stripped, so "BACK-01" is
 * equivalent to "BACK-1") and matched as a string prefix against the canonical
 * keys; hits are returned in ascending ID order, capped at `limit`.
 * Standalone read-only query over the in-memory index.
 */
export function queryEntityPrefix(index: EntityIndex, kind: EntityKind, prefix: string, limit = 5): string[] {
	const trimmed = prefix.trim();
	if (!trimmed) return [];
	const dashIndex = trimmed.indexOf("-");
	const normalized =
		dashIndex >= 0
			? `${trimmed.slice(0, dashIndex).toUpperCase()}-${stripLeadingZeroes(trimmed.slice(dashIndex + 1))}`
			: trimmed.toUpperCase();
	const hits: string[] = [];
	for (const canonical of index[KIND_MAP_FIELD[kind]].keys()) {
		if (canonical.startsWith(normalized)) hits.push(canonical);
	}
	hits.sort(compareCanonicalIds);
	return hits.slice(0, limit);
}

/**
 * Prefix query over wiki page paths: plain string lexicographic prefix match,
 * results in dictionary order, capped at `limit`.
 */
export function queryWikiPathPrefix(wikiPaths: readonly string[], prefix: string, limit = 5): string[] {
	const trimmed = prefix.trim();
	if (!trimmed) return [];
	const hits: string[] = [];
	for (const path of wikiPaths) {
		if (path.startsWith(trimmed)) hits.push(path);
	}
	hits.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
	return hits.slice(0, limit);
}

/** Minimal mdast shape: only the fields this transform reads or writes. */
type MarkdownNode = {
	type: string;
	value?: string;
	url?: string;
	children?: MarkdownNode[];
};

/** Covers every bare entity ID shape: BACK-123, doc-9, decision-1, DRAFT-104, TASK-PREFIXED. */
const ENTITY_ID_CANDIDATE = /[A-Za-z]+-[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*/g;
/** A candidate preceded by one of these is part of a longer identifier or path. */
const PRECEDING_REJECT = /[\p{L}\p{N}\p{M}_\-/\\.]$/u;
/** A candidate followed by an identifier character or a file extension is not an ID reference. */
const FOLLOWING_REJECT = /^[\p{L}\p{N}\p{M}_-]|^\.[\p{L}\p{N}\p{M}]/u;
/** Text inside these nodes already points somewhere; never rewrite it. */
const SKIPPED_NODES = new Set(["link", "linkReference", "definition"]);

/** Resolve a bare ID candidate against every kind; first canonical hit wins. */
function resolveCandidate(index: EntityIndex, candidate: string): { kind: EntityKind; id: string } | null {
	for (const kind of ["task", "doc", "decision", "draft"] as const) {
		const entity = resolveEntityReference(index, kind, candidate);
		if (entity) return { kind, id: entity.id };
	}
	return null;
}

function splitEntityIds(value: string, index: EntityIndex): MarkdownNode[] | null {
	let parts: MarkdownNode[] | null = null;
	let cursor = 0;

	ENTITY_ID_CANDIDATE.lastIndex = 0;
	let match = ENTITY_ID_CANDIDATE.exec(value);
	while (match) {
		const candidate = match[0];
		const start = match.index;
		const end = start + candidate.length;
		// Slices, not single characters, so boundary tests see whole code points.
		const preceding = value.slice(Math.max(0, start - 2), start);
		const following = value.slice(end, end + 3);
		const target = resolveCandidate(index, candidate);

		if (target && !PRECEDING_REJECT.test(preceding) && !FOLLOWING_REJECT.test(following)) {
			parts ??= [];
			if (start > cursor) {
				parts.push({ type: "text", value: value.slice(cursor, start) });
			}
			parts.push({
				type: "link",
				url: entityHref(target.kind, target.id),
				children: [{ type: "text", value: candidate }],
			});
			cursor = end;
		}

		match = ENTITY_ID_CANDIDATE.exec(value);
	}

	if (!parts) return null;
	if (cursor < value.length) {
		parts.push({ type: "text", value: value.slice(cursor) });
	}
	return parts;
}

function linkEntityIds(node: MarkdownNode, index: EntityIndex): void {
	const children = node.children;
	if (!children) return;

	const rewritten: MarkdownNode[] = [];
	let changed = false;
	for (const child of children) {
		if (child.type === "text" && typeof child.value === "string") {
			const parts = splitEntityIds(child.value, index);
			if (parts) {
				rewritten.push(...parts);
				changed = true;
				continue;
			}
		} else if (!SKIPPED_NODES.has(child.type)) {
			linkEntityIds(child, index);
		}
		rewritten.push(child);
	}

	if (changed) {
		node.children = rewritten;
	}
}

/**
 * Remark plugin that turns bare, known entity IDs in markdown text into links on the
 * singular route family (/task/:id, /documentation/:id, /decisions/:id, /draft/:id).
 * Code fences and inline code hold no text children in mdast, so they are excluded by
 * construction; existing links, link references and definitions are skipped; unknown or
 * ambiguous IDs stay plain (fail-closed). Wiki bare paths are not handled here.
 */
export function createEntityLinkPlugin(index: EntityIndex) {
	return () => (tree: MarkdownNode) => {
		if (index.tasks.size + index.docs.size + index.decisions.size + index.drafts.size > 0) {
			linkEntityIds(tree, index);
		}
	};
}
