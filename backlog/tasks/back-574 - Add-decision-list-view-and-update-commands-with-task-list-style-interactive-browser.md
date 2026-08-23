---
id: BACK-574
title: >-
  Add decision list, view, and update commands with task-list-style interactive
  browser
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-23 02:33'
labels:
  - tui
dependencies: []
actual_start: '2026-08-22 08:34'
actual_end: '2026-08-23 02:24'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI previously exposed only `backlog decision create`, so decisions could be created but not enumerated, viewed, or updated from the CLI. This task expands the decision surface to include list, view, and update subcommands, and adds an interactive two-pane decision browser (list left, details right) that is implemented by referencing the existing task-list interaction pattern. The browser uses `←/→` to switch panes, `↑/↓/j/k` to navigate or scroll, and highlights the active pane border in yellow (reverting on blur). It also works around terminal compatibility issues on Windows/PowerShell/VS Code. The CLI and MCP agent guides for decisions are updated to document the new commands/tools and multi-line content handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog decision list` enumerates decisions with `--plain` and `--json` output modes
- [x] #2 `backlog decision list` defaults to plain text when stdout is not a TTY and reports "No decisions found." for an empty log
- [x] #3 `backlog decision view <decisionId>` displays decision frontmatter and markdown body, with `--plain` fallback
- [x] #4 `backlog decision update <decisionId>` supports `--content` to replace the decision body and `--append-content` to append blocks, both accepting literal `\n` escapes
- [x] #5 Interactive `backlog decision list` opens a two-pane browser (list left, details right) that references the task-list interaction model: `←/→` switches panes, `↑/↓/j/k` navigates or scrolls, the active pane border highlights in yellow and reverts on blur, and a bottom help bar is shown
- [x] #6 The interactive TUI handles terminal compatibility on Windows/PowerShell/VS Code by releasing the shared blessed program, restoring terminal state on viewer exit, disabling mouse tracking, and falling back to plain output when terminal size is unavailable
- [x] #7 CLI and MCP decision guides are updated to document the new commands/tools and multi-line content handling
- [x] #8 Tests cover decision list (plain/json/empty), decision view, and decision update
- [x] #9 `bunx tsc --noEmit`, `bun run check .`, scoped tests, and `bun run build` all pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `backlog decision view <decisionId>` to display decision frontmatter and markdown body, with plain output fallback for non-TTY.
2. Add `backlog decision update <decisionId>` supporting `--content` to replace the decision body and `--append-content` to append blocks; reuse `core.updateDecisionFromContent()` for structured section parsing (Context/Decision/Consequences/Alternatives).
3. Extend `backlog decision list` with an interactive TUI mode (two-pane list/details) using a new `runDecisionListViewer()` helper; keep `--plain`/`--json` fallbacks for non-TTY or small terminals.
4. Harden the shared blessed TUI program for sequential screens by adding `releaseSharedProgram()` and making `scrollableViewer()` restore terminal state (screen.leave/release program) on exit, disable mouse on Windows, and add explicit scroll keys.
5. Update `src/guidelines/cli-instructions/decisions.md` and `src/guidelines/mcp/decisions.md` to document view/update/list behavior and multi-line content handling.
6. Add tests for decision view/update and verify with `bunx tsc --noEmit`, `bun run check .`, and `bun test`. Rebuild `dist/backlog.exe`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added `backlog decision view` and `backlog decision update` to `src/cli.ts`.
- `decision update --content` replaces the full decision body; `--append-content` appends blocks after the existing body. Both support multi-line content via quoted literal backslash-n escape sequences processed by `processCliEscapes()`.
- Implemented `src/ui/decision-list-viewer.ts` for the interactive decision list by referencing the existing task-list interaction model: left pane shows `Decisions (N)`, right pane shows raw markdown details; `←/→` switches panes, `↑/↓/j/k` navigates or scrolls, active pane border turns yellow and reverts on blur, and a bottom help bar mirrors the task-list style.
- Added `releaseSharedProgram()` in `src/ui/tui.ts` to clean up the shared blessed program between sequential TUI screens, fixing PowerShell/VS Code hangs after closing a viewer.
- Strengthened `scrollableViewer()`: explicit `↑/↓/j/k`/`PgUp/PgDn`/`Home/End` keys, Windows mouse disabled, `screen.enter()` on open, and `screen.leave()` + `releaseSharedProgram()` on close.
- Added `decision-list` context to `src/ui/components/help-popup.ts`.
- Updated CLI and MCP decision guides in `src/guidelines/cli-instructions/decisions.md` and `src/guidelines/mcp/decisions.md`.
- Registered the new decision guides with the instructions system by adding `CLI_DECISIONS_GUIDE` / `MCP_DECISIONS_GUIDE` exports to the guide index files, adding `"decisions"` to `WORKFLOW_GUIDE_KEYS` and `INSTRUCTION_GUIDE_KEYS` in `src/mcp/workflow-guides.ts`, and updating the overview guide indexes so `backlog instructions decisions` works for both CLI and MCP agents.
- Added tests for view/update in `src/test/cli-doc-decision-board.test.ts`.
- Verification: `bunx tsc --noEmit` passes, `bun run check .` is clean except for pre-existing `src/core/assets.ts` warnings, targeted tests pass, and `bun run build` succeeds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded the CLI decision surface from a single `backlog decision create` command to a full set of `list`, `view`, and `update` commands, and added an interactive two-pane decision browser that mirrors the existing task-list interaction pattern.

`backlog decision list` enumerates decisions. In a TTY it opens a two-pane viewer: the left pane lists decisions with a count (`Decisions (N)`), the right pane shows the raw markdown details, and the bottom bar displays keyboard shortcuts. `←/→` switches focus between panes, `↑/↓/j/k` navigates the list or scrolls the details, and the active pane border turns yellow (reverting on blur). For non-TTY or terminals with broken size detection it falls back to plain text rows and supports `--json` for a versioned `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }` envelope.

`backlog decision view <decisionId>` prints the decision's frontmatter and markdown body, defaulting to an interactive scrollable viewer in TTY mode and `--plain` otherwise.

`backlog decision update <decisionId>` supports `--content` to replace the decision body and repeatable `--append-content` to append blocks. Both options accept literal `\n` escapes via the shared `processCliEscapes()` helper. The update reuses `core.updateDecisionFromContent()` to parse structured sections (Context / Decision / Consequences / Alternatives).

The shared blessed TUI program was hardened for sequential screens: `releaseSharedProgram()` cleans up the terminal between screens, and `scrollableViewer()` now disables mouse tracking on Windows, adds explicit scroll keys, restores terminal state on exit, and falls back to plain output when terminal size is unavailable. These changes fix hangs and unresponsive scrolling in PowerShell/VS Code.

CLI and MCP agent guides (`src/guidelines/cli-instructions/decisions.md` and `src/guidelines/mcp/decisions.md`) were updated to document the new commands/tools and multi-line content handling.

Tests in `src/test/cli-doc-decision-board.test.ts` cover `decision create --plain`, list plain/json/empty output, decision view, and decision update with `--content` and `--append-content`. `src/test/cli-json-output.test.ts` continues to cover the versioned decision-list JSON envelope and conflicting output modes.

Verification: `bunx tsc --noEmit` passes; `bun run check .` is clean except for pre-existing `src/core/assets.ts` warnings; scoped tests pass; `bun run build` succeeds.
<!-- SECTION:FINAL_SUMMARY:END -->
