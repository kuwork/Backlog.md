---
id: BACK-776
title: Export sqlite-query results as CSV next to the database
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 18:38'
updated_date: '2026-10-12 19:23'
labels:
  - server
  - sqlite
milestone: m-11
dependencies:
  - BACK-773
documentation:
  - backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files:
  - src/sqlite/csv.ts
  - src/sqlite/export.ts
  - src/sqlite/paths.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/sqlite-csv.test.ts
  - src/test/sqlite-query-block.test.tsx
ordinal: 335001
actual_end: '2026-10-12 19:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A query result lives only as long as the browser tab. Add an Export CSV action that writes the current result to a CSV file beside the database it came from - the vault is the project root, so `<db-basename>.sqlite` lands next to `<db-basename>-<timestamp>.csv`.

This is the first write endpoint in this surface, so it must not grow into a general-purpose file writer. The client sends only what a query already sends - `source` and `sql` - and the server re-resolves the source, re-validates the SQL, re-runs the statement through the existing read-only path and writes the CSV itself. No row data comes from the client, and the response leaks no absolute paths.

Note: the m-11 description currently lists CSV export as out of scope for Phase 1 - that line needs amending (or this task does), otherwise the milestone contradicts itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 POST /api/sqlite/export-csv takes { source, sql, filename? } and answers with the written file as a project-relative path plus a truncated flag; nothing absolute is returned to the client.
- [x] #2 The endpoint re-runs both server-side gates - resolveSqliteSource and validateReadOnlySql - and refuses with the same 400 and Chinese reason that /api/sqlite/query gives for anything they reject.
- [x] #3 The write target is the parent directory of the resolved (realpath) database file, filename defaulting to `<db-basename>-<YYYYMMDD-HHmmss>.csv`. A client `filename` hint is reduced to a bare name: separators, drive letters, UNC, leading dots, control characters and `..` are all refused.
- [x] #4 Containment is re-checked after joining: the final absolute target must sit inside the realpath project root and outside every directory isScanSkippedDir skips. A symlinked parent that leaves the project is refused.
- [x] #5 Existing files are never overwritten - timestamp first, then -1, -2 until a free name is found.
- [x] #6 CSV is RFC 4180: fields containing quote / comma / CR / LF are quoted, embedded quotes doubled, CRLF line endings, UTF-8 with a BOM so Excel on Windows reads Chinese correctly. NULL stays an empty field; cells go through the same JSON-safe coercion as the query result.
- [x] #7 Row count matches what the grid showed (same cap), and a truncated export is flagged back to the UI - no silent save of a partial file.
- [x] #8 UI: an Export CSV button in the block header, disabled unless the block parsed and is not loading; success reports the written path inline, failure reports the server reason. New i18n keys in all four locales.
- [x] #9 Tests cover quoting, filename sanitisation, no-overwrite bumping, refusal when the target escapes the project root, and that the export path still cannot make the SQL write (it reuses the readonly handle + PRAGMA query_only).
- [x] #10 bunx tsc --noEmit, bun run check . and the new tests stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/sqlite/csv.ts - pure serialiser (columns + rows -> RFC 4180 string) and a filename builder/sanitiser; no fs, no React.
2. src/sqlite/export.ts - reuse resolveSqliteSource and validateReadOnlySql, run through runSqliteQuery, then write with the post-join containment check and the no-overwrite bump.
3. Server: register POST /api/sqlite/export-csv next to /api/sqlite/query (route table around src/server/index.ts:700), resolving projectRoot from core.fs.rootDir exactly as the query handler does.
4. Web: apiClient.exportSqliteCsv + Export CSV button in SqliteQueryBlock + locale keys.
5. Tests in src/test/sqlite-export.test.ts, cleaning up temp files the way src/test/sqlite.test.ts does (remember: rmSync on a just-closed SQLite file blocks on Windows; the CSV never touches that path, but the fixture db does).
6. Gates: tsc, biome, scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### The whole design hangs on one refusal: no rows, no target path, from the client
The obvious implementation - the browser posts the grid it already rendered, the server writes it where it is told - is one step away from "write arbitrary bytes anywhere the server can reach". So the endpoint takes only `source` and `sql`, the two strings a block already sends, re-runs `validateReadOnlySql` and `resolveSqliteSource`, re-executes through the readonly handle, derives the target directory from the **realpath** of the resolved database and re-checks containment after joining the filename. The component test asserts the request body is exactly `{ source, sql }`; regression there would be caught, not merely frowned at.

### Containment is checked twice on purpose, and the second check is unreachable today
`isInsideProjectRoot` was exported from paths.ts rather than reimplemented here, because a second copy of a containment rule is how the two drift apart. The export runs it on the directory *and* on the joined target: the second pass is unreachable given a source that cleared `resolveSqliteSource` (the target is `dirname(realpath(db))` plus a filename with no separators), and that is fine - it is cheap, and it survives someone changing what `filename` is allowed to hold. Tested directly so the rule is documented even though the endpoint cannot currently reach it.

### Two deviations from the plan, both recorded here rather than left implicit
1. The plan said "sanitise the client filename"; it does not, in fact, silently repair anything structural. Separators, drive letters, UNC, `..` and leading dots are refused with a Chinese reason, while merely Windows-illegal characters (`<>:\"|?*`) are replaced. Silently rewriting `../../x` into `x` would turn a mistake into a surprise.
2. Biome rejects literal control-character escapes in regexes (`noControlCharactersInRegex`), so the check is now `\p{Cc}` with the `u` flag - the same rule, said differently.

### Things that cost time and are worth knowing next time
- **520 rows one INSERT at a time costs 26 seconds.** The truncation case now inserts in chunks of 100; the whole 17-case suite runs in 4s.
- **The same `.gitignore`-style temp-lock warning applies**: `rmSync` after `Database.close()` blocks on Windows, so cleanup is a non-awaited `rm` exactly like src/test/sqlite.test.ts.
- Three assertion bugs were mine, not the code: a one-column delimiter row is `| --- |` (not `| --- | --- |` again, the same slip as BACK-775), a shared clipboard spy array leaked between cases, and `../escaped` is refused for its **separator** before its `..`, so the test asserts the refusal rather than which reason won.

### Known gaps
No end-to-end test drives the HTTP route: constructing `Core` in a test is heavy, and none of the existing sqlite suites do either. The handler is a thin wrapper (JSON in, `exportSqliteCsv`, JSON out), and every decision it could make is covered at the module level. `backlog/databases/demo-shop.sqlite` still has no script regeneration (carried over from BACK-773).

### Validation
`bun test src/test/sqlite-csv.test.ts src/test/sqlite-query-block.test.tsx src/test/sqlite.test.ts src/test/sqlite-markdown.test.ts` -> 70 pass / 147 assertions; `bunx tsc --noEmit` clean; `bun run check .` 0 errors (14 pre-existing any warnings).

### m-11 scope correction
The milestone description listed CSV export as out of Phase 1 scope; that sentence contradicts this task, so it was amended (CSV export re-enters as a block action, Embed stays deferred). CLI caveat found while doing it: `backlog milestone edit m-11 -d ...` also **renames** the title to whatever identifies it, so the title and file name had to be restored with `-t "SQLite Explorer Phase 1"`, and one `
` following a colon survived into the file as literal `/n` - repaired by hand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export CSV writes the current result beside its database: default `<db stem>-<YYYYMMDD-HHmmss>.csv`, never overwriting, answered with a project-relative path.

The shaping decision is that nothing about the rows or the destination comes from the client. `POST /api/sqlite/export-csv` takes `source` + `sql` (plus an optional filename hint) and re-runs both server-side gates, re-executes through the readonly handle, derives the directory from the realpath of the database and re-checks containment after the join. A filename hint that moves the write (separators, drive letters, `..`, leading dots) is refused rather than silently repaired.

Changes:/n- `src/sqlite/csv.ts` (new): RFC 4180 serialisation with CRLF and a UTF-8 BOM (Excel reads Chinese correctly only with the BOM), timestamped default naming, filename sanitising and the no-overwrite suffix bump.
- `src/sqlite/export.ts` (new): the gate order - validate SQL, resolve source, run read-only, then write - so a refused request leaves no file behind.
- `src/sqlite/paths.ts`: exported `isInsideProjectRoot` so there is one containment rule, not two.
- `src/server/index.ts`: route and handler; 400 with the Chinese reason for every refusal.
- `src/web/lib/api.ts`, `SqliteQueryBlock.tsx`, four locale files: Export CSV button with saving / saved path / failed states. `truncated` is reported back so a capped export is not mistaken for the whole result.

Verification:/n- bun test src/test/sqlite-csv.test.ts src/test/sqlite-query-block.test.tsx src/test/sqlite.test.ts src/test/sqlite-markdown.test.ts -> 70 pass / 147 assertions
- Component test asserts the request body is exactly { source, sql } - i.e. no row payload reaches the server
- bunx tsc --noEmit clean; bun run check . 0 errors (14 pre-existing any warnings)

Also amended the m-11 description, which still listed CSV export as out of Phase 1 scope.
<!-- SECTION:FINAL_SUMMARY:END -->
