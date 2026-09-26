---
title: BACK-642 Fail closed on ambiguous draft identities
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - core
  - task-identity
source_path: backlog/tasks/back-642 - Fail-closed-on-ambiguous-draft-identities.md
---

# BACK-642 Fail closed on ambiguous draft identities

Drafts carry two competing identities — the filename-derived id and the frontmatter id — which consumers normalized differently, so a first-match lookup could silently read, promote, or archive the wrong draft file. This task canonicalizes draft identity in one shared helper, resolves every draft through one filename-derived finder, and fails closed with `AmbiguousIdError` naming every candidate when the identity is ambiguous. Ports upstream BACK-636.

## Summary

- `src/utils/task-path.ts`: new `draftIdentityKey(id)` is the single canonicalization authority (lowercase prefix, zero-padding-insensitive dotted-decimal body, built on `canonicalTaskId`); `draftIdsEqual`, `draftIdsMatchLoosely`, and `findDuplicateDraftFilenameGroups` route through it; the duplicated `extractDraftBody` and first-match `getDraftPath` were deleted so no surface can guess
- `src/file-system/operations.ts`: new `resolveDraftFilePath` finder throws `AmbiguousIdError` naming every candidate; `loadDraft` rethrows it; `promoteDraft`/`archiveDraft` resolve by filename and hold `withDraftLock` across their read-modify-write span; `withTaskLock` was split into a shared `withEntityFileLock` plus `withDraftLock`
- `saveDraft` converges same-identity filenames into the saved file, never deletes a file that fails to parse, and aborts when a superseded file cannot be removed; `demoteTask` reserves filename-derived ids during draft allocation
- Surfaces: CLI `draft view`/`draft [id]`/`draft archive` report ambiguity and exit 1; server draft GET and promote handlers map `AmbiguousIdError` to 409 with the candidate list; MCP keeps its existing AMBIGUOUS_ID mapping and now surfaces conflicts because `loadDraft` rethrows instead of returning null
- `backlog doctor` prints draft identity findings (duplicate numeric identities, frontmatter drift, unreadable files) via new `DraftIdentityFindings`/`hasDraftIdentityFindings` in `src/utils/duplicate-detection.ts` and exits non-zero
- 32 scoped tests pass (draft-identity-fail-closed 15, duplicate-detection 14, server-drafts-endpoint 3); server handler tests call handlers directly because Bun returns 404 for every `/api/*` route in that environment
- Doctor and MCP draft suites were verified manually: they initialize a git repository per test, which takes ~30s on that drive and exceeds the test hook timeout

## Acceptance Criteria

- One exported `draftIdentityKey` canonicalizes prefix casing, zero padding, and dotted-segment padding; all grouping/matching routes through it
- `resolveDraftFilePath`, `loadDraft`, `promoteDraft`, `archiveDraft` share one filename-derived finder; ambiguity throws `AmbiguousIdError` naming every candidate
- Resolving or reading an ambiguous draft changes no file on disk; CLI exits non-zero with the ambiguity message
- `saveDraft` converges same-identity filenames without deleting unparsable candidates; filename-derived ids count as occupied in allocation
- Doctor reports draft identity findings and exits non-zero; server maps ambiguity to 409 with candidates

## Related Concepts

- [[concepts/task-identity]] — canonical id matching (`canonicalTaskId`) extended to drafts
- [[concepts/task-locking]] — `withEntityFileLock`/`withDraftLock` guard draft read-modify-write spans
- [[concepts/upstream-migration]] — ports upstream BACK-636 (commits 7a19e1d, b581cb3, 268a6a9)

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — same fail-closed pattern applied earlier to documents and decisions
- [[sources/back-538-duplicate-task-id-recovery]] — duplicate detection and doctor repair this draft report joins
- [[sources/back-644-web-draft-editing-fix]] — server draft routes that keep the 409 ambiguity mapping
