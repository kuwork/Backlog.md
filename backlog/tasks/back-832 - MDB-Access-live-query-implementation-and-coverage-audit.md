---
id: BACK-832
title: MDB (Access) live query implementation and coverage audit
status: Done
assignee: []
created_date: '2026-10-30 15:41'
labels:
  - mdb
  - web-ui
milestone: m-18
dependencies: []
priority: medium
ordinal: 392003
actual_start: '2026-10-30 01:00'
actual_end: '2026-10-30 15:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The MDB (Access) live query feature (src/mdb/*) is implemented and verified, the GBK decoding fix is in place, and the Web-side CSV export is wired up. This task records the feature's complete status and the coverage-audit conclusion.

Coverage:
- The `mdb-query` fenced block renders live in the reading view (table/list/value), reusing the sqlite-query grid/pagination/toCell logic.
- Access databases are loaded into an in-memory SQLite instance (PRAGMA query_only=ON) through mdb-reader, then executed via `runSqliteQuery`; cross-table JOINs and the full SQL surface are supported.
- GBK/CP936 text is displayed correctly after byte-level recovery in `decodeMdbText` (fixes the mojibake seen in the screenshot).
- Export CSV is served through the Web UI (File System Access API / download), on par with sqlite/duckdb/cypher.
- Four fail-closed safety gates: extension allowlist, read-only SQL validation, query_only pragma, and source-path escape rejection.

Decision record: CLI and MCP stay as-is — sqlite/duckdb live query blocks also have no CLI/MCP entry point, so MDB aligns with them and does not gain a standalone query entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The `mdb-query` block renders live in the reading view as table/list/value
- [x] #2 GBK-encoded text decodes correctly with no mojibake
- [x] #3 Export CSV via the browser download works
- [x] #4 The CLI/MCP keep-as-is decision is recorded, aligned with sqlite/duckdb
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/mdb/{paths,query,export,block,discover}.ts reusing the sqlite-query engine core; `createMdbDatabase` in query.ts loads each Access table into an in-memory SQLite instance.
2. `decodeMdbText` in query.ts recovers GBK bytes (charCodeAt & 0xff -> TextDecoder('gbk')) and falls back to the original value when too many replacement characters appear.
3. The MdbQueryBlock web component thinly wraps SqlQueryBlock (engine id=mdb); MermaidMarkdown registers the language-mdb-query fence; the server adds /api/mdb/{files,query,export-csv}.
4. The four locales gain the mdbQueryBlock dictionary; guideline docs gain a Live MDB Query Blocks subsection.
5. doc-33 (backlog/docs/PRDS/mdb/) uses the real lizheng.mdb as an acceptance sample and is generated via the CLI `doc create` (not hand-written).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MDB live query is fully delivered and aligned with sqlite/duckdb: src/mdb/* implements the engine, web rendering, server routes, i18n, and the doc-33 acceptance sample. The GBK decoding fix (decodeMdbText) is verified against the real lizheng.mdb; all sample SQL runs; mdb tests pass 11/11; tsc and biome are clean.

Coverage audit (on par with sqlite/duckdb):
- Web rendering (table/list/value): OK
- Export CSV (browser download): OK
- copy_to write-back: not supported (duckdb-only; MDB rejects it server-side)
- CLI entry point: none (sqlite/duckdb also lack one — keep as-is)
- MCP tool: none (sqlite/duckdb also lack one — keep as-is)

The original "Export query results as CSV next to the database" semantics (server-side write next to the database) were never implemented for any engine — every engine uses browser download, with the destination decided by the user. Commit is performed by the user.
<!-- SECTION:FINAL_SUMMARY:END -->
