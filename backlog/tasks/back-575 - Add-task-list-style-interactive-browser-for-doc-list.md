---
id: BACK-575
title: Add task-list-style interactive browser for doc list
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 02:41'
updated_date: '2026-08-23 03:02'
labels:
  - tui
dependencies: []
references:
  - BACK-574
ordinal: 194400
actual_start: '2026-08-23 02:47'
actual_end: '2026-08-23 03:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implemented a task-list-style two-pane interactive browser for backlog doc list. TTY mode now shows documents on the left (Documents (N)) and the selected documents raw markdown on the right (Details). Left/right arrows switch panes, up/down/j/k navigate or scroll, the active pane border highlights yellow and reverts on blur, Enter opens the document in the full viewer, ? opens a help popup, and q quits. --plain and --json continue to work, and the viewer falls back to plain output when the terminal size is unavailable or stdout is not a TTY.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc list continues to enumerate documents in --plain and --json modes
- [x] #2 interactive doc list opens a two-pane browser with documents on the left and content on the right
- [x] #3 left/right arrows switch panes; up/down/j/k navigate or scroll; active pane border highlights yellow and reverts on blur
- [x] #4 bottom help bar lists keyboard shortcuts and ? opens a help popup
- [x] #5 TTY falls back to plain output when terminal size is unavailable
- [x] #6 CLI and MCP documents guides are updated to describe the interactive list behavior
- [x] #7 tests cover plain/json/empty output
- [x] #8 tsc --noEmit, biome, scoped tests, and build pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes
- [x] #2 bun run check . passes with only pre-existing warnings
- [x] #3 bun test scoped to cli-doc-decision-board.test.ts passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Created src/ui/document-list-viewer.ts adapted from src/ui/decision-list-viewer.ts. 2. Added document-list help context to src/ui/components/help-popup.ts. 3. Wired backlog doc list in src/cli.ts to runDocumentListViewer in TTY mode with TerminalSizeError fallback. 4. Updated src/guidelines/cli-instructions/documents.md and src/guidelines/mcp/documents.md. 5. Added plain/json/empty tests in src/test/cli-doc-decision-board.test.ts. 6. Verified with bunx tsc --noEmit, bun run check ., scoped tests, and bun run build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused the shared releaseSharedProgram and terminal-state restore logic from BACK-574 to keep PowerShell/VS Code behavior consistent. Removed the now-unused genericSelectList import from src/cli.ts. Plain and JSON paths are unchanged; only the interactive branch was replaced.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog doc list now uses the same two-pane browser as decision and task lists. All fallbacks and JSON contracts are preserved; docs and tests are updated.
<!-- SECTION:FINAL_SUMMARY:END -->
