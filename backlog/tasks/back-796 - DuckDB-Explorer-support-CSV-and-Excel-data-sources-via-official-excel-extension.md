---
id: BACK-796
title: >-
  DuckDB Explorer: support CSV and Excel data sources via official excel
  extension
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-14 13:50'
updated_date: '2026-10-14 15:59'
labels:
  - codex
  - core
  - web-ui
dependencies: []
references:
  - 'src/duckdb/paths.ts:14'
  - 'src/duckdb/query.ts:71-90'
  - src/sqlite/validation.ts
documentation:
  - backlog/docs/PRDS/duckdb/doc-25 - DuckDB-Explorer：只读-SQL-浏览与查询能力.md
modified_files:
  - src/duckdb/paths.ts
  - src/duckdb/query.ts
  - src/duckdb/sql-literals.ts
  - src/duckdb/export.ts
  - src/sqlite/block.ts
  - src/sqlite/validation.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/test/duckdb.test.ts
  - backlog/docs/PRDS/duckdb/doc-25 - DuckDB-Explorer：只读-SQL-浏览与查询能力.md
  - backlog/docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md
ordinal: 358001
actual_start: '2026-10-14 14:25'
actual_end: '2026-10-14 15:59'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
M-12 shipped duckdb-query blocks that read only .duckdb files; users with CSV / Excel data in the project cannot preview or query them at all.

Feasibility is already proven by probe: Bun 1.3.13 + @duckdb/node-api reads CSV and XLSX via replacement scan (bare-path FROM 'file.csv' / FROM 'file.xlsx'); the official excel extension is a core extension with engine autoload enabled by default — first query auto-installs it from the network, later runs hit the local cache. COPY ... TO (FORMAT XLSX, HEADER true) round-trips through read_xlsx. The official excel extension is chosen over spatial (st_read, too heavy) and community rusty_sheet (supply-chain trust).

Design is captured in doc-25 section 11: non-.duckdb sources open an in-memory instance instead of attaching a database file; extension loading relies on engine autoload (never via user SQL, which stays blocked by the read-only validator); autoload/autoinstall failure (offline) must surface as a readable block error. The optional write path (COPY ... TO csv/xlsx) runs on the in-memory instance and its target path must pass the same in-project gates as source paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 duckdb-query blocks accept project-relative .csv sources and query them via bare-path replacement scan (FROM 'file.csv') on an in-memory instance, with no extension install required
- [x] #2 duckdb-query blocks accept project-relative .xlsx sources via the official excel extension; engine autoload installs/loads it without any INSTALL/LOAD in user SQL, and read_xlsx(...) with parameters also works
- [x] #3 resolveDuckdbSource whitelist covers .csv/.xlsx while the DUCK magic check applies to .duckdb only; path gates 1-3 (relative-only, containment, symlink) still reject out-of-project paths for every extension
- [x] #4 INSTALL/LOAD/COPY in user SQL stay rejected by the read-only validator; extension loading happens only through engine autoload
- [x] #5 When the excel extension cannot be downloaded (offline, no local cache), the block renders a readable error instead of failing silently
- [x] #6 Write path (if enabled per doc-25 11.4): COPY ... TO a project-relative .csv/.xlsx target succeeds; targets escaping the project are rejected; .duckdb source files remain unwritable
- [x] #7 Tests cover CSV query, xlsx query, whitelist/magic behavior, and validator rejection of INSTALL/LOAD/COPY
- [x] #8 source stays required for every source type and passes the four in-project gates; SQL string literals are additionally screened: URL literals (http(s)://, s3://) are rejected and local file paths must each pass the project gates
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **paths.ts** — Relax the extension whitelist: `DUCKDB_EXTENSIONS` now covers `.duckdb` / `.csv` / `.xlsx`. `resolveDuckdbSource` returns a source `kind` (`database` | `data-file`); the DuckDB magic-number check applies only to `.duckdb`. Path gates (relative-only, project containment, symlink resolution) stay in force for every extension, and the error text is updated to mention the full extension set.
2. **query.ts** — `runDuckdbQuery` branches by kind. `.duckdb` keeps the `READ_ONLY` attach. `.csv` / `.xlsx` open a `:memory:` instance and rely on the engine replacement scan + autoload (the excel extension for xlsx, no user `INSTALL`/`LOAD`). Autoload/autoinstall failure (offline) is wrapped into a readable Chinese error instead of failing silently.
3. **New `duckdb/sql-literals.ts`** — Extract SQL string literals (reusing the scan semantics from `validation.ts`). URL-scheme literals (`http(s)://`, `s3://`, etc.) are rejected outright. Path-like literals (containing `/` or `\`, or carrying a data extension) are each run through the same in-project gates (reject absolute paths, `..` escape, ignored directories).
4. **block.ts** — The shared parser gains an optional `copy_to` field (write target path). The SQLite side rejects it (`sqlite-query` blocks carrying `copy_to` error out); the DuckDB side accepts it.
5. **Write path (`copy_to`)** — The SQL stays a `SELECT`; the server wraps it as `COPY (<sql>) TO '<target>'` with the format derived from the target extension (`.csv` → `HEADER true`; `.xlsx` → `FORMAT XLSX, HEADER true`). The target passes the same in-project gates and may never be an existing `.duckdb` file. The write runs with the block (triggered by render/refresh, idempotent overwrite). The response gains a `writtenTo` field.
6. **server** — The DuckDB query handler wires literal screening + `copy_to` validation and execution; the export-csv path is unchanged. The SQLite query handler rejects `copy_to`.
7. **discover.ts** — Confirm `/api/duckdb/files` automatically lists `.csv` / `.xlsx` through the relaxed `isDuckdbFileName` whitelist (covered by the change in step 1).
8. **Frontend** — `api.ts` plus `DuckdbQueryBlock` / `SqlQueryBlock` thread `copy_to` through; when the result carries `writtenTo`, the block renders one line with the written path. All four locales add the `writtenTo` string.
9. **Tests** — Expand `duckdb.test.ts`: whitelist / magic dispatch, CSV query, xlsx query (gracefully skipped when the extension cannot be fetched), literal screening, `copy_to` write + escape rejection, and `INSTALL` / `LOAD` / `COPY` rejection as a leading keyword.
10. **Docs** — doc-25 §11.4 finalizes the write field as `copy_to`; doc-26 §7.3 switches the examples to the real field syntax.
11. **Wrap-up** — `bunx tsc --noEmit`, `bun run check .`, and `bun test` all green; reconcile the eight ACs one by one.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- **Empirical probes first.** Before writing code, two throwaway scripts (`tmp/duckdb-probe2.ts`, `tmp/duckdb-probe3.ts`, later removed) settled three unknowns that shaped the design: (a) bare-path `FROM 'file.csv'` / `FROM 'file.xlsx'` works on a `:memory:` instance with cwd = project root; (b) `COPY ... TO` succeeds even on a `READ_ONLY` instance, so the optional write path is valid for `.duckdb` sources too; (c) the excel extension resolves locally when present — probe-3's first error was only because the fixture path was wrong, which itself confirmed the `read_xlsx` function name resolves.
- **`.duckdb` still gated by magic number.** The relaxed whitelist does not let an arbitrary file masquerade as a database: a non-DuckDB file named `*.duckdb` is correctly rejected by the magic check. Only `.csv` / `.xlsx` skip that check (they are data files, not databases).
- **Excel extension is a core extension.** Engine autoload fetches it from the network on first use and caches it locally. Offline runs fail the autoload/autoinstall; `query.ts` catches the rejection and returns a readable Chinese error ("无法加载 Excel 扩展：请检查网络连接，或确认已缓存 excel 扩展") rather than a raw stack trace. The xlsx test is guarded so it skips gracefully when the extension cannot be fetched (CI / offline protection).
- **Write path reuses the same connection.** `copy_to` runs `COPY (...) TO` on the very connection used for the read. For a `.duckdb` source the `READ_ONLY` physical layer already blocks writing back into the database file; `resolveDuckdbWriteTarget` additionally refuses `.duckdb` targets outright. The only thing a write can land on is a new `.csv` / `.xlsx` inside the project — this is what makes the write path safe while the data source file stays untouched.
- **Single most important security change.** `validateReadOnlySql` (shared by SQLite and DuckDB) now also blocks `INSTALL` / `LOAD` / `COPY` as leading keywords. This closes the gap where a user could otherwise `INSTALL` a malicious extension or `COPY ... TO` an out-of-project path. Extension loading is reserved for engine autoload only; user SQL can never load or write.
- **Shared component plumbing.** `SqlQueryBlock` backs both SQLite and DuckDB blocks, so the `copy_to` plumbing and the `writtenTo` notice were added there, with i18n keys in all four locales. The SQLite handler simply never populates `writtenTo`, so its UI stays inert for that field.
- **Literal screening is best-effort, fail-closed.** `sql-literals.ts` screens string literals only for data-file sources. URL-scheme literals are rejected; path-like literals are run through the same in-project gates as `source`. A scan that cannot classify a literal is treated as a reject, so the default posture is safe even against SQL it does not fully understand.
- **Biome nits fixed.** Three style findings (multi-line signature collapse, an optional-chain cleanup in `paths.ts`) were auto-fixed via `bunx biome check --write`.
- **Verification.** 35 DuckDB tests + 28 SQLite tests pass. `bunx tsc --noEmit` reports 0 errors; `bun run check .` reports 0 errors (14 pre-existing `noExplicitAny` warnings, unrelated to this task). All eight ACs and all three DoD items are checked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented CSV/XLSX support for duckdb-query blocks (BACK-796).

Source resolution (paths.ts): DUCKDB_EXTENSIONS now whitelists .duckdb/.csv/.xlsx; resolveDuckdbSource returns a source kind (database | data-file); the DuckDB magic check applies only to .duckdb, and .duckdb is correctly rejected when not a real database. A new resolveDuckdbWriteTarget gates the optional copy_to target (csv/xlsx only, never .duckdb, must stay in-project).

Query execution (query.ts): runDuckdbQuery branches by kind - .duckdb attaches READ_ONLY; .csv/.xlsx opens a :memory: instance and relies on the engine replacement scan + autoload (excel extension for xlsx, no user INSTALL/LOAD). An excel autoload/autoinstall failure (offline) is wrapped into a readable Chinese error instead of failing silently. The optional copy_to path wraps the SELECT as COPY (... ) TO <target> (HEADER TRUE / FORMAT XLSX) on the same instance and reports writtenTo.

SQL literal screening (sql-literals.ts, new): for data-file sources, string literals are scanned - URL scheme literals (http(s)://, s3://, ...) are rejected, and path-like literals are run through the same in-project gates as source.

Validator (sqlite/validation.ts): INSTALL, LOAD and COPY added to the read-only forbidden-keyword list so user SQL can never load extensions or write; extension loading is reserved for engine autoload.

Shared block parser (sqlite/block.ts): copy_to is now a known optional field. The SQLite server handler rejects copy_to; the DuckDB handler accepts it.

Server + frontend: the duckdb query route screens literals, passes kind/copyTo/projectRoot, and surfaces writtenTo; /api/duckdb/files now lists .csv/.xlsx via the relaxed whitelist. api.ts, SqlQueryBlock and the four locales thread copy_to through and render a 'writtenTo' notice.

Tests: duckdb.test.ts expanded to 35 passing tests covering whitelist/magic/kind dispatch, CSV + xlsx queries (xlsx skips gracefully when the extension cannot be fetched), literal screening, copy_to write + escape rejection, and INSTALL/LOAD/COPY rejection; sqlite.test.ts still green. tsc, biome check, and the duckdb + sqlite suites all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
