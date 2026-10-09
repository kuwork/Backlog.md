---
id: BACK-760
title: Expose cross-branch visibility in the advanced settings page
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-08 17:23'
updated_date: '2026-10-08 18:22'
labels:
  - web-ui
dependencies:
  - BACK-759
documentation: []
modified_files:
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
ordinal: 322001
actual_start: '2026-10-08 17:23'
actual_end: '2026-10-08 17:45'
---

## Description
<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-759 turned cross-branch visibility into real configuration — `include_cross_branch` in `backlog/config.yml` (field `includeCrossBranch`, default `false`) — but the Web UI still had no switch for it. The only place that rendered a related option was the one-time initialization wizard (`src/web/components/InitializationScreen.tsx`), which is shown while creating a project, not a settings page. Editing the yml by hand was therefore the only way to flip the value.

`src/web/components/Settings.tsx` already has an **Advanced Settings** card (`{t.settings.advancedSettings}`) containing a **Task Resolution Strategy** block (`t.settings.taskResolutionDesc`, around L588-608) whose copy is exactly about *how conflicts are resolved when tasks exist on multiple branches*. Cross-branch visibility is the other half of the same question — *whether other branches enter the picture at all* — so the switch belongs directly beneath it.

The back end needed no work: `Settings` already holds a full `BacklogConfig` (with `includeCrossBranch` typed by BACK-759), and the save path is `handleSave` → `apiClient.updateConfig()` → `PUT /api/config` → `handleUpdateConfig` → `filesystem.saveConfig(updatedConfig)`, which writes whatever object it is handed as a whole. Serializing `include_cross_branch` was already part of BACK-759.

### Three controls, not one

While wiring the first switch the question came up why the server still logs "indexing N other local branches" with `include_cross_branch: false`. The answer is that scanning and *showing* are two different axes, both worth exposing:

| switch | what it controls | where |
|---|---|---|
| `check_active_branches` | whether other local branches are **scanned** at all (cost, and the ID-allocation candidate set) | `src/core/backlog.ts:4179` / `:492` |
| `include_cross_branch` | whether scanned results **enter** the board, the task list and search | query-time filtering |

Both are now on the settings page, with `active_branch_days` (`activeBranchDays`, default 30) as the third control, since it is the only knob that tunes the scan the second one enables.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Advanced Settings gains a toggle bound to `config.includeCrossBranch`, placed immediately after the Task Resolution Strategy block
- [x] #2 The toggle reuses the page's existing pattern — `sr-only peer` checkbox plus the `w-11 h-6` slider div — so it matches `autoCommit` / `remoteOperations` / `hideEmptyColumns`
- [x] #3 Unset means off, matching the `false` default; toggling it flips `hasUnsavedChanges` and enables the save button
- [x] #4 Saving writes `include_cross_branch: <value>` into `backlog/config.yml`, and re-opening the settings page reads it back identically
- [x] #5 Copy is localized: six new `settings` keys (`crossBranchTasks`, `checkActiveBranches`, `activeBranchDays` and their `...Desc`) added to `en.ts` / `zh-CN.ts` / `zh-TW.ts` / `ja.ts`. Because `TranslationDict = DeepString<typeof en>`, a missing key in any of the other three is a `tsc` error
- [x] #6 `bunx tsc --noEmit` and `bun run check .` pass
- [x] #7 A second toggle for `checkActiveBranches` (default `true`) is added, because whether other branches are scanned is controlled by it and not by `include_cross_branch`
- [x] #8 A numeric input for `activeBranchDays` (default 30) renders only while Check Active Branches is on
- [x] #9 The copy states that the two switches are different axes — cross-branch tasks decides whether results enter the list, check active branches decides whether scanning happens at all — and spells out that turning scanning off narrows task ID allocation to the current branch
- [x] #10 Saving is explicit: the controls mutate local React state only, so **Save Changes** must be clicked for anything to reach `config.yml`. Once saved, no restart is needed — `/api/tasks` resolves visibility through `resolveCrossBranchVisibility(param, await loadConfig())` on every request, and `handleUpdateConfig` broadcasts a config-updated event so the front end refetches
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `crossBranchTasks` and `crossBranchTasksDesc` to the `settings` section of `src/web/locales/en.ts`, right after `taskResolutionDesc`. `TranslationDict` is derived from `en`, so this step dictates what the other three files must carry.
2. Mirror the pair in `zh-CN.ts` / `zh-TW.ts` / `ja.ts`. Note that `zeroPaddedIdsDesc` appears twice in zh-CN / zh-TW — the new keys go only into the `settings` section, next to `taskResolutionDesc`.
3. In `src/web/components/Settings.tsx`, insert a `<div>` after the `taskResolutionStrategy` block with the same shape as its neighbours: `<label className="flex items-center justify-between">` wrapping a text block plus the toggle, bound with `checked={config.includeCrossBranch ?? false}` and `onChange={(e) => handleInputChange("includeCrossBranch", e.target.checked)}`.
4. Add the second toggle (`checkActiveBranches`) and, gated on it, the `activeBranchDays` number input — the latter is only meaningful while scanning is on, so it is not rendered otherwise.
5. Validate with `bunx tsc --noEmit` (which also proves all four locale files carry the keys) and `bunx biome check` on the touched files; run any settings-related test that exists.
6. No backend work: `handleSave` submits the whole config object and `include_cross_branch` serialization already landed in BACK-759.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### What changed

Five files, no backend work:

- `src/web/components/Settings.tsx` — three new blocks inside the Advanced Settings card, immediately after the `taskResolutionStrategy` select and before `zeroPaddedIds` (L609-670): the **Cross-Branch Tasks** toggle (L613-625), the **Check Active Branches** toggle (L631-647) and the **Active Branch Days** number input (L651-670, rendered only when the scan toggle is on). Same structure as the neighbouring toggles: `<label className="flex items-center justify-between">` wrapping a text block and the `sr-only peer` checkbox plus the `w-11 h-6` slider div.
  - `includeCrossBranch` binds `checked={config.includeCrossBranch ?? false}` — the `?? false` is required: existing `config.yml` files predate the key, and passing `undefined` to a controlled checkbox makes React treat it as uncontrolled on first render.
  - `checkActiveBranches` binds `checked={config.checkActiveBranches !== false}` — its default is `true` (`backlog.ts:465`) and the semantic is "only an explicit `false` turns it off", so a plain truthiness read would be wrong for a config that simply omits it.
  - `activeBranchDays` binds `value={config.activeBranchDays ?? 30}` (`backlog.ts:464`) and parses back with `Number.parseInt(...) || 30`; the whole block is skipped when the scan toggle is off so no meaningless input is left behind.
- Four locale files — `crossBranchTasks`, `checkActiveBranches`, `activeBranchDays` and their `...Desc`, six keys total, added to the `settings` section after `taskResolutionDesc`. `activeBranchDays` already exists under the `init` section; the two are independent. Since `TranslationDict = DeepString<typeof en>`, adding to `en.ts` first turns `tsc` into the completeness check for the other three.

### Decision: `include_cross_branch` must not stop the scan

Seeing "indexing N other local branches" with `include_cross_branch: false` looks contradictory, so the obvious fix would be to make that key stop scanning too. It must not, because one load serves both paths:

```
getActiveAndCompletedTaskIds()                     (src/core/backlog.ts:1483)
  → loadTasksWithStableBranchSnapshot()
      → shouldLoadBranches = checkActiveBranches !== false   (:4179)
      → identityIndex   ← branch entries enter the index here
```

`getActiveBranchSnapshot` returns empty tips outright when `checkActiveBranches` is false (`backlog.ts:492`). `include_cross_branch` defaults to **false**, so letting it also stop the scan would disable cross-branch loading by default: ID allocation would collapse back to local-only (the candidate set BACK-759 repaired, 705 → 749, would regress and the BACK-715 collision returns) and `task view <id-from-another-branch>` would report `not found` again.

Decision: keep the current split — scanning stays under `check_active_branches` — and expose that switch too, with copy that names the cost.

### Saving is explicit, and takes effect immediately

The page is a form, not an instant-apply surface. `handleInputChange` only mutates local state; `handleSave` (L159) validates, normalizes and calls `apiClient.updateConfig(config)`, which is `PUT /api/config` → `handleUpdateConfig` → `saveConfig`. Both Save and Cancel are disabled unless `hasUnsavedChanges` (`JSON.stringify(config) !== JSON.stringify(originalConfig)`, L188), so toggling a switch is what enables the button.

After saving, no restart is needed: every `/api/tasks` and `/api/search` request re-reads the yml (`resolveCrossBranchVisibility(searchParams.get("crossBranch"), await loadConfig())`, `src/server/index.ts:1138`), and `handleUpdateConfig` calls `broadcastConfigUpdated()` + `refreshInjectedStateMachine()`, so the board refetches its config and columns. `include_cross_branch` is also in `BOOLEAN_CONFIG_KEYS` (`src/utils/config-watcher.ts`), so external edits are picked up too.

### Why no backend change

`Settings` already holds a full `BacklogConfig`, so `includeCrossBranch` needed no new plumbing: the save path writes whatever object it is handed, and serializing `include_cross_branch` was already part of BACK-759. `hasUnsavedChanges` being a deep comparison means the save button lights up with no extra wiring.

### Verification

- `bunx tsc --noEmit` clean — also the proof that all four locale files carry the new keys.
- `bunx biome check` clean on all five files after one formatting pass.
- Live: started the server on a spare port, `GET /api/config` (field absent as expected), then `PUT` the same object with `includeCrossBranch: true` → **http 200**, and `backlog/config.yml` gained `include_cross_branch: true` at line 79. The file was backed up and restored afterwards.

### Measurement noise, not a finding

A first attempt drove the same `PUT` from a `bun -e` / bun-script `fetch` and got **404 "Not Found"**, which looks like a routing defect. Repeating the identical request with `curl` returns **200**. The route table registers `PUT` on `/api/config` unconditionally (`src/server/index.ts:694-697`), so this is a client-side quirk of driving the request from bun's `fetch` against this server, not a product bug — same family as the earlier `http=000` responses recorded in BACK-759. Prefer `curl` for live probes on this machine.

### Side effect rolled back

Running the CLI regenerated `AGENTS.md` with a 71-line state-machine block (the config now carries `when`/`ai` edges, which triggers the agent-instruction refresh). Unrelated to this task, so `git checkout -- AGENTS.md` reverted it. It will reappear on the next CLI run.
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cross-branch visibility now has a switch in the UI: Advanced Settings gains **Cross-Branch Tasks** beneath Task Resolution Strategy, bound to the `includeCrossBranch` config that BACK-759 introduced. Unset renders as off, matching the `false` default.

The change is front-end only — a toggle in `Settings.tsx` shaped like its neighbours (`?? false` matters: an absent config key would otherwise turn the controlled checkbox uncontrolled), plus six keys across `en` / `zh-CN` / `zh-TW` / `ja`. No backend work: `PUT /api/config` already writes the whole object and serializing `include_cross_branch` landed in BACK-759.

Follow-up in the same card: **Check Active Branches** and **Active Branch Days** are exposed as well, because scanning and showing are separate axes. `include_cross_branch` deliberately does not stop the scan — it shares one load with ID allocation and defaults to `false`, so making it stop scanning would silently disable cross-branch loading and bring back the ID collisions BACK-759 fixed.

Operator note: the controls edit local form state only, so **Save Changes** must be clicked for anything to reach `config.yml`. Once saved it takes effect without a restart — each request re-reads the config and the save broadcasts a config-updated event.

Verified with `tsc --noEmit` (which also proves no locale file is missing a key) and a clean biome pass on all five files; a live `PUT` returned 200 and wrote `include_cross_branch: true` into `config.yml`, which was then restored.
<!-- SECTION:FINAL_SUMMARY:END -->
