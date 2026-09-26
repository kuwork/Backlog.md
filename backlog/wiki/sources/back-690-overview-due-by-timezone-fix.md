---
title: BACK-690 Overview Due By renders date-only due dates as the previous day in western timezones
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - bug
  - date-fields
source_path: backlog/tasks/back-690 - Overview-Due-By-renders-date-only-due-dates-as-the-previous-day-in-western-timezones.md
---

# BACK-690 Overview Due By renders date-only due dates as the previous day in western timezones

A due date is a calendar day, but the overview health lists rendered it by appending `T00:00:00Z` (UTC midnight) and converting to the viewer's local timezone, so `2026-09-05` displayed as `9/4` in UTC-7. The fix parses date-only values as local midnight; timestamps keep the UTC parse.

## Summary

- One-branch change in `formatDateForStats` (`src/ui/overview-tui.ts`): a date-only value is normalized with `T00:00:00` (no `Z`), so it parses as local midnight and renders as the day it was written; values carrying a time keep the `:00Z` UTC parse because created/updated timestamps are stored as UTC
- The helper is now exported for testing
- Tests (`src/test/overview-date-format.test.ts`) spawn child processes with `TZ` pinned to America/Los_Angeles (-8) and Pacific/Kiritimati (+14) and assert the rendered day equals the local-midnight rendering, plus an in-process case pinning the UTC datetime path
- Revert check: restoring the `Z` suffix makes exactly the -8 probe fail while the other two stay green
- Execution finding: Bun on Windows ignores `TZ` set through a Git Bash command prefix but honors it via `Bun.spawnSync` env, and `Intl.DateTimeFormat().resolvedOptions().timeZone` still reports the machine zone — not usable to judge whether the pin took effect
- Storage, entry, and every other display surface already treat due dates as date-only and were left untouched

## Acceptance Criteria

- A date-only value renders as the day as written (local-midnight parse) in any timezone; datetime values keep the UTC parse
- Tests pin both paths across TZ-pinned child processes, and the revert check shows exactly the new tests failing pre-fix
- Type check and scoped tests pass

## Related Concepts

- [[concepts/date-fields]] — the date-only vs UTC-timestamp split this fix formalizes in the overview
- [[concepts/cli-tui]] — overview command rendering surface

## Related Sources

- [[sources/timezone-handling-fix]] — earlier timezone day-shift fix of the same class
- [[sources/back-689-tui-task-composer-dates]] — same session's date-field work on the TUI surfaces
