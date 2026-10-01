---
id: BACK-733
title: Include memos in global search
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-01 11:28'
labels: []
milestone: m-10
dependencies:
  - BACK-728
modified_files:
  - src/core/backlog.ts
  - src/core/search-service.ts
  - src/formatters/json-output.ts
  - src/server/index.ts
  - src/test/memo-search.test.ts
  - src/types/index.ts
  - src/web/components/search/SearchDialog.tsx
  - src/web/components/search/VirtualList.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/search-results.ts
references:
  - 'src/core/search-service.ts:51'
  - 'src/core/search-service.ts:191'
  - 'src/core/search-service.ts:328'
  - 'src/types/index.ts:289'
  - 'src/types/index.ts:346'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 303400
actual_start: '2026-10-01 10:28'
actual_end: '2026-10-01 11:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A capture inbox is only useful if you can find what you put in it. Memos currently sit outside SearchService entirely, so a note saved last week is invisible to the global search dialog - the same "cannot find my notes" complaint Memos users have.

Extend src/types/index.ts (SearchResultType at 289, SearchResult union at 346) with a memo member and teach src/core/search-service.ts to collect memos alongside documents and decisions, feeding them into the existing Fuse index, the empty-query collector and the result mapper. Memos stay out of the ContentStore snapshot; the search service loads them through the memo module instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SearchResultType gains "memo" and SearchResult gains a memo variant carrying the Memo and optional matches
- [x] #2 A query matching memo body text returns the memo, with match highlighting wired through the existing match mapping
- [x] #3 GET /api/search?type=memo returns only memos and an unfiltered search still includes memos alongside the other kinds
- [x] #4 The web search dialog surfaces memos with no component change beyond the new result kind
- [x] #5 Memos with no query fall back to the existing no-query collection path rather than being omitted
- [x] #6 Search results for memos expose enough routing information that the dialog can open them
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read src/types/index.ts:289-346 (SearchResultType, SearchResult union, SearchMatch) and src/core/search-service.ts end to end: class at 51, ensureInitialized 65, search 95, applySnapshot 191, rebuildFuse 247, collectWithoutQuery 277, mapEntityToResult 328, mapMatches 367.
2. types: add "memo" to SearchResultType, add MemoSearchResult { type: "memo"; score: number | null; memo: Memo; matches?: SearchMatch[] }, and add it to the SearchResult union.
3. search-service: add a private MemoSearchEntity { id, type: "memo", title (displayTitle), bodyText (rawContent), fileName, memo } and a memos array alongside tasks / documents / decisions / wikis.
4. Memos are deliberately not in the ContentStore snapshot, so give SearchService a memo source. Inject a loader (for example a second constructor argument () => Promise<Memo[]>) from wherever SearchService is constructed (src/core/backlog.ts around line 311), using Core's project root via fs.rootDir.
5. Make sure a memo written after startup is findable without a restart: either reload through the loader whenever the index is (re)built, or expose an explicit invalidation the memo write path calls. Pick the simpler one, make it correct, and record the choice in the implementation notes.
6. Wire memos into rebuildFuse's collection, into mapEntityToResult, and into collectWithoutQuery so a query-less search still lists them. Keep the existing type ordering intact so result ordering for other kinds does not change.
7. Confirm GET /api/search?type=memo filters to memos (the handler at index.ts:1101-1122 already reads the types param) and that an unfiltered search still includes memos.
8. Add tests for memo matching and type filtering; run bun test src/test/search.test.ts (plus any new file), then bunx tsc --noEmit and bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cross-file gaps closed in review after the parallel implementation:
- /api/search rejected type=memo with a 400 because the server whitelist still listed only four kinds; added and made the error message derive from the list so it cannot drift again.
- SearchDialog's TYPE_ICON_COLORS is a Record<SearchResultType, string>, VirtualList's getRowId and search-results' getSearchResultMeta/getSearchResultLink all needed explicit memo branches; the last one would have crashed on a memo result.
- CLI JSON search output needed MemoSearchResult on SearchResultInput plus a MemoSummaryJson shape. Plain CLI output skips memo results, matching how wiki results are already treated as web-only.
- New locale key searchDialog.filterMemo added to all four dictionaries (en / zh-CN / zh-TW / ja).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Memos now show up in global search.

Changes:
- src/types/index.ts: SearchResultType gains "memo", plus a MemoSearchResult member on the SearchResult union.
- src/core/search-service.ts: a MemoSearchEntity fed by an injected memo loader, memos included in the Fuse collection, in the empty-query collector and in the result mapper. Results carry the Memo so the UI can route them.
- src/core/backlog.ts: SearchService constructed with () => listMemos(filesystem.rootDir).
- src/server/index.ts: "memo" added to the /api/search type whitelist; the rejection message is now derived from that list.
- src/web: memo results get a filter tab, a group label, an icon colour, a row id, a title/tags summary and a link to /memos?date=<day> (memos have no detail route of their own).
- src/formatters/json-output.ts: memo results serialized in the CLI JSON search output.
- src/test/memo-search.test.ts (new): 8 tests.

Design notes:
- Memos stay out of ContentStore, so SearchService gets its own memo source instead of a snapshot field. Because memo writes emit no store event, the corpus is reloaded when the index is built and refreshed in the background once it is older than 500ms, so a memo captured after startup is findable on the next request without a restart. refreshMemos() is public for any caller that wants an explicit await.
- The web search dialog needed the memo branches in getSearchResultMeta and getSearchResultLink: without them a memo result would fall through to the task shape and crash on undefined fields.

Verification:
- bun test src/test/memo-search.test.ts -> 8 pass / 0 fail; alongside search-service and server-search-endpoint -> 28 pass / 0 fail
- live HTTP smoke: /api/search?query=zeppelin&type=memo returns the memo, unfiltered search includes it, a bogus type is rejected with "type must be one of task, document, decision, wiki, memo"
- bunx tsc --noEmit and bun run check . clean
<!-- SECTION:FINAL_SUMMARY:END -->
