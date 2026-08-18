---
title: BACK-410 Cursor AGENTS.md init cleanup
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - cli
  - init
  - agents
  - cursor
source_path: backlog/tasks/back-410 - Init-keep-Cursor-on-AGENTS.md-and-remove-obsolete-rule-artifacts.md
---

# BACK-410 Cursor AGENTS.md init cleanup

Cleanup task that keeps Cursor mapped to the shared `AGENTS.md` init target and removes obsolete Backlog-owned Cursor artifacts.

## Summary

- Removed `.cursorrules` special-casing and `fileName` threading from guideline marker helpers (`getMarkers`, `hasBacklogGuidelines`, `wrapWithMarkers`, `stripGuidelineSection`) so all guideline blocks use HTML-comment markers.
- Removed the unused `CURSOR_GUIDELINES` export from `src/guidelines/index.ts`.
- Updated `src/cli.ts` `--agent-instructions` option description/help copy to state that Cursor writes `AGENTS.md`.
- Synced the Web init `AGENTS.md` option description (`agentsMdDesc`) in all four locale files to name Cursor as an `AGENTS.md` user.
- Ensured repeated init stays idempotent and preserves existing `AGENTS.md` content and user-managed `.cursor/rules`.

## Acceptance Criteria

- Cursor selection never creates `.cursorrules` or other Backlog-owned Cursor rule files.
- Existing `AGENTS.md` content is preserved; repeated init keeps a single marker block.
- New focused tests cover CLI init and localized Web init Cursor copy.
- Type-check and Biome pass.

## Implementation Notes

Fork-adapted cleanup of upstream BACK-410 follow-up. Upstream's three new tests were not ported verbatim; fork-style coverage was added instead. Verification: `bunx tsc --noEmit`, Biome, CLI init, and Web initialization tests pass.

## Related Concepts

- [[concepts/cli-instructions]] — CLI instruction surface and init behavior
- [[entities/ai-agents]] — AI agent integration options

## Related Sources

- [[sources/back-521.2]] — Short CLI nudge and init default migration
- [[sources/back-521.14]] — CLI/MCP instruction guide updates
