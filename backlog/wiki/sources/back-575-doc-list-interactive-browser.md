---
title: Add task-list-style interactive browser for doc list
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
  - tui
  - docs
source_path: backlog/tasks/back-575 - Add-task-list-style-interactive-browser-for-doc-list.md
---

# Add task-list-style interactive browser for doc list

Gave `backlog doc list` the same two-pane interactive browser that decision and task lists already had: documents on the left (`Documents (N)`), raw markdown details on the right, Enter opens the full viewer, `?` opens the help popup, `q` quits. `--plain` and `--json` modes and all fallbacks are unchanged; only the interactive branch was replaced.

## Summary

- Created `src/ui/document-list-viewer.ts` adapted directly from `src/ui/decision-list-viewer.ts` (BACK-574) — same pane model: `←/→` switches panes, `↑/↓/j/k` navigates or scrolls, active pane border highlights yellow and reverts on blur, bottom help bar.
- Reused the shared `releaseSharedProgram()` and terminal-state restore logic from BACK-574 to keep PowerShell/VS Code behavior consistent.
- Wired `backlog doc list` in `src/cli.ts` to `runDocumentListViewer` in TTY mode with `TerminalSizeError` fallback to plain output; removed the now-unused `genericSelectList` import.
- Added `document-list` context to `src/ui/components/help-popup.ts`.
- Updated `src/guidelines/cli-instructions/documents.md` and `src/guidelines/mcp/documents.md` to describe the interactive list behavior.
- Tests for plain/json/empty output added to `src/test/cli-doc-decision-board.test.ts`.

## Acceptance Criteria

- doc list keeps `--plain`/`--json` enumeration; interactive mode opens the two-pane browser with pane switching, vim keys, and yellow active-border; TTY falls back to plain output when terminal size is unavailable; CLI/MCP documents guides updated; tests cover plain/json/empty.

## Related Concepts

- [[concepts/cli-tui]] — the shared two-pane interactive browser pattern
- [[concepts/cli-instructions]] — documents guide updated for both CLI and MCP

## Related Sources

- [[sources/back-574-decision-list-view-update-commands]] — the decision-list viewer this task adapts (same batch)
- [[sources/back-552-doc-view-plain]] — the plain-output fallback contract preserved here
