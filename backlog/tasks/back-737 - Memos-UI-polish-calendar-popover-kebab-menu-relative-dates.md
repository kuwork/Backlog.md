---
id: BACK-737
title: 'Memos UI polish: calendar popover, note typography, checklist and tag chips'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 18:24'
updated_date: '2026-10-01 21:45'
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
<!-- SECTION:FINAL_SUMMARY:END -->
