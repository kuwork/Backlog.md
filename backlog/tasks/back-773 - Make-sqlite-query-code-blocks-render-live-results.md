---
id: BACK-773
title: Make `sqlite-query` code blocks render live results
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 13:30'
updated_date: '2026-10-12 18:21'
labels:
  - web-ui
milestone: m-11
dependencies: []
documentation:
  - backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files:
  - src/sqlite/block.ts
  - src/sqlite/validation.ts
  - src/sqlite/paths.ts
  - src/sqlite/query.ts
  - src/sqlite/discover.ts
  - src/utils/project-scan.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/sqlite.test.ts
ordinal: 331001
actual_start: '2026-10-12 13:30'
actual_end: '2026-10-12 18:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the `sqlite-query` fenced code block actually work end to end (m-11 task 1, doc-16 §2-§6). A new `src/sqlite/` module parses the block, enforces read-only SQL, resolves `source` as a **project-relative** path behind four fail-closed gates, and runs the query server-side on `bun:sqlite` with a readonly handle + `PRAGMA query_only`. The server exposes `POST /api/sqlite/query` and `GET /api/sqlite/files`; the Web UI renders the block in reading view with `table` / `list` / `value` views, loading / error / empty / truncated states and a Refresh action.

Scope cut: **Embed is NOT part of this task** (m-11 task 4). The block renders live results only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Block parser accepts `source` / `sql` (inline or `|` block scalar) / `view` / `refresh`; missing or unknown fields and illegal `view` values fail with a readable message.
- [x] #2 Read-only validation: query must start with `SELECT` or `WITH … SELECT`; no internal semicolon (one trailing `;` tolerated); keyword blacklist ignores quoted identifiers and string literals, and *keeps* comments so a commented-out write is still refused.
- [x] #3 Path resolution: `source` is always **project-relative**; a leading `/` is refused (project rule: client-supplied paths must be relative — security-gotchas.md §1). Also refused: absolute paths, `..` escapes, symlinks leaving the project, excluded/hidden directories, non-whitelisted extensions and non-SQLite files.
- [x] #4 `POST /api/sqlite/query` returns `{ columns, rows, truncated, elapsedMs, dbPath }`; failures return 400 with a Chinese reason.
- [x] #5 `GET /api/sqlite/files` lists the project's SQLite files with a 30s cache.
- [x] #6 Reading view renders a `sqlite-query` fence as a result block (table/list/value), with loading / error / empty / truncated states and a Refresh button; edit mode keeps the raw source.
- [x] #7 `bunx tsc --noEmit`, `bun run check .`, and the new sqlite suite stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/sqlite/block.ts` — parse the YAML subset (`key: value`, `sql: |`), validate fields.
2. `src/sqlite/validation.ts` — read-only SQL validation over a quote/comment-aware scan.
3. `src/sqlite/paths.ts` — source resolution + the four gates; share the exclude-dir constant with `searchProjectFiles`.
4. `src/sqlite/query.ts` — readonly `bun:sqlite` execution, 500-row cap, idle handle cache, JSON-safe value coercion.
5. `src/sqlite/discover.ts` — project-wide SQLite file listing with a 30s cache.
6. Server: register `/api/sqlite/query` and `/api/sqlite/files`; handlers resolve `projectRoot` from `core.fs.rootDir`.
7. Web: `SqliteQueryBlock` component + `code` override in `MermaidMarkdown` + apiClient methods + i18n strings.
8. Tests: parser, validation, path gates, execution, discovery; then tsc / biome / scoped tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### A leading `/` is an absolute path, not "the project root"
doc-16's first draft copied the plugin's two syntaxes (`/`-prefix = vault root, bare = note-relative). Implementation ran straight into the project's own rule: `wiki/developer-notes/security-gotchas.md` §1 requires every client-supplied path to be relative and rejected by `isAbsolute`, and BACK-436 / BACK-450 / BACK-479 all enforce it. `isAbsolute("/data/shop.sqlite")` is **true** on Windows - that is exactly how the first test failed. So `source` is project-relative only: a leading `/` gets its own error message, and the note-relative variant was dropped rather than kept as a second meaning for the same string. Documented back into doc-16 §2.2.

### Both sides of a containment check need realpath
`resolveSqliteSource` realpaths the project root as well as the file. On Windows a root can arrive as an 8.3 short path (`ADMINI~1`) while the file's realpath is the long one, and `relative()` between them returns `..\..` - which would have refused every database in the project.

### Only the third read-only layer is actually load-bearing
Validation (shape + keyword blacklist) is best-effort; `new Database(path, { readonly: true })` plus `PRAGMA query_only` is what makes a hole in it a bug rather than an incident. Covered by a test that runs `CREATE TABLE` straight against `runSqliteQuery`, bypassing validation on purpose.
Keyword scanning deliberately keeps comment text (fail-closed: a commented-out `DROP` is refused) while the first-word and semicolon checks strip it - otherwise a trailing `-- 1; 2` would read as a second statement.

### Two Windows-only traps, both in the tests
1. A SQLite file stays locked briefly after `Database.close()`, and `rmSync` on it **blocks** (measured: 21s) instead of failing fast - cleanup is now a non-awaited `rm`, and a leftover temp directory is an acceptable price.
2. Opening the first SQLite file of a process costs far more than the next ones, and that one-off landed on random tests. The suite warms it up once at module load; three consecutive runs are green.

### react-markdown hands a fence's text over as an array, not a string
Caught only by opening a real document: every block rendered "缺少必填字段 source". `PreBlock` read `code.props.children` with `typeof === "string"`, but react-markdown delivers the fence body as an array of lines (newlines as their own entries), so the block body was always `""` and the parser failed on the empty input. Fixed with a recursive `textOf()` that walks arrays and elements. Worth remembering: a parser unit test proves nothing about the plumbing that feeds it.

### The list view taught the same lesson twice: layout lives with the container
1. **Column width is only shared inside one grid.** Rendering each row as its own `<dl class="grid …">` sized the label column against that row's longest name, so the two columns drifted row by row. Fixed by making the whole result set one grid and letting each row contribute its cells through `display: contents`, with `minmax(6rem,max-content)` so the label column takes its intrinsic width instead of being stretched (`auto` is not "fit content" here).
2. **The surrounding `.wmde-markdown` outranks every utility class on these elements.** It ships `.wmde-markdown dl dt { margin-top:16px; font-style:italic; font-weight:600 }` and `dl dd { padding:0 16px; margin-bottom:16px }` at (0,2,1) specificity, which is what put a 16px gap between label and value and italicised the labels. Single Tailwind classes are (0,1,0) and lose, so the reset is applied as inline styles. Any new markup inside `MermaidMarkdown` inherits this stylesheet - check what `.wmde-markdown` already says before assuming a class took effect.

### Review fixture
`backlog/databases/demo-shop.sqlite` (20 customers / 15 products / 80 orders + an `order_details` view) and `backlog/docs/sqlite/doc-23 - SQLite-Explorer-演示.md`, which exercises table / list / value, an empty result, and all four refusal paths (write SQL, stacked statements, `..` escape, leading `/`). Verified block-by-block against the server path before hand-off.

### Known gaps
Embed is not implemented (m-11 task 4). `documentPath` was deliberately not added to `MermaidMarkdown`: with no note-relative syntax there is nothing to resolve it against, and `FilePreviewModal` ended up unchanged (removed from `modified_files` accordingly).

`backlog/databases/demo-shop.sqlite` is a binary fixture and is **not** covered by `.gitignore`; decide whether it ships or is regenerated from a script before committing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
`sqlite-query` blocks now render live results end to end. New `src/sqlite/` module: `block.ts` (YAML-subset parser), `validation.ts` (read-only SQL, quote/comment-aware), `paths.ts` (project-relative resolution + four gates), `query.ts` (readonly `bun:sqlite`, 500-row cap, idle handle cache, JSON-safe cells), `discover.ts` (project-wide listing, 30s cache). Server gained `POST /api/sqlite/query` and `GET /api/sqlite/files`; the Web UI renders the fence through a `pre` override in `MermaidMarkdown` mounting `SqliteQueryBlock` (table/list/value, loading / error / empty / truncated, Refresh). 28 new tests; tsc, biome and the suite are green.

Two deviations from doc-16's first draft, both deliberate: `source` is project-relative only (no `/`-prefix, no note-relative — the project rejects client-supplied absolute paths), and Embed is deferred to m-11 task 4.

Review in the browser (not just in tests) surfaced three defects that no unit test could have caught: the fence body was read as a string when react-markdown passes an array, the list view built one grid per row so its columns never lined up, and `.wmde-markdown`'s own `dt`/`dd` rules overrode the layout utilities. All three are fixed; the fixture `backlog/databases/demo-shop.sqlite` plus `doc-23` now exercise every view and all four refusal paths against the real server path.
<!-- SECTION:SUMMARY:END -->
