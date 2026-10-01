---
id: BACK-736
title: Memos milestone regression and acceptance pass
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-729
  - BACK-730
  - BACK-731
  - BACK-732
  - BACK-733
  - BACK-734
  - BACK-735
references:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 306400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every earlier task in this milestone was verified in isolation to keep moving fast, so nothing has proven the whole feature holds together: type checking, linting, the full test suite, and the end-to-end behaviour of /memos in a real browser. This task is the single gate before the milestone can be called done.

Run the project-wide checks, run the full test suite and compare against the pre-change baseline so pre-existing flaky failures are not mistaken for regressions, and walk the acceptance list from doc-20 section 9 in a browser: capture a memo, see it in the feed, find it in search, follow an entity link from it, open the calendar and filter by a day, then edit the underlying file and watch the page update on its own.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes with no errors
- [ ] #2 bun run check . passes with no errors
- [ ] #3 The full test suite shows no new failures relative to the baseline recorded in the implementation notes
- [ ] #4 All memo unit and API tests pass
- [ ] #5 Browser walkthrough covers quick capture, feed paging, tag filter, search, entity link navigation, calendar day filtering, and external-edit refresh
- [ ] #6 Any deviation from doc-20 section 9 is either fixed or recorded as a follow-up in the implementation notes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes
- [ ] #6 Full test suite run and baseline comparison recorded
- [ ] #7 Browser acceptance walkthrough recorded in the implementation notes
<!-- DOD:END -->
