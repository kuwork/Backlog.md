---
title: BACK-608 Document statusExcluded filter in MCP workflow overview task_list line
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - mcp
  - docs
source_path: backlog/tasks/back-608 - Document-statusExcluded-filter-in-MCP-workflow-overview-task_list-line.md
---

# BACK-608 Document statusExcluded filter in MCP workflow overview task_list line

A consistency test in `src/test/mcp-server.test.ts` asserts that the `task_list` quick-reference line of the MCP workflow overview resource names every filter property of the `task_list` tool schema. BACK-548 added a `statusExcluded` filter to the schema, but the overview line in `src/guidelines/mcp/overview.md` still listed only the older filters, so the test failed on every full run. This task updated the doc line; the guarding test was deliberately left unchanged.

## Summary

- The `- task_list` quick-reference line in `src/guidelines/mcp/overview.md` now names the `statusExcluded` filter (excludes one or more statuses) alongside the existing filters, matching the `task_list` schema property added by BACK-548.
- The doc/schema consistency test is the guard: it was not weakened, only satisfied.
- Scoped `bun test src/test/mcp-server.test.ts` 11/11 pass; full run (2049 pass / 9 fail) shows the workflow overview failure absent; remaining failures are known flaky timing tests and ContentStore stale-refresh tests that depend on a clean commit.

## Acceptance Criteria

- The `task_list` line in the MCP workflow overview names the `statusExcluded` filter.
- `bun test src/test/mcp-server.test.ts` passes; tsc and biome clean.

## Related Concepts

- [[concepts/mcp-workflow]] — The MCP workflow overview resource as living documentation guarded by a schema-consistency test.
- [[concepts/mcp-server]] — task_list tool schema filters including statusExcluded.

## Related Sources

- [[sources/back-548-status-exclude-filtering]] — The task that added the statusExcluded filter to the schema, creating the doc drift this task fixed.
