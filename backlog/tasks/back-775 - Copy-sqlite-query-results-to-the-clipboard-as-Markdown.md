---
id: BACK-775
title: Copy sqlite-query results to the clipboard as Markdown
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 18:36'
updated_date: '2026-10-12 23:19'
labels:
  - web-ui
  - sqlite
milestone: m-11
dependencies:
  - BACK-773
  - BACK-774
documentation:
  - backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files:
  - src/sqlite/markdown.ts
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/sqlite-markdown.test.ts
  - src/test/sqlite-query-block.test.tsx
ordinal: 334001
actual_start: '2026-10-12 18:54'
actual_end: '2026-10-12 19:02'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Result grids get pasted into tasks, decisions and memos constantly, and today that means re-typing the table by hand. Add a Copy Markdown action that turns the current result into a GitHub-flavoured Markdown table and puts it on the clipboard.

Pure client work over the SqliteQueryResult already in component state: no request, no endpoint, nothing written to disk. The serialiser belongs in its own module so the escaping rules can be unit-tested without mounting a component. Existing header buttons (Refresh, and the Show/Hide toggle from BACK-774) stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A unit-tested `resultToMarkdownTable(result)` builds a GFM table: one `| a | b |` header row, one `| --- | --- |` delimiter row, one row per result row.
- [x] #2 Escaping: a literal pipe inside a column name or a cell becomes an escaped pipe, embedded newlines collapse to `<br>`, tabs to a single space.
- [x] #3 NULL renders as an empty cell, not the string NULL: Markdown has no way to grey it out, and a literal NULL pasted into a doc is indistinguishable from a real text value.
- [x] #4 Cells use the same JSON-safe contract as src/sqlite/query.ts (string, number, boolean, null), so what gets pasted matches what the table view shows; numbers print via their string form.
- [x] #5 table and list views produce the same Markdown table; value view copies the single scalar as plain text. Only loaded rows are copied, so a truncated grid copies what the reader already sees.
- [x] #6 The button is disabled unless the result is ready and non-empty; a successful copy swaps its label to a confirmation for about two seconds and then reverts; a clipboard failure shows an inline error instead of failing silently.
- [x] #7 Clipboard write uses navigator.clipboard (same pattern as MemoCard), with a hidden-textarea fallback for non-secure origins such as a LAN http address; if both paths fail the button reports the failure.
- [x] #8 New i18n keys `sqliteQueryBlock.copyMarkdown` / `copied` / `copyFailed` in all four locales.
- [x] #9 bunx tsc --noEmit, bun run check . and the new tests stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/sqlite/markdown.ts - `resultToMarkdownTable()` plus a shared cell formatter, no React and no fs import (the web side already imports pure helpers from ../../sqlite/block.ts).
2. Wire a Copy Markdown button into the SqliteQueryBlock header with its copied / failed transient state and a cleared timer on unmount.
3. Tests: src/test/sqlite-markdown.test.ts for pipes, newlines, NULL, empty result and value semantics; a component case asserting navigator.clipboard.writeText received exactly the serialised table.
4. Gates: tsc, biome, scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### NULL is empty in Markdown, grey in the UI - one difference, argued once
The grid prints NULL in grey because a rendered table has styling to spare; Markdown has none, so writing the string NULL there would make absent data indistinguishable from a text value called NULL. Documented on `cellToMarkdown` rather than left as an inconsistency to rediscover.

### Zero rows disables the button even though the serialiser can emit a bare header
`resultToMarkdownTable` still returns the header row for a columned-but-empty result, which is genuinely useful if you are documenting a shape. The button does not use it: the block renders "no rows", and a button that copies something invisible would be a puzzle. The rule is therefore in the component (`rows.length === 0 -> no copy`), not in the serialiser.

### The clipboard fallback exists because this tool is opened over plain http
navigator.clipboard is secure-context only; a LAN address like http://192.168.x.x:6420 does not qualify, and that is how this UI gets reached in practice. The textarea + execCommand route is deprecated but still works there. The component test covers all three outcomes (async API, fallback success, both refused) rather than just the happy path, because a silent failure here looks exactly like nothing happened.

### Two things the tests caught immediately
1. My own expected string was wrong: the fixture has one column, so the delimiter row is `| --- |`, not `| --- | --- |`. The assertion is what caught it.
2. The clipboard spy array was shared between cases, so the value-view test saw the table-view write as well. Since each case asserts the exact payload, `writes.length = 0` went into the stub rather than into every test.

### Layering
`src/sqlite/markdown.ts` imports `SqliteCell` as a *type* only, so importing it from a web component cannot drag `bun:sqlite` into the browser bundle. This is the second web-facing consumer of `src/sqlite/` (after `block.ts`), and keeping that rule is what makes co-locating these helpers with the engine worth it.

### Validation
`bun test src/test/sqlite-markdown.test.ts src/test/sqlite-query-block.test.tsx` -> 20 pass / 38 assertions; `bunx tsc --noEmit` clean; `bun run check .` 0 errors (14 pre-existing any warnings).

### Behaviour change (2026-10-13 follow-up): the Copy button is hidden, not disabled, when there is nothing to copy
The original AC said "disabled unless ready and non-empty". The product call was to hide it entirely: a button that is greyed out but still occupies the header for an empty result reads as "broken" rather than "nothing to do". So `copyMarkdown` is now null until `state.status === "ready" && rows.length > 0`, and the button is rendered only when that holds - the copied/failed transient states can never appear because neither can fire without a payload. The component test was updated from "disabled" to "element is absent" to pin the new contract.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`sqlite-query` blocks have a Copy Markdown button: it puts the rendered result on the clipboard as a GitHub-flavoured Markdown table (the bare scalar for a `value` view), with a two-second Copied confirmation and an explicit Copy failed state.

Changes:/n- `src/sqlite/markdown.ts` (new): `resultToMarkdownTable` and `cellToMarkdown` - pipe escaping, newlines to `<br>`, tabs to a space, NULL to an empty cell. Type-only import of `SqliteCell`, so importing it from the web cannot drag `bun:sqlite` into the bundle.
- `src/web/components/SqliteQueryBlock.tsx`: the action button (disabled while loading or empty), the transient copied/failed state, and a local `writeClipboard` that falls back to a hidden textarea outside secure contexts.
- Four locale files: `copyMarkdown` / `copied` / `copyFailed`.
- Tests: `src/test/sqlite-markdown.test.ts` (new, 11 cases) plus five component cases extending the harness from BACK-774.

Only rows already loaded are copied, so what lands on the clipboard is exactly what the reader sees.

Verification:/n- bun test src/test/sqlite-markdown.test.ts src/test/sqlite-query-block.test.tsx -> 20 pass / 38 assertions
- bunx tsc --noEmit clean; bun run check . 0 errors (14 pre-existing any warnings)
<!-- SECTION:FINAL_SUMMARY:END -->
