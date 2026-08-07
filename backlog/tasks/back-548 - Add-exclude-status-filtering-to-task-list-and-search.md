---
id: BACK-548
title: >-
  Add exclude-status filtering and multi-status selection to task list and
  search
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-09 06:58'
updated_date: '2026-08-07 18:47'
labels:
  - web-ui
  - cli
  - mcp
dependencies: []
references:
  - src/types/index.ts
  - src/core/backlog.ts
  - src/core/search-service.ts
  - src/utils/status.ts
  - src/utils/task-search.ts
  - src/cli.ts
  - src/ui/unified-view.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/web/lib/api.ts
  - src/web/components/TaskList.tsx
  - src/web/components/StatusFilterDropdown.tsx
  - src/web/components/StatusExcludeDropdown.tsx
  - src/server/index.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/validation/validators.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/task-creation.md
priority: medium
actual_start: '2026-08-07 16:53'
actual_end: '2026-08-07 17:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CLI task list/search currently supports filtering by a single status only (--status single value): multiple statuses cannot be selected and statuses cannot be excluded. This task adds multi-status selection (--status repeatable or comma-separated, case-insensitive) and status exclusion (--exclude-status with one or more statuses) to CLI task list/search, combinable with existing filters (priority/assignee/labels/type/milestone, etc.). The Web All Tasks page gains two independent multi-select dropdowns modeled after the Label filter: a Status include filter and a StatusExcluded (passive voice) exclusion filter, both persisted to URL query parameters (status / statusExcluded). The TUI unified view carries status arrays and statusExcluded in its filter state so live search updates and view switches cannot reintroduce excluded statuses. MCP task list/search supports the same multi-status selection and exclusion via status / statusExcluded arguments. Guidelines document the new filter surface: single-status, multi-select, and exclusion combination examples.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-532 and git show 0b3a23d as implementation reference.
- [x] #2 CLI task list supports --status with one or more statuses (repeatable or comma-separated, case-insensitive), combinable with existing filters.
- [x] #3 CLI task list supports --exclude-status excluding one or more statuses, combinable with existing filters.
- [x] #4 CLI search and task search plumbing support the same multi-status selection and exclusion.
- [x] #5 Web status filter follows the Label filter pattern (LabelFilterDropdown multi-select) for multi-select and exclusion, both persisted to URL query parameters.
- [x] #6 MCP task list/search supports multi-status selection and exclusion, schema style consistent with the existing labels array.
- [x] #7 Invalid or unconfigured statuses (multi-select and exclusion) are rejected consistently with existing configured-status validation.
- [x] #8 Regression tests cover CLI/search multi-select and exclusion, Web multi-select and exclusion, MCP, and TUI filter-state retention.
- [x] #9 Guidelines updated: keep existing single-status filter examples and add positive multi-select and exclusion combination examples across agent-guidelines, cli-instructions, and mcp guidelines.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Types src/types/index.ts: extend TaskListFilter.status to string | string[], add statusExcluded?: string | string[]; add statusExcluded to SearchFilters (status already supports arrays).
2. Core src/core/backlog.ts applyTaskFilters: array-based status matching (any match passes), add statusExcluded exclusion (trim/lowercase normalization, Set lookup).
3. Core src/core/search-service.ts normalizeFilters: add statusExcluded normalization into excludedStatuses and filtering.
4. CLI src/cli.ts: --status and the new --exclude-status both use createMultiValueAccumulator + parseDelimitedStringList for repeat/comma-separated values; validate via normalizeCliStatusList before writing to TaskListFilter; CLI flag options.excludeStatus maps to internal statusExcluded.
5. TUI src/ui/unified-view.ts, src/ui/board.ts, src/ui/task-viewer-with-search.ts: filter state carries status arrays and statusExcludedFilter; mergeUnifiedViewFilters merges correctly; kanban move mode ignores exclude-only filters.
6. Web: add two independent Label-pattern dropdowns in TaskList.tsx — StatusFilterDropdown (include multi-select, label Status) and StatusExcludedDropdown (exclusion, label StatusExcluded); status/statusExcluded persisted as repeated URL query params; src/web/lib/api.ts passes status arrays and statusExcluded; server /api/tasks + /api/search accept statusExcluded.
7. MCP: src/mcp/tools/tasks/schemas.ts extends taskListSchema/taskSearchSchema status to array and adds statusExcluded; src/mcp/validation/validators.ts JsonSchema gains oneOf support; src/mcp/tools/tasks/handlers.ts writes multi-value/exclusion into TaskListFilter; update MCP guideline docs.
8. Guidelines: add status-filter examples to src/guidelines/agent-guidelines.md, src/guidelines/cli-instructions/*, and src/guidelines/mcp/* — keep existing single-status examples and add positive multi-select and exclusion combination examples.
9. Tests: regression coverage for CLI/search multi-select and exclusion, Web multi-select and exclusion (incl. single-status URL dedup), MCP multi-select and exclusion, TUI statusExcludedFilter retention.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Naming: exclusion field unified as statusExcluded (status-first) across core TaskListFilter/SearchFilters, CLI filters, URL query params, server /api/tasks + /api/search, MCP schemas/args, and task-search options; TUI/Web internal state uses statusExcludedFilter (status-first + Filter suffix). CLI flag stays --exclude-status (options.excludeStatus), independent of internal field naming.

Core: TaskListFilter.status extended to string | string[] and statusExcluded added; applyTaskFilters matches any selected status and excludes via Set; content-store getTasks and file-system listTasks updated; search-service normalizes statusExcluded into excludedStatuses. status.ts added getCanonicalStatuses (dedup, case/space-insensitive, invalid reporting) and DEFAULT_STATUSES fallback.

CLI: task list and search gained --status multi-value (repeat/comma-separated) and --exclude-status; both canonicalized/validated via normalizeCliStatusList with exitCode 1 on invalid input; interactive TUI seeds statusExcludedFilter and loader filters.

TUI: UnifiedViewFilters/KanbanSharedFilters carry statusExcludedFilter; board.ts, task-viewer-with-search.ts, unified-view.ts propagate it through filter state; kanban move mode ignores exclude-only filters; task-search.ts applies status arrays and exclusion.

Web: TaskList now has two independent Label-pattern dropdowns — StatusFilterDropdown (include multi-select, field label Status) and StatusExcludedDropdown (exclusion, label StatusExcluded passive voice); status/statusExcluded persisted as repeated URL query params; api.ts and server accept statusExcluded; i18n keys in en/ja/zh-CN/zh-TW. Fixed URL-parse bug that duplicated a single status param into two entries (getAll + get double read).

MCP: taskListSchema/taskSearchSchema status accepts string or array, added statusExcluded; validators.ts JsonSchema gained oneOf support; handlers pass through both filters. Guidelines: six files updated with multi-select and exclusion examples. Tests: cli-exclude-status-filtering.test.ts (9 cases), search-service exclusion tests, MCP filter-pass-through tests, unified-view statusExcludedFilter tests, web single-status URL dedup tests. Validation: bunx tsc --noEmit, bun run check ., bun run build, focused suites pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented --exclude-status and multi-status --status filtering across CLI task list/search, Web All Tasks (two independent Label-pattern dropdowns: Status include + StatusExcluded passive-voice exclusion, URL persistence), TUI unified view, and MCP task list/search. Core TaskListFilter/SearchFilters gained statusExcluded and array status; CLI canonicalizes and validates against configured statuses; Web URL-parse dedup bug fixed. Exclusion field named statusExcluded (status-first) end to end; CLI flag remains --exclude-status. Regression tests cover CLI, search-service, MCP, unified-view filter state, and web URL dedup. Guidelines updated with single-status, multi-select, and exclusion examples. Validation: tsc, biome check, build, focused suites all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
