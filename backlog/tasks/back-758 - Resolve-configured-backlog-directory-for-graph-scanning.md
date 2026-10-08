---
id: BACK-758
title: >-
  Resolve the configured backlog directory for graph scanning and watching
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-08 03:00'
updated_date: '2026-10-08 03:06'
labels:
  - graph
  - cli
  - bug
milestone: m-9
dependencies:
  - BACK-757
modified_files:
  - src/graph/scanner.ts
  - src/graph/service.ts
  - src/test/graph-foundation.test.ts
ordinal: 321001
actual_start: '2026-10-08 03:00'
actual_end: '2026-10-08 03:06'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After BACK-757 fixed memo storage, the **task graph** and **knowledge graph** still rendered empty on
projects whose data lives under a configured directory (`.backlog` or a custom `backlog_directory`).
The graph scanner (`src/graph/scanner.ts`) and the graph-service watcher (`src/graph/service.ts`)
hardcoded the literal `"backlog"` directory name when building the per-artifact absolute paths,
instead of going through `resolveBacklogDirectory()`:

```ts
const absDir = join(projectRoot, "backlog", dirs[dirName]);   // scanner.ts
const dir    = join(this.projectRoot, "backlog", dirs[dirName]); // service.ts watcher
```

So `scanWhitelistedDirs()` walked `<root>/backlog/tasks`, `<root>/backlog/docs`, … and found nothing
for a `.backlog` project. The graph stayed empty even though the rest of the app (tasks/docs list,
memo storage) already resolved `.backlog` correctly — the symptom users saw was "graph not visible"
after the upgrade, while the server itself no longer threw.

Goal: make graph scanning and watching honor the configured backlog directory like every other
surface, so relocated projects show their task/knowledge graphs again.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `scanWhitelistedDirs()` resolves the configured backlog directory (`.backlog`, `backlog`, or a custom path from `backlog.config.yml`) instead of hardcoding `"backlog"`
- [x] #2 `GraphService` watches the configured directory's whitelisted subdirs, so hot updates fire for `.backlog` projects too (not just `backlog`)
- [x] #3 A `.backlog` project yields the same graph node set as an equivalent `backlog` project (tasks, docs, decisions, … all scanned)
- [x] #4 Uninitialized projects (no resolved directory) fall back to `DEFAULT_DIRECTORIES.BACKLOG` so the default behaviour is preserved
- [x] #5 Existing graph suites stay green (foundation, knowledge, sync)
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx biome check src/graph/scanner.ts src/graph/service.ts src/test/graph-foundation.test.ts` reports no errors
- [x] #2 `bun test src/test/graph-foundation.test.ts` passes, including the new `.backlog` scan case
- [x] #3 `bun test src/test/graph-knowledge.test.ts src/test/graph-sync.test.ts` passes (66 graph tests total, 0 fail)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/graph/scanner.ts`: import `resolveBacklogDirectory` and `DEFAULT_DIRECTORIES`; derive
   `backlogDirName = resolveBacklogDirectory(projectRoot).backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG`
   and use it in the `absDir` join.
2. `src/graph/service.ts`: apply the same resolution in the watcher-dir join inside `start()`.
3. `src/test/graph-foundation.test.ts`: add a `graph scanner` case that seeds a `.backlog` project
   (`.backlog/config.yml` + `tasks/` + `docs/`) and asserts `scanWhitelistedDirs()` returns those
   files with `absPath` resolving under `/.backlog/`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `graphPaths()` (`src/graph/paths.ts`) stores the Kuzu database in the global cache directory
  (`AppData/Local/backlog.md/graph`), never inside the project's backlog dir, so it was never
  affected — only the corpus scan and the file watcher were.
- Verified end-to-end: a synthetic `.backlog` project with two tasks + one doc returns 3 scanned
  files (previously 0); a default `backlog` project still resolves to `backlog/`.
- `resolveBacklogDirectory` can return `backlogDir: null` for a project with no backlog dir at all;
  the `?? DEFAULT_DIRECTORIES.BACKLOG` fallback keeps that case scanning the conventional `backlog/`.
- This is the same root-cause family as BACK-757 (memo storage): the graph surface was the last
  outlier not routing through `resolveBacklogDirectory()`. After this, every artifact surface
  (tasks, docs, decisions, memos, graph) honors the configured directory.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Graph scanning and watching now resolve the configured backlog directory, so the task graph and
knowledge graph populate correctly for `.backlog` (and custom-directory) projects — the "graph not
visible" symptom after the upgrade is resolved. The graph database itself was already in the global
cache and needed no change. A regression test locks the `.backlog` resolution in.

All graph suites stay green (foundation + knowledge + sync = 66 tests, 0 fail), including the new
`.backlog` scan case.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed
- `src/graph/scanner.ts` — resolve the configured directory for the whitelist corpus scan
- `src/graph/service.ts` — resolve the configured directory for the watcher directories
- `src/test/graph-foundation.test.ts` — add a `.backlog` scan regression test
