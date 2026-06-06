---
id: BACK-506
title: Fix CLI actualStart/actualEnd missing local-to-UTC conversion
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-04 07:36'
updated_date: '2026-06-04 14:16'
labels:
  - cli
dependencies:
  - BACK-497
ordinal: 165400
actual_start: '2026-06-04 07:39'
actual_end: '2026-06-04 14:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When users input actualStart/actualEnd via CLI (or MCP), the local datetime string is stored as-is without converting to UTC. Web UI already does local→UTC conversion via dateTimeLocalToStoredUtc. This causes the same user input to produce different stored values depending on the entry point.

Example (UTC+8):
- Web UI input 2026-06-04 09:00 (local) → stored as 2026-06-04 01:00
- CLI input --actual-start "2026-06-04 09:00" → stored as 2026-06-04 09:00 (no conversion)

Also, date-only format (YYYY-MM-DD) should be treated as 00:00 local time and converted to UTC as well. Other date fields (dueDate, plannedStart, plannedEnd, createdDate) must NOT be affected.

## Changes Made

1. Added `localDateTimeToStoredUtc` to `src/utils/date-utc.ts` — handles `YYYY-MM-DD`, `YYYY-MM-DD HH:MM`, `YYYY-MM-DDTHH:MM`, all treated as local time and converted to UTC.
2. Updated `src/web/utils/date-display.ts` — removed local implementation, re-exports `localDateTimeToStoredUtc` as `dateTimeLocalToStoredUtc` from shared module.
3. Updated `src/core/backlog.ts` — applied `localDateTimeToStoredUtc` to `input.actualStart` and `input.actualEnd` in both `createTask` and `updateTask`. Only these two fields are affected; all other date fields remain untouched.
4. Updated `src/web/utils/date-display.test.ts` and added `src/utils/date-utc.test.ts` with full coverage.

## Verification

- `bunx tsc --noEmit` passes for modified files.
- `bunx biome check` passes for modified files.
- All 21 tests in `date-utc.test.ts` and `date-display.test.ts` pass.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Changes

1. **Shared conversion utility** — Added `localDateTimeToStoredUtc` to `src/utils/date-utc.ts`, shared between CLI and Web. Handles three formats as local time and converts to UTC:
   - `YYYY-MM-DD` → treated as 00:00 local time
   - `YYYY-MM-DD HH:MM` → CLI datetime format
   - `YYYY-MM-DDTHH:MM` → Web `datetime-local` format
   All are converted to UTC via `new Date(localTime).toISOString()` and stored as `YYYY-MM-DD HH:MM`.

2. **Web layer** — `src/web/utils/date-display.ts` re-exports `localDateTimeToStoredUtc` as `dateTimeLocalToStoredUtc` from the shared module. Web UI calls this before sending to the API, so the API receives UTC strings.

3. **CLI layer** — `src/cli.ts` now calls `localDateTimeToStoredUtc` on `actualStart`/`actualEnd` before passing to core:
   - `backlog task create` / `backlog task edit`
   - `backlog milestone create` / `backlog milestone edit`
   This ensures CLI local input is converted to UTC before reaching core.

4. **Core layer** — `src/core/backlog.ts` does **not** perform any timezone conversion on `actualStart`/`actualEnd`. It stores the values as-is, since both Web and CLI already convert to UTC before reaching core. Other date fields (`dueDate`, `plannedStart`, `plannedEnd`, `createdDate`) are completely untouched.

5. **Tests** — Added `src/utils/date-utc.test.ts` with 6 test cases. Updated `src/web/utils/date-display.test.ts` to reflect that space-separated datetime strings are converted rather than passed through.
<!-- SECTION:NOTES:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add localDateTimeToStoredUtc to src/utils/date-utc.ts (handles YYYY-MM-DD, YYYY-MM-DD HH:MM, YYYY-MM-DDTHH:MM, all as local time → UTC)
2. Update src/web/utils/date-display.ts to import and re-export from shared module
3. In src/core/backlog.ts, convert input.actualStart and input.actualEnd via localDateTimeToStoredUtc in createTask and updateTask
4. Ensure no other date fields are touched
5. Update src/web/utils/date-display.test.ts and add src/utils/date-utc.ts tests
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
