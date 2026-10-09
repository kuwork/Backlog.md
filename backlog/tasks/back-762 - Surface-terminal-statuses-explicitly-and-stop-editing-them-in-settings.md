---
id: BACK-762
title: Surface terminal statuses explicitly and stop editing them in settings
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-09 02:45'
updated_date: '2026-10-09 03:51'
labels:
  - config
  - web-ui
  - cli
dependencies: []
modified_files:
  - src/cli.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/server-statuses-endpoint.test.ts
  - src/guidelines/cli-instructions/overview.md
ordinal: 324001
actual_start: '2026-10-09 02:56'
actual_end: '2026-10-09 03:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing tells you which columns are terminal. `backlog config list --plain` prints `statuses: [To Do, Planning, ..., Done, Dropped]` and nothing else, so deciding whether a task counts as finished means opening backlog/config.yml and reading every `category`; /api/statuses returns bare names that carry no category at all. Meanwhile the settings page offers a "terminal status" multi-select that writes `category` behind your back - a second entry point competing with the state-machine editor, which edits the very same field. Result: the terminal set is simultaneously invisible in the read paths and editable from a place that pretends it is its own concept.

Make the derived set explicit in every config read path and make the settings page show it read only. Terminality stays a property of a column's category in backlog/config.yml; the state-machine editor remains the only UI that changes it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog config list` prints a `terminalStatuses: [Done, Dropped]` line derived from the project's statuses
- [x] #2 GET /api/config returns a read-only `terminalStatuses` array alongside the stored config
- [x] #3 GET /api/statuses returns both the name list and the derived terminal set, and the web client still reads the names when either shape comes back
- [x] #4 The settings page renders the terminal set read only: no picker, no writes, and a line saying it comes from each column's category in the state machine
- [x] #5 Nothing that is derived is written back to backlog/config.yml: saving settings still serializes exactly the keys it did before
- [x] #6 The state-machine editor remains the only UI that can change whether a status is terminal, by editing its category
- [x] #7 A project whose statuses are a plain string array still reports one terminal - the last column - matching the legacy rule
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/cli.ts - print a `terminalStatuses: [Done, Dropped] (derived from statuses)` line right after the `statuses` line in `config list`, resolved with `getTerminalStatuses(config.statuses ?? [...DEFAULT_STATUSES])`; update the command's help-schema `output` so generated guidance says it is included.
2. src/server/index.ts - GET /api/config returns `{ ...config, terminalStatuses }` by spreading, so the derived value never lands on the cached config object; GET /api/statuses returns `{ statuses, terminalStatuses, defaultStatus }` instead of a bare array, with the legacy fallback list still used when the project declares no statuses.
3. src/web/lib/api.ts - `fetchStatuses` keeps returning `string[]` and accepts either shape (array from an older server, object from a current one), so nothing downstream has to change.
4. src/web/components/Settings.tsx - replace the terminal multi-select with a read-only block showing the set (or the translated "none"); delete `handleTerminalStatusesChange` and `asStatusDefinitions`, and drop the now-unused imports.
5. src/web/locales/{en,zh-CN,zh-TW,ja}.ts - rewrite `stateMachine.terminalStatusDesc` to say the set is derived from each column's category and edited in the state machine.
6. src/test/server-statuses-endpoint.test.ts - assert the new payload shape, add a string-array case, a case proving `default_status` wins over the initial category, and a case proving posting the /api/config body back does not write `terminalStatuses` into config.yml.
7. Verify with `bunx tsc --noEmit`, `bunx biome check`, the statuses endpoint suite, and the wider `bun test src/test src/web` run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

Derived values now travel with the config that produced them, and the one UI that let you edit them by accident is read only.

- src/cli.ts - `config list` prints `terminalStatuses: [Done, Dropped] (derived from statuses)` immediately after the `statuses` line, resolved by `getTerminalStatuses(config.statuses ?? [...DEFAULT_STATUSES])`. The `(derived from statuses)` suffix is there so nobody mistakes it for a key they can set. The commands help-schema `output` now says the derived values are included, because that text is what gets injected into the AI guidance files.
- src/server/index.ts - `GET /api/config` answers `{ ...config, terminalStatuses }`. The spread matters: `handleUpdateConfig` hands whatever it receives straight to `saveConfig`, so putting the value on `config` itself would let a client plant it in `config.yml`. `GET /api/statuses` grows from a bare `string[]` to `{ statuses, terminalStatuses, defaultStatus }` - it is the light-weight exit that previously carried no category at all, so its callers could not resolve terminality even in principle. `defaultStatus` falls back to the machines `initialStatus()` and then to the first column, and `default_status` always wins when it is set.
- src/web/lib/api.ts - `fetchStatuses()` still returns `string[]`; it accepts both shapes so an older server or a fixture keeps working and nothing downstream changes.
- src/web/components/Settings.tsx - the multi-select is replaced by a read-only block showing the set (or the translated "none") with a line saying it comes from each columns `category`. `handleTerminalStatusesChange` and `asStatusDefinitions` are gone, along with the imports they were the only users of.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts - `stateMachine.terminalStatusDesc` rewritten from instructions for a picker into an explanation of where the value comes from and where to change it.
- src/guidelines/cli-instructions/overview.md - the "read the live project state" line now names `terminalStatuses`, and the object-form section says to read the resolved list instead of guessing from a name or a column position. This is the text an agent reads, which is exactly who used to guess wrong.
- src/test/server-statuses-endpoint.test.ts - three new cases: the new `/api/statuses` payload, the string-array machine reporting only its last column, and `default_status` winning over the initial category. Plus one case that POSTs the `/api/config` body straight back and asserts `terminalStatuses` never reaches `backlog/config.yml`.

### Why the settings page stops being an editor

It was a second entry point onto the same field. The multi-select did not store a list of terminal statuses anywhere; it rewrote each selected columns `category` to `done` (adding `exit: complete`) and reset the unselected ones to `active`. The state-machine editor edits that same `category` directly. Two controls writing the same field is how a concept that does not exist ("the terminal statuses setting") gets believed. Removing the picker leaves one writer, and the read-only line points at it.

### Why nothing derived lands in config.yml

`serializeConfig` writes only keys it knows, so an unknown field cannot survive a save. The new test pins that behaviour rather than relying on it: it takes the body `/api/config` just returned, POSTs it to the save route, and asserts the config read back from disk has no `terminalStatuses`.

### Verification

- `bunx tsc --noEmit` clean; `bunx biome check` clean on every touched file.
- `bun test src/test/server-statuses-endpoint.test.ts` - 11 pass / 0 fail.
- `bun src/cli.ts config list --plain` on this repo now prints `terminalStatuses: [Done, Dropped] (derived from statuses)`, which is what its config declares with `category: done` and `category: dropped`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every read path now answers "which columns are terminal" instead of leaving you to infer it. `backlog config list --plain` prints `terminalStatuses: [Done, Dropped] (derived from statuses)` next to the `statuses` line; `GET /api/config` carries the same list; `GET /api/statuses` returns `{ statuses, terminalStatuses, defaultStatus }` instead of a bare name array that could not express terminality at all. The AI guidance the CLI injects now tells the reader to consult that list rather than assume a name or a column position.

The settings page no longer edits it. The old multi-select wrote `category` behind the scenes while the state-machine editor wrote the same field directly - two controls, one field, and no such thing as a "terminal statuses" setting. The page now shows the resolved set read only and says where to change it.

Nothing derived reaches `backlog/config.yml`: the terminal set is computed per request, `serializeConfig` only writes keys it knows, and a test POSTs the API body straight back to prove it. The web client accepts either response shape, so an older server keeps working.
<!-- SECTION:FINAL_SUMMARY:END -->
