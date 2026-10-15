---
id: BACK-800
title: Fix DuckDB native binding bundling in compiled executables
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-15 15:54'
updated_date: '2026-10-15 15:56'
labels: []
dependencies: []
modified_files:
  - scripts/build.ts
  - src/duckdb/query.ts
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
ordinal: 362001
actual_start: '2026-10-15 15:00'
actual_end: '2026-10-15 15:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
bun run build failed on Windows with 'Could not resolve @duckdb/node-bindings-<platform>' errors: @duckdb/node-bindings/duckdb.js selects its native binding through a runtime platform switch, but the bundler resolves every branch statically while bun install only installs the host platform's optionalDependencies (bun >=1.2.23 filters by os/cpu). After fixing that, the compiled exe crashed at startup with ERR_DLOPEN_FAILED (LoadLibrary: module not found): duckdb.node links against a sibling shared library (duckdb.dll / libduckdb.so / libduckdb.dylib) and Bun compile extracts only the .node into the temp dir (oven-sh/bun#44063), so the OS loader cannot find the library. DuckDB had never been in a released binary, so both issues were latent until someone built locally.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run build succeeds when only the host platform's duckdb binding is installed
- [x] #2 Compiled exe starts and serves DuckDB queries end-to-end (/api/duckdb/query)
- [x] #3 Cross-compiling with BACKLOG_BUILD_TARGET embeds the target platform's binding and sibling library
- [x] #4 CI/release build jobs install the build target's duckdb binding via bun install --os/--cpu
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/build.ts: resolve target platform/arch from BACKLOG_BUILD_TARGET (default host), mark the 7 non-target @duckdb/node-bindings-* packages external, and fail early with a 'bun install --os/--cpu' hint when the target binding is missing
2. scripts/build.ts: virtual module plugin (virtual:duckdb-sibling-lib) resolving to the target binding's sibling shared library so the file loader embeds it into the exe
3. src/duckdb/query.ts: load @duckdb/node-api lazily via dynamic import; before the first load, write the embedded sibling library into os.tmpdir() (size check against stale leftovers, write-then-rename for concurrent exes); no-op when running from source
4. .github/workflows/release.yml + ci.yml: add duckOs/duckCpu matrix fields and pass --os/--cpu to bun install so cross-compile jobs get the target binding
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root causes: (1) bun >=1.2.23 installs only host-matching platform optionalDependencies, while the bundler statically resolves every branch of the duckdb.js platform switch; (2) oven-sh/bun#44063 — bun compile extracts only the .node, not the sibling duckdb.dll/libduckdb.so/libduckdb.dylib it links against. Validated the sibling-extraction workaround with a minimal repro before touching the repo. Verified: bun run build; exe serves /api/duckdb/query against a CSV; local cross-compile BACKLOG_BUILD_TARGET=bun-linux-arm64; bun test src/test/duckdb.test.ts (38 pass); bunx tsc --noEmit; biome clean on touched files. The 5s-timeout flakes in implementation-notes tests reproduce on clean main and are unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed DuckDB native binding bundling for compiled executables.

Changes:
- scripts/build.ts: non-target @duckdb/node-bindings-* marked external; target binding verified with an install hint; sibling shared library embedded via a virtual-module plugin
- src/duckdb/query.ts: @duckdb/node-api loaded lazily; embedded sibling library extracted to the temp dir before first load
- CI/release workflows install the build target's binding with bun install --os/--cpu

Verification:
- bun run build + exe smoke test (DuckDB query over CSV via /api/duckdb/query)
- Cross-compile bun-linux-arm64 locally
- bun test src/test/duckdb.test.ts, bunx tsc --noEmit, bun run check .
<!-- SECTION:FINAL_SUMMARY:END -->
