---
id: BACK-646
title: Add Web UI demote-to-draft action
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-04-25 12:14'
updated_date: '2026-09-17 15:49'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/lib/api.ts
modified_files:
  - src/web/lib/api.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/Modal.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-task-details-modal-demote.test.tsx
priority: medium
actual_start: '2026-09-17 15:42'
actual_end: '2026-09-17 15:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web task popup can demote a local active task to a draft, but the action is fire-and-forget. Three gaps make it unsafe once anything goes wrong:

- `apiClient.demoteTask` uses the shared `fetchWithRetry` path, which retries three times. Demotion is not idempotent — each attempt allocates a fresh draft id and moves the file — so a lost response or a post-move server error is replaced by a later failure, and the user is told the wrong thing about the state on disk.
- `handleDemote` is not bound to the task identity it started with. If the popup switches task or closes while the request is in flight, the stale continuation still refreshes the view and closes the popup, and because no `demoting` state exists, every other write (save, complete, archive, promote, comment, criteria/DoD toggles, inline metadata, task type, keyboard shortcuts) can still be triggered while the move is running.
- A failure only echoes the raw message, so a lost response reads the same as a rejected request even though the two need opposite follow-up.

Expected behaviour:

- A non-idempotent mutation must not be retried automatically; the original server error has to survive.
- A demotion is bound to the identity captured when it started (task id, source, branch, draft-vs-task, open state). A continuation that runs after that identity changed is discarded and must not close the popup or refresh a view it no longer owns.
- While a demotion is running, other writes and closing are blocked, a second demotion cannot start, and the buttons that would trigger them are disabled.
- A lost response is reported as "may have succeeded", with the views refreshed so the user can verify the drafts list before retrying; a genuine rejection keeps its own message.
- A demotion conflict (ambiguous id, create lock, task lock) is reported as a conflict rather than a generic server failure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-419 and git show 5ba37fca1 as implementation reference.
- [x] #2 Demotion no longer uses the retrying request path, so a lost response or a post-move server error surfaces as the original error instead of being replaced by a later failure.
- [x] #3 An in-flight demotion is bound to the identity captured when it starts; a continuation that runs after the popup switches task or closes is discarded and cannot close or refresh a view it no longer owns.
- [x] #4 Other writes (save, cancel-edit, complete, archive, promote, comment, criteria and DoD toggles, inline metadata, deleting or clearing comments) and closing are blocked while a demotion runs, the keyboard shortcuts are ignored, and a second demotion cannot start.
- [x] #5 A lost response during demotion warns that the request may have succeeded and refreshes the views so the task and drafts lists can be verified before retrying, instead of reporting a plain failure.
- [x] #6 Tests cover the stale-identity guard, the blocked writes, the non-retrying request and the network-failure warning.
- [x] #7 bunx tsc --noEmit, bun run check . and the scoped web tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - API client: a non-retrying path for non-idempotent mutations

- 1.1 `src/web/lib/api.ts`: give `fetchWithRetry` an explicit retry-override argument and add `fetchWithoutRetry`, which calls it with zero retries.
- 1.2 `src/web/lib/api.ts`: move `demoteTask` onto that non-retrying path, because each attempt allocates a fresh draft id and moves the file.

### Phase 2 - Modal: bind the demotion to the task identity

- 2.1 `src/web/components/TaskDetailsModal.tsx`: derive a demotion identity from the open state plus the task id, source, branch and draft-vs-task flag, keep it in a ref, and store the in-flight request in an `activeDemotionRequest` ref. Every continuation after an await re-checks that both the ref and the request still match before touching state, refreshing or closing.
- 2.2 add a `demoting` state. While it is set: block save, cancel-edit, complete, archive, promote, comment, criteria and DoD toggles, inline metadata, comment deletion and clearing; ignore the `d`, `c`, `e` and `p` shortcuts; disable the action buttons; keep Escape and the close button from closing; and refuse a second demotion.
- 2.3 on success, dispatch the `drafts-updated` event, refresh, then close. If the refresh itself throws, warn that the task moved but the view did not refresh instead of closing silently.
- 2.4 on failure, tell a lost response apart from a rejection: for a network error, warn that the demotion may have succeeded, refresh the views so the user can verify the drafts list, and keep the original record open; for a server error, show the server message.
- 2.5 `src/web/locales/{en,ja,zh-CN,zh-TW}.ts`: add the in-progress label and the two warnings so the popup keeps its existing i18n contract.
- 2.6 `src/web/components/Modal.tsx`: let the header and its action row wrap, so the extra action does not clip the title or the buttons at narrow widths.

### Phase 3 - Regression tests and gates

- 3.1 `src/test/web-task-details-modal-demote.test.tsx`: cover the stale-identity guard, the blocked shortcuts and second demotion, the non-retrying request, the network-failure warning and the successful refresh-and-close path.
- 3.2 Gates: `bunx tsc --noEmit`, `bun run check .`, and the scoped web test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- `src/web/lib/api.ts`: `fetchWithRetry` takes an explicit retry override and the new `fetchWithoutRetry` calls it with zero retries; `demoteTask` moved onto that path, because every attempt allocates a fresh draft id and moves the file.
- `src/web/components/TaskDetailsModal.tsx`: added a demotion identity (open state, task id, source, branch, draft-vs-task), a ref holding the in-flight request and a `demoting` state. `handleDemote` binds every continuation after an await to both, so a response that lands after the popup switched task or closed is dropped instead of closing or refreshing a view it no longer owns. On success it dispatches `drafts-updated`, refreshes and closes; if the refresh itself fails after the move it warns instead of closing silently; a network error warns that the response may have been lost and refreshes the views first; a real rejection keeps the server message.
- The popup blocks every other write while the move runs: save, cancel-edit, complete, archive, promote, adding, deleting and clearing comments, criteria and DoD toggles, and inline metadata. The `d`, `c`, `e` and `p` shortcuts return early, the action buttons are disabled, Escape and the close path are ignored, and a second demotion cannot start.
- `src/web/locales/en.ts`, `ja.ts`, `zh-CN.ts`, `zh-TW.ts`: added the in-progress label and the two warnings so the popup keeps its existing i18n contract.
- `src/web/components/Modal.tsx`: the header and its action row now wrap, so the extra action cannot clip the title or the buttons at narrow widths.

### Scope decision

The upstream commit also reports a `demotionState` for a move that succeeded before a follow-up failure, and classifies a demotion conflict as 409 for an ambiguous id, a create lock or a task lock. Neither was ported. In this fork `FileSystem.loadTask` catches an ambiguous identity and answers as a missing record, `fs.demoteTask` only rethrows a create-lock error, and `Core.demoteTask` returns a draft id instead of carrying a failure state, so both branches would be unreachable here. The web-side resilience, which is the actual increment of this item, was ported in full.

### Verification

- `bunx tsc --noEmit` clean; `bun run check .` reports 411 files with 0 errors and only the 3 pre-existing non-null assertion warnings in `src/core/assets.ts`. The new locale keys needed one biome reflow pass (the formatter wanted the two long values on their own lines).
- `src/test/web-task-details-modal-demote.test.tsx` (new): 5 pass, covering the single-request failure path (a replayed demotion is what the fix removes), a response that lands after the popup switched task, the lost-response warning, the blocked buttons/shortcuts/second demotion, and the refresh-and-close path.
- Scoped web run: 55 pass / 0 fail across the new file, the drafts page suite and the seven other task-popup suites.

### Notes for review

- The popup dispatches `drafts-updated` through the bare global, so the test bridges `CustomEvent` to the jsdom realm before rendering; without that the dispatch throws inside the success path and the refresh assertions fail rather than the code under test.
- The demote button now reads `Demoting…` while the move runs, which is also what the blocked-state case asserts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web demote action no longer fires and forgets. It requests the move without retrying, binds every continuation to the identity it started with, blocks the other writes, shortcuts and closes while it runs, refreshes and closes on success, and tells a lost response apart from a rejection so the user verifies the drafts list instead of being told the demotion failed. The popup header wraps so the extra action cannot clip. Covered by 5 new popup cases plus a 55-case scoped web run; type check and biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->
