---
id: BACK-513
title: Fix heatmap counting completion dates in UTC instead of local time
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-05 17:31'
updated_date: '2026-06-05 17:36'
labels:
  - web-ui
  - bug
dependencies: []
modified_files:
  - src/core/statistics.ts
  - src/web/components/Statistics.tsx
priority: medium
ordinal: 171400
actual_start: '2026-06-05 17:30'
actual_end: '2026-06-05 17:34'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The completion heatmap uses `toISOString().slice(0,10)` to generate the date key, which is always in UTC. In positive timezones (e.g. UTC+8), a task completed on local date N may have a UTC date of N-1, causing it to be counted on the wrong day. For example, a task completed at local time June 5th may be stored as June 4th 16:00 UTC, so the old logic counts it under June 4th and June 5th shows 0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The heatmap uses local date to count completed tasks
- [x] #2 The frontend tooltip date matches the heatmap cell date
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Modify `src/core/statistics.ts` to use `getFullYear`/`getMonth`/`getDate` for local date key generation
- Modify `src/web/components/Statistics.tsx` `formatDate` to also use local date
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Changes made:**

1. `src/core/statistics.ts` (line ~81)
   - Replaced `completionDate.toISOString().slice(0, 10)` with local date formatting:
     ```ts
     const dateKey = `${completionDate.getFullYear()}-${String(completionDate.getMonth() + 1).padStart(2, "0")}-${String(completionDate.getDate()).padStart(2, "0")}`;
     ```

2. `src/web/components/Statistics.tsx` (line ~100)
   - Replaced tooltip `formatDate` from `date.toISOString().slice(0, 10)` to local date formatting using `getFullYear`/`getMonth`/`getDate`.

**Verification:**
- `bun test src/test/statistics.test.ts` — 14/14 pass
- `bunx tsc --noEmit` — no new type errors introduced (pre-existing error in `src/core/assets.ts` is unrelated)
- `biome check` — no formatting/lint issues in modified files
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed heatmap timezone issue by switching date key generation from UTC (`toISOString().slice(0,10)`) to local time (`getFullYear`/`getMonth`/`getDate`). This ensures tasks completed on local date N are correctly counted under local date N, resolving the mismatch where positive timezone users saw completed tasks attributed to the previous day.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
