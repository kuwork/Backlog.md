---
id: BACK-732
title: Calendar mode and feed/calendar linkage on /memos
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-01 16:27'
labels: []
milestone: m-10
dependencies:
  - BACK-731
modified_files:
  - src/core/memos.ts
  - src/server/index.ts
  - src/test/web-memos-page.test.tsx
  - src/web/components/MemosPage.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/memos.test.ts
references:
  - 'src/web/components/MemosPage.tsx:1'
  - 'src/web/styles/source.css:1'
  - 'src/web/components/TaskCard.tsx:349'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 302400
actual_start: '2026-10-01 16:02'
actual_end: '2026-10-01 16:27'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A feed alone is exactly the Memos weakness the milestone set out to fix: the calendar there is a separate page that never talks to the note stream. Here both modes live on one page and share a single selectedDate, so picking a day filters the feed and clearing the chip returns to everything.

Extend the MemosPage component from BACK-731 with a calendar mode: a CSS-grid month view fed by GET /api/memos/calendar, per-day counts rendered as an intensity gradient, today highlighted. Clicking a day expands a day panel in place beneath the grid rather than navigating away, and the panel offers an inline composer that writes a memo dated that day. No third-party calendar library - the project uses Tailwind v4 with dark: variants and no semantic tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The page offers a visible feed / calendar toggle and the composer stays available in both modes
- [x] #2 The calendar renders a month grid from the /api/memos/calendar counts, with day cells coloured by memo count and today visually highlighted
- [x] #3 Month navigation loads the counts for the new month
- [x] #4 Clicking a day opens a day panel below the grid listing that day's memos; clicking the same day again or the panel close button collapses it
- [x] #5 The day panel has its own composer that saves a memo dated that day, including back-dated days
- [x] #6 The day panel offers a secondary action that switches to feed mode filtered to that date
- [x] #7 Selecting a date from the calendar filters the feed to that day and the feed shows a clearable date chip
- [x] #8 /memos?view=calendar&date=YYYY-MM-DD deep-links straight to that day
- [x] #9 The calendar follows the project's light/dark styling conventions with no new third-party dependency
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the current MemosPage.tsx (feed) end to end, src/web/lib/api.ts fetchMemoCalendar, src/web/styles/source.css for any calendar/grid precedent, and TaskCard.tsx:349 for the card shell style. Confirm the memos locale section in all four files.
2. Back-datable capture needs a server change: extend src/core/memos.ts createMemo(root, content, tags?, createdDate?) so a caller can pin the createdDate, and extend the POST /api/memos handler in src/server/index.ts to accept an optional createdDate in the JSON body (validate the YYYY-MM-DD or YYYY-MM-DD HH:mm shape; reject anything that looks like injection). Add a storage + endpoint test for a back-dated memo.
3. Calendar state in MemosPage: keep the existing view/selectedDate seam, add calendarYear, calendarMonth, calendarCounts (Record<string,number>), selectedDay and dayPanelMemos. Load counts via apiClient.fetchMemoCalendar(year, month).
4. Month grid: build the 6x7 grid from the first day of the month and the weekday offset, render leading/trailing days from adjacent months dimmed, show the day number and the per-day count, colour cells by an intensity gradient derived from the max count, and highlight today. No third-party calendar library.
5. Month navigation: prev/next buttons that roll the year over at January/December and reload the counts for the new month.
6. Day panel: clicking a day loads that day's memos with fetchMemosPage({ date, limit: 100 }) and renders them as MemoCards beneath the grid; clicking the same day again or the panel close button collapses it. The panel has its own composer that POSTs with createdDate pinned to the selected day (back-dated save), then refreshes the counts and the panel list.
7. Feed/calendar linkage: the day panel exposes a "view in feed" action that sets selectedDate and switches the page to feed mode (satisfies the date-chip filter path), and ?view=calendar&date=YYYY-MM-DD deep-links straight to that month with the day pre-selected and its panel open.
8. Locales: add the missing calendar keys (prevMonth, nextMonth, today, dayMemosTitle, backDatedHint, viewInFeed) to en.ts first, then mirror into zh-CN/zh-TW/ja.
9. Verify: bunx tsc --noEmit, bun run check ., and a browser smoke of /memos?view=calendar covering day click, the day panel, a back-dated save and the clearable date chip.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes (carried to completion after the subagent was interrupted by a rate limit):
- Back-datable capture is the spine of the calendar: createMemo validates the optional createdDate against CREATED_DATE_PATTERN, derives the memo id prefix from that date (dateStampFrom), and bumps updatedDate to now. The POST handler rejects anything that is not YYYY-MM-DD or YYYY-MM-DD HH:mm, so there is no injection surface.
- The grid uses stable per-cell keys (buildMonthMatrix returns objects with a key field) to avoid the array-index-as-key lint, and countClass buckets the daily count into a few blue intensity classes for the gradient.
- The deep-link path initialises selectedDay from the ?date= param, so a date deep-link auto-opens the day panel; the click-to-open test therefore renders /memos?view=calendar (no date) and toggles via a click, while the back-dated-save and view-in-feed tests render with ?date= and skip the redundant click.
- Both tests for the panel previously closed it by an extra clickCalendarDay; those were removed once the date-param init was confirmed.
- A browser smoke of /memos?view=calendar confirmed day click, the day panel, a back-dated save and the clearable date chip behave as specified, with no new third-party calendar dependency (Tailwind v4 dark: variants only).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped calendar mode on /memos and wired it to the feed through a single shared selectedDate.

Changes:
- src/web/components/MemosPage.tsx: the page now owns both feed and calendar modes. CalendarGrid builds a 6x7 month matrix from the first-of-month weekday offset (leading/trailing days from adjacent months dimmed), colours each day cell by an intensity gradient derived from the max daily count, and highlights today. Month navigation (prev/next/today) rolls the year over at January/December and reloads counts via apiClient.fetchMemoCalendar(year, month). Clicking a day opens an in-place DayPanel listing that day's memos (fetched with fetchMemosPage({ date, limit: 100 })) and exposing its own back-dated composer that POSTs with createdDate pinned to the selected day; clicking the same day again or the panel close button collapses it. The panel's "View in feed" action sets selectedDate and switches to feed mode, which satisfies the clearable date-chip filter path. ?view=calendar&date=YYYY-MM-DD deep-links straight to that month with the day pre-selected and its panel open. The composer stays available in both modes (AC #1).
- src/core/memos.ts: createMemo(root, content, tags?, createdDate?) lets a caller pin the createdDate; the id prefix is derived from the pinned date via dateStampFrom, and a CREATED_DATE_PATTERN guard rejects malformed dates (falling back to now).
- src/server/index.ts: POST /api/memos now accepts an optional createdDate in the JSON body (validated against YYYY-MM-DD or YYYY-MM-DD HH:mm) and passes it through; GET /api/memos/calendar returns a Record<string, number> of per-day counts for the queried month.
- src/web/lib/api.ts: fetchMemoCalendar(year?, month?) plus createMemo now forwards the optional createdDate.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts: removed the unused calendarPlaceholder and added prevMonth, nextMonth, today, viewInFeed, noMemosThisDay (kept in sync; en.ts is the type source).

Verification:
- src/web/utils/memos.test.ts: 4 new back-dated creation tests (id prefix from pinned date, pinned createdDate + bumped updatedDate, malformed fallback to now, back-dated sort under its own day).
- src/test/web-memos-page.test.tsx: 5 new calendar tests (grid render with per-day counts + prev/next, day panel open/close, deep-link straight to the day, back-dated save pinned to the day, view-in-feed switch).
- src/test/server-memos-endpoint.test.ts: GET /api/memos/calendar happy path, default month, and 400 on out-of-range / non-numeric month.
- bunx tsc --noEmit and bun run check . clean for the touched files.
<!-- SECTION:FINAL_SUMMARY:END -->
