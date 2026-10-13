import { parseQueryBlock } from "../sqlite/block.ts";

export const DUCKDB_BLOCK_LANG = "duckdb-query";

/**
 * The DuckDB block parser is the very same tiny YAML subset as the SQLite one - the engine is the
 * only thing that differs - so it reuses `parseQueryBlock` rather than carrying a duplicate.
 */
export const parseDuckdbQueryBlock = parseQueryBlock;
