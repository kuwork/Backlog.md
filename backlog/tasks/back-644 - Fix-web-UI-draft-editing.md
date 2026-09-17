---
id: BACK-644
title: Fix web UI draft editing
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-15 13:17'
updated_date: '2026-09-17 08:23'
labels:
  - web-ui
dependencies: []
references:
  - src/server/index.ts
  - src/core/backlog.ts
  - src/web/App.tsx
  - src/web/components/TaskDetailsModal.tsx
modified_files:
  - src/server/index.ts
  - src/core/backlog.ts
  - src/web/App.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/test/server-drafts-endpoint.test.ts
  - src/test/web-draft-editing.test.tsx
priority: high
actual_start: '2026-09-17 08:02'
actual_end: '2026-09-17 08:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Editing a draft from the web Drafts page can never be saved: the page opens a DRAFT- record, but the browser task routes only resolve the task store, so GET /api/tasks/DRAFT-2 answers 404 and PUT answers 400 "Task not found: DRAFT-2" and the draft file is never written back. The drafts page has offered this click-to-edit affordance since the drafts UI shipped, so the defect is long-standing rather than a regression introduced by the current milestone.

Expected behaviour:

- Addressing stays prefix-based. The task routes serve drafts too, but only an explicit DRAFT- id addresses a draft; a prefix-less id such as /api/tasks/2 keeps naming the task with that number and can never silently retarget a same-numbered draft.
- The core already implements draft editing (Core.editTaskOrDraft / updateDraftFromInput) and the MCP task tools already use it, so the browser server is the only surface that offers a draft edit UI without draft handling behind it.
- Status semantics stay single-sourced. Promoting a draft replaces its id, and the drafts page Promote action is the surface that reports the new one, so the popup must not turn its status field into a second promote path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-634 and git show 583f928d as implementation reference.
- [x] #2 GET /api/tasks/<draft id> returns the draft instead of 404, so drafts and tasks resolve through the same task route.
- [x] #3 Saving an edit to a draft from the web Drafts page writes the draft file and keeps it a draft instead of failing with Task not found.
- [x] #4 Changing a draft status to a configured non-draft status through the task route promotes it, matching MCP semantics.
- [x] #5 A prefix-less id such as /api/tasks/2 still resolves to the task with that number, and an unknown draft id reports missing.
- [x] #6 The web drafts list reflects a saved edit without a manual reload, and the popup status field shows Draft for a draft with the field disabled.
- [x] #7 bunx tsc --noEmit, bun run check . and the scoped server / web tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Core: drop the duplicated task branch in editTaskOrDraft

- 1.1 src/core/backlog.ts: make the non-draft branch of editTaskOrDraft delegate straight to updateTaskFromInput. That method already demotes when the requested status is Draft, resolves the id against the task store (so ambiguous ids still fail closed) and reports a missing task, which removes the pre-load through fs.loadTask and the repeated demote branch.

### Phase 2 - Server: route the task endpoints by prefix

- 2.1 src/server/index.ts: add isDraftId(taskId) implemented as extractAnyPrefix(taskId) === DRAFT_PREFIX. The decision is made on the prefix rather than by probing the draft store, so a bare numeric id can never retarget a draft.
- 2.2 handleGetTask: delegate a DRAFT- id to the existing handleGetDraft so drafts and tasks share one resolution path; an ambiguous draft keeps answering 409 and a missing one 404.
- 2.3 handleUpdateTask: make the existence pre-check and the write prefix-aware. A draft is pre-checked through filesystem.loadDraft and written through core.editTaskOrDraft (a configured non-draft status promotes it); the task path keeps its current behaviour.

### Phase 3 - Web: refresh after save and the draft status field

- 3.1 src/web/App.tsx: dispatch drafts-updated from refreshData so the drafts list reloads after any data refresh, and drop the conditional dispatch in handleSubmitTask that only covered creating a draft on the drafts page.
- 3.2 src/web/components/TaskDetailsModal.tsx: StatusSelect lists the status the record actually holds first when it is not configured (a draft reads Draft instead of falling back to the first option), and the field is disabled for a draft record, which promotes nothing by itself.

### Phase 4 - Regression tests and gates

- 4.1 src/test/server-drafts-endpoint.test.ts: add cases for GET and PUT through a DRAFT- id writing the draft file back, promoting on a configured status, a prefix-less numeric id still resolving to the task, and an unknown draft id reporting missing.
- 4.2 src/test/web-draft-editing.test.tsx: cover the drafts list reloading on the shared refresh event, and the popup status field showing Draft for a draft (disabled) while a task keeps the configured statuses.
- 4.3 Gates: bunx tsc --noEmit, bun run check . and the scoped server / web test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- `src/core/backlog.ts`: the non-draft branch of `Core.editTaskOrDraft` now delegates straight to `updateTaskFromInput`, which already demotes when the requested status is Draft, resolves the id against the task store and raises `AmbiguousTaskIdError`. That removes the duplicated pre-load through `fs.loadTask` and the repeated demote branch.
- `src/server/index.ts`: added `isDraftId(taskId)`, defined as `extractAnyPrefix(taskId) === DRAFT_PREFIX`. `handleGetTask` hands a `DRAFT-` id to the existing `handleGetDraft`; `handleUpdateTask` takes its existence pre-check from `filesystem.loadDraft` and writes those ids through `core.editTaskOrDraft`. The prefix decides, never a probe of the draft store, so a bare id such as `2` still names the task with that number.
- `src/web/App.tsx`: `refreshData` dispatches the existing `drafts-updated` event, so the drafts list reloads after any save; the conditional dispatch in `handleSubmitTask` covered one path only and was removed.
- `src/web/components/TaskDetailsModal.tsx`: `StatusSelect` lists the status the record actually holds first when it is not configured, and the field is disabled for a draft record, which promotes nothing by itself.

### Verification

- `bunx tsc --noEmit` clean; `bun run check .` reports 411 files with only the 3 pre-existing non-null assertion warnings in `src/core/assets.ts`.
- `src/test/server-drafts-endpoint.test.ts`: 8 pass / 0 fail over two consecutive runs. The cases cover GET and PUT through a `DRAFT-` id writing the draft file back and keeping it a draft, promoting on a configured status, a bare numeric id still resolving to the task with that number while the same-numbered draft stays untouched, an unknown draft id reporting missing, and 409 for ambiguous draft identities.
- `src/test/web-draft-editing.test.tsx`: 4 pass / 0 fail, covering the drafts list reloading on the shared `drafts-updated` event and the popup status field for a draft and for a task.
- The server suite is slow on this drive (the slowest case sits near 5s), so the clean run above was taken with `--timeout 30000`. Under the 5s default the same case can be reported as timed out, after which the suite cleanup removes the test directory while the request is still in flight and the failure surfaces as a 404.

### Notes for review

- Draft ids are recognised by prefix instead of by probing the draft store, which is what keeps `/api/tasks/2` pointing at `TASK-2` rather than at a same-numbered draft.
- `editTaskOrDraft` now hands the raw id to `updateTaskFromInput` rather than a canonical task id, so id resolution happens once, inside that method.
- Server suites that drive a real socket (`server-demote-endpoint`, `server-task-dates-endpoint` and similar) fail identically on the unmodified tree in this environment: the test server answers 404 for `/api/tasks` although the route is registered. These new cases call the handlers directly for that reason.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Editing a draft from the web Drafts page now saves. The task routes answer a `DRAFT-` id from the draft store and write it through `Core.editTaskOrDraft`, so an edit keeps the draft a draft and a configured status promotes it, while a bare id such as `2` still resolves to the task with that number. `Core.editTaskOrDraft` lost its duplicated task branch to `updateTaskFromInput`, the drafts list reloads on the shared `drafts-updated` event after any save, and the popup status field shows a draft as Draft with the field disabled, because promoting belongs to the Drafts page. Covered by 8 server cases and 4 web cases; the type check and biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->
