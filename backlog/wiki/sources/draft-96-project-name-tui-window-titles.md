---
title: Include the project name in TUI window titles (draft-96)
created_date: '2026-09-08 17:00'
updated_date: '2026-09-08 17:00'
labels:
  - source
  - draft
  - tui
source_path: backlog/drafts/draft-96 - Include-the-project-name-in-TUI-window-titles.md
---

# Include the project name in TUI window titles (draft-96)

Upstream GitHub issue #853: the TUI board hardcoded "Backlog Board" (`src/ui/board.ts:304`) and the task viewer defaulted to "Backlog Tasks", so users running several boards in parallel terminals could not tell the windows apart. This draft extends the existing overview-TUI title pattern (`${projectName} - Overview`, `src/ui/overview-tui.ts:39`) to the board and task viewer through one shared helper. Migrated into the fork as BACK-591 (merged with terminal-title-restore scope from the same wave), Done.

## Summary

- Shared `formatTuiTitle(view, projectName)` helper in `src/ui/tui.ts` renders `<project> - <view>` and falls back to `Backlog <view>` when the name is blank/whitespace or the `Untitled Project` config-migration placeholder (the same placeholder the web server uses).
- Board is a pure render function, so it receives the name via a new optional `projectName` option next to `dateFormat`; all three callers (unified-view, simple-unified-view, enhanced-views) pass `config?.projectName`. The task viewer reads `config?.projectName` itself.
- The selected-task title is deliberately included: it overwrites the initial title as soon as a task opens, so titling only the initial screen would have left the tab unidentified in normal use.
- PR #863 review follow-up (P1): `formatTuiTitle` strips C0/C1/DEL control characters via a code-point filter in `src/ui/tui.ts` — the title is emitted as raw OSC (`ESC ] 0 ; <title> BEL`) with no escaping, so an attacker-controlled project name or task title could otherwise inject terminal escapes.
- Terminal-title restore on exit recorded as out of scope: neo-neo-bblessed never captures the original title, and XTerm title-stack escapes would need balanced push/pop across every `createScreen` teardown path, including a process-level exit hook.
- Verified end-to-end with the expect PTY suite (`RUN_INTERACTIVE_TUI_TESTS=1`, transcripts contain real OSC writes like `\x1b]0;Interactive board - Board\x07`) plus unit tests in `src/test/tui-window-title.test.ts` (crafted BEL/ESC/C1 names, control-only fallback, 7 pass); full suite at 1913–1952 pass / 5 skip across rebase iterations.

## Acceptance Criteria

- Board TUI title includes the project name, following the overview TUI pattern.
- Task viewer TUI title includes the project name under the same pattern.
- Titles fall back to a sensible default when the project name is empty.
- The `readyPattern "Backlog Board"` in `src/test/tui-interactive-editor-handoff.test.ts:409` is updated to match.
- Restoring the previous terminal title on exit is either included as a small addition or explicitly recorded as out of scope (recorded out of scope).

## Related Concepts

- [[concepts/cli-tui]] — the change touches all three TUI surfaces (board, task viewer, overview) through one shared title helper

## Related Sources

- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — TUI-3 section analyzes this draft for migration as BACK-591
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — B11 entry classifies it for migration
