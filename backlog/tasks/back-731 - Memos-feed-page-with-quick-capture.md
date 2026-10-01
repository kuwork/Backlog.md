---
id: BACK-731
title: Memos feed page with quick capture
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
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
ordinal: 301400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This is the task that makes the milestone visible: a /memos page where a note can be typed and saved in one motion, and where saved notes read back as a reverse-chronological card feed. Without it the API from BACK-729 has no user-facing value.

Add src/web/components/MemosPage.tsx, wire it into the Layout route group in src/web/App.tsx (routes at 1138-1223), add one Memos entry to src/web/components/SideNavigation.tsx (expanded list 1372-1493 plus the collapsed icon rail 1685-1878), add the api client methods to src/web/lib/api.ts, and add locale keys to all four files under src/web/locales/. Memo cards reuse the existing MermaidMarkdown renderer and StoredDate; the composer reuses PasteAwareMDEditor.

The page component owns the shared view state (feed | calendar) and selectedDate from day one, so the calendar task can extend it instead of rewriting it. Pagination is cursor based with IntersectionObserver auto-loading, because the whole point of a capture inbox is that it grows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /memos renders inside the existing Layout shell and is reachable from a single Memos entry in the sidebar in both expanded and collapsed states
- [ ] #2 The quick-capture composer sits at the top of the page, saves with the button and with Cmd/Ctrl+Enter, and the new memo appears at the top of the feed immediately
- [ ] #3 Each card shows its stored date and renders the memo body as markdown
- [ ] #4 The feed loads the first page on mount and appends the next page automatically when the sentinel scrolls into view, showing a loading state while fetching and an end-of-list state when nextCursor is null
- [ ] #5 Scroll position and already-loaded pages are preserved when a new page is appended
- [ ] #6 Tag chips are rendered read-only on each card and a tag filter narrows the visible memos
- [ ] #7 Saving, updating and deleting go through the /api/memos endpoints and failures surface an error instead of silently dropping the note
- [ ] #8 The page reads ?view= from the URL so a feed link opens the feed mode
- [ ] #9 All four locale files carry the new nav and memos keys and the UI shows no missing-key fallback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 The page renders without console errors in a browser smoke check
<!-- DOD:END -->
