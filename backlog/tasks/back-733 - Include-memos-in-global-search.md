---
id: BACK-733
title: Include memos in global search
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-728
references:
  - 'src/core/search-service.ts:51'
  - 'src/core/search-service.ts:191'
  - 'src/core/search-service.ts:328'
  - 'src/types/index.ts:289'
  - 'src/types/index.ts:346'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 303400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A capture inbox is only useful if you can find what you put in it. Memos currently sit outside SearchService entirely, so a note saved last week is invisible to the global search dialog - the same "cannot find my notes" complaint Memos users have.

Extend src/types/index.ts (SearchResultType at 289, SearchResult union at 346) with a memo member and teach src/core/search-service.ts to collect memos alongside documents and decisions, feeding them into the existing Fuse index, the empty-query collector and the result mapper. Memos stay out of the ContentStore snapshot; the search service loads them through the memo module instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchResultType gains "memo" and SearchResult gains a memo variant carrying the Memo and optional matches
- [ ] #2 A query matching memo body text returns the memo, with match highlighting wired through the existing match mapping
- [ ] #3 GET /api/search?type=memo returns only memos and an unfiltered search still includes memos alongside the other kinds
- [ ] #4 The web search dialog surfaces memos with no component change beyond the new result kind
- [ ] #5 Memos with no query fall back to the existing no-query collection path rather than being omitted
- [ ] #6 Search results for memos expose enough routing information that the dialog can open them
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 bun test src/test/search.test.ts passes and any new memo search test passes
<!-- DOD:END -->
