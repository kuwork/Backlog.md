---
id: BACK-549
title: Hide empty status columns on Board when no tasks
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-04 07:01'
updated_date: '2026-08-07 21:57'
labels:
  - web-ui
  - migration
dependencies: []
references:
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/cli.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/config-commands.test.ts
actual_start: '2026-08-07 21:53'
actual_end: '2026-08-07 21:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a kanban board column has no tasks, hide it to reduce clutter (a common friction when a project uses 5+ statuses but most tasks live in 1–2 of them). To preserve drag-and-drop usability, empty columns reappear while a task is being dragged so they remain valid drop targets; when the drag ends, empty columns hide again.

Add a new `hideEmptyColumns` boolean to `BacklogConfig` (default `false`) so existing users see no change; opt-in users get the cleaner board. Surface the toggle in the Web UI Settings page (General Settings, right after "Auto Open Browser"), and support it in the CLI config surface (`config get` / `config set` / `config list`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-466 and git show 17ca0bf as implementation reference.
- [x] #2 Add `hideEmptyColumns?: boolean` to `BacklogConfig` in src/types/index.ts with a doc comment explaining the default-false behavior and drag-aware reveal.
- [x] #3 Persist the field as `hide_empty_columns` in backlog/config.yml via the src/file-system/operations.ts config read and write paths.
- [x] #4 Add CLI support: `backlog config get hideEmptyColumns`, `backlog config set hideEmptyColumns true|false` (validating boolean values), and include the field in `backlog config list`; update the available-keys error lists.
- [x] #5 Add a Web UI Settings toggle under General Settings (after "Auto Open Browser") using the existing toggle pattern, with localized helper text about drag behavior; add i18n keys to src/web/locales/*.ts (en/ja/zh-CN/zh-TW).
- [x] #6 Thread `hideEmptyColumns` from src/web/App.tsx → src/web/components/BoardPage.tsx → src/web/components/Board.tsx.
- [x] #7 In src/web/components/Board.tsx, derive `visibleStatuses` with useMemo: when `hideEmptyColumns` is enabled and no drag is active, return only statuses with at least one task across all visible lanes (reusing the existing `displayTasksByLane` map); otherwise return `statuses` unchanged.
- [x] #8 While a task is being dragged, all configured statuses remain visible so empty columns stay valid drop targets (reuse existing `dragSourceStatus` state; no new drag state).
- [x] #9 Replace `statuses.map(...)` rendering with `visibleStatuses.map(...)` and use `visibleStatuses.length` for the grid/flex layout so hidden columns collapse cleanly.
- [x] #10 Add a regression test round-tripping `hideEmptyColumns` through `config get/set/list` (default `false`, set true, list shows the field).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Types src/types/index.ts: add `hideEmptyColumns?: boolean` to `BacklogConfig` (placed next to `autoOpenBrowser`), with a doc comment covering default-false and drag-aware reveal.
2. Persistence src/file-system/operations.ts: parse `hide_empty_columns` in the config loader; include `hideEmptyColumns` in the in-memory config object; write `hide_empty_columns: <value>` when serializing config back to YAML (only when a boolean is set).
3. CLI src/cli.ts: `config get hideEmptyColumns` prints `true`/`false` (or `false` when unset, matching the autoOpenBrowser pattern); `config set hideEmptyColumns` validates `true|false|1|0|yes|no`; add the field to `config list` output and to both available-keys error lists in `config get` / `config set`.
4. Web Settings src/web/components/Settings.tsx: add the "Hide Empty Columns" toggle right after the Auto Open Browser option, reusing the existing toggle markup; wire `handleInputChange('hideEmptyColumns', ...)`. Add localized strings to src/web/locales/{en,ja,zh-CN,zh-TW}.ts (e.g. `settings.hideEmptyColumns` / `settings.hideEmptyColumnsDesc`).
5. Thread the value: src/web/App.tsx passes `hideEmptyColumns={config?.hideEmptyColumns ?? false}` to BoardPage; BoardPage accepts and forwards it to Board.
6. Board src/web/components/Board.tsx: add optional `hideEmptyColumns` prop (default false); derive `visibleStatuses` with useMemo — return `statuses` unchanged when `hideEmptyColumns` is false or a drag is active (`dragSourceStatus !== null`), otherwise filter to statuses having at least one task in any value of `displayTasksByLane`.
7. Rendering: replace `statuses.map(...)` with `visibleStatuses.map(...)` for both the milestone-lane grid and the flat flex layout; use `visibleStatuses.length` for `gridTemplateColumns`.
8. Tests src/test/config-commands.test.ts: add a test that `config get hideEmptyColumns` defaults to `false`, `config set hideEmptyColumns true` round-trips to `true`, and `config list` shows `hideEmptyColumns: true`.
9. Validate: `bunx tsc --noEmit`, `bun run check .`, and the focused config-commands test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core: added hideEmptyColumns?: boolean to BacklogConfig (src/types/index.ts); parse/serialize hide_empty_columns in src/file-system/operations.ts config read/write. CLI: config get/set/list for hideEmptyColumns (boolean validation true|false|1|0|yes|no), updated CONFIG_GET_KEYS/CONFIG_SET_KEYS/CONFIG_AVAILABLE_KEYS. Web: Settings toggle after Auto Open Browser (src/web/components/Settings.tsx), i18n keys in en/ja/zh-CN/zh-TW; threaded hideEmptyColumns App.tsx -> BoardPage -> Board; Board derives visibleStatuses via useMemo (filters statuses with no tasks across displayTasksByLane, keeps all columns while dragging via dragSourceStatus), rendering uses visibleStatuses for both milestone grid and flat flex layouts. Test: config-commands round-trips get/set/list. Validation: tsc --noEmit, biome check, config-commands (13 pass), board-render/web-board-filters/board-ui (14 pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented hideEmptyColumns config (default false) to hide kanban status columns with no tasks across CLI, YAML persistence, and Web UI. CLI: config get/set/list with boolean validation. Web: Settings toggle (i18n 4 locales), config threaded App->BoardPage->Board, Board computes visibleStatuses via useMemo that drops empty statuses (reusing displayTasksByLane, no extra traversal) and keeps all columns visible while a task is dragged so empty statuses remain drop targets; grid and flex layouts use visibleStatuses.length. Regression test round-trips get/set/list. Validation: tsc --noEmit, biome check clean, config-commands 13 pass, board tests 14 pass.
<!-- SECTION:FINAL_SUMMARY:END -->

<!-- SECTION:FINAL_SUMMARY:END -->
