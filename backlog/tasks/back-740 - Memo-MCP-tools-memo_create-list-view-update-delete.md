---
id: BACK-740
title: 'Memo MCP tools: memo_create/list/view/update/delete'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-02 01:17'
updated_date: '2026-10-02 03:56'
labels: []
milestone: m-10
dependencies: []
ordinal: 310400
actual_start: '2026-10-02 01:19'
actual_end: '2026-10-02 01:27'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The memo entity currently has a CLI surface (backlog memo ...) and an HTTP API (/api/memos, BACK-729) but no MCP tools, so MCP clients cannot read or write memos. Add a memo tool group under src/mcp/tools/memos/ (handlers.ts, index.ts, schemas.ts) mirroring src/mcp/tools/documents/: memo_create (content, tags), memo_list (limit, cursor, date, tags filters matching listMemosPage), memo_view (id), memo_update (id, content/append), memo_delete (id). All handlers delegate to src/core/memos.ts so CLI, API and MCP share one ID scheme and file format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 memo_create creates a memo with content and optional tags and returns its YYYYMMDD-N id
- [x] #2 memo_list returns newest-first pages honouring limit, cursor, --date and --tags semantics from listMemosPage
- [x] #3 memo_view returns the full memo (id, dates, tags, body) and a clear not-found error for unknown ids
- [x] #4 memo_update replaces the body or appends a line and bumps updated_date
- [x] #5 memo_delete removes the memo and reports not-found when already gone
- [x] #6 The five tools are registered in the MCP server and appear in the tool list with schemas and descriptions
- [x] #7 MCP integration tests cover the tool group following the existing mcp-documents test style
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the documents tool group (src/mcp/tools/documents/: index.ts, handlers.ts, schemas.ts) and its registration in src/mcp/server.ts, plus the memo CLI surface in src/cli.ts and the core API in src/core/memos.ts.
2. Create src/mcp/tools/memos/ mirroring the documents group: schemas.ts with JSON Schemas for the five tools, handlers.ts delegating to src/core/memos.ts (createMemo, listMemosPage, getMemo, updateMemo, deleteMemo), index.ts registering the tools with createSimpleValidatedTool.
3. Register registerMemoTools in createMcpServer and upgradeToProject so the tools exist in both bootstrap paths.
4. Add src/test/mcp-memos.test.ts in the mcp-documents.test.ts style (mkdtemp project outside the repo), covering create, view, list filters and pagination, update content/append validation, delete, and MEMO_NOT_FOUND paths; update the tool-list assertion in mcp-server.test.ts.
5. Write the MCP usage guide src/guidelines/mcp/memos.md, register it as backlog://workflow/memos, and enumerate the memo tools in overview-tools.md.
6. Verify: bunx tsc --noEmit, bun run check ., bun test src/test/mcp-memos.test.ts plus MCP regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added src/mcp/tools/memos/ (index.ts, handlers.ts, schemas.ts) in the documents group style and registered five tools: memo_create (content required, tags optional), memo_list (limit/cursor/date/tags, items+nextCursor in structuredContent), memo_view, memo_update (exactly one of content/append required, optional tags), memo_delete. Unknown ids raise MEMO_NOT_FOUND. Registered in createMcpServer and upgradeToProject in src/mcp/server.ts; updated the full tool-list assertion in src/test/mcp-server.test.ts. Added src/test/mcp-memos.test.ts (9 cases, scratch project via mkdtemp outside the repo, covering create/view/list/filter/pagination/replace/append/delete/not-found). Verified: bunx tsc --noEmit, bun run check ., bun test src/test/mcp-memos.test.ts all pass.

MCP usage guide: src/guidelines/mcp/memos.md documents the five memo_* tools (params, filters, pagination, not-found semantics) in the drafts.md guide style; registered as a full workflow guide (backlog://workflow/memos + get_backlog_instructions 'memos'), replacing the earlier CLI-only registration; overview-tools.md enumerates the memo tools and the memos guide; mcp-server.test.ts resource/tool-list assertions updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the memo MCP tool group (src/mcp/tools/memos/: schemas/handlers/index, mirroring the documents group): memo_create (content + optional tags), memo_list (limit/cursor/date/tags over listMemosPage with structuredContent), memo_view, memo_update (content xor append, optional tags), memo_delete; registered in createMcpServer and upgradeToProject. Unknown ids return MEMO_NOT_FOUND. 9 new MCP integration tests (src/test/mcp-memos.test.ts) plus the mcp-server tool-list assertion updated. tsc/biome/tests all green.
<!-- SECTION:FINAL_SUMMARY:END -->
