import { parseQueryBlock } from "../sqlite/block.ts";

/** The fenced code language that renders a live `mdb-query` block (doc-16 §3). */
export const MDB_BLOCK_LANG = "mdb-query";

/**
 * The MDB block parser is the very same tiny YAML subset as the SQLite one - the engine is the only
 * thing that differs - so it reuses `parseQueryBlock` rather than carrying a duplicate.
 */
export const parseMdbQueryBlock = parseQueryBlock;
