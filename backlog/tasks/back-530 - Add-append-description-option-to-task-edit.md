---
id: BACK-530
title: Add --append-description option to task edit
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-28 01:02'
updated_date: '2026-07-28 04:29'
labels: []
dependencies: []
priority: medium
ordinal: 183400
actual_start: '2026-07-28 01:42'
actual_end: '2026-07-28 02:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently `backlog task edit` supports `--append-notes` and `--append-final-summary` to append to existing implementation notes or final summary. However, the `--description` option always replaces the entire description. Users expect an analogous append option for the description field so they can add context without losing the existing text.

Scope: add a `--append-description` (or `--append-desc` alias) option to `backlog task edit` that appends the provided text to the end of the current description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `task edit` supports `--append-description <text>` and appends the text to the existing description
- [x] #2 `--append-description` can be used multiple times and preserves the original description order
- [x] #3 Help text and input schema clearly distinguish `--description` (replace) from `--append-description` (append)
- [x] #4 Tests cover appending to both single-line and multi-line descriptions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend types: add `descriptionAppend?: string[]` to `TaskEditArgs` and `TaskUpdateInput`.
2. CLI options: register `--append-description` / `--append-desc` on `task edit` (multi-value accumulator) and include them in `hasEditFieldFlags` so the wizard is not triggered.
3. Input builder: map `descriptionAppend` to `updateInput` in `buildTaskUpdateInput`.
4. Core append logic: reuse the existing `appendBlock` helper in `Core.updateTaskFromInput` to append `input.descriptionAppend` to `task.description`.
5. Help docs: update the `task edit` `addHelpSchema` optional fields with `descriptionAppend`.
6. MCP parity: add `descriptionAppend` to the `task_edit` schema in `schema-generators.ts`.
7. Tests: add `src/test/append-description.test.ts` covering single append, multiple appends, empty description, multi-line `\n` escapes, and combining `--description` with `--append-description`.
8. Verify with `bunx tsc --noEmit`, Biome checks on touched files, and `bun test src/test/append-description.test.ts`.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented --append-description and --append-desc for backlog task edit. Changes span types, core append logic, CLI options, help schema, MCP schema, tests in src/test/append-description.test.ts, and guideline docs. Verified with bunx tsc --noEmit, biome checks on touched files, and all 5 new tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
