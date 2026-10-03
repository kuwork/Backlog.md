/**
 * The offset window that core, the REST API and the MCP tools page with: `offset` skips items,
 * `limit` caps the window, and the result reports the full `total` plus `hasMore` so a caller can
 * tell whether more rows exist. One implementation backs every non-CLI surface.
 *
 * Distinct from `list-window.ts`, which models the CLI's `--skip`/`--max-count` window and carries
 * the `cut`/`nextSkip` values the CLI footer and Next-command need.
 */
export interface ListPage<T> {
	items: T[];
	total: number;
	offset: number;
	/** The effective limit. `0` means no limit was applied (the whole list was returned). */
	limit: number;
	hasMore: boolean;
}

export function selectListPage<T>(items: readonly T[], opts: { limit?: number; offset?: number } = {}): ListPage<T> {
	const total = items.length;
	const offset = Math.max(0, Math.floor(opts.offset ?? 0));
	const limit = typeof opts.limit === "number" && opts.limit >= 0 ? Math.max(0, Math.floor(opts.limit)) : 0;
	const window = limit > 0 ? items.slice(offset, offset + limit) : items.slice(offset);
	const hasMore = limit > 0 && offset + limit < total;
	return { items: window, total, offset, limit, hasMore };
}
