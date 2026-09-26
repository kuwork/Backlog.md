---
title: BACK-682 Insert a web board multi-selection at a chosen position
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - web-ui
source_path: backlog/tasks/back-682 - Insert-a-web-board-multi-selection-at-a-chosen-position.md
---

# BACK-682 Insert a web board multi-selection at a chosen position

A single-card web board drop honoured the drop position, but a multi-selection drop silently appended to the column end because the batch path never passed `orderedTaskIds`. This task wires positional batch drops end-to-end and unifies the manual-sort rule: any drop that rewrites a column's order retires that column's manual sort, and a column being hovered by a foreign drag stands its sort down for the visit. BACK-684's sort stand-down change is folded into this record.

## Summary

- `src/server/index.ts` (`handleMoveTasks`): reads optional `orderedTaskIds`, forwards when non-empty, maps contract violations (order omitting a moved task, duplicate id) to 400 client errors
- `src/web/lib/api.ts`: `MoveTasksPayload.orderedTaskIds?: string[]`, forwarded untouched
- `src/web/components/Board.tsx`: `selectionOrderIds` memo (selection in board reading order) replaces per-call recomputation; `handleBatchMove` builds the order from the memo and skips its status-based no-op test when the drop named an order
- `src/web/components/TaskColumn.tsx`: one `resolveInsertion` helper maps a drop to an index for both single and batch drops; `isDragFromSameColumn` compares status plus lane (with lanes a column is (lane, status), not just status); sort retired after the unchanged-order guard; insertion indicator no longer suppressed for batch drags
- Sort stand-down (folded-in BACK-684): `getDisplayTasks` reads the reader's sort as `null` while a drag from another column is over the column, so the indicator and the drop resolve against the default order the drop will write; a fly-over or cancelled drag keeps the reader's sort
- Verification: 69 JSDOM cases across four board suites, endpoint cases, an eight-variant rollback matrix (`tmp/rollback-682.py`), and live CDP drags — a two-card drop sent exactly one `POST /api/tasks/move` carrying both `taskIds` and `orderedTaskIds`, and a drag into a manually sorted column flipped it to default order and landed the card at ordinal 4500 between neighbours
- Traps recorded: JSDOM drops must be dispatched inside the column (bubbling only travels up), and a drop helper firing only `drop` cannot see the column's own drag state — the helper must replay `dragenter`

## Acceptance Criteria

- `POST /api/tasks/move` accepts optional `orderedTaskIds`; without it append behaviour is unchanged; broken orders are 400s, failed ids land in `failures`
- A batch drop onto a card inserts the selection at that index (board order, not click order); empty space still appends; same-column reposition works and in-place release writes nothing
- Any drop that rewrites a column's order retires that column's manual sort — cross-status, cross-lane same-status, and same-column reorder alike
- Insertion indicator shown during multi-selection drags over positions the drop will honour; live CDP check confirms one request carrying both fields

## Related Concepts

- [[concepts/web-ui-features]] — board drag-and-drop and column sort semantics
- [[concepts/milestones]] — lane-aware column identity ((lane, status) not just status)

## Related Sources

- [[sources/back-680-batch-status-move]] — introduced `orderedTaskIds` in core; this task passes it from the web surface
- [[sources/back-681-tui-shift-arrow-multi-select]] — TUI consumer of the same positional primitive
- [[sources/back-504]] — origin of the manual-sort retirement rule this task generalizes
