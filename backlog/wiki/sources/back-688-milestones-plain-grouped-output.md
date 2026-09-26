---
title: BACK-688 milestones list --plain prints tasks grouped by milestone
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - cli
  - milestones
source_path: backlog/tasks/back-688 - milestones-list-plain-prints-tasks-grouped-by-milestone-migrate-board-m-output.md
---

# BACK-688 milestones list --plain prints tasks grouped by milestone

BACK-687 made `backlog milestones list` an interactive TUI on a TTY, leaving no plain-text way to get milestone-grouped task listings for piping or paging — the surface `backlog board -m` used to provide. This task restores that grouped output under `milestones list --plain` (and non-TTY stdout) by sharing the board's own renderer.

## Summary

- `src/cli.ts` milestone list plain branch: the inline counts summary replaced with `generateMilestoneGroupedBoard(tasks, statuses, milestones, projectName)` (from `src/board.ts`) — No Milestone section first, then milestones in file order, tasks under `### <Status> (n)` headings with id + title lines, matching `board -m`'s markdown shape exactly
- Policy aligned with `board -m` at the call site (formatter untouched): completed tasks excluded by default, `--show-completed` loads the completed folder so completed milestones get real sections; archived-milestone tasks fold into No Milestone via new shared helper `foldArchivedMilestoneTasks` in `src/core/milestones.ts` (the board loader deduplicated onto it); `hideEmptyColumns` narrows statuses like the board non-TTY branch
- `backlog board -m` itself left untouched, calling the same shared renderer — the "keep or redirect" decision resolved as keep-as-is sharing the formatter
- Docs: `CLI-INSTRUCTIONS.md` Milestone Management table and `src/guidelines/cli-instructions/milestones.md` updated (grouped plain board, `--show-completed` scope, non-TTY auto-plain; the `> result.md` redirect example later removed per user request); root-entry banner gained `draft list --plain` and `milestones list --plain` lines
- User reviewed real output and confirmed the `board -m` parity behavior (Done-status tasks in `tasks/` included; `completed/` folder excluded unless `--show-completed`) is correct as-is
- Tests: 4 grouped-output tests replace the counts-summary tests in `cli-milestone-management.test.ts`; milestone + board suites 34/34 and 33/33; live smoke confirmed `--plain` == `board -m` grouped shape (356 → 660 tasks with `--show-completed`). Repo-wide Biome kept two known pre-existing errors, so DoD #2 left unchecked

## Acceptance Criteria

- `--plain` prints tasks grouped by milestone with `### <Status> (count)` headings matching the `board -m` markdown shape
- Completed milestones collapsed by default, listed with `--show-completed`; non-TTY stdout without `--plain` behaves the same
- Existing `backlog board -m` output still works via the shared renderer; tests cover grouped output, the toggle, and the non-TTY path

## Related Concepts

- [[concepts/milestones]] — bucket ordering and archived-milestone folding rules
- [[concepts/cli-entry]] — CLI plain/non-TTY output contract
- [[concepts/cli-instructions]] — guide surfaces updated

## Related Sources

- [[sources/back-687-milestone-board-tui]] — the TUI change whose plain-output gap this fills
- [[sources/back-562-stable-json-output]] — sibling plain/machine-readable output surface conventions
