---
id: BACK-688
title: >-
  milestones list --plain prints tasks grouped by milestone (migrate board -m
  output)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-22 19:06'
updated_date: '2026-09-23 00:42'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/ui/board.ts
  - src/core/milestones.ts
  - src/formatters
documentation:
  - src/cli.ts
  - src/core/milestones.ts
  - src/test/cli-milestone-management.test.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/milestones.md
  - src/ui/root-entry.ts
modified_files:
  - src/cli.ts
  - src/core/milestones.ts
  - src/test/cli-milestone-management.test.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/milestones.md
  - src/ui/root-entry.ts
ordinal: 261400
actual_start: '2026-09-22 19:09'
actual_end: '2026-09-23 00:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-687 made `backlog milestones list` interactive TUI on a TTY, but its --plain / non-TTY output is still only a static counts summary. Restore the old grouped plain-text effect of `backlog board -m | less` (or redirect to a file) under the milestones list entry point.

Why: after the TUI change there is no plain-text way to get milestone-grouped task listings for piping, paging, or saving to a file — the surface `backlog board -m` used to provide.

Scope:
- `backlog milestones list --plain` outputs every milestone as a section (unassigned/No Milestone first, then milestones in milestone-file order) with each milestone's tasks grouped under status columns, mirroring the existing `backlog board -m` markdown rendering (task id + title lines under ### <Status> (n) headings).
- Completed milestones follow the existing `--show-completed` behavior (collapsed by default, listed when the flag is passed).
- Non-TTY stdout without --plain behaves the same as --plain (text output), consistent with BACK-687's contract.
- Reuse the existing board -m grouping/formatter logic rather than duplicating a new renderer; if `backlog board -m` becomes redundant it may be kept as-is or redirected to the same output — decide during implementation and note the choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog milestones list --plain` prints tasks grouped by milestone: No Milestone section first, then each milestone, tasks listed under ### <Status> (count) headings with id + title lines, matching the current board -m markdown shape
- [x] #2 Completed milestones stay collapsed unless --show-completed is passed, consistent with the current --plain behavior
- [x] #3 Non-TTY stdout without --plain produces the same grouped text output
- [x] #4 Existing `backlog board -m` output still works (unchanged or routed to the shared renderer)
- [x] #5 Tests cover the grouped plain output, the --show-completed toggle, and the non-TTY path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Agreed: align with board -m — plain output excludes completed tasks by default; with --show-completed, completed tasks are loaded and printed so completed milestones get real sections. Archived-milestone tasks fold into No Milestone, same as board -m. board -m itself stays untouched.

1. src/cli.ts milestone list command (plain branch, ~:4291-4342): replace the inline counts summary with the shared renderer generateMilestoneGroupedBoard(tasks, statuses, milestones, projectName) from src/board.ts:186. Apply the policy at the call site (the formatter is untouched): load tasks excluding completed by default (include them when --show-completed); map tasks on archived milestones to milestone: undefined (same preprocessing board -m uses, extracted to one shared helper if both call sites can use it); when hideEmptyColumns is set, narrow visible statuses the same way the board non-TTY branch does (src/ui/board.ts:406-422).
2. src/ui/board.ts board -m non-TTY path: unchanged, keeps calling the same formatter; both entries share generateMilestoneGroupedBoard.
3. Tests: extend src/test/cli-milestone-management.test.ts (or a new test file next to it) — plain output groups tasks under ## milestone sections with ### <Status> (n) blocks and task lines; --show-completed lists completed milestones with their tasks; non-TTY without --plain prints the same grouped text; existing board.test.ts generateMilestoneGroupedBoard cases keep passing (board -m regression).
4. Verify: bunx tsc --noEmit, bun run check on touched files, bun test for the milestone + board suites, and a live check of bun run cli milestones list --plain plus the piped board -m path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: milestone list plain branch now prints generateMilestoneGroupedBoard (shared with board -m), replacing the counts summary. Policy aligned with board -m: completed tasks excluded by default, --show-completed loads them (completed folder) so completed milestones get sections; archived-milestone tasks fold into No Milestone via new shared helper foldArchivedMilestoneTasks in src/core/milestones.ts (board loader deduplicated onto it). hideEmptyColumns narrows statuses exactly like the board non-TTY branch. Old counts-summary tests replaced with 4 grouped-output tests.
Validation: bunx tsc --noEmit clean; biome clean on touched files (repo-wide check still has the two known pre-existing errors in src/core/assets.ts / src/utils/task-path.ts, so DoD #2 left unchecked); cli-milestone-management + board.test 34/34; board-command + cli-board-integration + board-hide-empty-columns 33/33; live smoke: milestones list --plain == board -m grouped shape, --show-completed lists completed milestone sections (356 -> 660 tasks), board -m unchanged.

Docs: wrote the milestones list usage into both user guides. CLI-INSTRUCTIONS.md Milestone Management table now shows: grouped plain board (backlog milestones list --plain), --show-completed including completed-folder tasks, and piping/redirect (> result.md, | less); added a paragraph explaining the output shape, the board -m shared rendering, non-TTY auto-plain, the tasks/-only scope and the status-Done caveat. src/guidelines/cli-instructions/milestones.md (shipped ## Milestones

Milestones group tasks by iteration, version, or release cycle. They are stored as Markdown files in `backlog/milestones/` and differ from `tasks/` (specific work items).

Use Backlog.md public interfaces for milestone creation, listing, and archival so IDs, frontmatter, paths, and task relationships stay consistent.

> **Important**: Assigning a milestone name to a task via `--milestone` only records the name on the task file; it **does not create a milestone file**. To create a milestone with an ID and metadata, you must explicitly add it first using `milestone add`, then assign tasks to it.

### CLI Usage

The CLI supports adding, editing, removing, listing, and archiving milestones.

```bash
# Add a new milestone file explicitly (saved under backlog/milestones/)
backlog milestone add "Release 2.0" -d "Ship the v2.0 release"

# Edit a milestone (title, description, dates)
backlog milestone edit "Release 2.0" -t "Release 2.1" -d "Updated scope"
backlog milestone edit "Release 2.0" --due-date 2026-06-15
backlog milestone edit "Release 2.0" --planned-start 2026-06-01 --planned-end 2026-06-10
backlog milestone edit "Release 2.0" --clear-due-date --clear-planned-start --clear-planned-end

# List active milestones (shows completion ratio)
backlog milestone list

# Include completed milestones
backlog milestone list --show-completed

# Plain text output (AI-friendly)
backlog milestone list --plain

# Remove a milestone and clear, keep, or reassign its tasks
backlog milestone remove "Release 2.0"
backlog milestone remove "Release 2.0" --task-handling keep
backlog milestone remove "Release 2.0" --task-handling reassign --reassign-to "Release 3.0"

# Archive a completed milestone
backlog milestone archive "Release 2.0"
```

Archiving removes the milestone from the active list, moves its file to the archive folder, and unbinds its tasks (tasks are not deleted).

**Assigning tasks to milestones:**

```bash
# At creation
backlog task create "Feature X" -m "Release 2.0"

# Edit an existing task
backlog task edit 7 --milestone "Release 2.0"

# Clear milestone assignment
backlog task edit 7 --clear-milestone
```

The `-m` / `--milestone` option supports fuzzy matching by title, ID (e.g. `m-2`), or numeric alias (e.g. `2`).

**Board grouping by milestone:**

```bash
backlog board --milestones
```

### Key Rules

- Milestone files live under `backlog/milestones/`; archived milestones move to `backlog/archive/milestones/`.
- Milestone IDs follow the `m-N` format and are auto-assigned at creation.
- Archiving unbinds tasks but does not delete them; tasks revert to the unassigned pool.
- Prefer CLI or MCP APIs over ad-hoc file writes so frontmatter and metadata remain valid. content) list examples updated the same way, and the created/updated-date rule now points at the interactive detail view. User reviewed the actual output and confirmed the board -m parity behavior (Done-status tasks in tasks/ are included; completed/ folder excluded unless --show-completed) is correct as-is — no code change from that review.

Docs tweak: removed the '> result.md' redirect example from both guides (user request) — kept the plain grouped-board example and the non-TTY auto-plain note.

Banner: added 'backlog draft list --plain' and 'backlog milestones list --plain' lines above 'backlog task list --plain' in the root entry Common workflow section (src/ui/root-entry.ts). Verified: cli-root-entry 6/6, tsc clean, biome clean, live banner output correct.
<!-- SECTION:NOTES:END -->
