---
id: BACK-569
title: Show acceptance criteria completion on TUI and browser task summaries
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-17 21:36'
updated_date: '2026-08-17 05:29'
labels:
  - web
dependencies: []
references:
  - src/ui/acceptance-criteria-progress.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/web/components/AcceptanceCriteriaProgress.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/TaskList.tsx
  - src/test/tui-acceptance-criteria-progress.test.ts
  - src/test/web-acceptance-criteria-progress.test.tsx
actual_start: '2026-08-17 05:00'
actual_end: '2026-08-17 05:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Help people understand how much accepted task scope has been verified while scanning in-progress work in the TUI. In-progress task summaries and cards should show a compact completion bar followed by the exact checked/total acceptance-criteria fraction. This is a TUI presentation feature only; it does not change task state or CLI and MCP output.
Browser: In Progress task summaries or cards show a compact segmented completion bar with the exact checked/total fraction (for example [██████░░░░] 4/7), derived live from acceptance criteria without an AC label or percentage. CLI and MCP output stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In-progress task summaries and cards in the TUI show a compact completion bar followed by the exact checked/total fraction, for example [██████░░░░] 4/7.
- [x] #2 The visible indicator has no AC label and no percentage.
- [x] #3 The completion value is derived live from checked and total acceptance criteria and is not persisted as separate progress state.
- [x] #4 The bar uses 10 cells when available terminal width permits and 5 cells in constrained layouts.
- [x] #5 A task with no acceptance criteria does not display 0% or otherwise imply measurable completion.
- [x] #6 A task with every acceptance criterion checked still retains and clearly presents its actual In Progress status rather than implying that the task is Done.
- [x] #7 Colors are theme-safe, and the bar plus exact fraction remain understandable when color is unavailable.
- [x] #8 CLI and MCP output remain unchanged.
- [x] #9 TUI rendering tests cover partial completion, no acceptance criteria, all criteria checked while still In Progress, and both supported bar widths.
- [x] #10 In Progress task summaries or cards with acceptance criteria show a compact segmented completion bar followed by the exact checked/total fraction, without an AC label or percentage
- [x] #11 The displayed completion is derived from the task current checked and total acceptance criteria and reflects acceptance-criteria changes without storing a separate progress value
- [x] #12 The browser uses a 10-cell bar when space allows and a 5-cell bar in narrower available space, preserving the desktop-first layout and best-effort narrow behavior
- [x] #13 An In Progress task with no acceptance criteria does not display a value that implies 0% completion
- [x] #14 An In Progress task with every acceptance criterion checked remains visibly In Progress and the completion display does not imply that its task status is Done
- [x] #15 Browser tests cover partial completion, no acceptance criteria, all criteria checked while In Progress, and the 10-cell and 5-cell layouts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented acceptance-criteria completion on TUI and browser task summaries (merged B25(T) BACK-551 + B25(W) BACK-552).

### TUI
- Added src/ui/acceptance-criteria-progress.ts: formatAcceptanceCriteriaProgress derives live checked/total fraction with a 10-cell bar (5 cells under 32 columns); empty for non-In-Progress tasks or tasks without criteria; no AC label or percentage.
- src/ui/board.ts: formatTaskListItem accepts availableWidth and prefixes the progress indicator; getFormattedItems computes per-column width from terminal width / column count.
- src/ui/task-viewer-with-search.ts: the Acceptance Criteria section shows the progress line above the checklist.

### Browser
- Added src/web/components/AcceptanceCriteriaProgress.tsx: segmented bar + exact fraction, role=progressbar aria attributes, 5/10 cell layouts; null for non-In-Progress or no criteria.
- TaskCard shows the indicator under the title (10 cells); TaskList shows it in the title cell.

### Verification
- New: tui-acceptance-criteria-progress 5 pass; web-acceptance-criteria-progress 4 pass (SSR).
- Regression: board-loading / tui composer / web filters / web column sort / side-navigation 38 pass.
- bunx tsc --noEmit pass; biome pass on touched .ts files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TUI kanban cards, task lists, and task detail now show a compact [██████░░░░] 4/7 acceptance-criteria completion indicator for In Progress tasks, derived live from the checklist with no persisted state, no AC label, and no percentage. The browser shows the same indicator on TaskCard and TaskList summaries.

Tasks without acceptance criteria render nothing (no implied 0%), and fully-checked In Progress tasks keep their actual status.

Verified by 9 new tests plus 38 regression tests, typecheck, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->
