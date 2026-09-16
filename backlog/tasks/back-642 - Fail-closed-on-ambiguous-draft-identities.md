---
id: BACK-642
title: Fail closed on ambiguous draft identities
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-15 14:00'
updated_date: '2026-09-16 07:41'
labels:
  - cli
dependencies: []
references:
  - src/utils/task-path.ts
  - src/file-system/operations.ts
  - src/utils/duplicate-detection.ts
  - src/cli.ts
  - src/server/index.ts
modified_files:
  - src/utils/task-path.ts
  - src/file-system/operations.ts
  - src/utils/duplicate-detection.ts
  - src/cli.ts
  - src/server/index.ts
  - src/test/draft-identity-fail-closed.test.ts
  - src/test/server-drafts-endpoint.test.ts
  - src/test/duplicate-detection.test.ts
priority: high
actual_start: '2026-09-16 07:17'
actual_end: '2026-09-16 07:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Drafts carry two competing identities: the id derived from the file name and the id declared in the frontmatter. Consumers normalize them differently (prefix casing, zero padding, dotted subtask segments), and a first-match lookup silently resolves to whichever file happens to come first. When two draft files claim the same numeric identity, the CLI, the web API and MCP can read, promote or archive a draft other than the one the user selected.

Expected: draft identity is canonicalized in exactly one shared place, every surface resolves a draft id through the same filename-derived finder, and an ambiguous identity fails closed with an error naming every candidate file instead of guessing. Reading a draft must never rewrite or remove a file, and an unparsable draft still reserves its filename id. Doctor reports draft identity findings (duplicate numeric identities, frontmatter drift, unreadable files) so they can be repaired by hand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-636 and git show 7a19e1d, b581cb3, 268a6a9 as implementation reference.
- [x] #2 Draft identity is canonicalized by one exported helper (`draftIdentityKey`) that ignores prefix casing, zero padding, and dotted-segment padding; grouping, matching and comparison all route through it.
- [x] #3 `resolveDraftFilePath`, `loadDraft`, `promoteDraft` and `archiveDraft` resolve through the same filename-derived finder, and an ambiguous identity throws `AmbiguousIdError` naming every candidate file.
- [x] #4 Resolving or reading an ambiguous draft changes no file on disk; `draft view` and `draft archive` exit non-zero with the ambiguity message.
- [x] #5 `saveDraft` converges existing same-identity filenames into the saved file, never deletes a file that fails to parse, and filename-derived ids count as occupied during draft allocation.
- [x] #6 `backlog doctor` prints draft identity findings (duplicates, frontmatter drift, unreadable files) and exits non-zero when any are present.
- [x] #7 The server draft handlers map an ambiguous identity to 409 with the candidate list instead of 404 or 500.
- [x] #8 `bunx tsc --noEmit` and `bun run check .` pass, and the scoped draft identity test suites pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One canonical draft identity

- 1.1 Add `draftIdentityKey(id)` to `src/utils/task-path.ts`, built on the existing `canonicalTaskId`: lowercase prefix plus a zero-padding-insensitive dotted-decimal body.
- 1.2 Route `draftIdsEqual`, `draftIdsMatchLoosely` and `findDuplicateDraftFilenameGroups` through it; delete the duplicate `extractDraftBody` and the first-match `getDraftPath`.
- 1.3 Add `DraftIdentityFindings` and `hasDraftIdentityFindings` to `src/utils/duplicate-detection.ts`.

### Phase 2 - Fail-closed resolution in the file system

- 2.1 Add `DraftFileReference`, `resolveDraftFilePath`, `listDraftFilenames`, `listOccupiedDraftFileIds`, `loadDraftFromFile` and `diagnoseDraftIdentity` to `src/file-system/operations.ts`.
- 2.2 Make `loadDraft` a thin wrapper over `resolveDraftFilePath`, rethrowing `AmbiguousIdError`; make `promoteDraft` and `archiveDraft` resolve by filename and hold `withDraftLock` across their read-modify-write span.
- 2.3 Split `withTaskLock` into a shared `withEntityFileLock` and add `withDraftLock` on top of it.
- 2.4 Make `saveDraft` converge same-identity filenames, keep unparsable candidates, and abort when a superseded file cannot be removed.
- 2.5 Reserve filename-derived ids during `demoteTask` allocation.

### Phase 3 - Surfaces

- 3.1 CLI: `draft view`, `draft [id]` and `draft archive` report the ambiguity and exit 1; `doctor` prints the draft identity report and contributes to the exit code.
- 3.2 Server: map `AmbiguousIdError` to 409 with candidates in the draft GET and promote handlers.

### Phase 4 - Verification

- 4.1 Unit tests for `draftIdentityKey`, `findDuplicateDraftFilenameGroups` and `hasDraftIdentityFindings`.
- 4.2 File-system tests for fail-closed resolution, lock contention, save convergence, identity accounting and `diagnoseDraftIdentity`.
- 4.3 Handler tests for the 409 mapping; manual CLI runs for `doctor` and `draft view` / `draft archive`.
- 4.4 `bunx tsc --noEmit`, biome on touched files, scoped `bun test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- `src/utils/task-path.ts`: added `draftIdentityKey` as the single canonicalization authority (lowercase prefix, zero-padding-insensitive dotted-decimal body) built on the existing `canonicalTaskId`; `draftIdsEqual` and `draftIdsMatchLoosely` now compare through it; added `findDuplicateDraftFilenameGroups`; removed the duplicated `extractDraftBody` and the first-match `getDraftPath` so no surface can guess.
- `src/file-system/operations.ts`: added `DraftFileReference`, `resolveDraftFilePath` (filename-derived finder that throws `AmbiguousIdError` naming every candidate), `loadDraftFromFile`, `listDraftFilenames(unreadable?)`, `listOccupiedDraftFileIds` and `diagnoseDraftIdentity`; `loadDraft` became a thin wrapper that rethrows `AmbiguousIdError`; `promoteDraft` and `archiveDraft` resolve by filename and hold `withDraftLock` across their read-modify-write span; `saveDraft` converges same-identity filenames, skips unparsable candidates and aborts when a superseded file cannot be removed; `demoteTask` reserves filename-derived ids. Split `withTaskLock` into a shared `withEntityFileLock` and added `withDraftLock` on top of it.
- `src/utils/duplicate-detection.ts`: added `DraftIdentityFindings` and `hasDraftIdentityFindings`.
- `src/cli.ts`: `draft view`, `draft [id]` and `draft archive` report resolution failures and exit 1 through a shared helper; `doctor` diagnoses draft identity, prints the findings and contributes to the exit code, including the post-repair path.
- `src/server/index.ts`: the draft GET and promote handlers map `AmbiguousIdError` to 409 with the candidate list.

### Verification

- `bunx tsc --noEmit` clean; `bun run check .` passes (410 files, only 3 pre-existing warnings in `src/core/assets.ts`).
- 32 scoped tests pass: `src/test/draft-identity-fail-closed.test.ts` (15), `src/test/duplicate-detection.test.ts` (14), `src/test/server-drafts-endpoint.test.ts` (3). No regressions in `src/test/task-path.test.ts`, `src/test/filesystem.test.ts`, `src/test/draft-create-consistency.test.ts`, `src/test/core-task-collision.test.ts` (109 pass).
- Manual CLI run against a scratch project holding a padded twin, a drifted frontmatter and an unparsable file: `doctor` printed all three finding groups and exited 1; `draft view` and `draft archive` printed "Draft ID DRAFT-1 is ambiguous; 2 files match" with both filenames and exited 1, leaving every file untouched.

### Notes for review

- Server handler tests call the handlers directly instead of over HTTP: in this environment Bun returns 404 for every `/api/*` route, which reproduces on unmodified code (`src/test/server-demote-endpoint.test.ts` fails identically at its `/api/tasks` warm-up), so the socket layer cannot be exercised here.
- MCP keeps its existing `AmbiguousIdError` mapping (AMBIGUOUS_ID with candidates). Because `loadDraft` now rethrows instead of returning null, `task_view` and `task_archive` surface the conflict; the MCP draft tests could not run here because every test in that file initialises a git repository, which takes about 30s on this machine and exceeds the test hook timeout.
- `doctor` was verified by manual CLI run rather than an automated test for the same reason: the existing doctor suite initialises a git repository per test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Draft identity now resolves through one canonicalization authority and one filename-derived finder. An ambiguous draft identity fails closed with an error naming every candidate on the CLI, in the server handlers and in MCP, and neither a read nor a failed mutation changes a file on disk. Doctor reports duplicate draft identities, frontmatter drift and unreadable files, and `saveDraft` converges same-identity filenames without deleting unparsable candidates.
<!-- SECTION:FINAL_SUMMARY:END -->
