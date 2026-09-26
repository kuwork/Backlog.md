---
title: BACK-653 Remove the temp-file roundtrip in README board export
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - board-export
  - upstream-migration
source_path: backlog/tasks/back-653 - Remove-the-temp-file-roundtrip-in-README-board-export.md
---

# BACK-653 Remove the temp-file roundtrip in README board export

`updateReadmeWithBoard` wrote the generated Kanban board to a fixed `.temp-board.md` in the working directory, read it straight back, then shelled out to delete it — pure transport, and actively harmful: two exports in one directory clobbered each other, a crash left the file behind, and the cleanup deleted any unrelated user file carrying that name. This task generates the board in memory instead; the README section it produces is byte-identical.

## Summary

- `src/readme.ts` now imports `generateKanbanBoardWithMetadata` and assigns its return value directly; the temp write, read-back, and shell-based cleanup block are gone, so a board export touches no filesystem path but the README itself
- The README section assembly is untouched: BOARD_START/BOARD_END markers, License anchor, append fallback, title, subtitle, and `Generated on` timestamp behave exactly as before; `src/readme.ts` matches the upstream revision byte for byte (blob a01bd028a)
- The stray-file hazard was real, not theoretical: the pre-fix cleanup removed an unrelated `.temp-board.md`, and the new regression case fails against the old code with ENOENT
- Deliberately declined: a non-mutating `items.sort()` at `src/board.ts:101` — the array is built and discarded inside the same `generateKanbanBoardWithMetadata` call, so no caller can observe the mutation and a defensive copy would be pure cost
- Tests: new `src/test/readme-board.test.ts` (5 cases) — marker replacement, idempotent re-run, marker-less append with version suffix, README creation, and the stray `.temp-board.md` case; verified with tsc, Biome, and a revert check that puts the stray-file case back on red

## Acceptance Criteria

- `updateReadmeWithBoard` builds the board string in memory and never writes, reads, empties, or deletes `.temp-board.md`
- A board export leaves the working directory with only the files it started with, and a pre-existing `.temp-board.md` keeps its content
- The README board section is unchanged: marker replacement on re-run, License anchor, append fallback, title/subtitle/timestamp
- Regression tests cover marker replacement, idempotent re-run, append fallback, README creation, and the stray-file case (red before the fix)

## Related Concepts

- [[concepts/upstream-migration]] — ports upstream BACK-651 (commit 135bafd76) from the v1.50.1..v1.52.0 wave
- [[concepts/core-architecture]] — board generation lives in `src/board.ts`; README export in `src/readme.ts`

## Related Sources

- [[sources/back-654-board-export-grandchild-subtasks]] — sibling board-export fix from the same upstream wave
