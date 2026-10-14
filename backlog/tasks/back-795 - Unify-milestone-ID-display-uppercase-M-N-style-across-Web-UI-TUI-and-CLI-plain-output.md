---
id: BACK-795
title: >-
  Unify milestone ID display: uppercase M-N style across Web UI, TUI, and CLI
  plain output
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-14 08:27'
updated_date: '2026-10-14 08:47'
labels:
  - web-ui
  - tui
  - cli
dependencies: []
modified_files:
  - src/core/milestones.ts
  - src/web/utils/milestones.ts
  - src/web/components/MilestonesPage.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/ui/milestones.ts
  - src/board.ts
  - src/web/utils/milestones.test.ts
  - src/test/board.test.ts
  - src/test/milestones-tui.test.ts
  - src/test/web-milestone-live-add.test.tsx
  - src/test/cli-milestone-management.test.ts
ordinal: 357001
actual_start: '2026-10-14 08:28'
actual_end: '2026-10-14 08:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Milestone IDs were shown without the code or in lowercase (m-9) across surfaces, unlike task IDs which render uppercase (TASK-9). Add a shared display helper formatMilestoneId (src/core/milestones.ts) and apply it to: the web milestones page bucket titles, the milestone details modal title, the remove/reassign dropdown options, the TUI milestone sidebar rows and detail popup header, and the backlog milestone list --plain section headers. Web surfaces use an em dash separator (M-9 — Title) matching the task details modal; TUI and CLI use a hyphen (M-9 - Title) matching task rows. Display-only change: storage and alias resolution are unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web milestones list and detail titles show the uppercase code (M-9 — Title); when the label falls back to the raw id, the code is shown once
- [x] #2 TUI milestone rows and the detail popup header use the M-N - Title style
- [x] #3 milestone list --plain section headers render as ## M-N - Title (n tasks)
- [x] #4 formatMilestoneId has unit tests; affected web/TUI/CLI tests updated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add formatMilestoneId to src/core/milestones.ts: case-insensitive m-<digits> match, uppercase prefix, strip zero padding, pass non-id references through unchanged; re-export from src/web/utils/milestones.ts.
2. Web: show the formatted id in MilestonesPage bucket headers (id only when the label falls back to the raw id) and in the remove/reassign options; prefix the MilestoneDetailsModal title as M-N — title.
3. TUI: use the formatted id in formatRowLabel and the milestone popup header.
4. CLI plain: prefix generateMilestoneGroupedBoard section titles with the formatted id.
5. Tests: add formatMilestoneId unit tests; update board, milestones-tui, web-milestone-live-add, and cli-milestone-management expectations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added formatMilestoneId (src/core/milestones.ts, re-exported via src/web/utils/milestones.ts); matches m-<digits> case-insensitively, strips zero padding, passes non-id references through. Applied in: src/web/components/MilestonesPage.tsx (bucket header, reassign options), src/web/components/MilestoneDetailsModal.tsx (modal title, reassign options), src/ui/milestones.ts (formatRowLabel sidebar rows, detail popup header, removal hint), src/board.ts (generateMilestoneGroupedBoard section titles). When the label equals the raw id (entity not loaded), only the code is shown. Tests: new formatMilestoneId cases in src/web/utils/milestones.test.ts; updated board.test.ts, milestones-tui.test.ts, web-milestone-live-add.test.tsx, cli-milestone-management.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Milestone codes now render in the same uppercase style as task IDs: M-9 — Title on the web list/detail (em dash, matching the task details modal) and M-9 - Title in the TUI and CLI plain output (hyphen, matching task rows). Display-only change; storage and alias resolution are unchanged. bunx tsc --noEmit, biome check, and the affected test files pass; 4 popup timing cases in milestones-tui are flaky on this machine's baseline as well and are unrelated.
<!-- SECTION:FINAL_SUMMARY:END -->
