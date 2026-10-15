---
id: BACK-798
title: Web server crashes wiki tree request when backlog/wiki is missing
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-15 09:43'
updated_date: '2026-10-15 09:55'
labels:
  - bug
  - web
dependencies: []
references:
  - 'src/file-system/operations.ts:2575'
ordinal: 360001
actual_start: '2026-10-15 09:44'
actual_end: '2026-10-15 09:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wiki is an optional feature, but starting the web server in a project without a backlog/wiki directory threw ENOENT from FileSystem.getWikiTree() (buildWikiTreeRecursive at src/file-system/operations.ts:2608), surfaced via handleGetWikiTree (src/server/index.ts:1889) as a full error stack on every wiki tree request. The handler already fell back to an empty tree, so the user-visible result was correct, but the console noise made a normal optional-feature state look like a failure. listWikiPages() already tolerates a missing wiki directory; getWikiTree() did not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 getWikiTree() returns an empty array when backlog/wiki does not exist, logging a single warning instead of throwing
- [x] #2 Non-ENOENT errors from getWikiTree() still propagate so real failures are reported
- [x] #3 A regression test covers the missing-directory case
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In FileSystem.getWikiTree() (src/file-system/operations.ts), wrap the buildWikiTreeRecursive call in try/catch: on ENOENT log a single console.warn with the wiki root path and return []; rethrow any other error so real failures still surface via handleGetWikiTree.
2. Keep behavior consistent with listWikiPages(), which already tolerates a missing wiki directory.
3. Add a regression test in src/test/filesystem.test.ts (wiki operations describe): remove the wiki directory and assert getWikiTree() resolves to [].
4. Verify with bun test src/test/filesystem.test.ts and bunx tsc --noEmit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed in getWikiTree() (src/file-system/operations.ts:2575): ENOENT from buildWikiTreeRecursive is caught, a single console.warn is emitted, and an empty tree is returned, matching listWikiPages()'s tolerance of a missing wiki directory. Other errors still propagate to handleGetWikiTree's error handler. Added regression test 'returns an empty tree when the wiki directory is missing' in src/test/filesystem.test.ts. Verified: bun test src/test/filesystem.test.ts (76 pass), bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
getWikiTree() no longer throws ENOENT when backlog/wiki is missing: it logs one warning and returns an empty tree, matching listWikiPages()'s tolerance, so the web server starts cleanly in projects without the optional wiki feature.

Changed files:
- src/file-system/operations.ts - getWikiTree() wraps buildWikiTreeRecursive, catches ENOENT, emits a single console.warn with the wiki root path, and returns []; other errors still propagate to handleGetWikiTree's error handler
- src/test/filesystem.test.ts - new regression test 'returns an empty tree when the wiki directory is missing' (removes the wiki dir, asserts empty result); adds rm to the node:fs/promises import

Verification:
- bun test src/test/filesystem.test.ts (76 pass / 0 fail)
- bunx tsc --noEmit clean
<!-- SECTION:FINAL_SUMMARY:END -->
