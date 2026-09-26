import { readFileSync } from "node:fs";
import { parseFrontmatter } from "../markdown/frontmatter";
import type { GraphKind } from "./store";

/**
 * gray-matter based per-file parser (doc-014 §1.4).
 *
 * A file that fails to parse or lacks an id is skipped with a warning instead of poisoning the
 * whole import - one bad file must never take the graph down.
 */

export interface ParsedRecord {
	id: string;
	title: string;
	kind: GraphKind;
	status: string;
	/** Path relative to the backlog directory (the doc's filePath) - the FileNode identity. */
	filePath: string;
	updatedDate: string;
	parentTaskId: string | null;
	milestone: string | null;
	dependencies: string[];
}

export interface ParsedFile {
	record?: ParsedRecord;
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

export function parseTaskFile(absPath: string, relPath: string, kind: GraphKind): ParsedFile {
	let content: string;
	try {
		content = readFileSync(absPath, "utf8");
	} catch (error) {
		return { warning: `unreadable file ${relPath}: ${String(error)}` };
	}
	let data: Record<string, unknown>;
	try {
		data = parseFrontmatter(content).data;
	} catch (error) {
		return { warning: `unparseable frontmatter in ${relPath}: ${String(error)}` };
	}
	const id = typeof data.id === "string" ? data.id.trim() : "";
	if (id.length === 0) {
		return { warning: `missing frontmatter id in ${relPath}; file skipped` };
	}
	const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : relPath;
	const status = typeof data.status === "string" ? data.status : "";
	// The project's on-disk field is parent_task_id (snake_case); doc-014 §1.3 calls it parentTaskId.
	const parentRaw = data.parent_task_id ?? data.parentTaskId;
	const updatedRaw = data.updated_date ?? data.updatedDate;
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
		},
	};
}
