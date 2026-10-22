---
id: BACK-817
title: Fix doc view failing on bare IDs for subdirectory documents
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-22 07:00'
updated_date: '2026-10-22 07:21'
labels: []
dependencies: []
references:
  - 'src/utils/document-id.ts:145'
  - src/test/cli-doc-view.test.ts
modified_files:
  - src/utils/document-id.ts
  - src/test/cli-doc-view.test.ts
ordinal: 379001
actual_start: '2026-10-22 07:13'
actual_end: '2026-10-22 07:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Regression introduced by BACK-598 (commit 032ab8fe, first tag containing it: v1.50.1-CN): findDocumentByReference calls findDocumentById only for its ambiguity-throwing side effect and discards the return value. With no conflict, a document matched by bare ID (doc-20 or 20) is never returned; lookup falls through to path-stem and title-slug forms, whose keys never contain the bare ID, so the function returns null and the CLI prints 'Document doc-20 not found.'

Why root-level docs masked the bug: a root file like doc-1 - Title.md has a path stem equal to doc-1, so bare IDs resolve through the path form. All existing tests used root-level docs. Documents in subdirectories (e.g. memos/doc-20 - ....md) have stems like memos/doc-20, so bare IDs always miss.

User-visible trigger: backlog doc list --plain lists doc-20, but backlog doc view doc-20 and doc view 20 both report not found.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc view with a bare numeric ID or doc-ID prints content for documents in subdirectories
- [x] #2 A non-conflicting frontmatter ID match is returned directly, never falling through to path/slug lookups
- [x] #3 Conflicting IDs still fail closed with AmbiguousIdError and candidate hints
- [x] #4 cli-doc-view tests cover both bare-ID forms for a subdirectory document and all tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Locate the regression: findDocumentByReference (src/utils/document-id.ts:145) discards the findDocumentById return value
2. Fix: capture the result and return it on a non-conflicting ID match
3. Add a regression test: view a subdirectory document via both bare-ID forms (doc-20 and 20) in src/test/cli-doc-view.test.ts
4. Verify: bun test src/test/cli-doc-view.test.ts, biome check, and doc view doc-20 on this repo's real data
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix implemented and verified: a one-line change (capture the byId result and return it) plus one regression test. 10/10 tests pass, biome is clean, and doc view doc-20 --plain works against real data. Changes are not yet committed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed doc view failing on bare IDs for subdirectory documents.

Root cause: since BACK-598 (commit 032ab8fe), findDocumentByReference called findDocumentById only for its ambiguity side effect and discarded the return value, so non-conflicting bare-ID matches fell through to path/slug lookups that never contain the bare ID. Root-level docs masked the bug because their path stem equals the bare ID.

Changes:
- src/utils/document-id.ts: capture the byId result and return it on a non-conflicting match
- src/test/cli-doc-view.test.ts: regression test viewing a subdirectory document via both bare-ID forms (doc-20 and 20)

Verification:
- bun test src/test/cli-doc-view.test.ts: 10/10 pass
- bunx tsc --noEmit: clean
- bun run check .: no errors
- doc view doc-20 --plain against this repo's real data: prints the document
<!-- SECTION:FINAL_SUMMARY:END -->
