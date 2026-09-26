---
title: BACK-680 Move multiple selected tasks between statuses in one action
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - cli
  - web-ui
  - core
source_path: backlog/tasks/back-680 - Move-multiple-selected-tasks-between-statuses-in-one-action.md
---

# BACK-680 Move multiple selected tasks between statuses in one action

Batch status moves across CLI, web board, and (later) TUI via one shared core primitive. Started as contributor PR #945 (janosmiko), taken over in place to preserve credit, then reworked over several maintainer QA and review rounds; the TUI multi-select flow was rejected by the maintainer and split to BACK-681.

## Summary

- CLI: `task edit` accepts multiple IDs; per-task-only flags (title, description, plan, notes, comments, ordinal, modified files, checklist items, final summary, AC/DoD, date clearing) are rejected in a multi-ID call; shared flags loop the existing single-task edit path with per-task failures reported without aborting the batch; a multi-ID call with no batch-applicable flags errors instead of silently opening the wizard for the first ID
- Core/server: `Core.moveTasksToStatus({taskIds, targetStatus, orderedTaskIds?, targetMilestone?})` resolves and guards each task once, shares id-resolution/cross-branch helpers with `reorderTask` (~45 duplicated lines removed), returns per-task failures, and seeds block ordinals via `calculateBlockOrdinals` (count=1 equals `calculateNewOrdinal` midpoint math); exposed as `POST /api/tasks/move`
- Web board: Ctrl/Cmd/Shift multi-select, selection toolbar, batch drag in one request, drag ghost badge counts the set that actually moves (a ctrl/cmd-press-drag on an unselected card joins the selection at dragstart), collapsed-lane and filter pruning of the selection, and in-place release is a pure no-op via a `'self'` dropPosition that trips the existing `isOrderUnchanged` guard
- Review-round fixes: canonical task identity for dedup (leading zeros collapse, bare numbers keep default prefix), cross-branch cards excluded from the batch write set, lane-scoped append ordering, mixed-batch stay-put ruling for already-in-status tasks, double-Enter guard on TUI confirm, batch-drag insertion indicator suppressed
- TUI: maintainer rejected the m-key multi-mark flow (collides with within-column reordering); `src/ui/board.ts` is back to main's single-task mover except a 7-line `movePending` double-Enter guard; multi-select split to the successor task
- Tests: 75 pass / 0 fail across the four BACK-680 suites (`cli-task-batch-edit`, `core-move-tasks-to-status`, `server-move-tasks-endpoint`, `web-board-batch-move`), rollback matrix A–F, plus real-browser CDP verification (one `POST /api/tasks/move` for a two-card drag; no request for in-place release)
- Docs updated: `agent-guidelines.md`, `cli-instructions/task-execution.md`, `CLI-INSTRUCTIONS.md`

## Acceptance Criteria

- CLI batch edit updates every listed task via the single-task path with per-task failure reporting, and fails clearly when no batch-applicable flag is given
- Web batch moves route through `moveTasksToStatus`; milestone-view batch drag applies the same milestone semantics as single-task drag
- Ambiguous/unresolvable IDs in a batch fail closed as per-task errors; id-resolution/cross-branch guard logic shared with `reorderTask`
- Automated tests cover CLI batch edit, per-task failures, web batch moves, and the milestone-lane case

## Related Concepts

- [[concepts/task-identity]] — canonical id matching used for batch dedup and fail-closed resolution
- [[concepts/task-lifecycle]] — status transitions the batch move performs
- [[concepts/milestones]] — milestone-lane semantics in board batch drags
- [[concepts/web-ui-features]] — board multi-select, drag ghost, and no-op drop guards

## Related Sources

- [[sources/back-681-tui-shift-arrow-multi-select]] — the split-out TUI half that consumes `orderedTaskIds`
- [[sources/back-505]] — dependency drill-down; earlier board interaction precedent
- [[sources/back-541-board-column-created-sort]] — column ordering context the ordinal seeding builds on
