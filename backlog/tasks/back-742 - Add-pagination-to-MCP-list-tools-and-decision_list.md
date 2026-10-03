---
id: BACK-742
title: Add pagination to MCP list tools and decision_list
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-02 13:12'
updated_date: '2026-10-02 22:49'
labels:
  - mcp
  - web
dependencies:
  - BACK-741
modified_files:
  - src/cli.ts
  - src/core/memos.ts
  - src/guidelines/mcp/decisions.md
  - src/guidelines/mcp/memos.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/mcp/tools/decisions/handlers.ts
  - src/mcp/tools/decisions/index.ts
  - src/mcp/tools/decisions/schemas.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/schemas.ts
  - src/mcp/tools/memos/handlers.ts
  - src/mcp/tools/memos/schemas.ts
  - src/mcp/tools/milestones/handlers.ts
  - src/mcp/tools/milestones/index.ts
  - src/mcp/tools/milestones/schemas.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/mcp/utils/list-page.test.ts
  - src/mcp/utils/list-page.ts
  - src/server/index.ts
  - src/test/mcp-decisions.test.ts
  - src/test/mcp-documents.test.ts
  - src/test/mcp-memos.test.ts
  - src/test/mcp-milestones.test.ts
  - src/test/mcp-server.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/memos.test.ts
  - src/test/server-memos-endpoint.test.ts
  - src/test/web-memos-page.test.tsx
  - src/utils/list-page.test.ts
  - src/utils/list-page.ts
  - src/web/components/MemosPage.tsx
  - src/web/lib/api.ts
  - src/web/utils/memos.test.ts
  - src/web/utils/memos.ts
priority: high
actual_start: '2026-10-02 22:12'
actual_end: '2026-10-02 22:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MCP list tools mirror the CLI lists but lack parity on paging. `task_list`, `task_search`, `document_search` and `memo_list` accept `limit` yet slice silently with no `total`/`hasMore` signal, so an agent cannot tell whether it received a complete list. `document_list` and `milestone_list` accept no paging option at all and return every match. `memo_list` uses an opaque `cursor` while every other list tool has nothing. CLI BACK-741 standardized the eight CLI list commands on `--max-count`/`--skip`/`--count`; the MCP side has no equivalent and no `decision_list` tool at all (the `decisions` MCP guide explicitly says listing is not exposed over MCP).

**Phase 1** adds a single `offset`+`limit` paging scheme to every MCP list tool, surfaces the result through a uniform `structuredContent` envelope (`items`/`total`/`offset`/`limit`/`hasMore`) plus a CLI-style `Showing X-Y of N items` text hint, drops `memo_list`'s `cursor` in favor of `offset`, and adds the missing `decision_list` tool. This closes the MCP list-paging parity gap with BACK-741.

**Phase 2** carries the same scheme through the rest of the stack. The web memos feed still paged with an opaque `cursor`, which kept `cursor`/`nextCursor` alive in `core/memos.ts` only to serve the web UI and left the REST `/api/memos` contract disagreeing with the MCP one. Phase 2 migrates the web feed, the REST endpoint and core `listMemosPage` onto the same offset window, sharing one `selectListPage` implementation with the MCP layer. The web feed's id-based de-duplication already absorbs the duplicate rows an offset window can produce when a memo is captured mid-scroll, so infinite scroll keeps working. This supersedes Phase 1's decision to leave the core cursor contract untouched — that protection existed only for the web UI, which now moves onto offset itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Add `src/mcp/utils/list-page.ts` exporting `selectListPage` and `buildListResult`.
- [x] #2 `task_list` and `task_search` accept `offset` and return the structured envelope (`total`/`offset`/`limit`/`hasMore`); `limit` keeps its existing range.
- [x] #3 `document_search` accepts `offset`; `document_list` accepts `limit` and `offset`; both return the envelope.
- [x] #4 `milestone_list` accepts `limit` and `offset` (its input schema is no longer empty) and returns the envelope; full output is preserved when no option is given.
- [x] #5 `memo_list` drops `cursor`, accepts `offset`, and returns the envelope without `nextCursor`.
- [x] #6 Add the `decision_list` tool: lists decisions with optional `limit`/`offset`/`status`/`search`, and returns the same envelope.
- [x] #7 Every list tool appends a `Showing X-Y of N items` hint to its text output when the window is partial or more items remain.
- [x] #8 Docs updated: `src/guidelines/mcp/overview-tools.md` gains `decision_list` and a list-paging note; `src/guidelines/mcp/decisions.md` is corrected (listing is now exposed) with a `decision_list` row, parameters and example.
- [x] #9 Tests cover `selectListPage`/`buildListResult` plus the per-tool envelope (`total`/`hasMore`/offset slicing); `memo_list` cursor tests are migrated to `offset`.
- [x] #10 `bunx tsc --noEmit`, scoped `bun run check .` on changed files, and the affected `bun test` pass.
- [x] #11 `selectListPage` + `ListPage<T>` live in `src/utils/list-page.ts` and are imported by both core and the MCP layer (one implementation).
- [x] #12 `core/memos.ts` `listMemosPage` takes `offset` instead of `cursor` and returns the shared `ListPage<Memo>` envelope; `MemoPageOptions.cursor` and `MemoPage.nextCursor` are gone.
- [x] #13 `GET /api/memos` accepts `offset`, returns the envelope; a `cursor` query parameter is rejected with 400 instead of being silently ignored.
- [x] #14 `web/lib/api.ts` `fetchMemosPage` sends `offset` and returns the envelope type.
- [x] #15 `MemosPage.tsx` infinite scroll accumulates `offset` and stops when `hasMore` is false.
- [x] #16 `web/utils/memos.ts` `MemoFeedState` tracks `hasMore` (not `nextCursor`) and keeps the id-based de-duplication.
- [x] #17 The CLI `backlog memo list` keeps listing every memo (it never used the cursor) after the core signature change.
- [x] #18 `src/guidelines/mcp/memos.md` documents `offset` and the envelope, closing the gap Phase 1 left when it updated only `overview-tools.md` and `decisions.md`.
- [x] #19 Tests updated: core memo paging, `server-memos-endpoint`, `web/utils/memos`, `web-memos-page`.
- [x] #20 `bunx tsc --noEmit`, biome on changed files, and the affected `bun test` suites pass.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 Phase 1: `bunx tsc --noEmit` passes (TypeScript touched)
- [x] #2 Phase 1: scoped `bun run check .` passes on changed files
- [x] #3 Phase 1: `bun test` passes for `src/mcp/utils/list-page.test.ts` and the affected list-tool handler tests
- [x] #4 Phase 2: `bunx tsc --noEmit` passes
- [x] #5 Phase 2: biome check passes on changed files
- [x] #6 Phase 2: `bun test` passes for the affected memo paging suites
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Phase 1 — MCP list tools and `decision_list`:

1. **New `src/mcp/utils/list-page.ts`** (mirrors CLI `src/utils/list-window.ts`):
   - `selectListPage<T>(items: T[], opts: { limit?: number; offset?: number }): { items: T[]; total: number; offset: number; limit: number; hasMore: boolean }` — `offset` defaults to 0; `limit` undefined returns all; clamps out-of-range `offset`.
   - `buildListResult(content: ContentBlock[], page, opts?): CallToolResult` — returns `content` plus `structuredContent: { items, total, offset, limit, hasMore }`, and appends a `Showing X-Y of N items` line to the text when the window is partial or more remain.
2. **`task_list`** (`src/mcp/tools/tasks/handlers.ts`): add `offset?` to `TaskListArgs`; add `offset` (number, minimum 0) to `taskListSchema`; replace the manual `remaining` slice (around lines 301-308) with `selectListPage(filteredTasks, { limit, offset })`; build the status sections from `page.items` and return `buildListResult`.
3. **`task_search`** (`tasks/handlers.ts`): add `offset?` + envelope, same pattern.
4. **`document_search`** (`src/mcp/tools/documents/handlers.ts`): add `offset?` to `DocumentSearchArgs` + schema; apply `selectListPage` + envelope.
5. **`document_list`** (`documents/handlers.ts`): add `limit?` + `offset?` to `DocumentListArgs` + `documentListSchema`; apply over `filtered`; envelope.
6. **`milestone_list`** (`src/mcp/tools/milestones/handlers.ts` + `schemas.ts`): schema `properties` gains `limit?` (1-100) + `offset?` (0+); combine `fileMilestones` + `archivedMilestones` into one array, `selectListPage`, envelope.
7. **`memo_list`** (`src/mcp/tools/memos/handlers.ts` + `schemas.ts`): remove `cursor`; add `offset?`; replace `listMemosPage(... cursor)` with `selectListPage`; envelope (drop `nextCursor`); update `memoListSchema` and any cursor state.
8. **New `decision_list`**:
   - `src/mcp/tools/decisions/schemas.ts`: add `decisionListSchema` with optional `limit?` (1-100), `offset?` (0+), `status?`, `search?` (id/title substring).
   - `src/mcp/tools/decisions/handlers.ts`: add `DecisionListArgs`; add `formatDecisionSummaryLine(decision)`; add `listDecisions(args)` calling `this.core.filesystem.listDecisions()`, filtering by `status`/`search`, `selectListPage`, envelope.
   - `src/mcp/tools/decisions/index.ts`: register `decision_list` via `createSimpleValidatedTool` + `server.addTool`.
9. **Tests**:
   - `src/mcp/utils/list-page.test.ts`: offset/limit slice, `hasMore`, defaults, out-of-range offset.
   - Affected handler tests assert `structuredContent.total`/`hasMore`/`offset`/`limit` and offset slicing; `memo_list` cursor tests migrated to `offset`; add a `decision_list` test.
10. **Docs** (`src/guidelines/mcp/`): `overview-tools.md` — add `decision_list` to quick reference + a list-paging note; `decisions.md` — correct "listing not exposed" and document `decision_list`.
11. **Validation**: `bunx tsc --noEmit`, scoped `bun run check .` on changed files, `bun test` for the new/changed suites.

Phase 2 — memo paging unified on `offset`:

12. **Fix the Phase 1 doc gap** (`src/guidelines/mcp/memos.md`): replace the `cursor` example with `offset`, and document the `{ items, total, offset, limit, hasMore }` envelope + `Showing X-Y of N memos` hint.
13. **Share the paging helper**: create `src/utils/list-page.ts` holding `ListPage<T>` and `selectListPage` (moved verbatim from `src/mcp/utils/list-page.ts`). Keep `buildListResult` in `src/mcp/utils/list-page.ts` (it needs `CallToolResult`) and have it import `selectListPage` from the new location. Re-export through the MCP path so the handlers stay untouched, and split the test file so the pure-slice tests move to `src/utils/list-page.test.ts`.
14. **Core** (`src/core/memos.ts`): change `MemoPageOptions.cursor?: string` to `offset?: number`; drop the `MemoPage` interface and return `ListPage<Memo>`; implement via `selectListPage(all, { limit, offset })` after the `date`/`tags` filters. `limit` defaults to `MEMO_PAGE_SIZE`.
15. **REST** (`src/server/index.ts` `handleListMemos`): parse a non-negative `offset` (400 on junk), reject `cursor` with a 400 that names `offset`, and return the core envelope unchanged.
16. **CLI** (`src/cli.ts` memo list): it already ignores the cursor and asks for everything; adapt the call to the new option name so behaviour is unchanged.
17. **web api** (`src/web/lib/api.ts`): `fetchMemosPage({ limit, offset, date })` → `Promise<ListPage<Memo>>`.
18. **web state** (`src/web/utils/memos.ts`): `MemoFeedState.nextCursor: string | null` → `hasMore: boolean`; `appendMemoPage` reads `page.hasMore`, keeps the `seen` id-set de-duplication, and drops the stale-cursor guard.
19. **web component** (`src/web/components/MemosPage.tsx`): replace `cursorRef` with an offset ref seeded from `feed.memos.length`; `loadMore` stops on `hasMore === false`; the initial page sets `hasMore` from the envelope.
20. **Tests**: update `src/test/memos.test.ts` (core), `src/test/server-memos-endpoint.test.ts` (offset + cursor-400), `src/web/utils/memos.test.ts` (hasMore state), `src/test/web-memos-page.test.tsx` (mock envelope + offset accumulation).
21. **Validation**: `bunx tsc --noEmit`, biome on changed files, then the affected suites individually (combined runs of git-heavy suites flake).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan written before implementation per user request (create task + write plan, then implement). This ticket has two phases. Phase 1 covered MCP list-tool paging parity with CLI BACK-741 (offset+limit + unified `structuredContent` envelope), dropped the memo cursor, added `decision_list` and updated the MCP usage guides. Phase 2 carried the same offset scheme through the web memos feed, the REST `/api/memos` endpoint and core `listMemosPage`. CLI-instructions and wiki are intentionally out of scope throughout.

Phase 1 notes (2026-10-02):
- Paging helper mirrors the CLI `src/utils/list-window.ts` shape: `offset` defaults to 0, `limit` undefined/0 means "whole list", out-of-range `offset` clamps to an empty page, `hasMore = offset + items.length < total`.
- `memo_list` paging was first implemented inside the MCP handler (`listMemos` + `selectListPage`) rather than by changing core `listMemosPage`, to avoid a core-level breaking change. Phase 2 revisited that decision once the web UI itself moved to offset.
- `task_list` previously sliced per status bucket, which cannot express a cross-bucket `offset`. It now flattens the buckets into one ordered sequence (following `orderedStatuses`), pages that sequence, then regroups the page for rendering. Bucket order in the text output is unchanged.
- `milestone_list` keeps its `unconfigured`/`archived` diagnostic sections un-paged so those warnings never disappear; only the milestone rows themselves are paged.
- Docs: the user-facing tool list that the test suite validates against is `src/guidelines/mcp/overview.md` (exported as `MCP_WORKFLOW_OVERVIEW`), not `overview-tools.md`. Both were updated — `overview.md` carries the schema/filter lines and the new "List Paging" section, `overview-tools.md` is the tool-oriented variant.
- Validation: `bunx tsc --noEmit` clean; biome clean on all touched files; `list-page` 14 pass, `mcp-memos` 9, `mcp-decisions` 10, `mcp-documents` 11, `mcp-milestones` 38, `mcp-tasks` 32, `mcp-server` 12, plus `mcp-drafts`, `mcp-roots-discovery`, `mcp-fallback`, `state-machine-guidance`, `mcp-tasks-local-filter`, `mcp-tasks-completed`, `task-search-parity`, core `memos` 17 — all green. Running many git/filesystem-heavy suites in a single `bun test` process produces unrelated cross-file flakes; per-file runs are stable.
- Gap Phase 1 left: `src/guidelines/mcp/memos.md` still documented `memo_list`'s `cursor`/`nextCursor` after AC #8 removed them (that AC named only `overview-tools.md` and `decisions.md`). Fixed in Phase 2.

Phase 2 notes (2026-10-02):
- `selectListPage` is shared from `src/utils/list-page.ts` (core already depends on `../utils/*`, e.g. `core/backlog.ts`), so core and the MCP layer share one implementation. `buildListResult` stays in `src/mcp/utils/list-page.ts` because it needs `CallToolResult`; the MCP handlers were left untouched by re-exporting `selectListPage` through that path.
- `ListPage<T>` in `src/utils/list-page.ts` (offset/total/limit/hasMore) is deliberately distinct from `ListPage<T>` in `src/utils/list-window.ts` (skip/total/nextSkip/cut), which models the CLI's `--skip`/`--max-count` window and the Next-command footer. The two are documented against each other in the new file.
- `cursor` on `/api/memos` is rejected with 400 rather than ignored, so a stale client fails loudly instead of silently receiving page one forever.
- Offset drift (a memo captured mid-scroll shifts the window) is absorbed by the web feed's existing id de-duplication in `appendMemoPage`; the duplicate case is now covered by a test named "drops rows an overlapping offset window returns again".
- Validation: `bunx tsc --noEmit` clean; biome clean on all changed files. Green suites: `utils/list-page` 9, `mcp/utils/list-page` 5, `memos` (core) 17, `web/utils/memos` 23, `server-memos-endpoint` 15, `server-memo-broadcast` 2, `web-memos-page` 43, `mcp-memos` 9, `memo-search` 8. `server-memos-endpoint` crashed once on the first run with a Bun 1.3.14 allocator panic (known Windows issue) and passed on retry.
- Changes are in the working tree only, not committed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both phases are implemented and validated. Phase 1 gave every MCP list tool a shared `offset`+`limit` window and the `{ items, total, offset, limit, hasMore }` envelope, dropped `memo_list`'s cursor and added `decision_list`; Phase 2 moved the web memos feed, the REST `/api/memos` endpoint and core `listMemosPage` onto the same window (the retired `cursor` now answers 400), sharing one `selectListPage` from `src/utils/list-page.ts`.

36 files changed across the MCP handlers/schemas, core, REST, the web feed, their tests and the MCP guides. `bunx tsc --noEmit` and biome are clean, and the affected suites pass: MCP list tools (`list-page`, `mcp-tasks`, `mcp-documents`, `mcp-milestones`, `mcp-memos`, `mcp-decisions`, `mcp-server`), core `memos`, `web/utils/memos`, `web-memos-page`, `server-memos-endpoint`, `server-memo-broadcast` and `memo-search`. Changes are staged in the working tree, not committed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

Phase 1 — MCP list tools and `decision_list`:

- `src/mcp/utils/list-page.ts` — introduced `selectListPage` + `buildListResult` paging helper and uniform envelope. Phase 2 kept only `buildListResult` here and re-exported `selectListPage` from `src/utils/list-page.ts`.
- `src/mcp/utils/list-page.test.ts` — introduced; Phase 2 kept the `buildListResult` tests here and moved the pure-slice tests to `src/utils/list-page.test.ts`.
- `src/mcp/tools/tasks/handlers.ts` — `offset` arg; tasks flattened to one ordered sequence before `selectListPage`, then regrouped by `orderedStatuses`; envelope via `buildListResult`.
- `src/mcp/tools/tasks/schemas.ts` — `offset` added to `taskListSchema` and `taskSearchSchema`.
- `src/mcp/tools/documents/handlers.ts` — `limit`/`offset` on `listDocuments`, `offset` on `searchDocuments`, both enveloped.
- `src/mcp/tools/documents/schemas.ts` — `limit` (1-100) / `offset` (0+) on `documentListSchema`, `offset` on `documentSearchSchema`.
- `src/mcp/tools/milestones/handlers.ts` — `MilestoneListArgs` with `limit`/`offset`, envelope; unconfigured/archived diagnostic blocks preserved.
- `src/mcp/tools/milestones/index.ts` — pass through `MilestoneListArgs`.
- `src/mcp/tools/milestones/schemas.ts` — `milestoneListSchema` no longer empty.
- `src/mcp/tools/memos/handlers.ts` — `cursor` replaced by `offset`; paging done in the MCP layer via `listMemos` + `selectListPage`; no `nextCursor`.
- `src/mcp/tools/memos/schemas.ts` — `cursor` removed, `offset` added.
- `src/mcp/tools/decisions/handlers.ts` — `DecisionListArgs`, `formatDecisionSummaryLine`, `listDecisions` with `status`/`search` filters and envelope.
- `src/mcp/tools/decisions/schemas.ts` — new `decisionListSchema`.
- `src/mcp/tools/decisions/index.ts` — register `decision_list` (readOnlyHint).
- `src/guidelines/mcp/overview.md` — `task_list`/`task_search`/`document_list` lines document `offset`; `decision_list` entry; new "List Paging" section.
- `src/guidelines/mcp/overview-tools.md` — `decision_list` bullet and the shared list-paging note.
- `src/guidelines/mcp/decisions.md` — corrected the "listing not exposed" claim; documented `decision_list` parameters and example.
- `src/test/mcp-server.test.ts` — tool-name snapshot includes `decision_list`.
- `src/test/mcp-tasks.test.ts`, `src/test/mcp-documents.test.ts`, `src/test/mcp-milestones.test.ts` — envelope assertions added.
- `src/test/mcp-memos.test.ts` — cursor/nextCursor tests migrated to `offset`.
- `src/test/mcp-decisions.test.ts` — `decision_list` tests (paging, `status`, `search`, envelope).

Phase 2 — memo paging unified on `offset`:

- `src/utils/list-page.ts` (new) — shared `ListPage<T>` + `selectListPage`, moved out of the MCP layer.
- `src/utils/list-page.test.ts` (new) — the pure slice tests, moved from `src/mcp/utils/list-page.test.ts`.
- `src/core/memos.ts` — `listMemosPage` is an offset window returning `ListPage<Memo>`; `MemoPageOptions.cursor` and the `MemoPage` interface (with `nextCursor`) are gone.
- `src/server/index.ts` — `handleListMemos` parses a non-negative `offset` and rejects `cursor` with a 400 naming `offset`.
- `src/cli.ts` — comment updated only; the CLI never passed a cursor and still lists every memo.
- `src/web/lib/api.ts` — `fetchMemosPage` sends `offset` and returns `ListPage<Memo>`.
- `src/web/utils/memos.ts` — `MemoFeedState.hasMore` replaces `nextCursor`; `appendMemoPage` keeps the id de-duplication.
- `src/web/components/MemosPage.tsx` — `loadMore` walks an offset ref, `refreshInPlace` re-pulls the window by offset, `hasMore` drives the sentinel.
- `src/web/utils/memos.test.ts` — cases rebuilt on the envelope.
- `src/test/memos.test.ts` — core paging cases moved to `offset`/`hasMore`.
- `src/test/server-memos-endpoint.test.ts` — envelope assertions plus the `cursor` 400 and `offset` 400 cases.
- `src/test/web-memos-page.test.tsx` — mock returns the envelope; the sentinel test asserts `offset=2`.
- `src/guidelines/mcp/memos.md` — `offset` example + envelope text (fixes the Phase 1 gap).
