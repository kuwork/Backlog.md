import { parseQueryBlock, type QueryBlockParse } from "../sqlite/block.ts";

export const CYPHER_BLOCK_LANG = "cypher-query";

/**
 * The Cypher block grammar is the same tiny YAML subset as the SQL explorers'; the differences are
 * that the statement field is named `query` instead of `sql` (doc-27 §3), that `view: graph`
 * (BACK-803) is accepted on top of the shared text views, and that `refresh: auto` (BACK-804)
 * opts the block into re-running on its database's graph-updated broadcast - the SQL explorers
 * still reject both. The parsed block keeps the shared `QueryBlock` shape - the statement rides in
 * `sql` - so the query-block component needs no Cypher branch.
 */
export function parseCypherQueryBlock(raw: string): QueryBlockParse {
	return parseQueryBlock(raw, "query", ["table", "list", "value", "graph"], ["manual", "auto"]);
}
