import { posix } from "node:path";
import { entityIdsEqual } from "../utils/entity-id.ts";
import { taskIdsEqual } from "../utils/task-path.ts";
import { sanitizeUrlTitle } from "../web/utils/urlHelpers.ts";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.ts";
import {
	decodeMarkdownSegment,
	encodeMarkdownPath,
	mapMarkdownTargets,
	normalizeMarkdownJoin,
	splitMarkdownTarget,
} from "./local-paths.ts";

export type FileRenameReferenceKind = "task" | "document" | "decision" | "milestone" | "wiki" | "source";
export type EntityTitleRouteKind = "documentation" | "task" | "decisions";

export interface EntityTitleRouteChange {
	kind: EntityTitleRouteKind;
	/** Previous ID used to match routes and structured identity fields. */
	id: string;
	/** Target ID; title-only changes leave this unset. */
	newId?: string;
	oldTitle: string;
	newTitle: string;
}

export interface FileRenameContentInput {
	content: string;
	referencingPath: string;
	sourcePath: string;
	targetPath: string;
	kind: FileRenameReferenceKind;
	entityRoute?: EntityTitleRouteChange;
}

const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LOCAL_FILE_EXTENSION = /\.[A-Za-z0-9]+$/;

function routeIdMatches(kind: EntityTitleRouteKind, left: string, right: string): boolean {
	if (kind === "task") return taskIdsEqual(left, right);
	return entityIdsEqual(kind === "documentation" ? "doc" : "decision", left, right);
}

function rewriteEntityTitleRouteTarget(target: string, route: EntityTitleRouteChange): string {
	const parts = splitMarkdownTarget(target);
	const segments = parts.path.split("/");
	if (segments.length !== 4 || segments[0] !== "" || segments[1] !== route.kind) return target;
	const [, , id, oldSlug] = segments;
	if (!id || oldSlug === undefined || !routeIdMatches(route.kind, id, route.id)) return target;
	if (decodeMarkdownSegment(oldSlug) !== sanitizeUrlTitle(route.oldTitle)) return target;
	const newSlug = sanitizeUrlTitle(route.newTitle);
	if (!newSlug) return target;
	const path = `/${route.kind}/${route.newId ?? id}/${newSlug}`;
	return `${parts.enclosed ? `<${path}>` : path}${parts.range}${parts.query}${parts.fragment}`;
}

/** Rewrite only the title segment of a matching local entity route. */
export function rewriteEntityTitleRoutes(source: string, route: EntityTitleRouteChange): string {
	return mapMarkdownTargets(source, (target) => rewriteEntityTitleRouteTarget(target, route));
}

function rewriteRelativeFileTarget(target: string, input: FileRenameContentInput): string {
	const raw = target.trim();
	if (!raw || raw.startsWith("#") || raw.startsWith("?") || raw.startsWith("//")) return target;

	const parts = splitMarkdownTarget(raw);
	if (!parts.path || parts.path.startsWith("/")) return target;
	if (EXTERNAL_SCHEME.test(parts.path) && (parts.path.includes("//") || !LOCAL_FILE_EXTENSION.test(parts.path))) {
		return target;
	}

	const baseDir = posix.dirname(input.referencingPath.replace(/\\/g, "/"));
	const decodedPath = parts.path.replace(/\\/g, "/").split("/").map(decodeMarkdownSegment).join("/");
	const resolved = normalizeMarkdownJoin(baseDir === "." ? "" : baseDir, decodedPath);
	const oldPath = normalizeMarkdownJoin("", input.sourcePath.replace(/\\/g, "/"));
	if (!resolved || !oldPath || resolved !== oldPath) return target;

	let nextPath = posix.relative(baseDir === "." ? "" : baseDir, input.targetPath.replace(/\\/g, "/"));
	if (parts.path.startsWith("./") && !nextPath.startsWith(".")) nextPath = `./${nextPath}`;
	if (/%[0-9a-f]{2}/i.test(parts.path)) nextPath = encodeMarkdownPath(nextPath);
	const destination = parts.enclosed ? `<${nextPath}>` : nextPath;
	return `${destination}${parts.range}${parts.query}${parts.fragment}`;
}

function rewriteExactPathList(value: unknown, sourcePath: string, targetPath: string): [unknown, boolean] {
	if (!Array.isArray(value)) return [value, false];
	let changed = false;
	const next = value.map((entry) => {
		if (entry !== sourcePath) return entry;
		changed = true;
		return targetPath;
	});
	return [next, changed];
}

function rewriteTaskIdentityFields(data: Record<string, unknown>, route: EntityTitleRouteChange): boolean {
	if (route.kind !== "task" || !route.newId || route.newId === route.id) return false;
	let changed = false;
	for (const field of ["dependencies", "references"]) {
		const value = data[field];
		if (!Array.isArray(value)) continue;
		const next = value.map((entry) =>
			typeof entry === "string" && taskIdsEqual(entry, route.id) ? route.newId : entry,
		);
		if (next.some((entry, index) => entry !== value[index])) {
			data[field] = next;
			changed = true;
		}
	}
	if (typeof data.parent_task_id === "string" && taskIdsEqual(data.parent_task_id, route.id)) {
		data.parent_task_id = route.newId;
		changed = true;
	}
	return changed;
}

/**
 * Rewrite one Markdown file without touching the filesystem. Relative links resolve from the
 * referencing file, while task list fields and Wiki source_path retain project-root semantics.
 */
export function rewriteFileRenameContent(input: FileRenameContentInput): string {
	const { data, content: body } = parseFrontmatter(input.content);
	const nextBody = mapMarkdownTargets(body, (originalTarget) => {
		const routeTarget = input.entityRoute
			? rewriteEntityTitleRouteTarget(originalTarget, input.entityRoute)
			: originalTarget;
		return rewriteRelativeFileTarget(routeTarget, input);
	});
	let frontmatterChanged = false;

	if (input.kind === "task" || input.kind === "milestone") {
		for (const field of ["documentation", "references", "modified_files"]) {
			const [next, changed] = rewriteExactPathList(data[field], input.sourcePath, input.targetPath);
			if (changed) {
				data[field] = next;
				frontmatterChanged = true;
			}
		}
		if (input.kind === "task" && input.entityRoute) {
			frontmatterChanged = rewriteTaskIdentityFields(data, input.entityRoute) || frontmatterChanged;
		}
	} else if (input.kind === "wiki" && data.source_path === input.sourcePath) {
		data.source_path = input.targetPath;
		frontmatterChanged = true;
	}

	if (nextBody === body && !frontmatterChanged) return input.content;
	return stringifyFrontmatter(nextBody, data);
}
