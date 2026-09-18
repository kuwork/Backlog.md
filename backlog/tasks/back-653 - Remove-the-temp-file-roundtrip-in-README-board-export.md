---
id: BACK-653
title: Remove the temp-file roundtrip in README board export
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 21:06'
updated_date: '2026-09-18 06:56'
labels: []
dependencies: []
actual_start: '2026-09-18 06:53'
actual_end: '2026-09-18 06:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
updateReadmeWithBoard writes the generated Kanban board to a fixed .temp-board.md in the current working directory, reads it straight back, then shells out to delete it. The board string is already available in memory from generateKanbanBoardWithMetadata, so the roundtrip buys nothing and costs three failure modes: two exports in the same directory clobber each other, a crash between the write and the cleanup leaves .temp-board.md behind in the repository, and the cleanup deletes or truncates any unrelated file that happens to carry that name, because the temp path is a fixed name in whatever directory the command runs in rather than a unique scratch path.

This task generates the board in memory instead. The README section the export produces (markers, title, subtitle, timestamp, License anchoring, append fallback) stays exactly as it is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-651 and git show 135bafd76 as implementation reference.
- [x] #2 updateReadmeWithBoard builds the board string in memory and never writes, reads back, empties or deletes a .temp-board.md.
- [x] #3 A README board export leaves the working directory with only the files it started with, and an unrelated pre-existing .temp-board.md keeps its original content.
- [x] #4 The README board section itself is unchanged: it still lands between BOARD_START and BOARD_END, is replaced rather than appended on a second run, keeps the License anchor and the append fallback, and keeps the title, subtitle and Generated on timestamp.
- [x] #5 Regression tests in a new src/test/readme-board.test.ts cover the marker replacement, the idempotent re-run, the marker-less append with a version suffix, README creation, and the stray .temp-board.md case that is red before the fix.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/readme.ts, import generateKanbanBoardWithMetadata instead of exportKanbanBoardToFile, replace the exportKanbanBoardToFile call plus the Bun.file read of the temp path with a single in-memory call, and delete the cleanup block that empties the temp file and removes it with a shell command. Keep the join import, which is still needed for README.md.
2. Leave the section assembly alone: the BOARD_START/BOARD_END replacement, the License anchor and the append fallback are unrelated to the roundtrip and must not change.
3. Leave src/board.ts alone. The in-place items.sort() at line 101 mutates an array that buildKanbanStatusGroups creates inside the same call and generateKanbanBoardWithMetadata discards on return, so no caller can observe the mutation and a defensive copy would be pure cost.
4. Add src/test/readme-board.test.ts, since nothing covers updateReadmeWithBoard today: run in a temporary working directory and cover the marker replacement and board content, the idempotent re-run, the marker-less append with a version suffix, README creation, and an unrelated .temp-board.md left untouched.
5. Verify with bunx tsc --noEmit, bun run check . and the scoped test files, and revert-check the stray-file case before marking the task done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline: updateReadmeWithBoard (src/readme.ts) wrote the board with exportKanbanBoardToFile(tasks, statuses, join(process.cwd(), ".temp-board.md"), projectName), read the file straight back into fullBoardContent, then cleaned up with Bun.file(tempPath).write("") and a Bun.$ shell rm -f. exportKanbanBoardToFile (src/board.ts:316) is only generateKanbanBoardWithMetadata plus mkdir plus Bun.write, so the file was pure transport.

What the roundtrip cost, measured: the temp path is a fixed name in whatever directory the command runs in, not a unique scratch path, so the pre-fix cleanup removes whatever the user happens to have there. The new stray-file case fails on the old code with ENOENT, meaning the unrelated .temp-board.md is gone; two exports in the same directory also share one file, a crash between the write and the cleanup leaves it behind, and the cleanup itself spawned a shell.

Change: src/readme.ts imports generateKanbanBoardWithMetadata and assigns its return value to fullBoardContent; the two-line temp write plus read and the whole cleanup block are gone. Section assembly is untouched (BOARD_START/BOARD_END replacement, License anchor, append fallback, title, subtitle, extracted timestamp), so the README output is unchanged and the file now matches the upstream revision byte for byte (blob a01bd028a).

Left alone deliberately: src/board.ts:101 const sortedItems = items.sort(...). Both the analysis report and the shipped commit message call it a mutation bug, but it is not observable. items is groupedTasks.get(status), and that Map is built by buildKanbanStatusGroups inside the same call and discarded when generateKanbanBoardWithMetadata returns. The only other buildKanbanStatusGroups caller (src/ui/board.ts:112) builds its own Map, and the only other caller that passes tasks in (src/ui/board.ts:283) still sees its own array untouched. A spread copy of items would be a per-column allocation with no effect, so it was dropped.

Tests: new src/test/readme-board.test.ts (5 cases), since nothing covered updateReadmeWithBoard before. Runs in a temporary working directory and covers marker replacement and board content (the Kanban Board Export header stays out of the README), the idempotent re-run, the marker-less append with a version suffix, README creation, and the stray .temp-board.md case.

Verification: bunx tsc --noEmit clean; bun run check . 417 files, 0 errors (the 3 noNonNullAssertion warnings in assets.ts predate this change); board.test.ts + board-command.test.ts + board-render.test.ts + readme-board.test.ts 22 pass / 0 fail; cli-board-integration.test.ts 3 pass / 0 fail.

Revert check: restoring the pre-fix src/readme.ts (blob c856223f8) makes the stray-file case fail with ENOENT: no such file or directory, open ...temp-board.md while the other four stay green, because the old happy path did clean up after itself.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
updateReadmeWithBoard no longer touches the filesystem beyond the README itself: the board string comes straight from generateKanbanBoardWithMetadata instead of being written to .temp-board.md, read back and shelled out to be removed. The README section is unchanged - markers, License anchor, append fallback, title, subtitle and timestamp all behave as before - and src/readme.ts now matches the upstream revision byte for byte (blob a01bd028a).

The roundtrip was not merely redundant. The temp path is a fixed name in the directory the command runs in, so the pre-fix cleanup deleted any unrelated .temp-board.md the user had there: the new stray-file case fails with ENOENT against the old code and passes now. Concurrent exports no longer share one file, and a crash can no longer leave one behind.

The analysis report also asked for a non-mutating sort at src/board.ts:101. That was measured and declined: the array sorted there is built and discarded inside the same call, so no caller can observe the mutation, and the other callers of both functions keep their own arrays.

Verified with tsc, biome (417 files, 0 errors), 22 board tests across four files plus 3 board-integration cases, and a revert check that puts the new stray-file case back on red.
<!-- SECTION:FINAL_SUMMARY:END -->
