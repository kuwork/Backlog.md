---
id: BACK-694
title: Add a draft creation window to the TUI drafts session
status: In Progress
assignee:
  - '@kimi'
created_date: '2026-09-23 05:42'
updated_date: '2026-09-23 05:42'
labels:
  - tui
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/components/task-composer.ts
  - src/ui/components/help-popup.ts
  - src/cli.ts
modified_files:
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/components/task-composer.ts
  - src/ui/components/help-popup.ts
  - src/cli.ts
priority: high
ordinal: 266400
actual_start: '2026-09-23 05:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI has no place to create a draft, and the create window it does have throws a draft away.

`backlog draft list` opens the shared task-list view; the create key lives on the kanban tab and opens the task composer, which offers the configured workflow statuses and persists whatever status the form holds. So a draft can only be made by picking Draft out of the task statuses, and the result is then discarded: a created draft is left out of the session's data and answered with `Created DRAFT-n as a draft. Drafts are not shown on the task board.`, which is wrong in a session whose whole purpose is drafts.

What should exist: in a drafts session the create key opens the same composer - same layout, same fields, including the due, planned and actual dates - with the status pinned to Draft, and the created draft joins the session so it can be selected, edited and promoted from there. A task session keeps today's behaviour, including the notice that a draft created there is not one of its records.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In a drafts session the create key opens the task composer with its status pinned to a single Draft choice, while a task session keeps the configured statuses
- [ ] #2 A draft created in a drafts session joins that session (rendered in the board and selectable) and is reported as created, instead of being left out with the drafts-are-not-shown notice
- [ ] #3 A draft created from a task session is still reported as not shown on the board and stays out of that session's data
- [ ] #4 The help list opened from a drafts session names the create action for a draft, and a task session keeps its task wording
- [ ] #5 The window is the task composer itself, so a draft created there carries the same fields a task would, including the due, planned and actual dates
- [ ] #6 A targeted revert that drops the drafts-session pinning and the join turns exactly the drafts-session cases red while the task-session guard stays green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-read how the drafts session is built (the drafts command's interactive view), how the board's create key opens the composer, and how the board consumes the created record.
2. Thread the session kind from the drafts command through the unified view into the board, so one flag decides the whole create path.
3. Pin the composer's status choices to Draft in a drafts session, taking the label from the composer rather than a second literal.
4. Let a created draft join the session's data and take the ordinary created notice; keep the task-session path and its notice unchanged.
5. Cases: the composer receives a single Draft choice in a drafts session and the configured statuses otherwise; a draft created in the drafts session is rendered and selectable; a draft created in a task session is still reported as not shown and stays out of the data; the help list names the create action for drafts.
6. Verify clause by clause with a targeted revert, then the scoped suites, the type check and Biome.
<!-- SECTION:PLAN:END -->
