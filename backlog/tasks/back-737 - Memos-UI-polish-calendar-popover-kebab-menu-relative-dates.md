---
id: BACK-737
title: 'Memos UI polish: calendar popover, note typography, checklist and tag chips'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 18:24'
updated_date: '2026-10-03 03:44'
labels: []
milestone: m-10
dependencies: []
modified_files:
  - src/web/components/MemosPage.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/styles/source.css
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/memos.ts
  - src/web/utils/memos.test.ts
  - src/server/index.ts
  - src/test/server-memos-endpoint.test.ts
  - src/test/web-memos-page.test.tsx
  - src/utils/date-utc.ts
  - src/utils/date-utc.test.ts
  - src/core/memos.ts
  - src/web/utils/date-display.ts
  - src/web/utils/search-results.ts
  - src/web/utils/search-results.test.ts
  - src/test/memos.test.ts
  - src/test/mcp-memos.test.ts
  - src/test/memo-local-day-timezone.test.ts
  - src/guidelines/mcp/memos.md
ordinal: 307400
actual_start: '2026-10-01 17:50'
actual_end: '2026-10-01 21:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Post-milestone polish on the /memos page, delivered as one pass: a calendar popover on the composer, note-prose card typography, tickable checklists, inline `#tag` chips, and a working deep link. Every surface has a light and a dark value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The composer's calendar button opens a calendar popover; the old feed/calendar toggle and the duplicate day-panel composer are gone
- [x] #2 Picking a day parks a localized date chip on the composer, filters the feed to that day, and the next capture is dated that day at the current time
- [x] #3 The calendar month/weekday headings follow the app locale, card timestamps use the under-15m / under-1h / exact buckets, and edit/delete sit behind a kebab menu
- [x] #4 The calendar arrows are borderless with larger icons and the tag rows stay on one line instead of wrapping
- [x] #5 A memo's rendered checklist is tickable: clicking a checkbox flips the matching `- [ ]` marker in the saved body, and a memo whose body has no checklist is unchanged
- [x] #6 The memo body reads as note prose - 1rem at 1.7 leading, 0.75rem block rhythm, headings capped at 1.25rem - and the dead `prose prose-sm` classes are gone
- [x] #7 A rendered checklist reads as a control - rounded box, blue fill with a white tick when ticked, hairline box when not - and a ticked label is struck through and muted
- [x] #8 A `#tag` token in the body renders as an inline chip that filters the feed on click or on Enter, and the duplicated tag row under the card is gone
- [x] #9 Every colour rule declares a light and a dark value, and both themes were checked in a real browser, not only in jsdom
- [x] #10 The ticked box is not clipped on its left edge, a second click really clears the tick, and the box outline stays hairline instead of heavy
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Gather the page into one composer and one feed: the calendar becomes a popover on the composer button; picking a day parks a date chip, filters the feed to it, and dates the next capture.
2. Style the card body as note prose through a `.memo-body` scope in source.css, with a light and a dark value for every rule.
3. Render the `#tag` tokens as chips in place and let them drive the feed filter, which lets the duplicated tag row go.
4. Make the checklist a real control: an opt-in `onToggleTask` on the shared renderer plus `toggleTaskInMarkdown` rewriting the saved marker.
5. Serve the page on refresh by adding /memos to the SPA route table.
6. Verify with the gates, the memos suites, the compiled CSS chunk, a real-browser click cycle, and light/dark screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- The body's `prose prose-sm` wrapper was dead (`@tailwindcss/typography` is not a dependency), so the markdown renderer's GitHub *document* defaults - 2em headings, 16px block gaps, a -1.6em checkbox indent - were in charge. `.memo-body` replaces them.
- The preview stylesheet is bundled **twice** and its second copy lands after the end of source.css, so a tie on specificity goes to the renderer. The checkbox rules therefore name `.contains-task-list` to stay one class ahead of it; that is what keeps the box off the `overflow-x: hidden` edge.
- The checklist input is controlled from the memo source in both directions: `checked` is always an explicit boolean (the renderer omits it when unticked), and the toggle handler is read at click time rather than during render, so a second click never acts on a stale copy of the memo.
- `#tag` chips reuse the same tokens `extractInlineTags` already stores, so every chip has a filter behind it; their clicks are delegated with a native listener, which keeps a handler off a passive container.
- The shared renderer stays opt-in: both behaviours sit behind optional props (`onToggleTask`, `inlineTagChips`), so task and doc bodies keep GitHub's read-only boxes and literal `#word`.
- Card timestamps pick their bucket from the elapsed difference against a 30s ticker, not from a formatted string, so they keep advancing instead of freezing at their first value.
- Follow-up (2026-10-02, leftover bug found after delivery): a memo written at 23:00 local was counted on the next day, and picking the day it was written showed an empty feed. `nowStamp()` stores UTC (the repo-wide convention, and what the card timestamp already converts back), but four day-shaped readers took the stored string's first ten characters as if that were a local day: the calendar buckets in `handleGetMemoCalendar`, the `?date=` filter in `listMemosPage`, `memoCreatedOnDate` in the web helpers, and the memo deep link in `search-results`. A fifth surface was worse - the composer's back-dated chip spliced a LOCAL day onto a UTC clock time, storing an instant the calendar could never show.
- The fix routes every day-shaped question through one new helper, `localDateKeyFromStoredUtc` in `utils/date-utc.ts`: stored UTC in, the local date part out. `nowStamp()` still writes UTC, so nothing on disk changes and the two memos already captured were re-bucketed without being touched.
- The id is the deliberate exception, and it was the one call made explicitly on review: `nextMemoId` keeps the **stored UTC date** as its `YYYYMMDD` prefix (`dateStamp()`/`dateStampFrom()` unchanged). An id is a filename that must stay stable, and taking it from the stored value keeps it greppable against `created_date`; the local day is what the feed filter, the CLI's `--date` and the calendar grid answer with. Consequence to expect, and accepted: a capture at 23:00 local is filed under that local day but named for the next UTC date, so the digits of an id can be a day ahead of the day it appears on.
- Verification: `bunx tsc --noEmit` clean; `bunx biome check` clean on all 16 touched files (the repo-wide `bun run check .` still reports 25 errors in files this change never touched - a CRLF checkout artifact on this Windows machine, not a regression). Suites: core memos 19, date-utc 11, web/utils/memos 24, search-results 32, server-memos-endpoint 16, mcp-memos 9, web-memos-page 44, memo-local-day-timezone 3 - 158 pass / 0 fail.
- `src/test/memo-search.test.ts` fails on roughly 1 run in 4 on this machine, in its server-boot case (`/api/search` "returns memos in the unfiltered result set"): the readiness retry exhausts with no assertion diff. It is unrelated to this change - `git diff -U0 src/core/memos.ts` shows `nowStamp`/`dateStamp`/`dateStampFrom` are byte-identical to HEAD and the only functional edit is the `listMemosPage` day filter, which a `date`-less search never reaches. Left alone rather than chased here.
- Why a new suite exists: `bun test` runs in **UTC**, where a local day and the stored UTC date are always the same, so the older suites cannot tell the fixed code from the broken code - the regression tests added to them pass against both. `src/test/memo-local-day-timezone.test.ts` therefore pins the zone in a child process (`TZ=America/Los_Angeles` for a 23:00 capture, `TZ=Asia/Tokyo` for a 00:30 one) and asserts the feed filter and the calendar bucket land on the local day while the id keeps its UTC date. Both non-UTC cases fail on the pre-fix code and pass on the fixed code; the third case keeps the UTC degenerate case honest.
- Real-data check on the two memos in this repo (`TZ=America/Los_Angeles`): `20261002-1` (stored `2026-10-02 06:00` UTC = local Oct 1 23:00) now buckets on `2026-10-01`, and `20261002-2` on `2026-10-02`. `backlog memo list --date 2026-10-01` returns the first and `--date 2026-10-02` the second. `nextMemoId` still answers with the UTC date, and `src/guidelines/mcp/memos.md` records the split so an agent does not read the id's digits as the day a memo is filed under.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The /memos page is now one composer over a feed, with the note-card presentation finished in both themes.

What the page does now:
- The calendar is a popover on the composer button, dismissed by an outside click or Escape. Picking a day parks a localized date chip on the composer, filters the feed to that day, and dates the next capture that day at the current time.
- Card times read "N min ago" (under 15 minutes), "Today" (under an hour) or the exact local time, and keep advancing on their own; a date-only memo shows its own day with no shift.
- The body reads as note prose: one text size at 1.7 leading, a compact block rhythm, headings capped at 1.25rem, chips for inline code, panels for quotes and code, blue links, rounded images and tables.
- `#tag` tokens render where they were typed as chips; clicking one (or pressing Enter) filters the feed by that tag, so no separate tag row is needed under the card.
- A checklist is a real control: a thin 1px rounded box, blue with a white tick when ticked, its label struck through and muted, and clicking it saves the memo in either direction.
- Edit and Delete live behind a per-card ⋮ menu; the calendar marks memo density with a coloured dot rather than a count; tag rows scroll instead of wrapping.
- Refreshing /memos serves the app again instead of 404ing.
- Every colour has a light and a dark value; both themes were checked in a real browser.

Verification: bunx tsc --noEmit and bun run check . clean; src/test/web-memos-page.test.tsx 41 tests and src/web/utils/memos.test.ts 23 tests pass; the full web batch passed at 390 before the last checklist fixes.

Follow-up, 2026-10-02 - memos were counted on the wrong day. Two memos, both showing on Oct 2; picking Oct 1 showed an empty feed even though one had been written on the evening of Oct 1. `created_date` is stored UTC (the repo-wide convention, which the card timestamp already converted back), but four readers took the stored string's first ten characters as if that were a local day: the calendar buckets, the `?date=` filter in `listMemosPage`, `memoCreatedOnDate`, and the memo deep link in `search-results`. The composer's back-dated chip was worse still, splicing a local day onto a UTC clock time and storing an instant the calendar could never show.

Every day-shaped question now goes through one helper, `localDateKeyFromStoredUtc` in `src/utils/date-utc.ts`. Nothing on disk changed, so both memos already captured were re-bucketed in place - `20261002-1` on `2026-10-01` and `20261002-2` on `2026-10-02`, matching `backlog memo list --date`. On review the id was deliberately left on the **stored UTC date**: an id is a stable filename and stays greppable against `created_date`, so its digits can be a day ahead of the day the memo is filed under. `src/test/memo-local-day-timezone.test.ts` pins the zone in a child process to keep both rules honest, because `bun test` itself runs in UTC, where the two days coincide and the old code looks correct.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

- `src/web/components/MemosPage.tsx` - the composer/feed page: calendar popover, note-card typography, deep link, live refresh; follow-up fixed the back-dated chip (a local day at the current local time, converted to stored UTC) and the optimistic calendar-count bump on capture and delete.
- `src/web/components/MermaidMarkdown.tsx` - opt-in tickable checklists and inline `#tag` chips for the shared renderer.
- `src/web/styles/source.css` - the `.memo-body` note-prose scope and the checklist control, each with a light and a dark value.
- `src/web/locales/{en,ja,zh-CN,zh-TW}.ts` - the memos strings, including the relative-date buckets and the calendar labels.
- `src/web/utils/memos.ts` - feed helpers: offset append, tag collection and filtering, checklist marker toggling, inline-tag extraction; follow-up made the day match read the memo's local date part.
- `src/web/utils/memos.test.ts` - the helper suite, plus the back-dated creation cases.
- `src/web/utils/date-display.ts` - web-facing re-exports of the date helpers, so the page has one date module.
- `src/web/utils/search-results.ts` - the memo hit's deep link; follow-up made it target the memo's local day.
- `src/web/utils/search-results.test.ts` - link cases, including the memo local-day one.
- `src/server/index.ts` - the `/api/memos` and `/api/memos/calendar` handlers; follow-up made the calendar bucket by local day.
- `src/utils/date-utc.ts` - the canonical stored-UTC/local conversion module; follow-up added `formatLocalDateKey`, `localDateKeyFromStoredUtc` and `formatLocalTimeStamp`.
- `src/utils/date-utc.test.ts` - conversion cases, including the local-day round trip across day and year boundaries.
- `src/core/memos.ts` - memo storage: id allocation, listing, paging, create/update/delete; follow-up made the `date` filter compare local days and left the id on the stored UTC date.
- `src/test/{memos,server-memos-endpoint,mcp-memos,web-memos-page}.test.tsx` - the core, endpoint, MCP and page suites, retargeted to build their fixtures from local days.
- `src/test/memo-local-day-timezone.test.ts` - new: the memo day contract pinned to a real timezone in a child process, the only suite that can tell the fixed code from the broken code.
- `src/guidelines/mcp/memos.md` - records that the id is the UTC date while the `date` filter and the calendar are the local day.
