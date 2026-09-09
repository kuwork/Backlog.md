---
title: BACK-609 Raise bun test timeout for MCP stdio session test
created_date: '2026-09-06 08:10'
updated_date: '2026-09-06 08:10'
labels:
  - source
  - test
  - ci
source_path: backlog/tasks/back-609 - Raise-bun-test-timeout-for-MCP-stdio-session-test.md
---

# BACK-609 Raise bun test timeout for MCP stdio session test

The MCP stdio session test ('keeps stdio sessions alive after listing tools so document calls can respond') was killed by Bun's default 5000ms per-test timeout under full-suite parallel load, before its own platform-scaled internal waits could finish. The fix passes an explicit 30000ms per-test timeout so the internal `withTimeout` guards remain the real hang protection while the test gets enough wall time on loaded machines.

## Summary

- `src/test/mcp-stdio-exit.test.ts`: the timeout goes as the third `test()` argument (bun:test options belong at the end — the options-object-in-middle form does not type-check)
- Internal `getPlatformTimeout` waits (already doubled on Windows) remain the actual hang protection; the bun timeout only covers scheduling noise
- Chosen value 30000ms, well above the internal Windows-doubled timeouts
- Verified: scoped test passes; full suite (`full-test-609-611.log`) 2051 pass / 7 fail with the stdio shutdown 5s timeout failure absent

## Acceptance Criteria

- The stdio session test carries an explicit bun test timeout above its internal Windows timeout
- `bun test src/test/mcp-stdio-exit.test.ts` passes
- `bunx tsc --noEmit` and `bun run check` pass on touched files

## Related Concepts

- [[concepts/ci-platform-contracts]] — explicit per-test timeouts against Bun's 5000ms default under parallel load
