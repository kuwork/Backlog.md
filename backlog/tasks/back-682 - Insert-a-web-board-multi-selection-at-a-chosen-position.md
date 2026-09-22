---
id: BACK-682
title: Insert a web board multi-selection at a chosen position
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-21 16:58'
updated_date: '2026-09-21 18:42'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/Board.tsx
  - src/web/components/TaskColumn.tsx
  - src/core/backlog.ts
  - src/test/web-board-batch-move.test.tsx
  - src/test/server-move-tasks-endpoint.test.ts
  - src/test/web-task-column-sort.test.tsx
modified_files:
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/Board.tsx
  - src/web/components/TaskColumn.tsx
  - src/test/web-board-batch-move.test.tsx
  - src/test/server-move-tasks-endpoint.test.ts
  - src/test/web-task-column-sort.test.tsx
ordinal: 17000
actual_start: '2026-09-21 17:50'
actual_end: '2026-09-21 18:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dragging one card on the web board honours where you drop it: release it between two cards and it lands exactly there. Dragging a multi-selection does not, because the batch path appends the whole selection to the end of the target column. The same gesture therefore means two different things depending on how many cards are selected, and the difference is invisible until after the drop.

The primitive underneath is already positional. `moveTasksToStatus` takes an optional `orderedTaskIds` that names the target column's final order, and the TUI multi-select mover landed in BACK-681 relies on exactly that. The web path never passed it: the endpoint read only `taskIds` / `targetStatus` / `targetMilestone`, the client payload had no such field, and the batch branch in the drop handler returned before the position math the single-card path runs. The insertion indicator was suppressed for multi-selection drags precisely because the drop would not honour it.

Scope is the web board only: server endpoint, web client, and the board view. The CLI batch edit stays status-only.

The manual-sort rule belongs to the same change. A drop that rewrites a column's order has to retire that column's manual sort, otherwise the order it just wrote stays hidden behind the sort the reader picked - a rule the board has carried since BACK-504. "Cross-column" had only ever been read as "different status" while the board draws one column per lane and status: a drop between two lanes of the same status lands in a different column and kept the sort, and a same-column reorder rewrote the ordinals while the sort re-sorted the cards back, so the drag looked inert while a batch of task files changed. The rule is now expressed once: the drop retires the sort exactly when it changed the order.

The other half of that rule is which order the card is read in, and it belongs here too. A column that a drag from elsewhere is over has to show the order that drag is about to write, which is the default one. While it kept its manual sort, the insertion indicator and the drop both resolved against the sorted list: the release rewrote the column into the sorted order and only then retired the sort, so the cards swapped under the cursor and the card that had just landed was not where the line had promised - the reader saw it land, disappear and come back somewhere else. The sort now stands down for the visit instead of being retired, so a drag that flies over the column, or one that is cancelled, costs the reader nothing. That change and its task record are folded in here as well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `POST /api/tasks/move` accepts an optional `orderedTaskIds` field and forwards it to `core.moveTasksToStatus`; a request without that field keeps today's append behaviour unchanged.
- [x] #2 Endpoint coverage shows a positional batch move placing the selected tasks at the named indices, while the same request without `orderedTaskIds` appends them to the end of the column.
- [x] #3 A selected task that cannot move (unresolvable id, ambiguous identity, or a cross-branch card) stays in its source column, is left out of the target column's order, and is reported in `failures`.
- [x] #4 A named order that omits a task being moved, or names one twice, is rejected as a client error rather than surfacing as a server fault.
- [x] #5 `MoveTasksPayload` carries an optional `orderedTaskIds` that `apiClient.moveTasks` forwards untouched.
- [x] #6 A batch move builds its order from the column's previewed board order rather than the order in which the cards were clicked.
- [x] #7 Dropping a multi-selection onto a card inserts the whole selection at that card's index, while dropping into empty column space still appends to the end.
- [x] #8 A same-column multi-selection drop repositions the block to the dropped index, and releasing it where it already sits performs no write.
- [x] #9 Any drop that rewrites a column's order retires that column's manual sort — a cross-status drop, a drop between lanes of the same status, and a same-column reorder alike — while a release that changes nothing keeps the sort.
- [x] #10 The insertion indicator is shown during a multi-selection drag over a position the drop will honour.
- [x] #11 A live board check confirms a positional batch drag sends exactly one `POST /api/tasks/move` carrying both `taskIds` and `orderedTaskIds`, and that the cards land at the dropped index.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-read the `orderedTaskIds` contract in `core.moveTasksToStatus` (every moved task named, duplicates rejected, failed ids skipped) and the insertion math the single-card drop path already runs in `TaskColumn.handleDrop`.
2. Endpoint: read the optional field, forward it when it is present, and map the contract violations to a client error.
3. Payload: add the field to `MoveTasksPayload`.
4. Board: memoise the selection in board reading order, hand it to the columns, and assemble the request so the named order carries every id the board can place.
5. TaskColumn: resolve one insertion index for both single and batch drops, splice the lifted cards there, and retire the manual sort whenever the order actually changed.
6. Tests: endpoint cases for positional versus append, for a failed id and for a broken order; JSDOM cases for insertion, empty-space append, same-column reposition, in-place release, board order and the indicator.
7. Verify per clause: mutate each clause, confirm its guarding case turns red, and leave the sources restored.
8. Live-check the drag over CDP: exactly one request carrying both fields, with the cards at the dropped index.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
What changed
- `src/server/index.ts` (`handleMoveTasks`): reads an optional `orderedTaskIds`, forwards it only when it is non-empty, and treats "orderedTaskIds must include every task being moved" and "Duplicate task ID in orderedTaskIds" as client errors (400) next to the existing "required" check.
- `src/web/lib/api.ts`: `MoveTasksPayload.orderedTaskIds?: string[]`. The client serialises the payload as-is, so nothing else was needed.
- `src/web/components/Board.tsx`: a `selectionOrderIds` memo (the selection in board reading order) replaces the per-call recomputation in `handleBatchMove` and rides along in `selectionProps`. `handleBatchMove` takes an optional third argument, builds the request ids from the memo, keeps ids the board cannot place inside the request (appended to the named order so the server still reports them per task), and skips its status-based no-op test when the drop named an order — the drop handler has already established that it moves.
- `src/web/components/TaskColumn.tsx`: one `resolveInsertion` helper maps a drop to the index the lifted cards take in the display order without them (anchoring on the hovered card, shifting back by every lifted card ahead of it, appending over empty space); single and batch drops both use it. `isDragFromSameColumn` (status plus lane) replaces the status-only comparison, the sort is retired after the unchanged-order guard instead of before the selection branch, and the insertion indicator is no longer suppressed for batch drags — hovering a card the selection is already lifting previews "stay in place" instead of promising a position.

Why the order is spliced this way
- Cards already in the column keep the order the reader sees; cards joining from elsewhere follow in board order, which is the order the batch travels in. The core seeds block ordinals between the unmoved neighbours exactly as a single-task reorder seeds its midpoint, and renumbers the column when the ordinals collide, so the written order is the previewed order.

Folding in BACK-684
- `getDisplayTasks` reads the reader's sort through a local binding that is `null` while a drag from another column is over this column (`isDragOver && !isDragFromSameColumn`), so the column renders its default order for as long as that drag is here and the order the drop writes is the order that was on screen. Standing down is a visit and not a retirement: the state is still only cleared by a drop that rewrites the order, so a drag that flies over the column on its way elsewhere - or one that is cancelled - keeps the reader's sort, and a drag that started in the column keeps the sorted view while it hovers it. Its regression cases stay; only the task record goes.

What the checks showed
- Endpoint: a positional request seeds the moved task between its new neighbours (ordinal strictly between the two), the same request without the field appends to the end, a request whose order omits a failed id still returns 200 with that id in `failures`, and an order that omits a moved task or names one twice returns 400.
- JSDOM: 47 cases green across `web-board-batch-move` and `web-task-column-sort`, covering insertion at the hovered card, append over empty space, same-column reposition, in-place release, board order over click order, the indicator and the sort retirement rule.
- Neighbours (drag and drop with hidden columns, hide-empty columns, the batch suite) green; `bunx tsc --noEmit` clean; `bun run check .` reports only the three pre-existing `assets.ts` warnings.
- Rollback matrix (`tmp/rollback-682.py`): eight variants, one per clause, each turning its guarding case red with the sources restored afterwards.
- Live board over CDP (`tmp/run-682-cdp.sh`, `tmp/cdp-682.mjs`): a two-card selection dropped above the first card of In Progress sent exactly one `POST /api/tasks/move` carrying `{"taskIds":["TASK-1","TASK-2"],"targetStatus":"In Progress","orderedTaskIds":["TASK-1","TASK-2","TASK-4","TASK-5"]}` and the column read back in that order, and an in-place release sent no request at all.
- After the fold: 16 cases in `web-task-column-sort.test.tsx`, where the drop helper now replays the `dragenter` a real drop is always preceded by, `hoverOnCard` supplies the rect JSDOM does not lay out, and four cases cover the stand-down, the order coming back when the drag leaves, the same-column exemption and the hovered index read in default coordinates; 69 cases green across the four board suites; and a four-variant rollback matrix (`tmp/rollback-684.py`) in which every guard ran red with the sources restored byte-for-byte.
- Live board over CDP (`tmp/run-684-cdp.sh`, `tmp/cdp-684.mjs`): with In Progress on ID descending, a real drag entering the column flipped the rendered order to the default one while the column menu still reported `↓ID`, one `POST /api/tasks/reorder` carried `["TASK-4","TASK-1","TASK-5","TASK-6"]`, the rendered order afterwards was the same, and the card landed on ordinal 4500 - between TASK-4 (4000) and TASK-5 (5000).

Traps worth remembering
- `isSameColumn` used to mean "same status"; with lanes a column is (lane, status), and the drag-over highlight had always compared both while the drop handler had not.
- A same-column drop in a manually sorted column used to rewrite the ordinals while the sort re-sorted the cards back, so the gesture looked inert while task files changed underneath.
- JSDOM drops have to be dispatched inside the column (bubbling only travels upwards), and setting a drop position by hovering needs the card wrapper rather than the column root.
- A drop helper that fires only `drop` cannot see anything that reads the column's own drag state: every case passed with the column still sorted. A `dragover` on the column root cannot be part of that replay either, because it clears the preview the hover had just set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web board now honours the drop position for a multi-selection, and a drop that changes a column's order always retires that column's manual sort.

- `POST /api/tasks/move` gained an optional `orderedTaskIds`, the same field the reorder endpoint already takes, and passes it to `core.moveTasksToStatus`; without it a batch still appends to the end of the column. A broken order is reported as a client error.
- `MoveTasksPayload` carries the field. `Board.handleBatchMove` builds it from a `selectionOrderIds` memo (the selection in board reading order) and leaves the request's no-op test behind when the drop named an order.
- `TaskColumn.handleDrop` resolves one insertion index for single and batch drops, splices the lifted cards there, and retires the manual sort only when the order actually changed. That covers cross-status drops, drops between lanes of the same status and same-column reorders, while an in-place release keeps the sort and writes nothing. A batch drag shows the insertion indicator again.
- A column that a drag from another column is over stands its manual sort down for the visit, so the insertion indicator and the drop both read the default order, and the sort is retired only by a drop that rewrites the order. A drag that flies over the column, or is cancelled, keeps the reader's sort.
- BACK-684's change and its regression cases are folded into this one, task record and all.

Verification: 69 cases green across the two web test files and their two neighbours (16 of them in `web-task-column-sort.test.tsx` after the fold), the endpoint cases green, neighbours green, `bunx tsc --noEmit` clean, Biome clean apart from three pre-existing `assets.ts` warnings, an eight-variant rollback matrix in which every clause turned its guard red, a live CDP drag that sent one request carrying both fields and landed the cards at the dropped index, and a live CDP drag into a manually sorted column that flipped it to the default order on entry and then landed the card at the index that order had shown.
<!-- SECTION:FINAL_SUMMARY:END -->
