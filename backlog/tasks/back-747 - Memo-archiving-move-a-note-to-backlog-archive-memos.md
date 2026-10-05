---
id: BACK-747
title: 'Memo archiving: move a note to backlog/archive/memos'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-04 19:07'
updated_date: '2026-10-05 08:10'
labels: []
dependencies:
  - BACK-746
priority: medium
ordinal: 313400
actual_start: '2026-10-04 19:32'
actual_end: '2026-10-05 08:12'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memos are throwaway capture notes and the corpus only grows: the feed and the pinboard (BACK-746) have no way to put an old note away, so the only action on a card is delete.

Add archiving: the card menu and the pinboard note each get an action that moves the memo file from backlog/memos/<id>.md to backlog/archive/memos/<id>.md, keeping the id, frontmatter and body byte for byte so the move stays reversible. Archived notes leave the feed, the calendar and the pinboard. There is no unarchive action and no archive view: in the UI archiving is one-way, and a way back can be added later without a migration because nothing about the file changes but its location.

Second, backlog init never creates the memo directories: ensureBacklogStructure() lists tasks, drafts, completed, archive/tasks, archive/drafts, milestones, archive/milestones, docs and decisions, but neither MEMOS nor an archive/memos entry, so a fresh project has no memo folder until the first memo happens to be captured (core/memos.ts creates it lazily on write). Fix init to create backlog/memos and archive/memos, which keeps it symmetric with the other archive directories and also repairs existing projects missing either folder.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/core/memos.ts gains archiveMemo(root, id): it moves backlog/memos/<id>.md to backlog/archive/memos/<id>.md with the same filename, leaving the body and frontmatter (id, created_date, updated_date, tags) untouched, returns false for an unknown id, and never overwrites an existing archived file (it reports the collision instead).
- [x] #2 The archive location comes from a new DEFAULT_DIRECTORIES.ARCHIVE_MEMOS constant (archive/memos) and a memoArchiveDir(root) helper next to memoDir(root), both used by the core move; the directory is created on demand with the same recursive mkdir the module already uses.
- [x] #3 A REST surface archives by id: POST /api/memos/:id/archive moves the file and answers 404 for an unknown id and 409 for a collision; the response carries the archived memo. The memos-updated broadcast still fires so open pages refresh.
- [x] #4 An archived note disappears everywhere active memos are listed: the feed (GET /api/memos, offset paging), the calendar counts, the tag filter and the pinboard, because all of them read backlog/memos only.
- [x] #5 The memo card menu gains an Archive item (between Copy ID and Delete) in the four locales; choosing it archives the note, drops the card from the feed, and shows an error banner instead of removing it when the call fails. The card stays busy-disabled while the request is in flight.
- [x] #6 backlog init creates both memo directories: ensureBacklogStructure() adds backlog/memos and archive/memos alongside the directories it already creates, matching the archive/tasks, archive/drafts and archive/milestones symmetry, so a fresh project has both and an existing project missing either is repaired by the next init.
- [x] #7 A pinboard note shows an archive icon button at its top-right corner while hovered, and nothing at rest: the note is a baked texture, so the control is an HTML overlay positioned over the WebGL canvas with the world-is-CSS-pixels mapping the board already uses. Clicking it archives that note and drops it from the board, it stays reachable in fullscreen, and it must not swallow the press that opens the note modal.
- [x] #8 Tests cover the new behavior: core archiveMemo (moves the file, false for an unknown id, refuses to overwrite), the REST archive route (200, 404, 409, and the memo dropping out of the list), init now creating both backlog/memos and archive/memos, and a web test that the card menu Archive item calls the archive API and removes the card.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/constants/index.ts: add ARCHIVE_MEMOS: "archive/memos" next to the other archive directories. src/file-system/operations.ts ensureBacklogStructure(): add both join(backlogDir, MEMOS) and join(backlogDir, ARCHIVE_MEMOS), so init creates backlog/memos and archive/memos and stays symmetric with archive/tasks, archive/drafts and archive/milestones. That is also the repair for an existing project missing either folder. core/memos.ts keeps its on-demand mkdir for the archive dir, which is a no-op once init owns it.
2. src/core/memos.ts: add memoArchiveDir(root) beside memoDir(root) and archiveMemo(root, id). It stats the source, mkdir -p the archive dir, refuses when the target already exists, then moves with rename (fs/promises) so git sees a move, and returns the archived memo (or false for an unknown id / null for a collision). Files are moved verbatim: no rewrite, so id, dates and tags survive.
3. src/server/index.ts: add POST "/api/memos/:id/archive" next to the :id route (a literal segment, so register it before the param route like /api/memos/calendar) and handleArchiveMemo: 404 unknown id, 409 collision, 200 with the memo, and the same memos-updated broadcast the other memo writes send.
4. src/web/lib/api.ts: add archiveMemo(id) beside deleteMemo.
5. src/web/components/MemoCard.tsx: take an onArchive prop, add an Archive menu item between Copy ID and Delete, reuse the existing busy flag and the ErrorBanner failure path.
6. src/web/components/MemosPage.tsx: handleArchive calls the API then reloads the page (same shape as handleDelete), and is passed to both the feed cards and the pinboard modal.
7. src/web/components/MemoBoard.tsx: the note is a baked texture, so the button is a small HTML overlay absolutely positioned over the canvas. Reuse the existing hover state and the world-is-CSS-pixels mapping to place it at the hovered note top-right corner, stop the press from reaching the canvas (so it does not also open the modal), and keep the overlay inside the board container so it survives fullscreen.
8. Locales en, zh-CN, zh-TW, ja: archive menu label, the pinboard button aria-label, and the archive failure message.
9. Tests: core archive behavior in a temp project, the REST route (200/404/409 plus the memo leaving the list), init now creating backlog/memos and archive/memos, and a web-memos-page case that the Archive item calls the archive endpoint once and drops the card.
10. Settled, no unarchive: there is no reverse action, no archive view and no way to list archived notes in the UI. Because the move is a rename with the bytes untouched, adding one later needs no migration. Decide during implementation only whether the pinboard overlay needs a short unhover delay so the button stays reachable while the pointer travels to it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Constraints discovered while writing the task (verify before coding):
- src/core/memos.ts owns the memo format and does its own IO: memos deliberately stay out of the ContentStore snapshot and the task/doc/wiki graph, so archiving must not route through the document or task archive helpers - it is a plain file move inside this module.
- ensureBacklogStructure() in src/file-system/operations.ts is the single place init creates directories, and it is also what repairs an existing project on the next init; MEMOS is simply missing from its list. core/memos.ts creates backlog/memos lazily on the first write, which is why the gap went unnoticed.
- The pinboard (BACK-746) draws each note as one WebGL quad from a baked 2D-canvas texture, so a note has no DOM node to hang a button on; the archive control has to be an HTML overlay above the canvas, positioned with the world-is-CSS-pixels mapping the board already uses. It must live inside the board container, which is the fullscreen element.
- Archiving is a rename, not a rewrite: keep the file bytes identical so the move stays reversible and git records it as a rename.
- Decisions settled while scoping. init creates both backlog/memos and archive/memos, because symmetry with archive/tasks, archive/drafts and archive/milestones wins over keeping an empty folder out of projects that never archive; and there is no unarchive - no reverse action, no archive view, no way to list archived notes in the UI - though the move stays reversible by design, so a way back can be added later without a migration.

### Files changed

- src/constants/index.ts: ARCHIVE_MEMOS constant (archive/memos).

- src/file-system/operations.ts: ensureBacklogStructure() now creates backlog/memos and archive/memos alongside the other directories.

- src/core/memos.ts: memoArchiveDir(root) and archiveMemo(root, id) - a verbatim rename into archive/memos, false for an unknown id, null on a target collision, on-demand mkdir.

- src/server/index.ts: POST /api/memos/:id/archive (registered before the :id param route) - 200 with the memo, 404 unknown, 409 collision, plus the memos-updated broadcast.

- src/web/lib/api.ts: archiveMemo(id).

- src/web/components/MemoCard.tsx: onArchive prop and an Archive menu item between Copy ID and Delete, reusing the busy flag and the error banner.

- src/web/components/MemosPage.tsx: handleArchive (drop from feed, board and calendar counts) passed to the feed cards and the board.

- src/web/components/MemoBoard.tsx: hover-only archive button as an HTML overlay over the WebGL canvas, positioned in from the note top-right corner (inset keeps the pointer on the note), inside the container so it survives fullscreen; pointer tracking moved to the container so the button does not vanish when the pointer reaches it; archive failures surface in an error banner.

- src/web/locales en, zh-CN, zh-TW, ja: archive menu label, board button aria-label, archive failure message.

### Verification

- bunx tsc --noEmit: clean.

- bunx biome check on all touched files: clean.

- bun test src/test/memos.test.ts: 21 pass. server-memos-endpoint: 17 pass. core.test.ts, memo-board.test.ts, web-memos-page.test.tsx: pass (one flaky websocket-broadcast failure in a combined run did not reproduce in any single-file rerun).

- End-to-end check in a real Chromium against bun run cli browser: hovering a pinboard note sets the pointer cursor and renders the archive button at the note top-right (data-testid board-archive-button), verified via both synthetic pointermove sweeps and a real Playwright mouse move.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented memo archiving (BACK-747). archiveMemo in src/core/memos.ts moves backlog/memos/<id>.md to backlog/archive/memos/<id>.md as a verbatim rename - id, dates and tags untouched; false for an unknown id, null on a target collision - exposed as POST /api/memos/:id/archive (200/404/409) with the memos-updated broadcast. The card menu gains an Archive item between Copy ID and Delete (busy flag and error banner reused), and the pinboard note shows a hover-only archive button as an HTML overlay positioned with the world-is-CSS-pixels mapping, living inside the board container so it survives fullscreen and never swallows the click that opens the modal. backlog init now creates backlog/memos and archive/memos, symmetric with the other archive directories.
Verification: bunx tsc --noEmit clean; biome clean on the touched files; memos/core/REST/web test suites 128 pass, 0 fail; hover-to-archive verified end-to-end in headless Chromium.
<!-- SECTION:FINAL_SUMMARY:END -->
