---
id: BACK-833
title: Live query inline SQL editor
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-30 16:42'
updated_date: '2026-10-31 06:26'
labels:
  - web-ui
dependencies: []
priority: medium
ordinal: 393003
actual_start: '2026-10-30 16:47'
actual_end: '2026-10-30 17:19'
modified_files:
  - src/query-block/save.ts
  - src/file-system/atomic-write.ts
  - src/mdb/query.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/components/DuckdbQueryBlock.tsx
  - src/web/components/MdbQueryBlock.tsx
  - src/web/components/CypherQueryBlock.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/FilePreviewModal.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/WikiDetail.tsx
  - src/web/components/MemoCard.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/query-block-save.test.ts
  - src/test/mdb-query.test.ts
  - package.json
  - bun.lock
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The four live query blocks (sqlite-query, duckdb-query, mdb-query, cypher-query) render results in the reading view but offer no way to tweak the statement in place: any edit means leaving the page, opening the source .md, and reloading.

Add an inline editing flow to the shared query block:

- With the query panel expanded (Show query), an edit affordance sits at the right end of the panel's first line.
- Clicking it enters edit mode: the statement becomes a syntax-highlighted editor (Prism token colours behind a transparent textarea, theme-aware), with three actions — Save, Test, Discard — plus a Format button (SQL engines only) that reindents the draft in place without writing.
- Test runs the edited statement without writing anything, so a bad edit is visible before it touches the file.
- Save writes the new statement back into the source Markdown file and immediately re-runs the query so the grid refreshes.
- Discard drops the edit, restores the original statement, and leaves edit mode.
- A tested draft persists across pagination, refresh and CSV export: flipping pages or refreshing after a Test keeps showing the draft, and the page snaps back into range when the result set shrinks.

Scope note: Save writes to the source .md, so the block must know which file it came from. A block rendered without a known file path keeps read-only behaviour and shows no edit affordance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With the query panel expanded, an edit affordance appears at the right end of its first line
- [x] #2 Edit mode exposes Save / Test / Discard and edits only the statement field
- [x] #3 Test runs the edited statement without writing to disk
- [x] #4 Save writes the statement back to the source .md and refreshes the grid
- [x] #5 Discard restores the original statement and exits edit mode
- [x] #6 Blocks without a known file path stay read-only
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. MermaidMarkdown takes an optional filePath prop and forwards it to the four query blocks, which pass it into SqlQueryBlock.
2. SqlQueryBlock gains edit mode: an edit affordance at the right end of the query panel's first line; edit mode swaps the highlighted statement for a syntax-highlighted editor plus Save / Test / Discard / Format.
3. HighlightedSqlEditor: a transparent textarea layered over a scroll-synced Prism highlight pane, reusing the project's highlightCode so the editor inherits the light / dark theme; box metrics are shared across both layers so tokens line up under the caret.
4. Format button (SQL engines only, gated by `engine.highlightLanguage === "sql"`): reindents the draft in place via `sql-formatter` with `keywordCase: "upper"` and a per-engine dialect mapping (DuckDB to Postgres, SQLite / MDB to standard SQL); a preview aid that never writes the file.
5. Test executes the edited statement through the engine's existing run while omitting `copy_to`, so it cannot write; Save calls the write-back endpoint and then re-runs; Discard reverts to the original statement and exits edit mode.
6. Tested-draft persistence: a `displayedSql` state holds the last tested draft; `effectiveSql = displayedSql ?? parsed.block.sql` feeds the re-run effect, live re-run, `exportCsv` and `testDraft`, and `copyTo` is suppressed while a draft is shown. `discardEdit`, `saveDraft` and a `block` prop change reset it to null. A `clampPageToTotalPages` helper snaps `page` back into range whenever the result shrinks past it.
7. New POST /api/query-block/save: path guard plus .md extension allowlist, locates the fenced block by its full body, rewrites only the sql / query field, and writes atomically (temp file + rename). The rewritten body comes back so the block can be saved again.
8. Add i18n keys (edit / save / saving / saved / saveFailed / test / testing / testFailed / discard / format / formatFailed) to all four locales; en.ts stays the source of truth.
9. Thread filePath through every MermaidMarkdown caller that has one: file preview, task, document, decision, wiki, memo. Milestone has no path and stays read-only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## How the block is located

The first cut located the block by its statement text. That fails for the common case: `parseQueryBlock` strips a block scalar's indentation (block.ts:114-117), so for

    sql: |
      SELECT a
      FROM b

the parsed statement is `SELECT a
FROM b` while the file holds `  SELECT a
  FROM b` — `indexOf` never matches.

The block now sends the whole fenced body. It is the only form that is still byte-identical to the file: every preprocessing pass `MermaidMarkdown` runs (`linkifyBareUrls`, `encodeLocalFileLinkDestinations`, `prepareWikiMarkdown`, `sanitizeRawHtmlAngleBrackets`) is code-range aware, so fenced content comes through untouched. The server locates that body, requires it to be unique and fenced, and rewrites only the `sql` / `query` field inside it: an inline value stays inline, a `|` block scalar keeps its marker and its original indentation, and an inline statement that gains lines becomes a block scalar.

On success the endpoint returns the rewritten body. The block adopts it, so a second edit still finds itself — without that, saving twice in a row would fail because the prop still holds the pre-edit body.

## Paths across surfaces

Surfaces hand over different flavours of path: the file preview has a project-relative one, a task an absolute one, and a document / decision / wiki page / memo only its path inside its own collection directory (the server itself composes `backlog/docs/${doc.path}` at index.ts:4076). Rather than have every surface rebuild a prefix and hard-code the configurable backlog directory name, `resolveQueryBlockFile` tries the absolute form, then the project root, then each collection root, and returns whichever candidate exists inside the project.

## Deliberately not done

`Milestone` carries no path (types/index.ts:215-228), so milestone descriptions keep the read-only behaviour instead of growing a new field through the core loaders.

After a save the page's in-memory copy of the body is stale until it re-reads: the block itself is correct because it adopted the rewritten body, but a subsequent full-document save from the same page would still write the pre-edit text. Left out of scope; it needs a refresh signal the surfaces do not have yet.

## Editing a draft across pages

A tested draft stays on screen across pagination, refresh and CSV export. `displayedSql` holds the draft once a Test succeeds; `effectiveSql = displayedSql ?? parsed.block.sql` feeds the re-run effect, the live re-run, `exportCsv` and `testDraft`. While `displayedSql` is set the re-run path suppresses `copyTo`, so a test stays read-only by design. `discardEdit`, `saveDraft` and a `block` prop change reset `displayedSql` to null, returning the grid to the committed statement.

When the result set shrinks past the current page — for example discarding a multi-page draft to return to a single-page original, or a live refresh that returns fewer rows — `clampPageToTotalPages` snaps `page` back to `max(1, totalPages)`. It is invoked from all three result handlers and only acts when `totalPages` is known and `page` is out of range, so it converges after a single extra request and never loops.

## Syntax-highlighted editor and a Format button

The edit draft renders with Prism token colours through a transparent-textarea-plus-highlight-layer (`HighlightedSqlEditor`): the typed text is transparent so the caret and selection stay live while a scroll-synced `<pre>` behind it paints the same `.token.*` spans the reading view uses, so the editor inherits the light / dark theme. Box metrics (font, line-height, padding) are identical on both layers via shared utility classes plus inline overrides, so tokens line up under the caret; the layer is `pointer-events: none` and scroll-synced on `onScroll`.

A Format button sits at the left of the Save / Test / Discard row, gated to SQL engines only (`engine.highlightLanguage === "sql"`; Cypher has no shared formatter). It runs `sql-formatter`'s `format` in place with `keywordCase: "upper"`, mapping DuckDB to the Postgres dialect and SQLite / MDB to standard SQL. It is a preview aid like Test — it never writes the file — and an unparseable statement is left untouched with a transient `formatFailed` note. New i18n keys `format` / `formatFailed` added to the four query-block dicts in all four locales; `sql-formatter` added to `dependencies`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The four live query blocks can now edit their own statement in place. With the query panel expanded, an Edit affordance sits at the right end of its first line; edit mode swaps the highlighted statement for a syntax-highlighted editor with Save / Test / Discard / Format. The editor layers a transparent textarea over a scroll-synced Prism highlight pane, reusing the reading view's token spans so it stays theme-aware; a SQL-only Format button reindents the draft in place via `sql-formatter` without writing.

Test runs the edited statement through the engine's own `run` and deliberately omits `copy_to` so it cannot write. Save posts to `POST /api/query-block/save`, which re-gates the path, locates the fenced body, rewrites the statement field and writes atomically; the block adopts the returned body, which re-parses and re-runs, so the grid refreshes from what was just written. Discard exits edit mode and re-runs so the draft's rows are replaced by the statement the file still holds.

A tested draft persists across pagination, refresh and CSV export: `displayedSql` holds the draft, `effectiveSql` feeds every run path, and `copyTo` is suppressed while a draft is shown; the page clamps back into range when the result set shrinks. Wired everywhere a path exists: file preview, task (description / plan / notes / comments / final summary), document, decision, wiki (page and link preview) and memo. Milestone has no path in its type, so it stays read-only. A block rendered without a path shows no affordance at all.

Verification: `bunx tsc --noEmit` clean; `bunx biome check` clean on all touched files; `bun test src/test/query-block-save.test.ts` 17/17 (block scalar, inline, inline-to-block-scalar, Cypher `query:` field, no-op, the three trailing-newline fence cases, and every refusal: empty statement, non-Markdown, escaping path, missing block, ambiguous block, unfenced look-alike, missing statement field); mdb 14/14 including three cache cases (shared handle, explicit close, reload after the file changes); 62/62 across the three suites. An end-to-end round trip against a copy of doc-33 drives the body shape the browser actually sends, rewrites a real `sql: |` block, parses it back, and saves a second edit off the returned body.
<!-- SECTION:FINAL_SUMMARY:END -->
