import { readFileSync } from "node:fs";
import { parseFrontmatter } from "../markdown/frontmatter";
import { type GraphKind, isKnowledgeKind } from "./store";

/**
 * gray-matter based per-file parser (doc-014 §1.4, doc-15 "解析器注册").
 *
 * Two families of files end up in the same FileNode table:
 * - work files (tasks/, drafts/, milestones/, completed/) - task | draft | milestone;
 * - knowledge files (wiki/, docs/, decisions/) - wiki | decision | document.
 *
 * In both families the node type is implied by the whitelisted directory the file was scanned from
 * (`scanner.ts`); nothing is read from frontmatter to decide it, and a knowledge file's subfolder
 * (sources/, concepts/, ...) is navigation only. The one asymmetry is the task id: a work file
 * without a frontmatter `id` is skipped, while a knowledge file has no id at all.
 *
 * A file that cannot be read or parsed is skipped with a warning instead of poisoning the whole
 * import - one bad file must never take the graph down.
 *
 * The frontmatter `relations` field (semantic edges, deferred by doc-15) is deliberately ignored
 * here - no warning, no edge.
 */

export interface ParsedRecord {
	id: string;
	title: string;
	/** Implied by the whitelisted directory, never inferred from frontmatter or a subfolder name. */
	kind: GraphKind;
	status: string;
	/** Path relative to the backlog directory (the doc's filePath) - the FileNode identity. */
	filePath: string;
	updatedDate: string;
	parentTaskId: string | null;
	milestone: string | null;
	dependencies: string[];
	/** frontmatter `labels` (doc-15 §4: this project's tag field; there is no parallel `tags`). */
	labels: string[];
	/** frontmatter `source_path`, normalised to forward slashes; null when absent. */
	sourcePath: string | null;
	/** Body `[[wikilink]]` targets, alias and heading parts stripped (doc-15 §3.1). */
	wikilinks: string[];
}

export interface ParsedFile {
	record?: ParsedRecord;
	/** The whole file was skipped. */
	warning?: string;
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v.length > 0);
	if (typeof value === "string") {
		return value
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
}

/**
 * `[[target|alias]]` and `[[target#heading]]` both name `target`: the alias is display text and the
 * heading is a position inside the same file, so neither changes which file the link points at.
 */
const WIKILINK_PATTERN = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

export function extractWikilinkTargets(body: string): string[] {
	const targets: string[] = [];
	for (const match of body.matchAll(WIKILINK_PATTERN)) {
		const target = match[1]?.trim();
		if (target) targets.push(target);
	}
	return targets;
}

export function parseTaskFile(absPath: string, relPath: string, kind: GraphKind): ParsedFile {
	let content: string;
	try {
		content = readFileSync(absPath, "utf8");
	} catch (error) {
		return { warning: `unreadable file ${relPath}: ${String(error)}` };
	}
	let data: Record<string, unknown>;
	let body: string;
	try {
		const parsed = parseFrontmatter(content);
		data = parsed.data;
		body = parsed.content;
	} catch (error) {
		return { warning: `unparseable frontmatter in ${relPath}: ${String(error)}` };
	}

	// A knowledge page has no task id (doc-15 §2.2); a work file without one is skipped.
	const isKnowledge = isKnowledgeKind(kind);
	const id = typeof data.id === "string" ? data.id.trim() : "";
	if (!isKnowledge && id.length === 0) {
		return { warning: `missing frontmatter id in ${relPath}; file skipped` };
	}

	const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : relPath;
	const status = typeof data.status === "string" ? data.status : "";
	// The project's on-disk field is parent_task_id (snake_case); doc-014 §1.3 calls it parentTaskId.
	const parentRaw = data.parent_task_id ?? data.parentTaskId;
	const updatedRaw = data.updated_date ?? data.updatedDate;
	const sourceRaw = data.source_path ?? data.sourcePath;
	const sourcePath =
		typeof sourceRaw === "string" && sourceRaw.trim().length > 0 ? sourceRaw.trim().replace(/\\/g, "/") : null;

	return {
		record: {
			id,
			title,
			kind,
			status,
			filePath: relPath,
			updatedDate: typeof updatedRaw === "string" ? updatedRaw : "",
			parentTaskId: typeof parentRaw === "string" && parentRaw.trim().length > 0 ? parentRaw.trim() : null,
			milestone: typeof data.milestone === "string" && data.milestone.trim().length > 0 ? data.milestone.trim() : null,
			dependencies: toStringArray(data.dependencies),
			labels: toStringArray(data.labels),
			sourcePath,
			wikilinks: isKnowledge ? extractWikilinkTargets(body) : [],
		},
	};
}
