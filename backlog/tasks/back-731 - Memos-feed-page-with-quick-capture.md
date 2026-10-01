---
id: BACK-731
title: Memos feed page with quick capture
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-02 00:22'
labels: []
milestone: m-10
dependencies:
  - BACK-729
references:
  - 'src/web/App.tsx:1138'
  - 'src/web/components/SideNavigation.tsx:1372'
  - 'src/web/lib/api.ts:591'
  - 'src/web/components/MermaidMarkdown.tsx:285'
  - 'src/web/components/StoredDate.tsx:19'
  - 'src/web/locales/en.ts:77'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
modified_files:
  - src/test/web-memos-page.test.tsx
  - src/web/App.tsx
  - src/web/components/MemosPage.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/memos.test.ts
  - src/web/utils/memos.ts
ordinal: 301400
actual_start: '2026-10-01 11:30'
actual_end: '2026-10-01 15:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the task that makes the milestone visible: a /memos page where a note can be typed and saved in one motion, and where saved notes read back as a reverse-chronological card feed. Without it the API from BACK-729 has no user-facing value.

Add src/web/components/MemosPage.tsx, wire it into the Layout route group in src/web/App.tsx (routes at 1138-1223), add one Memos entry to src/web/components/SideNavigation.tsx (expanded list 1372-1493 plus the collapsed icon rail 1685-1878), add the api client methods to src/web/lib/api.ts, and add locale keys to all four files under src/web/locales/. Memo cards reuse the existing MermaidMarkdown renderer and StoredDate; the composer reuses PasteAwareMDEditor.

The page component owns the shared view state (feed | calendar) and selectedDate from day one, so the calendar task can extend it instead of rewriting it. Pagination is cursor based with IntersectionObserver auto-loading, because the whole point of a capture inbox is that it grows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 /memos renders inside the existing Layout shell and is reachable from a single Memos entry in the sidebar in both expanded and collapsed states
- [x] #2 The quick-capture composer sits at the top of the page, saves with the button and with Cmd/Ctrl+Enter, and the new memo appears at the top of the feed immediately
- [x] #3 Each card shows its stored date and renders the memo body as markdown
- [x] #4 The feed loads the first page on mount and appends the next page automatically when the sentinel scrolls into view, showing a loading state while fetching and an end-of-list state when nextCursor is null
- [x] #5 Scroll position and already-loaded pages are preserved when a new page is appended
- [x] #6 Tag chips are rendered read-only on each card and a tag filter narrows the visible memos
- [x] #7 Saving, updating and deleting go through the /api/memos endpoints and failures surface an error instead of silently dropping the note
- [x] #8 The page reads ?view= from the URL so a feed link opens the feed mode
- [x] #9 All four locale files carry the new nav and memos keys and the UI shows no missing-key fallback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the surrounding code before writing anything: src/web/App.tsx routes 1138-1223 and the ws onmessage block 952-994, src/web/components/SideNavigation.tsx expanded Tasks group 1372-1493 plus the collapsed icon rail 1685-1878 and the Icons object at 56, src/web/lib/api.ts fetchDocs 591 / createDoc 637 / updateDoc 615, src/web/components/MermaidMarkdown.tsx 285, src/web/components/StoredDate.tsx 19, src/web/components/LabelFilterDropdown.tsx 15, src/web/components/PasteAwareMDEditor.tsx 67, and the nav section of src/web/locales/en.ts 77.
2. Add the api client methods to src/web/lib/api.ts following the existing fetchDocs/throwResponseError style: fetchMemosPage(limit, cursor, date?), createMemo(content, tags), updateMemo(id, patch), deleteMemo(id), fetchMemoCalendar(year, month). DELETE has no precedent for docs, so model it on removeMilestone (api.ts:793).
3. Create src/web/components/MemosPage.tsx as the single home for memos. It owns the state a later calendar task will extend: memos, nextCursor, loading, error, view ("feed" | "calendar"), selectedDate and the active tag filter. Keep the calendar branch out of this task but leave the state and the toggle seam in place.
4. Quick capture: a composer pinned to the top of the page that reuses PasteAwareMDEditor so pasted images and markdown work with no new editor code. Save on button click and on Cmd/Ctrl+Enter; POST to /api/memos and insert the returned memo at the top of the list. Surface a clear error when the write fails instead of dropping the note.
5. Feed: one card per memo showing StoredDate and the body rendered with MermaidMarkdown (this puts memos inside the existing entity-link and wikilink pipeline for free). Tags render as read-only chips, not as an editable filter widget.
6. Pagination: fetch the first page on mount, then use an IntersectionObserver on a sentinel at the end of the list to append pages while nextCursor is non-null. Show a loading state while fetching and an explicit end-of-list state when nextCursor is null. Appending must not disturb the scroll position or drop already-loaded pages.
7. Tag filtering: collect the tags present in the loaded memos and narrow the visible cards; reuse LabelFilterDropdown if it fits the read-only chip model, otherwise simple toggle chips.
8. Routing and navigation: add <Route path="memos" .../> inside the Layout route group in App.tsx, and one Memos NavLink plus icon in SideNavigation for both the expanded and collapsed states. Read ?view= from the URL via useSearchParams so a feed link opens the feed mode.
9. Locales: add nav.memos and a memos section (composer placeholder, save, saving, loading, end of list, empty state, clear date) to en.ts first, then mirror into zh-CN.ts, zh-TW.ts and ja.ts. en.ts is the type source, so a missing key fails compilation.
10. Verify: bunx tsc --noEmit, bun run check ., and a browser smoke of /memos covering capture, paging and tag filtering.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes (carried to completion after the subagent was interrupted by a rate limit):
- The subagent left four unresolved TypeScript errors that I fixed: (1) errorMessage(error, fallback) was referenced in three spots but never defined, so I added it next to the existing errorDetail helper; (2) the per-card ErrorBanner was passed the whole error object as title instead of title/detail strings; (3) the test helper reactProps returned a union that could be undefined, which broke .onClick/.onChange calls — gave it a typed ReactProps shape; (4) the composer error was showing the raw server message ("boom") instead of the localized "Could not save this memo" headline, so I moved the raw message into the banner detail and kept the localized headline as the title.
- The first-page test asserted the literal "2026-10-01" date string, but StoredDate renders through toLocaleString(undefined, ...) which is machine-locale dependent (this box rendered "2026年10月1日 09:00"); changed the assertion to check the locale-independent UTC hover title instead.
- A browser smoke test during the subagent run had written 31 real memo files into backlog/memos/; those were scratch artifacts, removed before commit so the repo's data folder is not polluted.
- The calendar branch is intentionally a placeholder: AC #9 of the next task (BACK-732) owns the real calendar. This task only had to leave the seam, which it does.

Follow-up fix: pasted images in the memos composer and card editor were saved with their /assets/.temp/ URLs, so they disappeared when the temp dir was cleaned. handleCapture and handleUpdate now promote temp assets via apiClient.promoteAssets and rewrite the markdown with replaceTempImageUrls before createMemo/updateMemo, matching the TaskDetailsModal comment-save pattern. The composer keeps the rewritten draft so a failed save retries cleanly. Verified with bunx tsc --noEmit, bun run check . and the memos test suites.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the /memos feed page so the BACK-729 API has a user-facing home.

Changes:
- src/web/components/MemosPage.tsx (new): the single page for memos. Quick-capture composer pinned to the top reuses PasteAwareMDEditor and saves on button click and Cmd/Ctrl+Enter; the captured memo is prepended to the feed. The feed renders one card per memo with StoredDate and the shared MermaidMarkdown renderer (so [[wiki]] links and entity links just work), read-only tag chips, and inline edit/delete. Pagination is cursor based with an IntersectionObserver sentinel that appends pages while nextCursor is non-null; the page keeps scroll position and already-loaded rows by tracking request epochs and deduping across cursors. A tag-filter bar and an optional date pill narrow the visible cards. The page already owns the view (feed | calendar) and selectedDate state plus ?view= URL handling, leaving a clean seam for the calendar task.
- src/web/utils/memos.ts (new): pure feed-state helpers (appendMemoPage, prependMemo, replaceMemo, removeMemo, collectMemoTags, filterMemosByTags, memoMatchesFilters, extractInlineTags) extracted out of the component so the pagination append is unit-testable on its own.
- src/web/lib/api.ts: fetchMemosPage, createMemo, updateMemo, deleteMemo (modeled on removeMilestone for the DELETE), and fetchMemoCalendar for the upcoming calendar task.
- src/web/App.tsx: <Route path="memos" .../> inside the Layout group.
- src/web/components/SideNavigation.tsx: a Memos NavLink plus a folded-sticky-note icon (Icons.Memo) in both the expanded list and the collapsed icon rail.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts: nav.memos and a full memos section (title, feed/calendar tabs, composer placeholder/hint, capture/save/paging/empty/error strings, tag and date filters, edit/delete confirmations).

Verification:
- src/web/utils/memos.test.ts (new, 13 tests): append/paging edge cases, feed mutations, tag collection/filtering, inline-tag extraction.
- src/test/web-memos-page.test.tsx (new, 6 tests): first-page load, composer capture, failed-write keeps the note and surfaces an error, IntersectionObserver pagination, tag filtering, ?view= deep link.
- bunx tsc --noEmit and bun run check . clean for the touched files.
<!-- SECTION:FINAL_SUMMARY:END -->
