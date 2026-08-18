---
title: BACK-556 Add --append-plan to task edit CLI
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - cli
  - task-editing
source_path: backlog/tasks/back-556 - Add-append-plan-option-to-task-edit-CLI.md
---

# BACK-556 Add --append-plan to task edit CLI

Added a repeatable `--append-plan` option to `backlog task edit` so humans and agents can extend an implementation plan without replacing existing content or opening an editor.

## Summary

- Wired `--append-plan` into `src/cli.ts` at five points: `hasEditFieldFlags`, help schema, commander option declaration, value collection via `toStringArray`, and `editArgs.planAppend`.
- Reused the existing shared plan append pipeline (`sanitizeAppendInput` + `appendImplementationPlan` in `src/core/backlog.ts`) unchanged.
- Multiple append values are applied in CLI order, each separated from existing/previously appended plan text by exactly one blank line.
- Whitespace-only append values are ignored; the first nonblank append creates the plan section when missing.
- When both `--plan` and `--append-plan` are used together, `--plan` replaces first, then append values apply in order.
- Documentation updated in `src/guidelines/cli-instructions/task-execution.md`.

## Implementation Notes

Append values are not passed through `processCliEscapes`, matching the existing `--append-notes` convention. Focused real CLI tests cover noninteractive and PTY no-editor behavior.

## Related Concepts

- [[concepts/cli-entry]] — CLI command architecture
- [[concepts/task-lifecycle]] — Task creation and editing flow

## Related Sources

- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — Plan/notes/final-summary escape support
- [[sources/back-530-append-description]] — Append-description precedent
