---
title: BACK-598 Allow CLI doc view to disambiguate by path or title slug
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - cli
  - bug
source_path: backlog/tasks/back-598 - Allow-CLI-doc-view-to-disambiguate-by-path-or-title-slug.md
---

# BACK-598 Allow CLI doc view to disambiguate by path or title slug

BACK-596 made document identity fail-closed, so two documents sharing a frontmatter id (e.g. `guide/doc-1 - Title.md` and `migration/doc-1 - Title.md`) became unviewable by bare ID with no escape hatch. This task extends `backlog doc view` with three reference forms — bare ID (unchanged), docs-relative path (e.g. `migration/doc-14`), and filename title slug — while keeping every lookup fail-closed with a sorted candidate list and ready-to-run disambiguation hints.

## Summary

- `src/utils/document-id.ts` gained `findDocumentByReference` with three ordered passes: bare ID (delegates to `findDocumentById`, still fail-closed), docs-relative path (full path sans `.md` or `dir/id-stem`; backslashes and `./` normalized, `..` traversal and drive prefixes rejected), then filename title slug (case-insensitive, portion after the first `id - ` separator).
- Each pass must match at most one file or it throws with the sorted candidate list; a bare-ID ambiguity throws immediately and is never rescued by later forms.
- `AmbiguousIdError` gained an optional subject phrase so non-ID lookups report "Document reference ambiguity" while the default "Document ID doc-N" wording stays byte-identical.
- Core gained `getDocumentContentByReference` resolving against one `listDocuments` pass; `getDocumentContent` refactored onto the shared `readDocumentFile` helper with behavior unchanged for MCP/server/TUI callers.
- CLI `doc view` switched to `getDocumentContentByReference`; help schema documents the three accepted forms.
- Follow-up polish: ambiguity errors append ready-to-run alternatives via `documentReferenceSuggestions` (unique dir/id stem when unambiguous, otherwise full path sans `.md`, quoted when it contains spaces).

## Acceptance Criteria

- Resolves a document by docs-relative path (e.g. `migration/doc-14`) and by filename title slug.
- Path/slug lookups that still match more than one document print the candidate list and exit with code 1.
- Bare ID lookup remains unchanged and fail-closed on ambiguity; tests cover path lookup, slug lookup, and ambiguity cases.

## Related Concepts

- [[concepts/task-identity]] — Extends the fail-closed identity model with path/slug reference resolution and candidate-list ambiguity errors.
- [[concepts/cli-entry]] — doc view command surface, help schema, and exit-code semantics.

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — The fail-closed identity work that created the ambiguity this task gives users an escape hatch from.
- [[sources/back-552-doc-view-plain]] — Prior doc view CLI surface this task extended with reference-form lookup.
