---
id: BACK-564
title: 'Align search score threshold across TUI, CLI, and MCP with web search'
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-15 20:33'
updated_date: '2026-08-16 08:39'
labels:
  - search
dependencies:
  - BACK-480
references:
  - src/utils/task-search.ts
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/task-viewer-with-search.ts
priority: medium
ordinal: 190400
actual_start: '2026-08-15 22:30'
actual_end: '2026-08-15 22:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI kanban and task-list search used Fuse.js without the web UI's score threshold, so short numeric queries produced false-positive matches (e.g. searching 63 included BACK-410 because Fuse's 0.35 threshold accepts edit-distance-1 hits; searching 6 included BACK-428). The web SideNavigation search filters results by score <= 0.45 (centralized search), which drops these false positives.

Aligned every search surface with the web behavior by applying the same score threshold (0.45): the in-memory task search index used by the TUI board (getFilteredTasks) and task viewer, the CLI search command, and the MCP task/document search handlers. The web backend /api/search is unchanged (the web frontend already filters).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the web search behavior: src/web/components/SideNavigation.tsx filters SearchService results by score <= 0.45; fork task back-480 documents the same short-numeric false-positive class and its substring pre-filter fix.
- [x] #2 TUI kanban search (board.ts getFilteredTasks) applies the web-equivalent score threshold so short numeric queries no longer match unrelated task IDs (63 must not include BACK-410).
- [x] #3 TUI task-list search (task-viewer-with-search.ts, both the in-memory index and the SearchService branch) applies the same threshold.
- [x] #4 CLI search (src/cli.ts) and MCP task/document search (src/mcp/tools/tasks/handlers.ts, src/mcp/tools/documents/handlers.ts) apply the same score threshold (0.45), so 63 does not include BACK-410 on any surface.
- [x] #5 Regression tests cover numeric queries (single digit, two digits) and text queries across the affected TUI, CLI, and MCP filter paths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/utils/task-search.ts: TaskSearchOptions and SharedTaskFilterOptions gained an optional scoreThreshold; the Fuse branch filters results by result.score <= scoreThreshold when set (undefined keeps every match, preserving CLI/MCP behavior). applyTaskFilters and applySharedTaskFilters pass it through.
- src/ui/board.ts getFilteredTasks (the actual kanban / search-path filter) passes scoreThreshold: 0.45.
- src/ui/unified-view.ts filterTasksForKanban passes scoreThreshold: 0.45.
- src/ui/task-viewer-with-search.ts: the in-memory applyTaskFilters branch passes scoreThreshold: 0.45; the SearchService branch filters TaskSearchResult by score <= 0.45 (matching the web SideNavigation filter).

Behavior verified against the web implementation (SearchService + score <= 0.45):
- "6" -> BACK-366.01/366.02/466... (IDs containing 6; BACK-428 no longer a false positive).
- "63" -> BACK-463/363/563 (BACK-410 scores 0.87 > 0.45 and is filtered, matching the web).
- "563" -> BACK-563 exactly.
- Text queries (e.g. "create task") keep Fuse semantics, identical to the web (order-sensitive).

Note: the initial numeric-specific substring branch was tried and reverted in favor of the web-identical score-threshold approach, so TUI and web search behave exactly alike.

Tests:
- unified-view-filters 16 pass, cli-search-command + cli-doc-search + cli-json-output 28 pass, mcp-drafts 5 pass.
- bunx tsc --noEmit pass; biome check pass.

Scope extension (same session): the score threshold now also applies to CLI and MCP search, so every surface behaves like the web UI.\n- src/cli.ts search command: SearchService results filtered by score <= 0.45 (matches web SideNavigation) before plain/JSON/interactive output.\n- src/mcp/tools/tasks/handlers.ts: draft-list search and both search_task branches pass scoreThreshold: 0.45 to the in-memory index.\n- src/mcp/tools/documents/handlers.ts: searchDocuments filters SearchService results by score <= 0.45.\n- src/test/cli-json-output.test.ts heterogeneous-rank case: query changed from "JSON task" to "JSON" ("JSON task" drops the decision under the threshold, which is the intended behavior); result order assertion updated to document/task/decision (Fuse score order).\n- Verified end to end: CLI search 63 returns only TASK-63 (TASK-410 filtered), matching web/TUI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned TUI kanban and task-list search with the web UI by applying the same Fuse score threshold (0.45) used by the web SideNavigation search. Short numeric queries no longer produce false positives (63 no longer includes BACK-410; 6 no longer includes BACK-428), and text search keeps the same Fuse semantics as the web.

Implemented via an optional scoreThreshold on the shared task-search index, wired into board.ts getFilteredTasks, unified-view filterTasksForKanban, and both task-viewer search branches. CLI/MCP search is unchanged.

Verified against web behavior on real data, with 28+ search regression tests, typecheck, and biome passing.
<!-- SECTION:FINAL_SUMMARY:END -->
