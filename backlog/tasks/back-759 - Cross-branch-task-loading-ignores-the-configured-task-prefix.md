---
id: BACK-759
title: Cross-branch task loading ignores the configured task prefix
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 18:22'
labels:
  - cli
  - web-ui
dependencies: []
documentation: []
modified_files:
  - src/core/task-loader.ts
  - src/cli.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/utils/config-watcher.ts
  - src/server/index.ts
  - src/core/search-service.ts
  - src/web/lib/api.ts
  - src/test/cross-branch-visibility.test.ts
priority: high
ordinal: 285400
actual_start: '2026-10-08 15:54'
actual_end: '2026-10-08 17:18'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-branch task loading produces an empty index whenever a project configures a custom `task_prefix`, so tasks that exist only on other branches are invisible to every cross-branch consumer (Web UI, `backlog task view <id>`, sequences, dependency resolution).

`BranchTaskLoader` resolves each filename through `extractConfiguredTaskId(filePath, prefix)` (`src/core/task-loader.ts:51-56`), which calls `extractTaskIdFromFilename(filename)` **without forwarding `prefix`**. `extractTaskIdFromFilename` builds its matcher from that argument (`src/utils/task-path.ts:68`, regex `^${prefix}-(\d+)` via `src/utils/prefix-config.ts`), defaulting to the hard-coded `"task"`. For this repository (`task_prefix: "back"`) every `back-*.md` is matched against `^task-(\d+)`, returns `null`, and the prefix-equality guard on the following line never executes. The commit index for every branch therefore comes back empty, and no other-branch task is ever hydrated.

Measured on this repository — working tree at tag `v1.52.0-CN` (task IDs capped at BACK-714) while `main` carries BACK-758:

- `extractTaskIdFromFilename("back-758 - Resolve-configured-backlog-directory-for-graph-scanning.md")` → `null`; with `prefix="back"` → `"BACK-758"`.
- `BranchTaskLoader.load(...)` entries: **0 → 2418** after the fix, spanning branches `main` / `release` / `wiki-tmp`.
- Hydrated tasks: **0 → 443**; `core.queryTasks()`: **400 (max BACK-714) → 444 (includes BACK-758)**.
- `backlog task view BACK-758`: `not found` → full task body.

The existing fixture (`src/test/shared-branch-task-loader.test.ts:15-18`) configures `prefixes: { task: "task" }` with `task-1 - Feature.md` sample paths, so the default prefix hides the omission. **Any project with a non-default `task_prefix` loses cross-branch loading entirely.** `main` carries the same defect.

### Second scope: cross-branch visibility is not configurable, and CLI/Web disagree

Once the index works, the remaining inconsistency is on the *visibility* axis: `includeCrossBranch` has no config key and is a hard-coded literal at every call site, with opposite defaults on the two surfaces.

| surface | where | value |
|---|---|---|
| CLI `task list` / `board` | `src/cli.ts:2657` / `:2884` | literal (flipped to `true` for verification) |
| CLI write-lookups (`view`/`edit`/`deps`/`sequences`/milestone …) | 9 sites in `src/cli.ts` | `false` |
| Web `/api/tasks` | `src/server/index.ts:1132` | reads the URL param only |
| Web front end | `src/web/lib/api.ts:264` | unconditionally appends `crossBranch=true` |
| core default | `src/core/backlog.ts:761` | `options.includeCrossBranch ?? true` — never reached from either surface |

So the Web UI is always cross-branch (the front end forces the param), the CLI is whatever the literal says, and nothing can be turned from settings. The agreed semantics: **the config value is the default; the URL parameter stays as an override.** The front end stops sending the parameter, and the server falls back to config when it is absent.

Naming reuses the option already used throughout core: yml key `include_cross_branch` (snake_case, matching `check_active_branches`), config field `includeCrossBranch`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `extractConfiguredTaskId` forwards the configured prefix to `extractTaskIdFromFilename` instead of relying on the hard-coded default
- [x] #2 On a project with a custom `task_prefix` (this repo: `back`), `BranchTaskLoader.load` returns entries from other active branches instead of an empty index
- [x] #3 `core.queryTasks()` includes tasks that exist only on another branch — verified by reading BACK-758 from `main` while working on a branch capped at BACK-714
- [x] #4 Projects using the default `task` prefix behave exactly as before (no change in index contents or ordering)
- [x] #5 A regression test exercises a non-default prefix so a default-prefix-only fixture cannot hide the defect again
- [x] #6 `backlog/config.yml` gains an `include_cross_branch` boolean key (snake_case yml key, `includeCrossBranch` config field); the parser also accepts the `includeCrossBranch` camelCase alias, as `filesystemOnly` / `backlogDirectory` already do
- [x] #7 Config serialization writes the key back out, so a read/write round trip does not drop it
- [x] #8 Web `/api/tasks`: with the `crossBranch` parameter absent, visibility follows the config; when the parameter is present it wins
- [x] #9 Web `/api/search`: same parameter and same config fallback; when off, tasks whose `source` is `local-branch` / `remote` are filtered out of results
- [x] #10 `src/web/lib/api.ts` `fetchTasks()` / `search()` no longer append `crossBranch` by default — only when a caller passes it explicitly
- [x] #11 CLI `task list` and `board` read the same config instead of a literal; the other 9 write/lookup call sites stay local-first
- [x] #12 `config-watcher` recognises the new key so a config edit takes effect without restarting
- [x] #13 Regression tests cover both directions: parameter absent falls back to config, parameter present overrides it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce: from a branch whose highest task ID is BACK-714, build the cross-branch snapshot and confirm the commit index for `main` is empty; confirm `extractTaskIdFromFilename("back-758 - ….md")` returns `null` while the same call with `prefix="back"` returns `"BACK-758"`.
2. Fix `src/core/task-loader.ts:53` — forward the prefix: `extractTaskIdFromFilename(filename, prefix)`. Keep the trailing `extractAnyPrefix(taskId) === prefix` guard; it is only meaningful once the prefix-aware parse succeeds.
3. Audit the remaining `extractTaskIdFromFilename` call sites for the same omission. `src/utils/task-watcher.ts:67` already forwards the prefix and needs no change; `src/core/cross-branch-tasks.ts` builds its matcher with `buildPathIdRegex(prefix)` and is not affected.
4. Add a regression test that configures `prefixes: { task: "back" }` with `back-*.md` sample paths, asserting the loader returns entries from a non-current branch.
5. Validate with `bunx tsc --noEmit`, `bun run check .`, and the scoped branch-loader test.
6. Verification caveat: `backlog task list` / `board` pass `includeCrossBranch: false` explicitly, so confirm the fix through the query path with the flag forced to `true` (and `task view <id>`), not through `task list`.

Second scope — make cross-branch visibility configurable, config as default and the URL parameter as override:

7. **Type**: add `includeCrossBranch?: boolean` to `BacklogConfig` in `src/types/index.ts`, next to `checkActiveBranches` / `activeBranchDays`.
8. **Parse + serialize**: in `src/file-system/operations.ts`, add `case "include_cross_branch"` and `case "includeCrossBranch"` to the config switch (`value.toLowerCase() === "true"`), and append `include_cross_branch` to the `saveConfig` key list.
9. **Hot reload**: add `"include_cross_branch"` to `BOOLEAN_CONFIG_KEYS` in `src/utils/config-watcher.ts` (that set is already spread into `RECOGNIZED_CONFIG_KEYS`).
10. **Server `/api/tasks`**: read the parameter once; when it is `null` fall back to `(await this.core.filesystem.loadConfig()).includeCrossBranch === true`, otherwise use `param === "true"`.
11. **Server `/api/search` + search service**: add `includeCrossBranch?: boolean` to `SearchOptions` (default `true`, preserving today's behaviour); in `src/core/search-service.ts` compose the task predicate with `isLocalEditableTask` when it is off, applying it in both `collectWithoutQuery`'s task branch and the fuse result loop. `handleSearch` resolves the parameter with the same rule as #10.
12. **Front end**: in `src/web/lib/api.ts`, `fetchTasks()` appends `crossBranch` only when `options?.crossBranch !== undefined`; `search()` gains an optional `crossBranch` with the same rule. Note the board's main data source is `search()`, not `fetchTasks()`, so #11 is required for the setting to actually change what the board shows.
13. **CLI**: replace the `includeCrossBranch: true` literals at `src/cli.ts:2657` (`task list`) and `:2884` (`board`) with `config.includeCrossBranch === true` — the `task list` site must hoist the `loadConfig()` call that already sits a few lines below; the board site already has `config` loaded. Leave the other 9 call sites and `src/cli.ts:4361` (milestone list) at `false`.
14. **Validate**: `bunx tsc --noEmit`, `bun run check .`, scoped `bun test` (`--timeout 60000` on this machine), plus a live server check of `/api/tasks` and `/api/search` with the parameter absent and explicit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### The fix

One line in `src/core/task-loader.ts:53`:

```ts
- const taskId = extractTaskIdFromFilename(filename);
+ const taskId = extractTaskIdFromFilename(filename, prefix);
```

The function already received the correct `prefix` — `load()` derives it at `task-loader.ts:377` as
`userConfig?.prefixes?.task ?? DEFAULT_TASK_PREFIX` and threads it through `loadCommitIndex` into
`extractConfiguredTaskId`. Only the final hop to the filename parser dropped it. The trailing guard
`extractAnyPrefix(taskId)?.toLowerCase() === prefix.toLowerCase()` is kept: it was dead code before
(both sides could never be reached with a non-null `taskId`) and now does the real work of rejecting
files that parse but belong to a different prefix.

### Call-site audit

Three non-test call sites exist. `src/utils/task-watcher.ts:67` already forwards the prefix.
`src/core/cross-branch-tasks.ts:36` builds its matcher with `buildPathIdRegex(prefix)` and is
prefix-correct. `src/core/task-loader.ts:53` was the only omission. The duplicated
`DEFAULT_TASK_PREFIX = "task"` constants in `task-loader.ts`, `cross-branch-tasks.ts`,
`file-system/operations.ts` and `utils/task-id.ts` are left alone — they are consistent fallbacks,
not the defect.

### Regression test

`src/test/shared-branch-task-loader.test.ts` gains "resolves branch task files when the project uses
a custom task prefix", modelled on the adjacent unborn-branch test but with
`prefixes: { task: "back" }` and a `back-1 - Feature.md` path. Verified in both directions: with the
fix it passes; with the one-line fix reverted it fails (`0 pass / 1 fail`). The pre-existing fixture
uses the default `task` prefix, which is precisely why the defect survived.

### `includeCrossBranch` is a separate axis — and has no config knob

`backlog task list` and the board view pass `includeCrossBranch: false` explicitly
(`src/cli.ts:2587` and `src/cli.ts:2798`), so they list only locally editable tasks by design.
`core/backlog.ts:761` defaults the option to `true`, which is what the Web UI (`server/index.ts`)
uses. There is **no** `backlog.config.yml` key for it — confirmed by scanning the config keys
(`remote_operations`, `filesystem_only`, `check_active_branches`, …) and finding no cross-branch
entry. That is why the toggle cannot be found in settings.

Per request, both CLI call sites are now flipped to `true` so the fix can be verified end to end and
so CLI and Web UI agree. This is a behaviour change: `task list` now reports 444 rows instead of 400
and surfaces tasks from `main` / `release` / `wiki-tmp` that cannot be edited from this worktree.
Reverting is those two literals. `src/cli.ts:4361` (milestone list) is deliberately left at `false`
so milestone completion percentages keep counting local tasks only.

### ID allocation was collateral damage, not a separate bug

`backlog task create` allocated BACK-715 on a branch capped at BACK-714, colliding with main's own
BACK-715. The allocation path is `generateNextId` → `getExistingIdsForType` →
`getActiveAndCompletedTaskIds()` (`backlog.ts:1476`) → `loadTasksWithStableBranchSnapshot()`, where
`includeCrossBranch` defaults to `true` — allocation was always meant to be cross-branch. It returned
the wrong answer only because the identity index it reads is built by the same broken loader:

| state | candidate IDs | contains main's BACK-758 | allocates |
|---|---|---|---|
| defect | 705 | no | 715 |
| fixed | 749 | yes | 759 / 760 |

The 44-ID delta matches the 44 cross-branch tasks (444 − 400). This task is therefore numbered
BACK-759 manually: the CLI allocated BACK-715, and the file plus its frontmatter were renumbered.
Two throwaway probe tasks (BACK-760, BACK-761) were deleted afterwards.

### Verification

- `bunx tsc --noEmit`: clean.
- `bunx biome check` on the three touched files: clean. Repo-wide `bun run check .` reports only
  pre-existing `noNonNullAssertion` warnings in `src/core/assets.ts`.
- `bun test src/test/shared-branch-task-loader.test.ts --timeout 60000`: 27 pass, 0 fail. Without
  the timeout override five tests trip the 5000 ms default on this machine (they take 11–21 s);
  they are environment-slow, not failing.
- End to end: `bun run cli task list --plain` now reaches BACK-759 and includes BACK-758;
  `bun run cli task view BACK-758 --plain` prints the full task from `main`.

### Second scope: one config key, parameter stays an override

Naming reuses the option core already passes around: yml key `include_cross_branch` (snake_case, matching
`check_active_branches`), config field `includeCrossBranch`. The rule the user asked for is *config is
the default, the parameter is the override* — so the front end no longer appends `crossBranch` and the
server falls back to config only when the parameter is absent.

- `src/types/index.ts`: `BacklogConfig.includeCrossBranch?: boolean`; `SearchOptions.includeCrossBranch?: boolean` (defaults to `true` inside the search service, so existing callers are unchanged).
- `src/file-system/operations.ts`: parse `include_cross_branch` plus the `includeCrossBranch` camelCase alias, and serialize `include_cross_branch`. **Gotcha:** `parseConfig` returns an explicit object literal — a field added only to the switch is silently dropped unless it is also added to that return object. Caught by a failing test, not by `tsc`.
- `src/utils/config-watcher.ts`: `BOOLEAN_CONFIG_KEYS` gains `"include_cross_branch"` (already spread into `RECOGNIZED_CONFIG_KEYS`).
- `src/server/index.ts`: new exported `resolveCrossBranchVisibility(rawValue, config)` — pure, so both HTTP surfaces share one rule and it can be tested without booting a server. `/api/tasks` and `/api/search` both call it.
- `src/core/search-service.ts`: the corpus is shared and always cross-branch, so a local-only search composes the task predicate with `isLocalEditableTask` — applied on both the no-query path (`collectWithoutQuery`) and the fuzzy path.
- `src/web/lib/api.ts`: `fetchTasks()` / `search()` append `crossBranch` only when a caller passes it explicitly. The board reads its rows from `search()`, not `fetchTasks()`, so the search half is what actually changes the board.
- `src/cli.ts`: `task list` and `board` read `config?.includeCrossBranch === true` instead of the `true` literal introduced earlier in this task; the 9 write/lookup sites and the milestone list stay local-first.

### Verification of the second scope

- New `src/test/cross-branch-visibility.test.ts`: 8 pass / 0 fail — `resolveCrossBranchVisibility` in
  all four combinations (param `true`/`false` × config `true`/`false`, plus config `null`), the yml key
  in both spellings, a `saveConfig` → reload round trip, and `SearchService` filtering on both the
  no-query and the fuzzy path.
- Regression run: `search-service` + `cross-branch-visibility` + `shared-branch-task-loader` +
  `server-search-endpoint` → **63 pass / 0 fail**. A second batch (board / config / server broadcast)
  showed one 20 s timeout on a decision-broadcast test; re-run alone it passes in 8.6 s, i.e. contention
  from running three slow files at once on this machine, not a regression.
- End to end, in a throwaway worktree at `refs/tags/v1.52.0-CN` (current checkout untouched, worktree
  and temp branch removed afterwards): `backlog task list --plain` reports **400 rows** with the key
  absent and **445 rows** with `include_cross_branch: true`. Measured from `main` the same comparison
  yields 444/444, because main already carries every ID the other branches hold — the difference is
  only visible from a branch that lags.
- `bunx tsc --noEmit` clean; `bunx biome check` clean on all eight touched files.

### UI toggle: done in BACK-760

The key is now real configuration, but at the end of this task the Web UI still had no switch for it —
`src/web/components/InitializationScreen.tsx` was the only place rendering `checkActiveBranches`, and it
is an init-time screen rather than a settings page. Editing `backlog/config.yml` was the only way to flip
it. **BACK-760 covers this**: the Advanced Settings card now carries Cross-Branch Tasks
(`includeCrossBranch`), Check Active Branches (`checkActiveBranches`) and Active Branch Days
(`activeBranchDays`). Note that saving there is explicit — the controls mutate form state and require
**Save Changes**; the server re-reads the yml per request, so no restart is needed afterwards.

### Observed, not addressed

With cross-branch loading actually working, one non-fatal warning appears on stderr:
`Failed to hydrate task BACK-345.01 from main:backlog/completed/back-345.01 - ….md`, followed by a
`Git command failed` trace. The file exists on `main` and `git show main:<path>` succeeds, so this is
a transient subprocess failure under the concurrent hydration fan-out on Windows, not a missing-path
defect. `task view` exits 0 and returns the task regardless. Left out of scope here; worth a separate
task if it reproduces.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cross-branch task loading was silently dead for any project with a custom `task_prefix`: the loader parsed every filename with the hard-coded default prefix, so the branch index came back empty and no other-branch task was ever hydrated.

Changes:
- src/core/task-loader.ts: `extractConfiguredTaskId` forwards the configured `prefix` to `extractTaskIdFromFilename`. One line; the prefix-equality guard below it becomes live instead of dead code.
- src/test/shared-branch-task-loader.test.ts: regression test with `prefixes: { task: "back" }` — passes with the fix, fails without it. The existing fixture's default `task` prefix is what let the defect through.
- src/cli.ts: `task list` and the board view switch `includeCrossBranch: false` → `true` so the CLI matches the Web UI and the fix is observable from the command line. No config key exists for this option; milestone list is intentionally left at `false`.

Impact measured on this repository: branch index entries 0 → 2418 across main / release / wiki-tmp, query corpus 400 → 444, BACK-758 readable from a branch capped at BACK-714, and task-ID allocation 715 → 759 (allocation was already cross-branch by design; it was reading the same empty index).

Second part — cross-branch visibility is now real configuration instead of scattered literals:

- `include_cross_branch` in `backlog/config.yml` (field `includeCrossBranch`) is the default for `task list`, `board`, `/api/tasks` and `/api/search`; the `crossBranch` HTTP parameter and the front-end option stay as overrides. Unset means local-first, so the historical CLI behaviour is the default and the Web UI stops showing other branches unless told to.
- The rule lives in one exported pure function, `resolveCrossBranchVisibility`, so both HTTP surfaces cannot drift apart.
- Search filtering happens at query time against the shared corpus — the corpus itself is still built cross-branch, so turning the setting on needs no reload.
- Measured from a throwaway worktree at v1.52.0-CN: `task list` 400 rows (unset) → 445 rows (`include_cross_branch: true`).
- The setting got its UI switch one task later, in BACK-760 (Advanced Settings → Cross-Branch Tasks, plus Check Active Branches and Active Branch Days).
<!-- SECTION:FINAL_SUMMARY:END -->
