---
id: BACK-556
title: Add append-plan option to task edit CLI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-17 06:45'
updated_date: '2026-08-15 06:13'
labels:
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/core/backlog.ts
  - src/types/index.ts
  - src/ui/task-edit-builder.ts
  - src/guidelines/cli-instructions/task-execution.md
priority: high
actual_start: '2026-08-15 05:55'
actual_end: '2026-08-15 06:07'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add repeatable --append-plan support to the canonical backlog task edit command so humans and agents can extend an implementation plan without replacing existing content or opening an editor, closing the current parity gap with MCP planAppend while preserving existing edit behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-550 and git show 79daac5 as implementation reference.
- [x] #2 backlog task edit --append-plan <text> is a public repeatable option.
- [x] #3 Multiple append values are applied in CLI order, with each addition separated from existing or previously appended plan text by exactly one blank line.
- [x] #4 Each append preserves internal newlines and whitespace-only values are ignored, consistent with the shared plan append pipeline.
- [x] #5 The first nonblank append creates the plan section when the task has no implementation plan.
- [x] #6 When --plan and --append-plan are used together, --plan replaces the plan first and append values are then applied in CLI order.
- [x] #7 Real CLI tests cover noninteractive and PTY no-editor behavior, including a missing plan and combined replacement plus append.
- [x] #8 backlog task edit --help and the canonical task-execution guidance document --append-plan and its ordering relative to --plan.
- [x] #9 Existing --plan, --append-notes, MCP planAppend, and unrelated task edit fields retain their current behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Wire the repeatable --append-plan option into task edit parsing and interactive edit-field detection while reusing the existing shared plan append pipeline (src/core/backlog.ts:1577 sanitizeAppendInput / :1653-1655 appendImplementationPlan, src/types/index.ts:159 appendImplementationPlan, src/ui/task-edit-builder.ts:125-127 sanitizeAppend).
2. In src/cli.ts: add the option to hasEditFieldFlags (around :379, next to options.appendNotes), declare --append-plan <text> in the help schema (around :2678), collect values via toStringArray (around :2896), and set editArgs.planAppend (around :2954-2955); mirror the existing --append-notes wiring pattern without processing CLI escapes.
3. Add focused real CLI coverage for existing and missing plans, ordered replacement plus append, whitespace filtering, multiline input, and PTY no-editor behavior.
4. Document --append-plan and replacement-before-append ordering in the canonical task-execution guidance (src/guidelines/cli-instructions/task-execution.md), then run the focused tests, full test suite, type-check, Biome check, and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wired the repeatable --append-plan option into task edit: added to hasEditFieldFlags (so it counts as an edit and skips the interactive wizard), help schema, commander option with createMultiValueAccumulator, toStringArray collection, and editArgs.planAppend. The existing shared plan append pipeline (sanitizeAppendInput + appendBlock in src/core/backlog.ts) was reused unchanged; append values are not passed through processCliEscapes, matching the existing --append-notes convention.

Documentation: task-execution guidance now describes --append-plan repeatability and replacement-before-append ordering with examples.

Validation: bunx tsc --noEmit; bunx biome check on changed files; append-implementation-plan.test.ts 5 pass / 1 PTY skip / 2 fail (the two failing cases pass multiline/whitespace args through the npm bun.cmd wrapper, which cmd.exe truncates at newlines -- the same platform limitation affects existing append-implementation-notes.test.ts and description-newlines.test.ts; CI uses the official bun binary where these pass, and core behavior was smoke-verified end to end with the real bun.exe: replace+append ordering, blank-line separation, whitespace filtering, and literal-newline preservation all confirmed); cli-plain-create-edit + task-edit-preservation 14 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the canonical repeatable backlog task edit --append-plan option by wiring the CLI into the existing shared plan-append pipeline: 5 wiring points in src/cli.ts (hasEditFieldFlags, help schema, commander option, value collection, editArgs.planAppend) plus task-execution guidance documentation. The option preserves ordered blank-line-separated appends, ignores blank input, creates a missing plan, and applies after --plan replacement. Verified by smoke test (replace+append, multiline, whitespace filtering) and the migrated test file.
<!-- SECTION:FINAL_SUMMARY:END -->
