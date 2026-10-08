---
id: BACK-757
title: >-
  Resolve the configured backlog directory for memo storage and ensure structure
  on re-init
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-08 01:43'
updated_date: '2026-10-08 02:40'
labels:
  - memos
  - cli
  - bug
milestone: m-9
dependencies: []
modified_files:
  - src/core/memos.ts
  - src/core/init.ts
  - src/test/memos.test.ts
ordinal: 321000
actual_start: '2026-10-08 01:43'
actual_end: '2026-10-08 02:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After upgrading the backlog tool, projects that keep their data under a configured directory
(`--backlog-dir .backlog` or a `backlog.config.yml` `backlog_directory`) broke the memo feature.

Two independent defects:

1. **Memo IO ignored the configured backlog directory.** `memoDir()` and `memoArchiveDir()` in
   `src/core/memos.ts` hardcoded `DEFAULT_DIRECTORIES.BACKLOG` (`"backlog"`). Every other artifact
   (tasks, docs, decisions, milestones) resolves its directory through the filesystem's
   `getBacklogDir()`, which honours `resolveBacklogDirectory()`. Memos were the only outlier, so the
   browser server's `startMemoWatcher()` watched `backlog/memos` (error: `ENOENT` when only
   `.backlog/memos` exists) and every memo write/read landed in the wrong folder for relocated
   projects.

2. **Re-init skipped structure creation.** `initializeProject()` in `src/core/init.ts` only called
   `saveConfig()` on the re-initialization path and omitted `ensureBacklogStructure()`. Re-running
   `backlog init` against an already-initialized (upgraded) project therefore did not create missing
   `memos/` (and `docs/`, the wiki root) directories.

Goal: make memo storage follow the configured backlog directory like every other artifact, and make
re-init guarantee the on-disk structure exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `memoDir()` / `memoArchiveDir()` resolve the configured backlog directory (`.backlog`, `backlog`, or a custom path from `backlog.config.yml`) instead of hardcoding `"backlog"`
- [x] #2 The browser server's `startMemoWatcher()` watches the configured memo directory, so a `.backlog` project no longer throws `ENOENT` on `backlog/memos` at start
- [x] #3 Re-initialization (`backlog init` on an existing project) calls `ensureBacklogStructure()` so missing `memos/` / `docs/` directories are created
- [x] #4 Default behaviour is preserved: a project with no configuration still resolves to `backlog/memos`; existing tests pass
- [x] #5 The memo-directory path-escape guard (`refuses an id that would escape the memo directory`) still holds after the resolution change
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` clean for the touched modules
- [x] #2 `bunx biome check src/core/memos.ts src/core/init.ts src/test/memos.test.ts` reports no errors
- [x] #3 `bun test src/test/memos.test.ts` 23 pass (incl. two new `.backlog` cases)
- [x] #4 `bun test src/test/server-memo-broadcast.test.ts src/test/server-memos-endpoint.test.ts` 19 pass
- [x] #5 `bun test src/test/web-memos-page.test.tsx` 54 pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/core/memos.ts`: add a private `backlogDirNameFor(root)` that calls the existing
   `resolveBacklogDirectory(root)` and falls back to `DEFAULT_DIRECTORIES.BACKLOG` when nothing is
   configured; rewrite `memoDir()` / `memoArchiveDir()` to `join(root, backlogDirNameFor(root), ...)`.
   This reuses the exact resolution the rest of the project already uses - no new discovery logic.
2. `src/core/init.ts`: in the `isReInitialization` branch, call
   `await core.filesystem.ensureBacklogStructure()` before `saveConfig()` (recursive, idempotent,
   and it resolves the configured directory instead of assuming `backlog/`).
3. `src/test/memos.test.ts`: add a describe block that seeds `.backlog/config.yml` and asserts
   `memoDir`/`memoArchiveDir` resolve under `.backlog/`, plus a round-trip write/read.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `resolveBacklogDirectory()` is the single source of truth already used by the filesystem; calling
  it from the standalone `memoDir()` keeps memos consistent with tasks/docs/etc. without threading a
  cached filesystem instance through the pure memo module.
- Fallback to `"backlog"` preserves behaviour for projects that have neither `backlog/` nor
  `.backlog/` yet (e.g. a scratch project). The existing `memoDir` test that asserts
  `join(root, "backlog", "memos")` still passes because the test seeds `backlog/config.yml`.
- Verified end-to-end against a synthetic `.backlog` project: `resolveBacklogDirectory` returns
  `.backlog`, `memoDir` returns `<root>/.backlog/memos`, and `ensureBacklogStructure()` creates
  `memos/` and `docs/` (the wiki root) under `.backlog/`.
- Note on test flakiness: `src/test/mcp-memos.test.ts > deletes a memo` intermittently times out in
  its `afterEach` on Windows - a pre-existing `recursive: true` content-store watcher vs. `rm -rf`
  race, unrelated to this change (it passes in isolation and on most full runs; the same suite also
  flakes on `memo-search`'s server-boot case per known issues). `McpServer` does not use
  `startMemoWatcher`, so this change cannot alter its memo behaviour.
- `bun.lock` was rewritten incidentally by `bun test`/`bunx`; it is not part of the fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Memo storage now follows the configured backlog directory. `memoDir()`/`memoArchiveDir()` resolve
through `resolveBacklogDirectory()`, so the browser's memo watcher and every memo write/read target
`.backlog/memos` (or a custom directory) exactly like the rest of the project - the `ENOENT` watcher
error on upgraded `.backlog` projects is gone. Re-running `backlog init` now also recreates any
missing `memos/` and `docs/` directories via `ensureBacklogStructure()` on the re-init path.

All memo-related suites stay green (memos 23, server memo 19, web memo page 54), including the
directory-escape security guard.
<!-- SECTION:FINAL_SUMMARY:END -->
