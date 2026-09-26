---
title: BACK-685 Single-source task search config and filters in core
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - cli
  - search
  - core
source_path: backlog/tasks/back-685 - Single-source-task-search-config-and-filters-in-core.md
---

# BACK-685 Single-source task search config and filters in core

Task search and filtering were implemented five times with real behavior drift (any-label vs all-label matching, case-sensitive MCP label loops, labels/assignees searchable locally but not via `backlog search` or the web API). This task makes `src/utils/task-search.ts` the single owner of the searchable-text builder, the Fuse config, and one shared filter predicate, consumed by SearchService, Core, the CLI, and the MCP adapter.

## Summary

- `src/utils/task-search.ts` rewritten as single owner: new exports `buildTaskSearchBodyText` / `buildTaskSearchFields` / `TASK_SEARCH_FUSE_OPTIONS` / `createTaskFilterMatcher(options, corpus)`; `applyTaskFilters` / `applySharedTaskFilters` / `createTaskSearchIndex` keep signatures so board/unified-view consumers needed zero changes; predicate semantics are the union of all five copies; `labelMatch` defaults to `any`
- Labels and assignees enter the searchable text on every surface, closing the drift where a query found a task via `task list --search`/TUI but not via `backlog search`/web API (probe-verified before)
- `src/core/search-service.ts`: task entities use the shared builders; inline Fuse config, `NormalizedFilters`, both private filter copies, and four normalize helpers deleted; wiki entity corpus and the `fileName: 0.25` key preserved as service-side extensions; also fixed a pre-existing `dispose()` gap
- `src/cli.ts`: `taskMatchesAllLabels` deleted; `--labels` flows through `baseFilters.labels` + `labelMatch "all"`; `src/mcp/tools/tasks/handlers.ts`: hand-rolled case-sensitive label loops deleted — MCP label matching becomes case-insensitive as a side effect
- `labelMatch` resolution: `any` by default; CLI `--labels` and MCP `task_list` labels pass `all` (matching documented contracts); interactive pickers stay `any`
- `src/types/index.ts`: `TaskListFilter` and `SearchFilters` gain `labelMatch?: "any" | "all"` (additive)
- New `src/test/task-search-parity.test.ts` (14 cases) pins cross-surface parity including labels/assignees, labelMatch semantics, CLI/MCP wiring, and the wiki corpus; mutation matrix proves each guard discriminates

## Acceptance Criteria

- One module owns the Fuse config and searchable-text builder; SearchService imports it and its duplicated config is deleted
- A label or assignee query finds the task identically via `backlog search`, `task list --search`, MCP, and the web API
- One shared filter implementation with explicit labelMatch semantics; the five divergent copies deleted or delegating
- Fork extensions survive: wiki entities in the corpus, `fileName` key (0.25), board/unified-view consumers unchanged; MCP label matching case-insensitive

## Related Concepts

- [[concepts/search-sequences]] — the search/filter pipeline this task unifies
- [[concepts/spotlight-search]] — cross-surface search consumers
- [[concepts/core-architecture]] — shared-core placement of the predicate
- [[concepts/mcp-server]] — MCP adapter now delegating to the shared filters

## Related Sources

- [[sources/back-686-shared-search-consumers]] — follow-up routing TUI viewer and milestones page onto this shared search
- [[sources/back-564-search-score-threshold]] — earlier threshold tuning on the same index
- [[sources/back-624-global-search-dialog]] — web search surface benefiting from the corpus parity
