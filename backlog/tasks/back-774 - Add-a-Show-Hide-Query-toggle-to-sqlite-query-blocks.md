---
id: BACK-774
title: Add a Show/Hide Query toggle to sqlite-query blocks
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 18:35'
updated_date: '2026-10-12 18:53'
labels:
  - sqlite
  - web-ui
milestone: m-11
dependencies:
  - BACK-773
documentation:
  - backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files:
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/sqlite-query-block.test.tsx
ordinal: 333001
actual_start: '2026-10-12 18:06'
actual_end: '2026-10-12 18:53'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-773 renders a `sqlite-query` fence as a result grid only: the reader sees the rows but not the statement behind them, and checking a number means opening the document in edit mode and hunting for the fence. Give the block header a Show/Hide Query toggle that reveals `source` and the SQL inline, read-only, in reading view.

Web only. The toggle issues no request, never re-runs the query, and does not add Copy or Export buttons - those are BACK-775 and BACK-776. Display state lives in the component, defaults to collapsed, is not persisted, and is not shared between two blocks pointing at the same source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header renders exactly one toggle for every block state (loading, ready, empty, error) and keeps it usable while a query is in flight.
- [x] #2 A block that fails to parse still offers the toggle: expanded, it shows the raw fence body verbatim, since that is the fastest way to spot a typo in the block YAML.
- [x] #3 Collapsed by default. Expanding fires no additional request (assert against the fetch stub), and Refresh leaves an expanded block expanded.
- [x] #4 The expanded panel shows `source` and the statement as read-only monospace text: line breaks preserved, long lines scroll horizontally instead of being wrapped or cut off.
- [x] #5 Labels come from new i18n keys `sqliteQueryBlock.showQuery` / `sqliteQueryBlock.hideQuery`, added to en, ja, zh-CN and zh-TW.
- [x] #6 Accessible and consistent: a real button with aria-expanded / aria-controls, keyboard reachable, styled like the existing Refresh button in the same header row.
- [x] #7 bunx tsc --noEmit, bun run check . and the new component test stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/web/components/SqliteQueryBlock.tsx - add a collapsed/expanded state, put the toggle in the existing header button row, render the SQL panel above the result body (parsed failure falls back to the raw block prop).
2. Locale keys in src/web/locales/{en,ja,zh-CN,zh-TW}.ts, next to the existing sqliteQueryBlock block.
3. src/test/sqlite-query-block.test.tsx on the existing tsx harness (see src/test/mermaid-markdown.test.tsx for how the api client gets stubbed): label flips on click, panel content appears, exactly one /api/sqlite/query call after toggling, parse failure still reveals the raw body.
4. Gates: tsc, biome, scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### The toggle checklist had nothing surprising in it - until the test harness
Component behaviour is straightforward: one `useState`, one always-rendered button, a panel that renders `source` + the parsed SQL (or the raw body when parsing failed).

The one real cost was building the harness rather than the feature. Nine years of habit say a line like "expanding must not re-query" is self-evident; BACK-773 already taught once that a unit-test-green component can be broken in the plumbing, so it is now asserted by counting fetch calls into `/api/sqlite/query`: one after first paint, two after Refresh, and the expanded panel still there. That is the only test in this suite that would fail if someone naively put the block body inside the query `useEffect` deps.

### `<pre>` inherits the same trap the list view hit
`.wmde-markdown` styles every `<pre>` with code-block chrome at (0,1,1), which beats any utility class. `PRE_RESET` is applied inline for exactly the reason the existing `dt`/`dd` reset exists, and the comment points back at it.

### Validation
`bun test src/test/sqlite-query-block.test.tsx` 4 pass; `bun test src/test/mermaid-markdown.test.tsx src/test/sqlite.test.ts` 85 pass; `bunx tsc --noEmit` clean; `bun run check .` 0 errors (14 pre-existing `any` warnings). No locale-completeness test exists, but `TranslationDict` is derived from `en.ts`, so a missing key in ja/zh-CN/zh-TW is a tsc error rather than a silent English fallback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`sqlite-query` blocks now have a Show Query / Hide Query toggle in the header: collapsed by default, expanded they disclose `source` and the statement in read-only monospace (the raw block body when the block itself failed to parse, since that is what the reader has to fix).

Changes:/n- `src/web/components/SqliteQueryBlock.tsx`: one `useState` for the panel, an always-enabled button carrying `aria-expanded` / `aria-controls` (id from `useId`), and a `PRE_RESET` inline style because `.wmde-markdown` restyles every `<pre>` past any utility class.
- Four locale files (en / ja / zh-CN / zh-TW): `sqliteQueryBlock.showQuery` / `hideQuery`.
- `src/test/sqlite-query-block.test.tsx` (new): four cases on the jsdom + act harness.

Behaviour worth pinning down: expanding issues no request, and Refresh leaves an expanded panel open - both asserted by counting calls into `/api/sqlite/query` rather than by inspecting markup.

Verification:/n- bun test src/test/sqlite-query-block.test.tsx -> 4 pass
- bun test src/test/mermaid-markdown.test.tsx src/test/sqlite.test.ts -> 85 pass
- bunx tsc --noEmit clean; bun run check . 0 errors (14 pre-existing any warnings)
<!-- SECTION:FINAL_SUMMARY:END -->
