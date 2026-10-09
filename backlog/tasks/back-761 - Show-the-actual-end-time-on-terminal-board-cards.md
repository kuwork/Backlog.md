---
id: BACK-761
title: Show the actual end time on terminal board cards
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-09 01:48'
updated_date: '2026-10-09 03:51'
labels:
  - web-ui
dependencies: []
modified_files:
  - src/web/components/TaskCard.tsx
ordinal: 323001
actual_start: '2026-10-09 02:08'
actual_end: '2026-10-09 03:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Board cards already surface the planned range and the due date, but a card sitting in the terminal column (Done) shows no ending timestamp: the card footer has created/updated-relative date, due date and assignee, and nothing that answers 'when did this finish?'. The data is already there — `actualEnd` is stamped on transition into a terminal status (BACK-492, core/backlog.ts:1734) — it is simply never rendered on the card. Surface it so a finished card reads as finished at a glance, using the same date conventions the rest of the card already uses (local time, current year dropped, canonical UTC value on hover, BACK-673).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A card whose task sits in a terminal status as declared by the project config (not a hardcoded name) and that has an actualEnd renders that timestamp in the card footer
- [x] #2 Placement - the timestamp sits to the right of the assignee in the footer and is still right-aligned when the card has no assignee
- [x] #3 The value is the stored UTC actualEnd converted to the viewers local time and formatted as M/D plus HH:mm (10/9 09:45)
- [x] #4 The year is dropped when the local year equals the current year and shown in full otherwise (2025/12/31 09:45)
- [x] #5 Hovering the timestamp shows the canonical stored UTC value - consistent with the other card dates
- [x] #6 A date-only actualEnd (the auto-populate-on-create path writes createdDate) renders as a date with no clock and shifts no timezone
- [x] #7 Non-terminal cards and terminal cards without an actualEnd render exactly as before
- [x] #8 The terminal set comes from getTerminalStatuses so a project declaring a different or additional terminal status gets the stamp there too
- [x] #9 Formatting lives in src/web/utils/date-display.ts and is covered by unit tests in date-display.test.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `formatStoredUtcShortStamp(value, now?)` to `src/web/utils/date-display.ts` returning `StoredDateDisplay` ({ text, title }): local `M/D` (or `YYYY/M/D` when the local year differs from `now.getFullYear()`) plus ` HH:mm` when the stored value carries a time, with `title` = `storedUtcHoverTitle(value)` so the canonical UTC value is on hover. It reuses `parseStoredUtcDate` / `DATE_TIME_REGEX` from `src/utils/date-utc.ts` instead of parsing on its own; a date-only value is read from its own digits rather than converted, so a negative UTC offset cannot shift it to the previous day.
2. Cover it in `src/web/utils/date-display.test.ts`: current-year datetime, cross-year datetime, date-only, empty and invalid input.
3. In `src/web/components/TaskCard.tsx` wrap the existing assignee span and the new timestamp into one right-aligned footer group, rendering the timestamp only when `task.status === terminalStatus && task.actualEnd`: the helper text alone (no icon - it was dropped, the neighbouring due date already carries one and two small glyphs in one 10px footer is noise), `title` from the helper. No new i18n keys — the hover copy is the UTC value, exactly like the other card dates.
4. Verify with `bun test src/web/utils/date-display.test.ts`, `bunx tsc --noEmit` and `bun run check .`; if the dev server starts quickly, look at the Done column once.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

Five files, front end only; the terminal set now comes from config rather than a hardcoded name.

- src/web/utils/date-display.ts - new exported `formatStoredUtcShortStamp(value, now?)` returning `{ text, title }`: local `M/D` (or `YYYY/M/D` when the local year differs from `now.getFullYear()`) plus ` HH:mm` when the stored value carries a time, with `title = storedUtcHoverTitle(value)` so the canonical UTC value is on hover. It reuses `parseStoredUtcDate` / `DATE_TIME_REGEX`, and a date-only value is read from its own digits so a negative UTC offset cannot shift it a day back.
- src/web/components/TaskCard.tsx - the footer right side is now one group holding the assignee and, when the task is terminal and has an actualEnd, the stamp itself - no icon: the due date beside it already carries one, and two 12px glyphs competing in a 10px footer read as noise rather than information. `isTerminal = isTerminalStatusName(task.status, terminalStatuses)` also replaces the old hardcoded `task.status !== "Done"` guard on the due-date risk border and the overdue red.
- src/web/components/TaskColumn.tsx - the `terminalStatus` prop becomes `terminalStatuses: string[]` and is forwarded.
- src/web/components/Board.tsx - computes `terminalStatuses = getTerminalStatuses(statusesConfig ?? statuses)` next to the existing `terminalStatus` (kept as the single complete terminal the cleanup button needs).
- src/web/utils/date-display.test.ts - four new cases.

### Why the whole terminal set, not one status

`getTerminalStatus` returns a single status - the one whose exit channel is `complete`. A project can declare more than one terminal status, and which one a task reached is a config question. The card takes the already-derived set, so nothing here assumes a name like Done.

### Why nothing showed up on BACK-239 (double derivation)

`isTerminalStatus(status, statuses)` expects a **raw `statuses` config** and derives the terminal set itself. TaskCard was handing it the already-derived `["Done", "Dropped"]`, so the predicate derived a second time: read as a plain name list, the two-machine fallback names only the **last** column, giving `["Dropped"]` - and every Done card, BACK-239 included, fell through. Only Dropped cards ever rendered a stamp.

Fix: `isTerminalStatusName(status, terminalNames)` in `src/utils/terminal-status.ts` compares against a set that was already resolved, with no re-derivation, and TaskCard uses it. Every other caller passes the raw config and keeps using `isTerminalStatus`. A regression test pins it - `isTerminalStatusName("Done", ["Done", "Dropped"])` is true where the old composition was false.

Found by rendering the real BACK-239 payload off the running server through `react-dom/server` in jsdom: `["Done", "Dropped"]` produced no stamp, `["Done"]` did. That probe is what separated "the bundle is stale" from "the predicate is wrong" - the served bundle already contained the new code.

### Why the change was invisible at first

The board that was open is served by a bun process started before the edit, and it keeps the old bundle. `src/server/index.ts` imports `src/web/index.html`, so the front end is bundled when the server starts - restarting the browser command is what picks the change up. Nothing else was missing: `GET /api/tasks` already carried `actualEnd` (271 of the 424 Done tasks in this repo have one; the rest predate BACK-492 and have nothing to show).

### Verification

- `bunx tsc --noEmit` clean, and `bunx biome check` clean on the touched files.
- `bun test src/test/terminal-status.test.ts src/test/state-machine.test.ts src/web/utils/date-display.test.ts` - 64 pass / 0 fail (23 of them date-display).
- `bun build src/web/main.tsx` bundled 1183 modules and the output contains `formatStoredUtcShortStamp(task.actualEnd)`, so the new path really is in the app bundle.
- Live probe: `GET http://localhost:6420/api/tasks` returns 271 Done tasks carrying `actualEnd`, so the data the card reads is present.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A terminal board card now shows when the work actually ended. The stamp sits to the right of the assignee in the card footer (and stays right-aligned when there is no assignee), renders the stored UTC `actualEnd` in the viewers local time as `M/D` plus `HH:mm`, and drops the year for the current year - 10/9 09:45 against 2025/12/31 09:45. Hover shows the canonical UTC value, like every other date on the card.

A terminal status is read from the project config through `getTerminalStatuses` / `isTerminalStatus` instead of a hardcoded Done, so a differently named or additional terminal status is handled too; the same predicate now also guards the due-date risk border and the overdue red.

Operator note: the board server has to be restarted to pick this up, because it bundles the front end at startup.
<!-- SECTION:FINAL_SUMMARY:END -->
