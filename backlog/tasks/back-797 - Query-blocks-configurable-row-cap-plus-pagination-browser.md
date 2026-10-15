---
id: BACK-797
title: 'Query blocks: configurable row cap plus pagination browser'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-14 23:47'
updated_date: '2026-10-15 08:10'
labels:
  - codex
  - core
  - web-ui
dependencies: []
modified_files:
  - backlog/config.yml
  - src/types/index.ts
  - src/sqlite/query.ts
  - src/sqlite/export.ts
  - src/duckdb/query.ts
  - src/duckdb/export.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/sqlite.test.ts
  - src/test/duckdb.test.ts
  - src/file-system/operations.ts
  - src/test/filesystem.test.ts
  - src/web/App.tsx
ordinal: 359001
actual_start: '2026-10-15 00:09'
actual_end: '2026-10-15 08:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both the `sqlite-query` and `duckdb-query` blocks cap their result at a hardcoded 500 rows (`SQLITE_MAX_ROWS` / `DUCKDB_MAX_ROWS`). That cap, the pagination page size, and whether a block opens in paginated mode should all be configurable — both in `backlog/config.yml` and in the web Settings UI — rather than baked into constants.

On top of the configurable cap, a pagination browser is added: a toggle button next to the existing Refresh button switches a block into paginated mode, where the result is browsed page by page with left/right arrow controls and a "page X of Y" indicator. The pagination browser is real engine-side paging — the user SQL is wrapped in a subquery and `LIMIT`/`OFFSET` are pushed down to the engine, with a separate `SELECT COUNT(*)` subquery for the total — so it never materializes the whole result and is **not** bounded by the 5000 cap (this is exactly why pagination exists: to browse large data sets that exceed 5000 rows). The table view and the list view both gain a row-number (序号) column. The preview (non-paginated) mode keeps its truncation notice and now also reports the true total row count, so a reader knows the result was capped (addressing the earlier gap where only "500 行" was shown).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 The 500-row preview cap is moved out of the hardcoded constants into `BacklogConfig` as `queryMaxRows` (default 500); both SQLite and DuckDB query handlers and the export path read it from config instead of the constant. The `SQLITE_ABS_MAX_ROWS` / `DUCKDB_ABS_MAX_ROWS = 5000` hard ceiling is retained and applies to preview mode only. The web Settings UI exposes `queryMaxRows` as a number input clamped to a maximum of 5000 (labeled "最大 5000").
- [x] #2 `BacklogConfig` gains `paginationPageSize` (default 50) and `defaultPagination` (default false); both are persisted by `saveConfig` and editable in the web Settings UI.
- [x] #3 A switch-style toggle (开关样式) labeled "分页浏览" is rendered next to the Refresh button on both the SQLite and DuckDB query blocks (shared `SqlQueryBlock`); the toggle's on/off state makes it visually clear whether pagination mode is active.
- [x] #4 When pagination is enabled, the block sends `page` / `pageSize` to the server; the backend wraps the user SQL in a subquery and pushes `LIMIT`/`OFFSET` down to the engine (a separate `SELECT COUNT(*)` subquery yields `totalRows`) — it never materializes the full result and therefore is **not** subject to the 5000 cap. The server returns `totalRows`, `page`, `pageSize`, `totalPages` alongside the page's rows, and `truncated` is false in pagination mode.
- [x] #5 The pagination browser shows the current page and total page count with left/right arrow controls; arrows are disabled at the first/last page; changing the page re-runs the query for that page.
- [x] #6 If `defaultPagination` is true in config, a query block enters pagination mode immediately on first render (no manual toggle needed).
- [x] #7 Both the table view and the list view render a row-number (序号) column; the number reflects the global row position across pages in pagination mode and the local position in preview mode.
- [x] #8 The preview (non-paginated) mode keeps its truncation notice and now also reports the true total row count (e.g. "已截断至 500 行（共 N 行）"), so readers know the result was capped.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Types + config file** — Add `queryMaxRows?: number`, `paginationPageSize?: number`, `defaultPagination?: boolean` to `BacklogConfig` (`src/types/index.ts`); add the three keys with defaults (`query_max_rows: 500`, `pagination_page_size: 50`, `default_pagination: false`) to `backlog/config.yml`.
2. **Query result shape** — Extend `SqliteQueryResult` / `DuckdbQueryResult` with `totalRows`, `page`, `pageSize`, `totalPages`. `runSqliteQuery` / `runDuckdbQuery` branch on pagination: when `page` is set, wrap the user SQL as `SELECT * FROM (<sql>) AS _p LIMIT :pageSize OFFSET :offset` for the page and `SELECT COUNT(*) AS _c FROM (<sql>) AS _p` for the total (no full materialization, no 5000 cap); otherwise slice by `maxRows` (preview) and keep `truncated`. Both branches always report `totalRows`. The wrapper strips any trailing semicolon and is safe for `WITH`/`SELECT` queries (CTEs are legal inside a subquery in both engines).
3. **Server handlers** — `handleSqliteQuery` / `handleDuckdbQuery` read config via `this.core.filesystem.loadConfig()`; default `maxRows` to `clamp(config.queryMaxRows ?? 500, 1, 5000)` and `pageSize` to `clamp(config.paginationPageSize ?? 50, 1, 1000)`. Preview mode keeps `SQLITE_ABS_MAX_ROWS` / `DUCKDB_ABS_MAX_ROWS = 5000` as a hard ceiling on `maxRows`. Pagination mode ignores that ceiling (only `pageSize` rows are ever fetched at once).
4. **API client + shared block** — Add `page?` / `pageSize?` to the `sqlite-query` / `duckdb-query` request types in `api.ts`; `SqlQueryBlock` fetches config once (module-level memoized) to learn `paginationPageSize` and `defaultPagination`, threads `page` / `pageSize` into `engine.run`, and re-runs on page change or pagination toggle.
5. **Pagination UI** — Add a switch-style toggle (开关样式, labeled "分页浏览") beside the Refresh button in the block header; its on/off visual state shows whether pagination mode is active. When pagination is on and `totalPages > 1`, render a pager (`← 第 X / Y 页 →`) with disabled arrows at the first/last page; `defaultPagination` initializes the toggle to on at first render.
6. **Row-number column** — Prepend a `#` header/cell to the table view and a 序号 entry to each row in the list view; compute the global row index for pagination mode (`(page - 1) * pageSize + i + 1`).
7. **Settings UI** — Add a "Query / Data preview" section in `Settings.tsx` with a number input for `queryMaxRows` (clamped to a maximum of 5000, shown as a max attribute plus helper text "最大 5000"), a number input for `paginationPageSize` (default 50), and a checkbox for `defaultPagination`; wire them through the existing generic `handleInputChange`.
8. **i18n** — Add strings (pagination toggle, prev/next, "第 {page} / {total} 页", 序号, updated truncated/summary text) to `sqliteQueryBlock` and `duckdbQueryBlock` in all four locales (zh-CN, zh-TW, en, ja), and extend `QueryBlockDict` accordingly.
9. **Tests + checks** — Add backend tests for the preview cap, `totalRows`, pagination slicing, and `totalPages`; run `bunx tsc --noEmit`, `bun run check .`, and the SQLite + DuckDB query suites; update AC/DoD.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- **Pagination is real engine-side paging, not full-materialization.** Because the user wants to browse data sets that exceed 5000 rows, pagination wraps the user SQL in a subquery and pushes `LIMIT`/`OFFSET` down to the engine (`SELECT * FROM (<sql>) AS _p LIMIT :pageSize OFFSET :offset`) and computes the total with a separate `SELECT COUNT(*) AS _c FROM (<sql>) AS _p`. Only one page (`pageSize` rows, default 50) is ever fetched per request, so pagination is exempt from the 5000 cap — that cap remains only for the preview (non-paginated) mode. The 5000 constant is retained as `SQLITE_ABS_MAX_ROWS` / `DUCKDB_ABS_MAX_ROWS` and caps `maxRows` in preview mode.
- The subquery wrap is safe for both `SELECT ...` and `WITH cte AS (...) SELECT ...` queries (Common Table Expressions are legal inside a subquery in both SQLite and DuckDB). A trailing semicolon is stripped before wrapping. The read-only keyword blacklist (which now also rejects `INSTALL`/`LOAD`/`COPY`) still guards the wrapped SQL before execution.
- The preview-mode total (`totalRows`) comes from the already-materialized `records.length`; the pagination-mode total comes from the `COUNT(*)` subquery. Both feed the same `totalRows` field so the UI can show "共 N 行" uniformly.
- The config read inside `SqlQueryBlock` is module-level memoized so multiple blocks on one page share a single `fetchConfig` call; config edits made in Settings require a page reload to reach already-mounted blocks (acceptable).
- Export CSV keeps using the preview cap (`queryMaxRows`, hard-capped at 5000) so its behavior stays unchanged and bounded; it is not tied to the current page.
- The `queryMaxRows` / `paginationPageSize` / `defaultPagination` keys are optional in the type and defaulted in code, so existing `config.yml` files without them keep working. The Settings number input for `queryMaxRows` clamps to a maximum of 5000 (the displayed maximum).
- **Review rework (post-In-Review UI fixes in `SqlQueryBlock.tsx`).** (1) The pagination pager was gated behind `totalPages > 1`, so toggling pagination on a dataset that fits one page — or just to confirm the mode was on — showed no control at all. The pager now renders whenever pagination mode is active (`state.status === "ready" && pagination`); on a single-page result it shows "第 1 / 1 页" with both arrows disabled, which still communicates that pagination mode is on. (2) The list view had merged the row number into the first field's label as a `"N. field"` prefix. It now renders 序号 as a dedicated leading gutter column (right-bordered, right-aligned, muted) ahead of the field `<dl>`, so it reads as its own column and stays aligned across every row. The table view already had a separate `#` column and was left unchanged.
- **Second review pass (UI styling alignment).** (3) The pagination toggle now uses the exact same switch markup as the Settings page (`w-11 h-6` track, `after:h-5 after:w-5` knob via the `after:` pseudo-element, `rounded-circle`, `peer-checked:bg-blue-500`) so the block's toggle visually matches the app's other switches. (4) The pager control bar was restyled to be text-height and text-styled: the arrows are now plain text (`←`/`→`) with a hover color shift instead of bordered raised buttons, and the bar uses `leading-none` + `mt-1` so its height matches the surrounding text. A non-clickable arrow is now simply not rendered (`currentPage > 1` / `currentPage < totalPages` guard) rather than shown disabled at 40% opacity — at the first or last page the relevant arrow is invisible while the "第 X / Y 页" indicator remains.
- **Third review pass (config persistence bug fix).** The "Query / Data preview" fields were added to the `BacklogConfig` type and the Web Settings UI, but they never reached disk: `FileOperations.serializeConfig` is an explicit line-by-line writer and did not emit `query_max_rows` / `pagination_page_size` / `default_pagination`, and `parseConfig` did not read them back. The Web save path (`apiClient.updateConfig` → server → `filesystem.saveConfig` → `serializeConfig` → `Bun.write`) ran fine, so the UI looked like it saved, but a reload showed the old default — the keys were silently dropped on write. Fixed by adding all three keys to both `parseConfig` (with `query_max_rows`/`queryMaxRows`, `pagination_page_size`/`paginationPageSize`, `default_pagination`/`defaultPagination` aliases) and `serializeConfig` (guarded by `typeof ... === "number"` / `"boolean"` so absent keys do not clutter the file). Added a filesystem round-trip test that writes with one `FileSystem` and reads with a fresh one (to bypass the in-memory cache and actually exercise serialize+parse), asserting all three values survive.
- **Fourth review pass (compact toggle + stable pager).** (5) The pagination toggle was still too large (`w-11 h-6`, 44×24 px) in the cramped block header. It was replaced with the app's dedicated `<Switch>` component (`src/web/components/Switch.tsx`, `w-9 h-5` track, `h-4 w-4` knob, emerald on-state) which is smaller and reads as "已完成" when on. The label uses `htmlFor` + `useId()` so Biome's `noLabelWithoutControl` stays satisfied. (6) The pager arrows had been conditionally removed from the DOM (`currentPage > 1 ? button : null`), causing the "第 X / Y 页" text to shift left/right when crossing the first/last page boundary. They are now always rendered as `<button>` elements; at the boundary they become invisible via `opacity-0` + `cursor-default` (still occupying layout space) while clickable pages use `cursor-pointer` with a hover color shift. This keeps the pager bar width and the page-number position stable across every page.
- **Fifth review pass (toggle blank-page + config cache).** (7) Clicking the pagination toggle in list view caused a blank result. Root cause: `togglePagination` used a functional updater `setPagination((on) => !on)` that ignored the `<Switch>` component's passed `checked` value, and did not bump `nonce` or reset `page` when turning pagination OFF. In edge cases (rapid toggles, React batching desync) the block could enter a state where `pagination` was true but `page` was stale or the query effect did not re-run with clean parameters. Fixed by changing `togglePagination` to accept the Switch's `next: boolean` directly (`onChange={(next) => ...}`), resetting `page` to 1 whenever pagination turns ON, and always bumping `nonce` so the run effect re-queries with fresh parameters. (8) Settings changes appeared to require a server restart. Root cause: `loadQueryConfig()` cached its promise in a module-scoped `configPromise` variable that was never invalidated. Even after the server broadcast `config-updated` via WebSocket and `App.tsx` called `loadAllData()`, existing (and newly mounted) `SqlQueryBlock` instances still received the old cached config. Fixed by removing the module-level cache entirely so each block fetches config fresh on mount, and adding a window event `"backlog-config-updated"` (dispatched from `App.tsx` when the WebSocket receives `config-updated`) that every mounted `SqlQueryBlock` listens for to re-fetch config in place. This means a Settings save is reflected immediately in all query blocks without requiring a page refresh or server restart.

**Sixth review pass (pagination toggle scroll-jump blank page).** Clicking the pagination toggle on a block deep in a long doc scrolled the window to a blank area below the page shell. Root cause: the shared Switch component (extracted in the fourth pass) renders its sr-only checkbox as a bare sibling of the track span, so the checkbox's `position: absolute` (from `sr-only`) resolved against the initial containing block — no positioned ancestor exists between the input and BODY. Absolutely positioned elements do not follow the inner `<main>` scroll container, so the hidden checkbox stayed at its unscrolled document position (also inflating window scrollHeight, e.g. 3206 vs 673 client height); clicking the label focused the checkbox and the browser scroll-into-viewed the window to that stale spot, leaving the 100vh shell scrolled out of view (the 'blank page'). Shallower blocks (e.g. the table-view block near the top) jumped too little to notice, which is why it read as a list-view-only bug. Fixed by wrapping the checkbox and track in `<span className="relative inline-block">` in src/web/components/Switch.tsx, restoring the positioning context the pre-extraction markup had; the input remains the track's preceding sibling so `peer-checked:` styles are unaffected. The same latent bug existed at Switch's other two call sites (SearchDialog, CompletedFilterToggle) and is fixed by the same change. Verified with real-mouse CDP tests at 1366x768 on doc-24/doc-26: window scrollY no longer moves (1054 -> 0), window scrollHeight no longer inflated, pager and arrows work; zero JS exceptions. Added src/test/web-switch.test.tsx asserting the checkbox stays inside a positioned wrapper. Also corrected the stale loadQueryConfig doc comment in SqlQueryBlock.tsx (still claimed module-scope memoization after the fifth pass removed it).

**Seventh review pass (toggle placement + switch color).** Two UI polish requests from acceptance: (1) the 分页浏览 toggle moved from the left of the action buttons to the far right of the block header, immediately after the 重新查询 (Refresh) button (src/web/components/SqlQueryBlock.tsx header). (2) The shared Switch's on-state color changed from emerald (`peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-700`) to the Settings page's blue (`peer-checked:bg-blue-500`, single color for both themes) in src/web/components/Switch.tsx, so 分页浏览 / 显示已完成 / the search dialog switch all match the Settings switches. Verified by the user on the dev server; tsc, biome, and the Switch regression test stay green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-797 is implemented and all checks pass. The hardcoded 500-row preview cap was lifted into `BacklogConfig` as `queryMaxRows` (default 500), and two new config keys `paginationPageSize` (default 50) and `defaultPagination` (default false) were added; all three are persisted in `backlog/config.yml` and edited from the web Settings "Query / Data preview" section. The Settings `queryMaxRows` input is a number clamped to a maximum of 5000 (labeled "最大 5000"), and the `SQLITE_ABS_MAX_ROWS` / `DUCKDB_ABS_MAX_ROWS = 5000` hard ceiling still caps **preview** mode only.

A switch-style "分页浏览" toggle sits next to the Refresh button on every `sqlite-query` / `duckdb-query` block (shared `SqlQueryBlock`); its on/off visual state shows whether pagination is active. When on, the block sends `page` / `pageSize` to the server, which wraps the user SQL in a subquery and pushes `LIMIT`/`OFFSET` down to the engine (`SELECT * FROM (<sql>) AS _p LIMIT :pageSize OFFSET :offset`) with a separate `SELECT COUNT(*) AS _c FROM (<sql>) AS _p` for the total. Only one page is ever fetched, so pagination is **real engine-side paging** and is exempt from the 5000 cap — exactly the use case for browsing data sets beyond 5000 rows. The pager shows "第 X / Y 页" with disabled left/right arrows at the bounds; `defaultPagination` initializes the toggle on at first render. Both the table view (`#` column) and list view (序号 as a dedicated leading gutter column) gained a row-number column that reflects the global row position across pages.

The preview (non-paginated) mode keeps its truncation notice but now also reports the true total (`已截断至 {count} 行（共 {total} 行）`), closing the earlier gap where only the cap was shown. Export CSV still uses the preview cap (hard-capped at 5000) and is not tied to the current page.

**Rework after the first review pass:** the pager now renders whenever pagination mode is active (previously hidden unless `totalPages > 1`, so a one-page result or a mode check showed nothing), and the list view's 序号 is now its own leading gutter column instead of being prepended to the first field's label. `bunx tsc --noEmit` and `bun run check .` remain clean after these two UI edits.

**Second review pass (styling):** the pagination toggle now uses the same switch markup as the Settings page (`w-11 h-6` track, `rounded-circle`, `peer-checked:bg-blue-500`), and the pager control bar is text-height/text-styled (`leading-none` + `mt-1`, arrows rendered as plain text with a hover color shift). A non-clickable arrow is omitted entirely (conditional render at the first/last page) instead of shown disabled. tsc and `bun run check .` remain clean.

**Third review pass (config persistence bug):** the three "Query / Data preview" keys were silently dropped on write, so editing them in the web Settings never changed `config.yml` — `FileOperations.serializeConfig` is an explicit line-by-line writer that did not include `query_max_rows` / `pagination_page_size` / `default_pagination`, and `parseConfig` did not read them back. Both functions now handle all three keys, so values round-trip through disk. Locked in by a new filesystem test that saves through one `FileSystem` and loads through a fresh one (bypassing the in-memory cache) to verify serialize + parse, not just the cache.

**Fourth review pass (compact toggle + stable pager):** the pagination toggle was swapped for the app's `<Switch>` component (`w-9 h-5`, emerald on-state), which is smaller and fits the block header. The pager arrows are now always rendered but use `opacity-0` at the first/last page instead of being removed from the DOM, so the "第 X / Y 页" text never shifts position. tsc and `bun run check .` remain clean.

**Fifth review pass (toggle blank-page + config cache):** `togglePagination` now accepts the Switch's boolean `next` value directly (instead of deriving from stale state via a functional updater), always resets `page` to 1 when turning pagination ON, and bumps `nonce` so the query effect re-runs with clean parameters — this prevents the blank-result state that occurred in list view. The module-level `configPromise` cache was removed; each block fetches config fresh on mount, and all mounted blocks listen for the `"backlog-config-updated"` window event (dispatched from `App.tsx` on every WebSocket `config-updated`) to re-fetch config in place. Settings changes now propagate to query blocks immediately without a page refresh or server restart.

Verification: `bunx tsc --noEmit` clean; `bun run check .` exits 0 (the only remaining diagnostics are 14 pre-existing `noExplicitAny` warnings in `ryugraph-wasm.d.ts` and 1 info about the intentional `_c` literal key — none introduced by this change); SQLite suite 31 pass, DuckDB suite 38 pass, including three new pagination tests per engine (page slicing + totalPages, preview totalRows/truncation, and 6000-row pagination exempt from the 5000 cap). The 6000-row DuckDB test was switched from 6000 individual INSERTs to a single `INSERT ... SELECT FROM range(...)` to avoid WASM round-trip timeouts.

**Sixth review pass (toggle scroll-jump blank page):** clicking the pagination toggle on a deeply nested block scrolled the window to a blank area because the shared Switch's sr-only checkbox had no positioned ancestor — its absolute position resolved against the initial containing block and did not follow the inner `<main>` scroll container, so focusing it on click scroll-into-viewed the window to a stale, shell-less spot. Fixed in `src/web/components/Switch.tsx` by wrapping the checkbox and track in `<span className="relative inline-block">` (restores the pre-extraction positioning context; `peer-checked:` unaffected). The same fix covers Switch's other two call sites (SearchDialog, CompletedFilterToggle). Verified with real-mouse CDP tests at 1366x768 on doc-24/doc-26 (scrollY 1054 -> 0 jump eliminated, window scrollHeight no longer inflated, pager fully functional, zero exceptions), and locked in by `src/test/web-switch.test.tsx`. tsc and `bun run check .` remain clean.

**Seventh review pass (acceptance polish):** the 分页浏览 toggle now sits at the far right of the query-block header, immediately after 重新查询, and the shared Switch on-state is the Settings blue (`peer-checked:bg-blue-500`) instead of emerald, aligning 分页浏览 and 显示已完成 with the Settings page switches. Verified by the user on the dev server; all checks green.
<!-- SECTION:FINAL_SUMMARY:END -->
