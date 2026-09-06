---
id: BACK-609
title: Raise bun test timeout for MCP stdio session test
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 07:54'
updated_date: '2026-09-06 08:10'
labels: []
dependencies: []
references:
  - src/test/mcp-stdio-exit.test.ts
  - src/test/test-utils.ts
modified_files:
  - src/test/mcp-stdio-exit.test.ts
ordinal: 214400
actual_start: '2026-09-06 07:54'
actual_end: '2026-09-06 08:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 'keeps stdio sessions alive after listing tools so document calls can respond' test spawns an MCP server over stdio, initializes a project, and performs listTools plus a document_create round trip. Its internal waits use getPlatformTimeout (already doubled on Windows), but Bun's default per-test timeout of 5000ms fires first under full-suite parallel load, killing the test at ~5012ms before its own logic can complete. Pass an explicit per-test timeout (e.g. 30000ms) so the internal withTimeout guards remain the real hang protection while the test gets enough wall time on loaded machines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The stdio session test carries an explicit bun test timeout above its internal Windows timeout
- [x] #2 bun test src/test/mcp-stdio-exit.test.ts passes
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
1. Add an explicit bun test timeout (30000ms) to the 'keeps stdio sessions alive' test so Bun's 5000ms default no longer fires before the test's own Windows-doubled internal timeouts
2. Run bun test src/test/mcp-stdio-exit.test.ts plus tsc/biome
3. Confirm disappearance in the next full bun test run
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Raised the per-test timeout for the MCP stdio session test.

Changes:
- src/test/mcp-stdio-exit.test.ts: pass 30000ms as the third test() argument (bun:test options belong at the end; the options-object-in-middle form does not type-check). Internal withTimeout guards remain the hang protection.

Verification:
- bun test src/test/mcp-stdio-exit.test.ts passes
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-609-611.log): 2051 pass / 7 fail; the stdio shutdown 5s timeout failure is absent.
<!-- SECTION:FINAL_SUMMARY:END -->
