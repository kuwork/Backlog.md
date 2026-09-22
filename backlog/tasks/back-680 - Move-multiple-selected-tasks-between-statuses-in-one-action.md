---
id: BACK-680
title: Move multiple selected tasks between statuses in one action
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 18:57'
updated_date: '2026-09-21 08:28'
labels: []
dependencies: []
actual_start: '2026-09-21 06:40'
actual_end: '2026-09-21 08:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let users select several tasks and change their status in one action across surfaces, layered per the manifesto: canonical CLI first (`task edit` accepts multiple task IDs and loops the existing single-task edit path, with flags that cannot apply per-task across a batch rejected), and web board plus TUI batch selection as views over one shared core method (`moveTasksToStatus`) with partial-failure per-task error reporting. Implemented by contributor PR #945 (janosmiko); we are taking that PR over in place to preserve credit. Known defects fixed during takeover: the interactive wizard silently dropped extra IDs when `task edit` was called with multiple IDs and no flags; batch drag in the milestone board view changed status but ignored milestone lanes; ~45 lines of id-resolution/branch-guard logic were duplicated between reorderTask and moveTasksToStatus. Browser QA follow-ups fixed on the branch: a no-op batch drop fired a real move plus a full data reload, and the multi-select drag ghost showed only one card.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI `task edit` with multiple IDs and a status flag updates every listed task via the existing single-task edit path, reporting per-task failures without aborting the batch
- [x] #2 CLI `task edit` with multiple IDs and no batch-applicable flags fails with a clear error instead of silently opening the wizard for only the first ID
- [x] #3 Web board batch moves route through the shared core method (moveTasksToStatus); batch drag in the milestone view applies the same milestone semantics as single-task drag. TUI batch selection was split out to a follow-up TUI multi-select task after the maintainer rejected the m-key recruitment flow; the TUI keeps main's single-task mover
- [x] #4 Ambiguous or unresolvable task IDs in a batch fail closed as per-task errors; no task is guessed
- [x] #5 Id-resolution and cross-branch guard logic is shared between reorderTask and moveTasksToStatus rather than duplicated
- [x] #6 Unrelated formatting churn is removed from the diff
- [x] #7 Automated tests cover CLI batch edit, per-task failure reporting, web batch moves, and the milestone-lane case
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Rework of PR #945 on branch pr/batch-move-tasks per maintainer QA (head 954112f4). Each change names the existing interaction it reuses.

1. TUI - one move flow on the existing m mover (reuses: moveOp move mode in src/ui/board.ts, its entry key m, its arrow-key target movement, its magenta ghost preview + cyan move-mode row highlight, its transient-footer errors, its popupOpen/filterPopupOpen/modalOpen guards):
   a. Generalize MoveOperation to a marked set (taskIds, anchor first). m in normal mode enters move mode exactly as today with the selected task as anchor (N=1 pixel-identical).
   b. Arrows keep today's exact semantics: they move the anchor ghost/target. The anchor ghost occupies the spot where the whole set will land (existing preview).
   c. m while in move mode toggles the mark of the task at the anchor's insertion point (the task whose row the ghost occupies, shown directly below it). Marked tasks stay in place rendered with the mover's magenta family (reuses formatTaskListItem's isMarked branch from the PR, recolored to match the mover). Cross-branch tasks refuse with the existing cannot-move-branch transient footer.
   d. Enter confirms: build the target column's final order (column minus marked, block = anchor + marked in board display order inserted at the anchor position) and call core.moveTasksToStatus with orderedTaskIds; per-task failures use the PR's transient-footer report. N=1 no-position-change keeps today's silent exit guard. Esc cancels and clears (existing cancelMove generalized).
   e. DELETE the PR's separate batch mode: space marking, batchMoveTargetStatus, performBatchMove, shiftBatchMoveTarget, batch footer branch, marked-count idle suffix. Footer in move mode shows M=Mark, Enter=Confirm, Esc=Cancel in the existing hint style (uppercase letters stay key indicators). help-popup M entry updated, Space removed.
2. Core: extend moveTasksToStatus with optional orderedTaskIds for placed drops (reuses: reorderTask's neighbor-seeded ordinal calculation generalized to a block via a calculateBlockOrdinals helper in core/reorder.ts that equals calculateNewOrdinal at count=1, plus the existing resolveOrdinalConflicts + updateTasksBulk write path and the shared resolveTasksForBoardMove/cross-branch/milestone helpers). Without orderedTaskIds the current append-to-end semantics are unchanged (web endpoint untouched).
3. Web no-op drop (reuses: TaskColumn's existing dropPosition + isOrderUnchanged guard): root cause - the card-level dragover early-returns when hovering the dragged card itself, dropPosition stays null, and handleDrop falls back to append-to-end, so a lift-and-release-in-place fires a real reorder that also moves the card to the bottom. Fix: record dropPosition {index, position:'self'} while hovering the dragged card (no indicator rendered), and map 'self' to the card's current position in handleDrop so the existing isOrderUnchanged guard makes it a pure no-op. Batch and milestone-lane in-place drops stay inert via the existing landsWhereItAlreadyIs guard; add tests for all three paths.
4. Web drag ghost (reuses: buildSelectionDragImage stacked ghost + board card classes): count the set that will actually move. Fix the selection-minus-dragged case - a modifier-press-drag on a not-yet-selected card starts the drag before the click registers; at dragstart with ctrl/meta held and an existing selection, add the card to the selection (existing onSelect toggle) and badge selectionCount+1. Stack depth reflects the count (min 3 layers). Tests pin badge and stack for 2 and 3 selected.
5. Tests: rewrite board-tui-batch-move.test.ts to drive the unified m flow (mark/toggle/confirm/cancel/cross-branch/footer), extend core-move-tasks-to-status.test.ts with orderedTaskIds placement cases, extend web-board-batch-move.test.tsx with the no-op and ghost cases. Update help-popup/footer test expectations. bunx tsc --noEmit, bun run check ., bun test all green.
6. Push fast-forward to fork branch pr/batch-move-tasks; contributor commits preserved.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rework round 2 (maintainer QA feedback), on pr/batch-move-tasks:
- TUI: deleted the space-marking batch mode entirely; moveOp generalized to a marked set (anchor first). m enters move mode as before; in move mode m toggles the task directly below the ghost (the spot the ghost occupies); Enter confirms all marked, Esc cancels. Confirm routes through core.moveTasksToStatus with the new orderedTaskIds placement, so the set lands exactly where the ghost previewed.
- Core: moveTasksToStatus accepts optional orderedTaskIds; block ordinal seeding via calculateBlockOrdinals in core/reorder.ts (count=1 matches calculateNewOrdinal's midpoint math); append semantics unchanged when the param is absent.
- Web no-op root cause: card-level dragover early-returned when hovering the dragged card itself, leaving dropPosition null, so handleDrop fell back to append-to-end - an in-place release both fired a reorder and moved the card to the bottom. Fixed with a 'self' dropPosition that resolves to the card's current spot and trips the existing isOrderUnchanged guard. Verified live in Chromium: in-place release (single and batch) sends no request; real drags send exactly one.
- Web ghost: badge now counts the set that actually moves; a ctrl/cmd-press-drag on a not-yet-selected card joins the selection at dragstart (the click never completes in that gesture), fixing the selection-minus-dragged badge and the drop moving one card short. Stack depth follows the count.

Thread-triage round (head bd4ba137): board-move dedup and CLI batch dedup now use canonical task identity (leading zeros collapse, bare numbers keep the default prefix); shift-range skips cross-branch cards; selection prunes to filter-visible cards; append places arriving tasks after the column as rendered with non-finite ordinals treated as missing; already-in-status tasks keep their ordinal in a mixed batch (named lane still applies); double-Enter guard on the TUI confirm. Regression tests added for each.

Maintainer re-test follow-up (head 551323e7): during a selection drag, every selected card now carries the grabbed card's existing isDragging treatment (opacity/rotate/scale) via a board-level selection-drag flag; cleared on dragend and on selection clear. jsdom test pins companion styling on dragstart and its removal on dragend.

Maintainer decision: the TUI multi-mark flow is rejected (overloading m collides with within-column reordering) and split to a successor TUI multi-select task (maintainer-designed shift-arrow recruitment). The branch now ships CLI batch edit + web multi-select (no-op guards, drag ghost, selection-drag styling) + core moveTasksToStatus with orderedTaskIds placement (used by the web API and the upcoming TUI multi-select design). src/ui/board.ts is back to main's single-task mover except a standalone double-Enter movePending guard; TUI tests rewritten as board-tui-move.test.ts asserting main's single-mover semantics.

Verification for AC checks: full suite green on head f4f1ba61 (2670 tests, 0 fail) covering cli-task-batch-edit.test.ts (ACs 1-2), web-board-batch-move.test.tsx + server-move-tasks-endpoint.test.ts (AC 3 web scope, milestone lanes), core-move-tasks-to-status.test.ts (ACs 4-5, shared resolution and fail-closed per-task errors); web batch drop additionally verified live in Chromium earlier on this branch. AC 6 verified by diff review each round. TUI diff against main is exactly the 7-line movePending guard in src/ui/board.ts.

Codex thread round (head 2e39335f): lane-scoped append ordering (a drop into one milestone lane no longer renumbers other lanes), cross-branch cards excluded from the batch write set (they order the column but are never persisted locally), web batch requests built in board order instead of click order, and CLI batch edit dedups on resolved identity so bare-number aliases under a custom prefix cannot save a task twice. The TUI marked-set thread is obsolete - that code was deleted with the TUI multi-select split. Regression tests added for the three fixturable fixes.

Closing Codex round (head be6239da): the batch-drag insertion indicator is suppressed (a batch drop never honors a card-level position, so the UI no longer promises one) and --acceptance-criteria/--clear-ac/--ac/--dod joined the per-task-only guard for multi-ID edits, matching the existing plan/notes philosophy. Deferred, not fixed: honoring the drop position for batch drags (needs orderedTaskIds through the web move endpoint and a product decision on the blessed inert same-column drop) - natural companion to the follow-up TUI multi-select work.

Terminal adjudication round (head 77e8ce6f): FIXED djEMu (--clear-final-summary joins the per-task-only batch guard, test added). REFUTED djCP8: a selected task already at the target status keeps its ordinal while the named lane is applied - that is the maintainer's explicit stay-put ruling from the mixed-batch round; switching cross-lane cards to append semantics would reverse it. REFUTED djCQA: an append can never render after an ordinal-less cross-branch card without writing that card, which the no-write rule forbids; the current deterministic outcome (arrivals carry ordinals, the read-only card stays last-rendered-by-absence) is the least-bad representable order and rejecting the whole move would break supported drops. DEFERRED djCP- (legacy ordinal-less cards materialize in ID order rather than the web renderer's date order) and djCQB (lane matching by trimmed string misses milestone aliases the board canonicalizes): both are the same client-knows-rendered-truth gap whose clean fix is passing the rendered destination ordering through the batch endpoint's orderedTaskIds - already recorded as the positioned-batch-drop follow-up.

Final code round (head f344d681): FIXED djmAz - the selection prune now also drops cards hidden by a collapsed milestone lane (same rendered-truth shape as the filter prune; test collapses a lane and sees the selection shrink), closing the no-silent-movement gap. DEFERRED wholesale per coordinator ruling: djmA1 (lane-major ordering for batch payloads - belongs to the positioned-batch-drop follow-up that passes rendered ordering through the move endpoint) and djmA2 (TUI input race while a slow single-mover write is in flight - pre-existing single-mover behavior, follow-up ledger). Any further review threads on this PR are deferred wholesale; the review-cycle cap is spent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Batch status moves are wired across the three surfaces via a shared core primitive.

CLI: `task edit` accepts multiple task IDs. Per-task-only flags (title, description, plan, notes, comments, ordinal, modified files, checklist items, final summary, and the date clearing flags) are rejected in a multi-ID call; shared flags loop the existing single-task edit path and report per-task failures without aborting the batch. New `src/test/cli-task-batch-edit.test.ts` covers the happy path, mixed batch, deduplication, alias collapse, per-task-flag rejection, and clearing-flag batchability.

Core / server: `Core.moveTasksToStatus({taskIds, targetStatus, orderedTaskIds?, targetMilestone?})` resolves and guards each task once, shares the resolution / cross-branch helpers with `reorderTask`, and returns per-task failures. `POST /api/tasks/move` exposes it. New / extended tests in `src/test/core-move-tasks-to-status.test.ts` and `src/test/server-move-tasks-endpoint.test.ts` cover fail-closed ambiguous IDs, shared helpers, and milestone-lane payloads.

Web board: multi-select via Ctrl/Cmd and Shift, selection toolbar for batch moves, batch drag moves the whole selection in one request, drag ghost shows the selected count, collapsed-lane and filter pruning, and in-place release is a pure no-op. `src/test/web-board-batch-move.test.tsx` covers selection, toolbar moves, batch drag, milestone-lane payloads, no-op guards, drag image, and selection-drag styling.

Usage guides updated: `src/guidelines/agent-guidelines.md`, `src/guidelines/cli-instructions/task-execution.md`, and `CLI-INSTRUCTIONS.md`.

Verification: 75 pass / 0 fail across the four BACK-680 suites; `bunx tsc --noEmit` clean; `bun run check .` reports only the 3 pre-existing `assets.ts` warnings. Rollback matrix (A-F) confirmed each behavior is test-guarded (7 / 2 / 1 / 25 / 7 / 9 failures respectively, files restored). Real-browser CDP verification via Chrome drag interception on an out-of-repo temp project: a two-card selection drag to a different status produced exactly one `POST /api/tasks/move` carrying both IDs, and both cards landed in the target column; an in-place release of a single card sent no request and left it where it was.
<!-- SECTION:FINAL_SUMMARY:END -->
