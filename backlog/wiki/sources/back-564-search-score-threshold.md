---
title: BACK-564 Align search score threshold across TUI, CLI, and MCP
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - search
  - fuse
  - tui
  - cli
  - mcp
source_path: backlog/tasks/back-564 - Align-search-score-threshold-across-TUI-CLI-and-MCP-with-web-search.md
---

# BACK-564 Align search score threshold across TUI, CLI, and MCP

Applied the same Fuse.js score threshold used by the Web UI (`<= 0.45`) to TUI kanban, TUI task list, CLI search, and MCP search to eliminate short numeric false positives.

## Summary

- `src/utils/task-search.ts` gained an optional `scoreThreshold` option; the Fuse branch filters results by `result.score <= scoreThreshold` when set.
- `src/ui/board.ts` `getFilteredTasks` passes `scoreThreshold: 0.45`.
- `src/ui/unified-view.ts` `filterTasksForKanban` passes `scoreThreshold: 0.45`.
- `src/ui/task-viewer-with-search.ts` filters both the in-memory branch and the SearchService branch by `0.45`.
- `src/cli.ts` search command filters SearchService results by `score <= 0.45`.
- MCP task/document search handlers pass `scoreThreshold: 0.45` or filter SearchService results by the same threshold.
- An initial numeric-specific substring branch was tried and reverted in favor of the web-identical score-threshold approach.

## Implementation Notes

Behavior verified against the Web UI: `6` no longer matches `BACK-428`; `63` no longer matches `BACK-410`. Text queries keep the same Fuse semantics as the Web.

## Related Concepts

- [[concepts/search-sequences]] — Fuse.js search and filtering
- [[concepts/web-ui-features]] — Web UI search behavior

## Related Sources

- [[sources/milestone-search-fix]] — BACK-480 short numeric false-positive class
