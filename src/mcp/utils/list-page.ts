import type { ListPage } from "../../utils/list-page.ts";
import type { CallToolResult } from "../types.ts";

export type { ListPage } from "../../utils/list-page.ts";
export { selectListPage } from "../../utils/list-page.ts";

/**
 * Wraps a human-readable `content` with the structured list envelope every MCP list tool returns,
 * and appends a CLI-style `Showing X-Y of N <label>` hint to the last text block when a window was applied.
 */
export function buildListResult(
	content: Array<{ type: "text"; text: string }>,
	page: ListPage<unknown>,
	options: { label?: string } = {},
): CallToolResult {
	const label = options.label ?? "item";
	const blocks = content.map((block) => ({ ...block }));

	if (page.limit > 0 && page.total > 0) {
		const start = page.offset + 1;
		const end = page.offset + page.items.length;
		const hint = `Showing ${start}-${end} of ${page.total} ${label}${page.total === 1 ? "" : "s"}.`;
		const lastBlock = blocks[blocks.length - 1];
		if (lastBlock && lastBlock.type === "text") {
			lastBlock.text = `${lastBlock.text}\n${hint}`;
		} else {
			blocks.push({ type: "text", text: hint });
		}
	}

	return {
		content: blocks,
		structuredContent: {
			items: page.items,
			total: page.total,
			offset: page.offset,
			limit: page.limit,
			hasMore: page.hasMore,
		},
	};
}
