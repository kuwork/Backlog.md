---
title: BACK-560 Match milestone ID queries in task list milestone filtering
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - milestones
  - filtering
source_path: backlog/tasks/back-560 - Match-milestone-ID-queries-in-task-list-milestone-filtering.md
---

# BACK-560 Match milestone ID queries in task list milestone filtering

Milestone filtering in task lists now resolves numeric and canonical milestone IDs (`0`, `m-0`), case variants, and punctuated titles consistently across CLI, interactive list, and MCP.

## Summary

- Upgraded `src/utils/milestone-filter.ts` with `createMilestoneFilterValueResolver` exposing `resolveExactId`, `resolveExactTitle`, `resolveId`, and `createMilestoneFilterMatcher`.
- `normalizeMilestoneFilterValue` switched to the `\p{L}\p{N}` Unicode character class so symbol-only and non-ASCII titles keep their identity.
- `src/utils/task-search.ts`, `src/core/backlog.ts`, `src/ui/board.ts`, `src/ui/task-viewer-with-search.ts`, and `src/ui/unified-view.ts` all route milestone filtering through the shared matcher.
- `src/cli.ts` removed the pre-seeding block that normalized the milestone filter before the interactive view.
- MCP `task_list` active and Draft paths resolve milestone IDs consistently.
- Queries matching no configured milestone return no tasks.

## Acceptance Criteria

- Numeric/canonical milestone ID queries list only tasks assigned to that milestone.
- Title filtering supports exact, partial, and typo queries, including punctuation-sensitive titles.
- Regression tests cover shared matching, CLI output, interactive filtering, and MCP active/draft paths.

## Related Concepts

- [[concepts/milestones]] — Milestone management
- [[concepts/search-sequences]] — Search and filter infrastructure

## Related Sources

- [[sources/milestone-search-fix]] — BACK-480 milestone search fuzzy-match false positive fix
