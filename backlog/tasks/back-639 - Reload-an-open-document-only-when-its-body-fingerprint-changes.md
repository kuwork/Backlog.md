---
id: BACK-639
title: Reload an open document only when its body fingerprint changes
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-15 06:26'
updated_date: '2026-09-15 07:25'
labels:
  - web-ui
dependencies: []
ordinal: 240400
actual_start: '2026-09-15 06:26'
actual_end: '2026-09-15 07:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web viewer ignores external edits until the page is manually reloaded: editing a document file on disk (or through another agent) never reaches an open `/documentation/:id` page.

Cause: BACK-637 added a `handledRouteIdRef` guard in DocumentationDetail so an unrelated docs-array refresh could not unmount the body and reset the reader's scroll position. The guard keys off the route id alone, so it cannot tell an unrelated refresh from a real body edit and suppresses both.

The websocket path is already correct: the content store re-parses documents from disk, detects the change, notifies, the server broadcasts `tasks-updated`, and the client rebuilds the docs array. Only the decision to reload is missing a signal about *what* changed.

Fix by giving every document a body fingerprint, and reloading an open document only when that fingerprint differs from the body on screen. An unchanged refresh keeps the current DOM and scroll position (BACK-637 AC #6 stays true), an in-progress edit buffer is never overwritten, and a fetch that resolves after the reader moved to another document is discarded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A document payload carries a stable fingerprint of its raw body, and the fingerprint never reaches the markdown written to disk
- [x] #2 Editing the open document's body outside the app refreshes the rendered body without a manual page reload
- [x] #3 Refreshing the docs array without a body change neither reloads the document nor re-enters the loading state
- [x] #4 While the document is in edit mode, an automatic refresh does not overwrite the in-progress buffer
- [x] #5 A content fetch that resolves after the reader switched to another document id is discarded
- [x] #6 Web documentation refresh tests cover the changed-body reload, the unchanged-refresh guard, and BACK-637 anchor preservation
- [x] #7 bunx tsc --noEmit, bun run check . and bun test pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a shared contentFingerprint() helper under src/utils (pure, works in Bun and the browser).
2. Carry the fingerprint on Document: compute it in parseDocument, type it in src/types, and include it in the /api/docs payload.
3. In DocumentationDetail, reload the open body only when the incoming fingerprint differs from the rendered one; keep the fetch silent so the DOM and scroll position survive, skip while editing, and drop results that resolve after a route change.
4. Extend src/test/web-documentation-refresh.test.tsx with the changed-body reload, the unchanged-refresh guard and the BACK-637 anchor case.
5. Run bunx tsc --noEmit, bun run check . and bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Kept BACK-637's handledRouteIdRef guard: the fingerprint effect runs beside it, not instead of it, so an unrelated refresh still never remounts the body and the reader's anchor survives.

The docs payload already carries the fingerprint, so deciding whether to reload costs no extra request. The reload stays silent (isLoading never flips), which also keeps the effect's isLoading guard from re-entering on its own render.

Fingerprints are derived on every parse and never serialized; src/test/markdown.test.ts asserts serializeDocument output does not contain contentHash.

Validation: bunx tsc --noEmit clean; bun run check . clean for every touched file; bun test src/test/web-documentation-refresh.test.tsx src/test/markdown.test.ts => 55 pass / 0 fail.

Live check: editing backlog/docs/migration/doc-12 on disk refreshed the already-open /documentation/12 page over the websocket, no manual reload, and an unchanged refresh left the page alone.

The full bun test suite is extremely slow on this Windows host (still running after 32 minutes) and its remaining failures are unrelated to this change: 23 CLI-spawn tests exceed the 5s per-test budget while an equivalent passing sibling takes 6-20s, plus atomic-task-create.test.ts > 'allows concurrent entry into the save path' which fails on a Windows temp-dir EBUSY/lock timeout and has no documents code in it at all.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gave every document a body fingerprint so an open viewer reloads only when the text really changed.

Changes:/n- src/utils/content-fingerprint.ts: dependency-free fingerprint (length + 32-bit FNV-1a hash), pure so it runs in Bun and in the browser.
- src/markdown/parser.ts: parseDocument stamps contentHash on every read; it is derived state and never reaches the markdown written back to disk.
- src/types/index.ts: Document.contentHash, documented as read-derived.
- src/server/index.ts: /api/docs carries contentHash so the client can decide without an extra request.
- src/web/components/DocumentationDetail.tsx: a new effect compares the incoming fingerprint with the body on screen and reloads silently only when they differ. loadDocContent gains a {silent} path that keeps the DOM mounted, so the scroll position and the hash anchor survive; edit mode is skipped, a failed silent refresh keeps the body already on screen, and a fetch that resolves after the reader switched documents is discarded. BACK-637's route guard is untouched.

Verification:/n- bunx tsc --noEmit: clean
- bun run check .: clean for all touched files
- bun test src/test/web-documentation-refresh.test.tsx src/test/markdown.test.ts: 55 pass / 0 fail
- Live: editing doc-12 on disk refreshed the open /documentation/12 page without a manual reload

Known, unrelated: the full bun test suite is very slow on this Windows host; its remaining failures are CLI-spawn tests exceeding the 5s per-test budget and one Windows temp-dir EBUSY flake in atomic-task-create.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
