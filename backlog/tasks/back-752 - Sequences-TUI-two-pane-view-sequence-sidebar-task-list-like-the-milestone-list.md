---
id: BACK-752
title: >-
  Sequences TUI: two-pane view (sequence sidebar + task list) like the milestone
  list
status: Done
assignee: []
created_date: '2026-10-06 11:54'
updated_date: '2026-10-06 13:00'
labels:
  - cli
  - tui
dependencies: []
modified_files:
  - src/cli.ts
  - src/ui/sequences.ts
  - src/test/sequences-view.test.ts
priority: medium
actual_start: '2026-10-06 11:50'
actual_end: '2026-10-06 12:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog sequence list` without `--plain` opens a TUI that was hand-rolled as a vertical stack of bordered blocks inside a bordered scrollable container. The nesting renders a double frame around every group, eats two columns on each side, never scrolls the cursor back into view, shows no highlight until the first arrow key, and labels the screen "read-only" while the `m` key rewrites dependencies. `backlog milestone list` already ships the layout this project uses elsewhere (a navigable sidebar pane plus a main pane, hint line, shared task popup). Bring the sequences view onto that same shape.

Scope: the interactive view only. The `--plain` text output, the headless fallback and the core layering in src/core/sequences.ts are unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interactive `sequence list` renders two panes: a left pane listing "Unsequenced" plus "Sequence 1..N" (with task counts), and a right pane listing the tasks of the focused group.
- [x] #2 Exactly one border per pane: no nested frames, and task rows start one column inside the pane border instead of being indented twice.
- [x] #3 The first paint already shows the focused row highlighted in both panes; no arrow key press is needed to discover the cursor.
- [x] #4 The task pane scrolls with the cursor in both directions (long groups no longer push the selection off screen), and the sidebar scrolls when there are more groups than rows.
- [x] #5 `m` still opens move mode with the same targets (Unsequenced, a Sequence, the gap between Sequence K and K+1); Enter applies through core.updateTasksBulk and the view recomputes and repaints.
- [x] #6 Chrome text matches behaviour: the screen is no longer labelled "read-only", the focused pane is marked, and the footer hint switches between navigate mode and move mode.
- [x] #7 `--plain`, non-TTY and CI still print the existing text output; plain text lines are byte-identical to before.
- [x] #8 Move mode explains itself: the right pane shows what Enter would write for the highlighted task and target (dependency rewrite in join semantics, the ordinal anchor, the blocked case), and states that the move sets the layer rather than the order inside it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rewrite src/ui/sequences.ts around two panes instead of a stack of blocks: left pane = box with label " Sequences " holding a blessed `list` of group rows (Unsequenced first, then Sequence 1..N, each with its task count); right pane = box labelled with the focused group holding a `list` of `ID - title` rows. Keep the headless/[--plain] text branch exactly as it is.
2. Drive both panes from one `rows` model built by a pure helper, so the geometry and the selection can be asserted in tests: `buildSequenceRows({ unsequenced, sequences })` returning `{ key, kind: "unsequenced" | "sequence", index, label, tasks }`.
3. Fix the two layout bugs the old view carried: no border on the outer container (the panes own the frames), and scroll-into-view computed from the pane height as a number (screen height minus chrome) instead of the percentage string the old code compared against.
4. Paint the highlight on first render: call the refresh routine once after the panes are mounted, so row 0 is inverted before any key press.
5. Keep `m` move mode, but on the new model: while it is on, the sidebar relabels to the move targets (Unsequenced / Sequence K / "Between Sequence K and K+1"), Enter calls planMoveToUnsequenced / planMoveToSequence / adjustDependenciesForInsertBetween, writes through core.updateTasksBulk and then reloads tasks, recomputes sequences with computeSequences and repaints both panes. Esc cancels without writing.
6. Chrome: title via formatTuiTitle("Sequences", projectName), footer hint that swaps between navigate text and "Move mode: ... Target: ...", focused pane marked by border colour like the milestone sidebar does.
7. Verify: pseudo-TTY capture rendered back to text (single frame per pane, highlight on first paint, scroll after moving down past the fold); tsc under src/ clean; scoped biome check clean.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
How the old view was diagnosed

- No TTY is available in this shell, so the interactive path was exercised by setting `process.stdout.isTTY = true` plus `columns`/`rows` in a throwaway script, redirecting stdout to a file and rendering the captured ANSI back to text with a small cursor-positioning renderer (CUP/SGR/ACS only). That reproduced the real frame, which is how the five defects below were confirmed rather than guessed.
- Old frame: a bordered `scrollablebox` holding bordered group blocks, so every group was wrapped in two frames and the rows started two columns in; block height `max(4, n + 4)` left two blank lines per block; `container.height` was the string `"100%-1"`, so `typeof === "number"` was never true and the scroll-into-view branch could not fire; nothing called the highlight routine before the first key press; the header said "read-only" while `m` rewrote dependencies.

The crash that followed the rewrite

- `refresh()` moves a list cursor with `select()`, and blessed answers every cursor move with a `select item` event. The listener called `refresh()` again, which selected again: the two drove each other until the stack blew (`RangeError: Maximum call stack size exceeded`). Blessed's emitter has no error listener, so it rethrew it as `new args[0]()` and the process died with the misleading `TypeError: RangeError is not a constructor` — which is what pressing an arrow key looked like from the outside.
- Fixed with a `syncingSelection` guard around the body of `refresh()`. Every key handler is additionally wrapped in `safe()`, so a future failure shows up in the footer instead of killing the session.

Other things the new view had to handle

- A shrinking list leaves its old rows on screen: blessed redraws the rows it has and never touches the ones below, so moving from the 18-task Unsequenced bucket to the 5-task Sequence 1 kept the tail of the bucket visible. `padToPaneHeight` pads the item list with blanks up to the pane's body height so those rows are painted over. (`screen.clearRegion` on the pane was tried first and did not clear them.)
- The terminal size is read as `process.stdout.columns || 1` by blessed; a terminal that does not report one collapses every percentage, so the view falls back to 80x24 when the reported size is missing or below 20 columns.
- Quitting now calls `screen.leave()`, `screen.destroy()` and `releaseSharedProgram()`, the same teardown the milestone and board views use. Without the release the shared program keeps stdin in raw mode and the shell is left hanging after `q`.

Shape of the new view

- Left pane: bordered box labelled ` Sequences (N) ` holding a `list` of `Unsequenced (18)` / `Sequence K (n)` rows. Right pane: bordered box labelled with the focused group holding its tasks. Footer carries the hint line. The focused pane is marked by a yellow border, matching the milestone sidebar; the unfocused pane still shows its cursor, just without the inverse highlight.
- `↑/↓` move the focused pane's cursor, `Tab`/`→`/`←` switch panes, `Enter` opens the shared task popup (or moves focus into the task list when the sidebar has it), `m` toggles move mode, `q` quits.
- Move mode keeps the previous targets — Unsequenced, a Sequence, the gap between Sequence K and K+1 — but the sidebar now lists them, opening on the target the task already sits in. Applying goes through `planMoveToUnsequenced` / `planMoveToSequence` / `adjustDependenciesForInsertBetween`, writes with `core.updateTasksBulk`, then recomputes `computeSequences` and repaints in place instead of destroying the screen and re-entering the view.
- `buildSequenceRows`, `buildMoveTargets` and `moveTargetLabel` are pure and exported so the row model, the counts and the target list can be asserted without a terminal.

Move-mode readability follow-up

- The drop targets read like "put it in this row", but a sequence is only the layer its dependencies put it in. The right pane is idle while the left pane owns the keyboard, so move mode now fills it with a preview of what Enter would write: the task, the group it comes from, the target, and the exact field changes (`dependencies -> all 2 of Sequence 1 (BACK-1, BACK-2)`, `ordinal -> 0 when unset (anchor)`, `replaced, not appended (join semantics)`, `every Sequence 2 task depends on BACK-9`, or `blocked: it still has dependencies or dependents`). Every preview ends with "This sets the layer, not the order in it: rows inside a layer follow ordinal." `buildMovePreview` is pure and exported, covered by tests.
- Making the `m` handler async introduced a regression that only showed up in the pseudo-TTY capture: the handler awaited `core.queryTasks()` before setting `targetPos`, and the await resolved *after* the next key press, so an arrow pressed during it was undone and the target snapped back to the first entry. The handler now sets the target and paints synchronously, seeds the preview from the rows already on screen (`rows.flatMap`), and only refines it with the full snapshot when it arrives — and only if move mode is still on.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog sequence list` without `--plain` now opens a two-pane view shaped like the milestone list: a ` Sequences (N) ` sidebar listing the Unsequenced bucket and every sequence with its task count, a main pane listing the tasks of the highlighted group, and a footer hint. The focused pane is marked with a yellow border. `↑/↓` move the focused cursor, `Tab`/`→`/`←` switch panes, `Enter` opens the shared task popup, `m` toggles move mode and `q` quits.

Rewritten `src/ui/sequences.ts` around two blessed panes instead of a stack of bordered blocks inside a bordered container, which removes the double frame, restores two columns of width, paints the cursor highlight on the first frame and scrolls with the cursor. Move mode keeps its three targets (Unsequenced, a Sequence, the gap between Sequence K and K+1); applying writes through the existing `planMoveTo*` helpers and `core.updateTasksBulk`, then recomputes and repaints in place.

Verified: pseudo-TTY capture rendered back to text at 120x40 and 120x14 — single frame per pane, cursor visible on first paint, right pane scrolls after 14 steps down in a 14-row window, move mode relabels the sidebar to `Unsequenced`/`Sequence 1`, `q` closes cleanly (`VIEW CLOSED`, exit 0). New `src/test/sequences-view.test.ts` covers `buildSequenceRows`, `buildMoveTargets`, `moveTargetLabel` and the headless text branch: 6 pass. Sequence suites (core + view) 651 pass / 0 fail. `bunx tsc --noEmit` reports no errors under `src/` (the only hits are the unrelated `mikesigs/`, `myran/` forks) and `bunx biome check` is clean on the three touched files. `sequence list --plain` output is unchanged.

Verification note (commands actually run): `bunx tsc --noEmit` — no errors under `src/` (the only remaining hits are the unrelated `mikesigs/` and `myran/` forks in the working tree). `bunx biome check src/ui/sequences.ts src/cli.ts src/test/sequences-view.test.ts` — clean; the repo-wide `bun run check .` still reports errors in files nobody touched (checked out with CRLF line endings on Windows), which is pre-existing and unrelated. `bun test src/test/sequences-view.test.ts` — 13 pass / 0 fail; the sequence suites together (core layering, move, reorder, insert-between, unsequenced eligibility, view) — 658 pass / 0 fail. Interactive verification used a pseudo-TTY capture rendered back to text, because this shell has no TTY.

Move mode also carries its own explanation now: while the left pane lists the drop targets, the right pane shows a preview of what Enter would write for the highlighted task — the source group, the target, the exact field changes (`dependencies -> all 2 of Sequence 1 (BACK-1, BACK-2)`, `ordinal -> 0 when unset (anchor)`, `every Sequence 2 task depends on BACK-9`, or `blocked: it still has dependencies or dependents`) — and ends by saying the move sets the layer, not the order inside it, because rows inside a layer follow `ordinal`. `buildMovePreview` is a pure exported helper with 7 new tests (13 pass in `src/test/sequences-view.test.ts`).
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

- `src/ui/sequences.ts` — rewritten. Two blessed panes (group sidebar + task list) replace the nested stack of bordered blocks; `buildSequenceRows` / `buildMoveTargets` / `moveTargetLabel` are new pure helpers so the row model can be asserted without a terminal; `buildMovePreview` renders the move-mode explanation (target, dependency rewrite in join semantics, the ordinal anchor, the blocked case) into the idle right pane; `syncingSelection` guard plus `safe()` key wrappers stop the `select()`/`select item` recursion; `padToPaneHeight` clears rows left behind by a shrinking list; teardown now calls `screen.leave()` / `screen.destroy()` / `releaseSharedProgram()`. The `m` handler sets the target and paints synchronously before any await, so a key pressed during the snapshot fetch is not undone afterwards.
- `src/cli.ts` — passes `projectName` into `runSequencesView` so the screen title matches the other TUI views. The `--plain` / non-TTY / CI text branch is untouched.
- `src/test/sequences-view.test.ts` — new. 13 tests: `buildSequenceRows` (ordering, counts, ordinal-then-id task membership), `buildMoveTargets` (gap only between consecutive sequences, no bucket row without one), `buildMovePreview` (source/target naming, dependency replacement, the Sequence 1 anchor, the inserted layer for a between target, the blocked Unsequenced drop, and the standing note that the move sets the layer rather than the order), and the headless plain-text branch.
- `backlog/tasks/back-752 - ...md` — this task record.
