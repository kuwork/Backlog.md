---
id: BACK-598
title: Allow CLI doc view to disambiguate by path or title slug
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-25 23:05'
updated_date: '2026-08-26 06:17'
labels:
  - cli
  - bug
dependencies: []
ordinal: 205400
actual_start: '2026-08-26 05:03'
actual_end: '2026-08-26 05:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-596 made document identity fail-closed across the entire docs tree. When two documents share the same frontmatter id (for example `backlog/docs/guide/doc-1 - Title.md` and `backlog/docs/migration/doc-1 - Title.md`), `backlog doc view 1` now correctly reports an ambiguity error instead of silently picking one.

However, the CLI previously only accepted a bare document id, and its ambiguity error only suggested renaming or deleting files. Users had no way to specify which of the colliding documents they wanted to view without first renaming one of them. This task extends doc view to accept three additional lookup forms — using `backlog/docs/subdir/doc-1 - Title.md` as the canonical example — that bypass the id-based ambiguity:

1. Code-name short path: `backlog doc view subdir/doc-1` (docs-relative path using just the file's id stem)
2. Title: `backlog doc view Title` (filename title portion after `doc-1 - `)
3. Full filename: `backlog doc view "doc-1 - Title.md"` (quote filenames that contain spaces)

Each form resolves against the filesystem listing and returns the unique document when exactly one match exists; otherwise the command remains fail-closed, prints the candidate list, and appends a ready-to-run hint for each candidate (the unique directory/id stem when possible, otherwise the full docs-relative path without `.md`). This keeps the fail-closed semantics while giving users a practical escape hatch when two documents legitimately share the same numeric id in different subdirectories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resolves a document by its relative path under backlog/docs (e.g., migration/doc-14)
- [x] #2 resolves a document by its filename title slug (e.g., BACK-596-Code-Review-Report)
- [x] #3 If a path or slug still matches more than one document, the command prints the candidate list and exits with code 1
- [x] #4 Bare id lookup behavior remains unchanged and still fail-closed on ambiguity
- [x] #5 Tests cover path lookup, title-slug lookup, and their ambiguity cases
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: entity-id.ts AmbiguousIdError gained an optional subject phrase so non-ID lookups report Document reference ambiguity while the default Document ID doc-N wording stays byte-identical. document-id.ts added findDocumentByReference with three passes: bare-ID first (delegates to findDocumentById, still fail-closed), then docs-relative path (full path sans .md or dir/filename-id stem; backslashes and ./ segments normalized; .. traversal and drive prefixes rejected), then filename title slug (basename sans .md plus portion after the first id-title separator, case-insensitive). Each pass must match at most one file or it throws with the sorted candidate list; a bare-ID ambiguity throws immediately and is never rescued by later forms. Core gained getDocumentContentByReference resolving against one listDocuments pass and reusing the shared file reader; getDocumentContent refactored onto readDocumentFile with behavior unchanged for MCP/server/TUI callers. CLI doc view switched to getDocumentContentByReference and its help schema documents the three accepted forms.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-08-26 05:42
---
Follow-up polish: the ambiguity error for doc view now appends ready-to-run alternatives, e.g. backlog doc view migration/doc-14, computed by documentReferenceSuggestions from the candidate paths (unique dir/id stem when unambiguous, otherwise full path sans .md; quoted when it contains spaces). Purely additive CLI stderr output after the existing fail-closed message; identity semantics and other surfaces unchanged.
---

created: 2026-08-26 06:12
---
Polished description and help text to consistently use the canonical doc-1 - Title.md example and code-name short path / title / full filename terminology.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Doc view now accepts three reference forms: bare ID (unchanged, fail-closed on ambiguity), docs-relative path such as migration/doc-14 or the full migration/doc-14 - Title.md filename with optional .md, and filename title slug such as BACK-596-Code-Review-Report (case-insensitive). Path and slug lookups resolve against the filesystem listing and fail closed with a sorted candidate list when several files match, so users can disambiguate duplicate frontmatter IDs across subdirectories without renaming files. Resolution lives in findDocumentByReference (src/utils/document-id.ts) wired through Core.getDocumentContentByReference; bare-ID identity for MCP/server/web/TUI is untouched. Verified: bunx tsc --noEmit clean; Biome clean on all touched files; 8/8 cli-doc-view tests including new ambiguity cases; all 8 document-related suites green (51 pass, 1 skip); live smoke tests against this repo's real doc-14 collision in guide/ vs migration/. Known pre-existing issues unrelated to this task, present at HEAD: bun run check . fails on three noNonNullAssertion errors in src/core/assets.ts (external PR #668), and mcp-server workflow overview test drifts from task_list statusExcluded schema.
<!-- SECTION:FINAL_SUMMARY:END -->
