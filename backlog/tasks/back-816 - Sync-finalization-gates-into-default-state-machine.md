---
id: BACK-816
title: Sync finalization gates into default state machine
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-22 04:08'
updated_date: '2026-10-22 06:44'
labels: []
dependencies: []
modified_files:
  - src/web/locales/zh-CN.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-TW.ts
ordinal: 378001
actual_start: '2026-10-22 04:12'
actual_end: '2026-10-22 06:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The finalized backlog/config.yml adds task-finalization requires gates: `In Progress -> In Review` requires the task file to be completed per task-finalization, and `In Review -> Done` requires the task file to be verified complete per task-finalization. But `backlog init` writes the default machine from `DEFAULT_STATE_MACHINES` (src/web/locales/*), which still uses the old `finalSummary` non-empty gate and omits the `In Review -> Done` requires. New projects therefore do not get the gate. Sync all four locale default machines to the finalized edges so init writes the corrected value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 zh-CN default machine In Progress to In Review carries when set to the implementation-done event and requires set to the finalization-completion gate
- [x] #2 zh-CN default machine In Review to Done carries the finalization-verification requires gate
- [x] #3 en/ja/zh-TW default machines carry the equivalent gate localized
- [x] #4 defaultStateMachineForLocale zh-CN In Review to Done transition includes a non-empty requires
- [x] #5 bunx tsc --noEmit and existing state-machine/locale tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update zh-CN default machine: tighten `In Progress -> In Review` `when` to the implementation-done event; set its `if`/`requires` to the finalization wording; add `requires` to `In Review -> Done` (edge previously had none).
2. Mirror the same two gates in en/ja/zh-TW default machines with localized prose.
3. Verify a fresh init renders the `requires` on both edges.
4. Run tsc + locale/state-machine tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation plan fulfillment
- Step 1 (zh-CN default machine): done. Tightened `In Progress -> In Review` `when` to the implementation-done event; set its `if`/`requires` to the finalization wording; added the `requires` to `In Review -> Done` (edge previously had none).
- Step 2 (en/ja/zh-TW locales): done. Mirrored the same two gates with localized prose across all three locales.
- Step 3 (init renders the requires): done. Scripted `defaultStateMachineForLocale` for all four locales; both edges carry a non-empty `requires` (asserted ALL_GATES_PRESENT).
- Step 4 (tsc + tests): done. `bunx tsc --noEmit` passes; Biome clean on the 4 changed files; scoped `bun test` 119 pass / 0 fail (state-machine, init, state-machine editor/tree).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Synced the finalized task-finalization state-machine gates into the default machine that
`backlog init` writes, so new projects get them out of the box. The default machine lives in
`DEFAULT_STATE_MACHINES` (`src/web/locales/*`), not a copied template, and is what
`initializeProject` -> `defaultStateMachineForLocale` writes into a new project's
`config.yml`. Updated all four locales (zh-CN/en/ja/zh-TW): `In Progress -> In Review`
tightened `when` to the actual-work event and now `requires` "task file complete per
task-finalization"; `In Review -> Done` gained the "task file verified complete per
task-finalization" requires (previously absent). Verified via a direct call to
`defaultStateMachineForLocale` (ALL_GATES_PRESENT), `tsc --noEmit`, Biome on the 4 files,
and 119 scoped tests (state-machine + init + state-machine editor/tree) passing.
<!-- SECTION:FINAL_SUMMARY:END -->
