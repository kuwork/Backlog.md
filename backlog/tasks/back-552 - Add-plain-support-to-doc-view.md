---
id: BACK-552
title: Add plain support to doc view
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-08 20:15'
updated_date: '2026-08-09 07:04'
labels:
  - cli
dependencies: []
actual_start: '2026-08-09 06:59'
actual_end: '2026-08-09 07:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a non-interactive plain-text path for backlog doc view so agents, scripts, pipes, and CI can read Backlog documents through the public CLI without launching the interactive viewer. The --plain flag prints the raw document content to stdout; when stdout is not a TTY, plain output is emitted automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-523 and git show 9dad487 as implementation reference.
- [x] #2 backlog doc view <docId> --plain prints the raw document content to stdout without launching the interactive viewer.
- [x] #3 backlog doc view <docId> automatically emits plain output when stdout is not a TTY (auto-plain).
- [x] #4 backlog doc view --help documents the --plain option and includes a plain-output example.
- [x] #5 Focused CLI tests cover explicit plain output and non-TTY auto-plain behavior for document view.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Follow the existing CLI plain-output pattern used by other read commands. Add --plain to backlog doc view in src/cli.ts, using isPlainRequested(options) || shouldAutoPlain before falling back to the scrollable viewer; update the command help schema and examples. Add a focused CLI test file src/test/cli-doc-view.test.ts covering explicit --plain and non-TTY auto-plain behavior. Verify with the focused test, typecheck, and Biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added --plain support to backlog doc view in src/cli.ts, mirroring the existing plain-output pattern (isPlainRequested(options) || shouldAutoPlain) before falling back to scrollableViewer. Updated the help schema optional field and examples. Added src/test/cli-doc-view.test.ts covering explicit --plain and non-TTY auto-plain (both pass). Verified: bunx tsc --noEmit clean, biome check clean on changed files, 2/2 focused tests pass. Note: non-TTY auto-plain was already handled by scrollableViewer; the new branch makes --plain explicit and forceable on an interactive TTY. Guidelines updated: src/guidelines/cli-instructions/documents.md and src/guidelines/agent-guidelines.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added --plain to backlog doc view. With --plain (or non-TTY auto-plain via shouldAutoPlain) the raw document content is printed to stdout instead of launching the interactive scrollable viewer. Help schema now documents the plain optional field and a --plain example. New focused test file cli-doc-view.test.ts (2 tests) passes; typecheck and Biome clean. Non-TTY auto-plain was already provided by scrollableViewer, so the flag mainly makes plain output explicit and usable on an interactive TTY.
<!-- SECTION:FINAL_SUMMARY:END -->
