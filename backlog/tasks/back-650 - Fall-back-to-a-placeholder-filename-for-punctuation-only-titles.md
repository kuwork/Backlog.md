---
id: BACK-650
title: Fall back to a placeholder filename for punctuation-only titles
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 21:04'
updated_date: '2026-09-18 05:42'
labels: []
dependencies: []
references:
  - 'src/core/content-store.ts:1029'
  - 'src/core/content-store.ts:1129'
  - 'src/utils/task-path.ts:197'
  - 'src/file-system/operations.ts:1247'
  - 'src/file-system/operations.ts:2382'
  - 'src/core/duplicate-task-repair.ts:168'
actual_start: '2026-09-18 05:26'
actual_end: '2026-09-18 05:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A punctuation-only title such as '!!!' sanitizes to an empty segment, so the saved file is 'back-42 - .md' instead of 'back-42 - <title>.md'. The empty segment itself round-trips through every parser, but the '<id> - ' prefix is load-bearing for the readers that recover an id from a filename: the content-store task watcher takes the id from the segment before the first space (src/core/content-store.ts:1029) while the decision watcher splits on ' - ' (src/core/content-store.ts:1129); task-path resolves an id with base.split(' - ')[0] (src/utils/task-path.ts:197); document saving matches an existing file by base.split(' - ')[0] before resaving (src/file-system/operations.ts:1247) and the docs tree labels nodes the same way (src/file-system/operations.ts:2382); duplicate-task repair refuses to rebuild a path without the separator (buildTargetPath, src/core/duplicate-task-repair.ts:168). Emitting id-only filenames would break all of them, so the fallback belongs in the single function that owns filename sanitization instead of at each call site.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A punctuation-only title produces a filename with a non-empty title segment (e.g. 'task-42 - untitled.md')
- [x] #2 Filenames keep the 'id - title.md' shape; no id-only filenames are introduced
- [x] #3 Tests cover punctuation-only titles for tasks, docs, and decisions
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Probe how this fork generates filenames: sanitizeFilename (src/file-system/operations.ts:1811) is the only owner, shared by tasks, drafts, decisions and documents.
2. Confirm the '<id> - <title>.md' shape is load-bearing by reading the readers that parse the filename: the content-store task and decision watchers, the task-path id lookup, document save dedup, the docs tree and duplicate-task repair.
3. Add the empty-result fallback inside sanitizeFilename so every call site keeps the separator without special-casing an empty title.
4. Cover tasks, drafts, decisions and documents in src/test/filesystem.test.ts, including id recovery by both filename splitters and document resave dedup.
5. Revert-verify the new cases, then run bunx tsc --noEmit, bun run check . and the scoped test file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1-AC2: sanitizeFilename kept its character-stripping chain unchanged and now returns the sanitized value or the 'untitled' placeholder, so a '!!!' title yields 'task-1 - untitled.md'. The fix is one function (src/file-system/operations.ts:1811-1822) and all four call sites inherit it: saveTask:546, saveDraft:1019, saveDecision:1196, saveDocument:1233. The title itself is untouched - frontmatter keeps '!!!' and task list renders it.

AC3: src/test/filesystem.test.ts gains a "punctuation-only titles" block with 5 cases covering tasks, drafts, decisions and documents. Two of them assert the shape the readers need rather than just a non-empty string: the filename still splits into the id on the first space and still contains ' - '. The document case resaves with different content and asserts the docs dir holds exactly one 'doc-punct - untitled.md', which is the dedup path an id-only filename would miss. Drafts are read through getDraftsDir, the task-side cases via tasksDir. One adaptation when porting the upstream case set: its write-target assertion used a file-path accessor this fork does not have, so the target is asserted with stat on the expected path plus readdir.

Verification: reverting the fallback (plain 'return sanitized') turns 4 of the 5 new cases red, observing 'decision-punct - .md' and 'doc-punct - .md'. The second case still passes in the reverted state because an empty title keeps both the space split and the ' - ' separator, so it is a shape guard rather than a defect detector. Scoped run: bun test --timeout 240000 src/test/filesystem.test.ts -> 74 pass, 0 fail. End-to-end in a throwaway project built with initializeTestProject: task create '!!!' -> 'task-1 - untitled.md', doc create '!!!' -> 'doc-1 - untitled.md', draft create '!!!' -> 'draft-1 - untitled.md', and task list still shows the '!!!' title. bunx tsc --noEmit clean; bun run check . over 414 files, 0 errors and only the 3 pre-existing noNonNullAssertion warnings in src/core/assets.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made sanitizeFilename fall back to an 'untitled' placeholder when a title sanitizes to an empty string, so a punctuation-only title such as '!!!' produces 'task-1 - untitled.md' instead of 'task-1 - .md'. A single function owns the fix, so tasks, drafts, decisions and documents all keep the '<id> - <title>.md' shape that the filename readers depend on: the content-store task watcher (id from the first space), document save dedup and duplicate-task repair (both need the ' - ' separator). Emitting id-only filenames, as patching one call site at a time would do, breaks all three.

Verified with 5 new cases in src/test/filesystem.test.ts covering tasks, drafts, decisions and documents, including id recovery by both filename splitters and a document resave that must still dedupe to a single file; reverting the fallback turns 4 of them red. Scoped run 74 pass / 0 fail, bunx tsc --noEmit clean, bun run check . over 414 files with 0 errors, and a throwaway-project CLI run producing 'task-1 - untitled.md', 'doc-1 - untitled.md' and 'draft-1 - untitled.md' with the '!!!' title preserved in frontmatter and rendered by task list.
<!-- SECTION:FINAL_SUMMARY:END -->
