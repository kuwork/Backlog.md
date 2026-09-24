---
id: BACK-706
title: Stamp a milestone's actualEnd when its last task reaches a terminal status
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 21:33'
updated_date: '2026-09-24 21:51'
labels: []
dependencies:
  - BACK-705
ordinal: 276400
actual_start: '2026-09-24 21:34'
actual_end: '2026-09-24 21:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: flipping the last active task of a milestone to a terminal status stamps the milestone's actual_end, so a finished milestone no longer needs a hand-set date.

Context: the branch meant to do this (src/core/backlog.ts, updateTask, "Milestone-level auto-population", from BACK-493) can never fire. Its own guard requires the flipped task to be terminal as well, but the task set comes from fs.listTasks(), and at that moment the flipped task is still on disk with its pre-save status - saveTask runs after the whole milestone block. listTasks() only scans backlog/tasks, and the enclosing condition already guarantees the current task is non-terminal, so every(isTerminalStatus) is always false.

Evidence (throwaway corpus, two tasks in one milestone, temp print inside the branch): TASK-1 To Do -> In Progress writes the milestone actual_start (that branch does not read listTasks); TASK-1 In Progress -> Done shows listTasks returning TASK-1:In Progress, TASK-2:To Do; TASK-2 In Progress -> Done (the last one) shows TASK-1:Done, TASK-2:In Progress and writes nothing. The live repo matches: BACK-705 carries its own actual_end (the task-level branch is healthy) while m-9 has actual_start only.

Out of scope: the move-to-completed endpoint (POST /tasks/:id/complete -> fs.completeTask) is a bare rename that never touches frontmatter, so it fills neither the task's nor the milestone's actual_end; drafts and archived tasks stay invisible to listTasks() so they never block a milestone from closing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Flipping the last active task of a milestone to a terminal status writes actual_end into the milestone file, while a milestone that still has a non-terminal task gets none
- [x] #2 A milestone that already carries actual_end keeps it, and unrelated transitions (In Progress, reopening a task) leave it untouched
- [x] #3 A regression test in src/test/milestone-timestamps.test.ts covers the last-task case and the still-open case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Fix the judgement
- 1.1 src/core/backlog.ts: judge the milestone task set with the flipped task resolved to its new status (match by id on the listTasks() result), so the current task stops reading as its pre-save state.
- 1.2 Keep the write where it is and keep the existing guards: task must have a milestone, milestone must load, actual_end must not already be set.
### Phase 2 - Regression
- 2.1 src/test/milestone-timestamps.test.ts: two tasks in one milestone, completed one after the other; assert actual_end only appears after the second, and that a milestone with a leftover To Do task stays untouched.
### Phase 3 - Verify
- 3.1 bunx tsc --noEmit, plus bun test --timeout 240000 on the milestone suites.
- 3.2 Re-run the throwaway-corpus scenario from the diagnosis and confirm the milestone file gains actual_end.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
src/core/backlog.ts (updateTask, milestone auto-population): the milestone task set from fs.listTasks() now resolves the flipped task to its new status before the every(isTerminalStatus) test, so the task's own pre-save row no longer keeps the branch unreachable. The write site, its guards (task has a milestone, milestone loads, actual_end not already set) and the position of saveTask are unchanged.

Why it was dead: the enclosing guard already requires the flipped task's old status to be non-terminal, and that old status is exactly what listTasks() reads off disk (saveTask runs further down), so allTerminal could never be true. Temp instrumentation on a throwaway corpus showed listTasks() returning "TASK-1:Done, TASK-2:In Progress" while TASK-2 was being flipped to Done.

Evidence: new case "stamps actual_end once the milestone's last task reaches a terminal status" plus "keeps a milestone actual_end that is already set and ignores non-closing transitions" in src/test/milestone-timestamps.test.ts. Mutation check: reverting the substitution alone makes the new case fail at expect(reloaded?.actualEnd).toMatch(stamp) with "Received value must be a string: undefined"; restoring it turns the file green again. Live end-to-end on a throwaway corpus (own backlog/tasks + backlog/milestones + config, canonical milestone filename): with every other task already Done, flipping the last one In Progress then Done wrote actual_end: '2026-09-24 21:36' into m-1, while the intermediate state (that task still open) left the milestone without actual_end.

Gates: bunx tsc --noEmit clean; bunx biome check on both touched files clean; bun test --timeout 240000 on milestone-timestamps + milestone-filter + cli-milestone-management + cli-task-milestone + core-move-tasks-to-status = 79 pass / 0 fail (5 files), and server-milestone-broadcast + web-milestone-timestamps = 13 pass / 0 fail.

Left as-is on purpose (recorded in the description): POST /tasks/:id/complete is a bare file rename that fills neither the task's nor the milestone's date; a task created straight into a terminal status still does not close its milestone; drafts and archived tasks stay invisible to listTasks() and so never block a milestone from closing.
<!-- SECTION:NOTES:END -->
