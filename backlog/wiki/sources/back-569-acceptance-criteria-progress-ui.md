---
title: BACK-569 Acceptance criteria completion on TUI and browser summaries
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - tui
  - web-ui
  - acceptance-criteria
source_path: backlog/tasks/back-569 - Show-acceptance-criteria-completion-on-TUI-and-browser-task-summaries.md
---

# BACK-569 Acceptance criteria completion on TUI and browser summaries

In-Progress task summaries now show a compact segmented completion bar plus the exact checked/total acceptance-criteria fraction, derived live from the checklist.

## Summary

- Added `src/ui/acceptance-criteria-progress.ts` with `formatAcceptanceCriteriaProgress`: 10-cell bar (5 cells under 32 columns), no label, no percentage, live checked/total.
- `src/ui/board.ts`: `formatTaskListItem` accepts `availableWidth` and prefixes the progress indicator; `getFormattedItems` computes per-column width.
- `src/ui/task-viewer-with-search.ts`: Acceptance Criteria section shows the progress line above the checklist.
- Added `src/web/components/AcceptanceCriteriaProgress.tsx`: segmented bar + exact fraction, `role="progressbar"` with ARIA attributes, 5/10-cell layouts, null for non-In-Progress or no criteria.
- `TaskCard` shows the indicator under the title (10 cells); `TaskList` shows it in the title cell.
- No persisted progress state; CLI and MCP output unchanged.

## Acceptance Criteria

- In-Progress tasks show `[██████░░░░] 4/7` style indicator.
- No AC label or percentage; tasks without AC show nothing.
- Fully-checked In-Progress tasks retain their actual In-Progress status.
- Theme-safe; understandable without color.
- TUI and browser tests cover partial completion, no AC, all checked, and both bar widths.

## Related Concepts

- [[concepts/cli-tui]] — TUI task summaries
- [[concepts/web-ui-features]] — Web task cards and lists
- [[concepts/task-lifecycle]] — Task status and acceptance criteria

## Related Sources

- [[sources/back-537-deterministic-checklist-serialization]] — Acceptance-criteria editing
