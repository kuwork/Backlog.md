---
id: BACK-690
title: >-
  Overview Due By renders date-only due dates as the previous day in western
  timezones
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 01:53'
updated_date: '2026-09-23 02:06'
labels:
  - cli
  - bug
dependencies: []
references:
  - src/ui/overview-tui.ts
  - src/test/overview-date-format.test.ts
modified_files:
  - src/ui/overview-tui.ts
  - src/test/overview-date-format.test.ts
ordinal: 263400
actual_start: '2026-09-23 01:54'
actual_end: '2026-09-23 02:06'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A due date is a calendar day, but the overview command health lists (At Risk / Overdue / Blocked / Stale) render it through formatDateForStats (src/ui/overview-tui.ts), which appends T00:00:00Z (UTC midnight) to a date-only value and then renders it in the viewer local timezone. In western timezones such as UTC-7 a due date stored as 2026-09-05 is displayed as 9/4 - the day shifts. Fix: parse date-only values as local midnight so the rendered day is the day as written, carrying no timezone meaning. Values that carry a time (created/updated timestamps stored as UTC) keep the existing UTC parsing. Storage, entry and every other display surface already treat due dates as date-only and stay untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verified against BACK-678 (commit 53bbf721): due dates are a date-only string everywhere; created/updated stay UTC timestamps
- [x] #2 formatDateForStats renders a date-only value as the day as written (parsed as local midnight, no day shift in any timezone), and a value carrying a time keeps the existing UTC parsing
- [x] #3 Tests pin the date-only and datetime paths; the revert check shows exactly the new tests fail against the old implementation
- [x] #4 bunx tsc --noEmit passes and the scoped bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The fix is a one-branch change in formatDateForStats (src/ui/overview-tui.ts): a date-only value is now normalized with T00:00:00 (no Z suffix) so it parses as local midnight and renders as the day it was written; values carrying a time keep the :00Z UTC parse because created/updated timestamps are stored as UTC. The helper is now exported. Tests (src/test/overview-date-format.test.ts) spawn child processes with the TZ environment variable pinned to America/Los_Angeles (-8) and Pacific/Kiritimati (+14) and assert the rendered day equals the local-midnight rendering of the same calendar day, plus an in-process test pinning the UTC parse for datetime values. Revert check: restoring the Z suffix makes exactly the -8 probe fail while the other two stay green. Pitfall discovered while pinning timezones on this machine: Bun on Windows ignores the TZ variable when it is set through a Git Bash command prefix (bun -e / bun run), but honors it when it arrives through a real environment block (Bun.spawnSync env parameter), and Intl.DateTimeFormat().resolvedOptions().timeZone can still report the machine zone - do not use it to judge whether the pin took effect.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
formatDateForStats now renders date-only values as the calendar day they were written (local-midnight parse) in every timezone, while datetime values keep the existing UTC parse; three tests pin both paths across TZ-pinned child processes, and the revert check confirms the -8 probe alone discriminates the fix.
<!-- SECTION:FINAL_SUMMARY:END -->
