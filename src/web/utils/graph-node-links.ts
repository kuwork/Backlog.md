import type { GraphNodeDto } from "../lib/api.ts";
import { encodeWikiPath } from "./urlHelpers.ts";

/**
 * Where a graph node's page lives in the Web UI, or null when it has no page to open.
 *
 * The three knowledge kinds are already rendered by the app itself - wiki pages under `/wiki/*`,
 * documents under `/documentation/:id`, decisions under `/decisions/:id` - so a click on a
 * knowledge node can hand the reader the real page instead of a dead end.
 *
 * Two cases have no address:
 * - a Tag node is a virtual classification built from `labels`; there is no page behind it;
 * - a knowledge node whose payload id is still a path (a folder `readme.md` that carries no
 *   frontmatter id) cannot be resolved against `:id` routes, and guessing an id would open the
 *   wrong page - so nothing is opened.
 */
export function knowledgeNodeHref(node: Pick<GraphNodeDto, "id" | "kind" | "filePath">): string | null {
	switch (node.kind) {
		case "wiki":
			// A wiki page is addressed by its path relative to backlog/wiki/ - derive it from filePath,
			// which always starts at the backlog directory (a wiki file may or may not have an id).
			return `/wiki/${encodeWikiPath(node.filePath.replace(/^wiki\//, ""))}`;
		case "document":
			return node.id.includes("/") ? null : `/documentation/${encodeURIComponent(node.id)}`;
		case "decision":
			return node.id.includes("/") ? null : `/decisions/${encodeURIComponent(node.id)}`;
		default:
			return null;
	}
}
