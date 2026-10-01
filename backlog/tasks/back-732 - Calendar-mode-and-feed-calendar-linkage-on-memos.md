---
id: BACK-732
title: Calendar mode and feed/calendar linkage on /memos
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-731
references:
  - 'src/web/components/MemosPage.tsx:1'
  - 'src/web/styles/source.css:1'
  - 'src/web/components/TaskCard.tsx:349'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 302400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A feed alone is exactly the Memos weakness the milestone set out to fix: the calendar there is a separate page that never talks to the note stream. Here both modes live on one page and share a single selectedDate, so picking a day filters the feed and clearing the chip returns to everything.

Extend the MemosPage component from BACK-731 with a calendar mode: a CSS-grid month view fed by GET /api/memos/calendar, per-day counts rendered as an intensity gradient, today highlighted. Clicking a day expands a day panel in place beneath the grid rather than navigating away, and the panel offers an inline composer that writes a memo dated that day. No third-party calendar library - the project uses Tailwind v4 with dark: variants and no semantic tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The page offers a visible feed / calendar toggle and the composer stays available in both modes
- [ ] #2 The calendar renders a month grid from the /api/memos/calendar counts, with day cells coloured by memo count and today visually highlighted
- [ ] #3 Month navigation loads the counts for the new month
- [ ] #4 Clicking a day opens a day panel below the grid listing that day's memos; clicking the same day again or the panel close button collapses it
- [ ] #5 The day panel has its own composer that saves a memo dated that day, including back-dated days
- [ ] #6 The day panel offers a secondary action that switches to feed mode filtered to that date
- [ ] #7 Selecting a date from the calendar filters the feed to that day and the feed shows a clearable date chip
- [ ] #8 /memos?view=calendar&date=YYYY-MM-DD deep-links straight to that day
- [ ] #9 The calendar follows the project's light/dark styling conventions with no new third-party dependency
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 Browser smoke check confirms day click, day panel, back-dated save and the clearable chip
<!-- DOD:END -->
