---
id: BACK-517
title: Fix i18n string fragmentation in milestone expand/collapse button
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-08 15:18'
updated_date: '2026-06-08 15:35'
labels:
  - web-ui
  - bug
  - milestones
  - i18n
dependencies: []
priority: medium
ordinal: 2000
actual_start: '2026-06-08 15:20'
actual_end: '2026-06-08 15:35'
---

## Description

On the Milestones page, the expand/collapse button is built by concatenating two separate locale fragments:

```tsx
{isExpanded ? t.milestones.hideTasks : t.milestones.showTasks} {t.milestones.tasks}
```

This is an i18n anti-pattern that produces broken or unnatural results in every locale:

| Locale | `hideTasks` | `tasks` | Result | Issue |
|--------|-------------|---------|--------|-------|
| en | `"Hide"` | `"tasks"` | `"Hide tasks"` | Works by accident, but still fragile fragmentation |
| zh-CN | `"隐藏"` | `"个任务"` | `"隐藏 个任务"` | Unnatural spacing + measure word |
| zh-TW | `"隱藏"` | `"個任務"` | `"隱藏 個任務"` | Same issue |
| ja | `"非表示"` | `"件のタスク"` | `"非表示 件のタスク"` | **Completely nonsensical** — "件のタスク" requires a number prefix |

## Root Cause

`showTasks` / `hideTasks` are partial verb fragments, and `tasks` is a separate noun fragment. Different languages have different word order, spacing, and grammatical conventions. A translator cannot produce a natural result when a sentence is split into pieces that must be concatenated at runtime.

## Fix

Make `showTasks` and `hideTasks` complete phrases that include the noun, so no concatenation is needed:

- `en`: `"Show tasks"` / `"Hide tasks"`
- `zh-CN`: `"显示任务"` / `"隐藏任务"`
- `zh-TW`: `"顯示任務"` / `"隱藏任務"`
- `ja`: `"タスクを表示"` / `"タスクを非表示"`

In `MilestonesPage.tsx`, render the button label with a single key:
```tsx
{isExpanded ? t.milestones.hideTasks : t.milestones.showTasks}
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `showTasks` and `hideTasks` are changed to complete phrases in `en.ts`
- [x] #2 `showTasks` and `hideTasks` are changed to complete phrases in `zh-CN.ts`
- [x] #3 `showTasks` and `hideTasks` are changed to complete phrases in `zh-TW.ts`
- [x] #4 `showTasks` and `hideTasks` are changed to complete phrases in `ja.ts`
- [x] #5 `MilestonesPage.tsx` removes the `t.milestones.tasks` concatenation and uses a single locale key
- [x] #6 No visual regression in any supported locale
<!-- AC:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Update `showTasks` and `hideTasks` in all locale files (`en.ts`, `zh-CN.ts`, `zh-TW.ts`, `ja.ts`) to complete phrases that embed the noun
2. Remove the `t.milestones.tasks` concatenation in `MilestonesPage.tsx` button rendering
3. Delete the now-unused `tasks` key from all locale files (value identical to `taskPlural`)
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
The root cause was an i18n string-splitting anti-pattern: `showTasks`/`hideTasks` were verb fragments concatenated with `tasks` (a noun fragment) at runtime. This breaks in languages where word order, spacing, or measure words differ from English.

- `ja.ts` was the most broken: "非表示 件のタスク" is nonsensical because "件のタスク" requires a numeric prefix (e.g. "3件のタスク")
- `zh-CN`/`zh-TW` had unnatural spacing + measure word: "隐藏 个任务"
- `en.ts` worked by accident ("Hide" + "tasks" = "Hide tasks") but remained fragile

The fix eliminates runtime concatenation entirely by making each locale key a complete phrase. The redundant `tasks` key was also removed because it had zero code references and its value was identical to `taskPlural` in every locale.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
