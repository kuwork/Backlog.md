---
id: BACK-608
title: Document statusExcluded filter in MCP workflow overview task_list line
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 07:32'
updated_date: '2026-09-06 07:43'
labels: []
dependencies: []
references:
  - src/guidelines/mcp/overview.md
  - src/test/mcp-server.test.ts
  - src/mcp/tools/tasks/schemas.ts
modified_files:
  - src/guidelines/mcp/overview.md
ordinal: 213400
actual_start: '2026-09-06 07:32'
actual_end: '2026-09-06 07:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A consistency test asserts that the task_list line of the MCP workflow overview resource mentions every filter property of the task_list tool schema. BACK-548 added a statusExcluded filter to the schema, but the overview's task_list quick-reference line in src/guidelines/mcp/overview.md still lists only the older filters, so the test fails on every full test run. Update that line so it names statusExcluded alongside the existing filters. The test is the guard here; do not weaken it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The '- task_list' line in src/guidelines/mcp/overview.md names the statusExcluded filter
- [x] #2 bun test src/test/mcp-server.test.ts passes
- [x] #3 bunx tsc --noEmit and bun run check pass on touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add statusExcluded to the task_list quick-reference line in src/guidelines/mcp/overview.md
2. Run bun test src/test/mcp-server.test.ts plus tsc/biome
3. Confirm disappearance in the next full bun test run
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added statusExcluded to the task_list quick-reference line in src/guidelines/mcp/overview.md. Scoped mcp-server tests 11/11 pass, tsc/biome clean. Full run in progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented the statusExcluded filter in the MCP workflow overview.

Changes:
- src/guidelines/mcp/overview.md: task_list quick-reference line now names the statusExcluded filter (excludes one or more statuses), matching the task_list schema property added by BACK-548. Test guarding doc/schema consistency kept unchanged.

Verification:
- bun test src/test/mcp-server.test.ts → 11/11 pass
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-608.log): 2049 pass / 9 fail; the workflow overview failure is absent. No deterministic failures remain except the three ContentStore stale-refresh tests whose failures come from uncommitted workspace changes (they pass on clean commits). Remaining failures are known flaky timing tests (MermaidMarkdown, stdio shutdown, editTaskInTui editor subprocess timeouts, filesystem watcher).
<!-- SECTION:FINAL_SUMMARY:END -->
