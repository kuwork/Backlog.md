---
id: BACK-596
title: Fail closed on ambiguous document and decision identity
status: Done
assignee: []
created_date: '2026-08-07 17:25'
updated_date: '2026-08-25 23:17'
labels:
  - cli
  - server
  - web-ui
  - mcp
dependencies: []
references:
  - src/utils/entity-id.ts
  - src/utils/decision-id.ts
  - src/utils/document-id.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/server/index.ts
  - src/cli.ts
  - src/mcp/errors/mcp-errors.ts
  - src/markdown/parser.ts
  - src/web/lib/api.ts
  - src/web/components/AmbiguousIdNotice.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/ui/decision-list-viewer.ts
priority: high
actual_start: '2026-08-25 17:30'
actual_end: '2026-08-25 23:15'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document and decision identity resolution is currently a silent fail-open and must become fail-closed end to end.

Current defects:
- loadDecision matches by filename prefix (operations.ts:971): equivalent IDs (decision-1 vs decision-001) cannot resolve to each other; when several files share a prefix, the first one is silently picked
- getDocument takes the first match via documents.find (backlog.ts), so retitling a file can silently repoint the same ID to a different file
- Files missing an id frontmatter are listed but unaddressable; the old documentIdsEqual returned true for blank ID bodies, causing spurious matches
- CLI: doc view catch-all swallows every error into a fake not-found without setting an exit code; decision view/update fake the same not-found
- Server doc/decision GET/PUT fold ambiguity into 404/500; resolving through the store raw-ID key silently collapses same-ID files
- MCP has no corresponding error code; the web api discards the 409 body, detail views fall back to cached entries and render a false success, create routes keep residual ambiguity notices, and DocumentationDetail error setter is dead code
- The parser matter() is affected by gray-matter cache poisoning: once a malformed frontmatter fails to parse, later parses of the same content silently degrade to empty data

Goal: unify identity resolution with a shared module (strip the prefix, treat a blank body as unaddressable, normalize zero-padded numbers); any ambiguity throws an error carrying the candidate file list; decisions switch to a backlog-relative path field (aligning with the existing document convention); CLI/TUI/server/web/MCP all surface ambiguity truthfully while unique-ID behavior stays unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git show 900ff97 and git show cf0ca9c as implementation reference.
- [x] #2 Equivalent zero-padded IDs resolve to one canonical key on both document and decision paths; an ID matching multiple files throws an ambiguous error listing every candidate relative path instead of silently picking one.
- [x] #3 The empty-string ID matches nothing anywhere; documents or decisions missing an id in frontmatter remain listed but are unaddressable by ID lookup.
- [x] #4 Decision carries a backlog-relative optional path end to end (listDecisions, loadDecision, decision watcher injection, TUI viewer reads, server endpoints); no Decision.filePath usage remains while Task.filePath stays untouched.
- [x] #5 The full doc and decision command groups keep working; ambiguous doc view, decision view, and decision update print the candidate list with exit code 1, and unique-ID behavior is unchanged.
- [x] #6 Server document/decision GET and PUT return 409 with the ambiguity message and candidates on conflict, with tests proving candidate files stay byte-identical.
- [x] #7 MCP reports ambiguous identity as an explicit AMBIGUOUS_ID error code with candidates; the former silent duplicate-collapse expectation is replaced by a fail-closed assertion.
- [x] #8 Web detail views render a shared ambiguity notice from the server payload without falling back to cached entries; entering the create route from a stale ambiguous link clears residual notices; slug normalization never wipes the rendered error state.
- [x] #9 Markdown parsing bypasses the gray-matter content cache so malformed frontmatter fails on every parse instead of degrading to empty data.
- [x] #10 bunx tsc --noEmit passes and targeted bun test suites pass; backlog doctor behavior is intentionally out of scope and unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Shared identity module

- 1.1 Add src/utils/entity-id.ts: entityIdKey (strip doc-/decision- prefix, blank body returns null, zero-padded numeric normalization), normalizeEntityId, entityIdsEqual, AmbiguousIdError (carries candidates), findUniqueEntityById (describe callback builds the candidate list); AmbiguousTaskIdError in src/utils/task-path.ts now extends AmbiguousIdError with the upstream (taskId, candidates) signature and doctor-preview guidance
- 1.2 Rewrite src/utils/document-id.ts as a thin wrapper over entity-id and add findDocumentById; add src/utils/decision-id.ts providing the decision-side equivalent (describe uses path ?? title)

### Phase 2 - Decision relative-path field switch

- 2.1 types/index.ts: Decision gains path?: string (backlog-relative), removes filePath?: string
- 2.2 operations.listDecisions attaches the relative path per file and catches per file (a single malformed file no longer clears the whole list) and exposes the unreadable?: string[] out-param; loadDecision is rewritten as findDecisionById(await this.listDecisions())
- 2.3 content-store decision watcher injects path into the parseDecision result (field-only; the existing retry/refresh lifecycle is untouched)
- 2.4 Migrate every Decision.filePath consumer: cli decision view and ui/decision-list-viewer read via path; the server entity endpoint uses the relative path directly and drops the toProjectRelative conversion; afterward confirm no Decision.filePath remains (Task.filePath is out of scope)

### Phase 3 - Fail-closed lookup switch

- 3.1 operations.loadDocument and core.getDocument go through findDocumentById; the empty-string ID no longer matches any entity

### Phase 4 - Surface wiring

- 4.1 server handleGetDoc/handleUpdateDoc/handleGetDecision/handleUpdateDecision return 409 with the full message and candidates on isAmbiguousIdError; handleGetDecision keeps resolving from disk through filesystem.loadDecision
- 4.2 mcp-errors maps AmbiguousIdError to AMBIGUOUS_ID with candidates; document create/update handlers rethrow it instead of wrapping it in OPERATION_FAILED
- 4.3 cli doc view catch branches on ambiguity before the generic not-found swallow; decision view/update print the candidates and set exitCode=1; help-schema wording updated; the full doc/decision command groups stay intact (create/list/search unaffected)
- 4.4 markdown/parser.ts uses matter(toParse, {}) to bypass gray-matter cache poisoning

### Phase 5 - Web

- 5.1 api.ts document/decision fetch/update/create calls throw ApiError preserving status and server message, and export isAmbiguousIdConflict
- 5.2 Add web/components/AmbiguousIdNotice.tsx; DocumentationDetail actually reads its error state, DecisionDetail gains an error state; on 409 neither falls back to props cache entries
- 5.3 The create route (id is new) clears error/document state on entry to remove residual notices; slug normalization never wipes the rendered error state

### Phase 6 - Tests and verification

- 6.1 Port adversarial tests: content-identity, server-documents-endpoint (GET/PUT 409 with byte-untouched proof), web-ambiguous-id (both components), markdown cache regression, mcp-documents, and adapt existing filesystem/documentation cases
- 6.2 bunx tsc --noEmit passes; biome check on touched files passes; targeted bun test suites are green
- 6.3 Manual smoke test: create decision-001/decision-1 fixtures and verify CLI view/update, server endpoints, and web detail rendering surface the ambiguity, while unique-ID paths are unaffected
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation follows the six-phase plan. Core: entity-id.ts (entityIdKey/normalizeEntityId/entityIdsEqual/AmbiguousIdError/findUniqueEntityById), decision-id.ts, document-id.ts rebuilt as thin wrappers; AmbiguousTaskIdError now lives in src/utils/task-path.ts and extends AmbiguousIdError with the upstream constructor(taskId, candidates), producing the shared multi-line message that ends with the doctor-preview guidance (fork doctor provides task duplicate-ID repair).

Relative path cutover: Decision gained path (backlog-relative) and lost filePath; listDecisions attaches paths and catches per file so one malformed file cannot hide the rest; loadDecision resolves via findDecisionById; the content-store decision watcher injects path at its single parse site without touching the retry lifecycle. Consumers migrated: cli decision view/update read through join(decisionsDir, path); ui/decision-list-viewer does the same and now surfaces isAmbiguousIdError messages (the full candidate list) instead of a generic failure string; the server entity preview builds backlogDirName/decisions/<path> (toProjectRelative is no longer used for decisions). Task.filePath is untouched.

Fail-closed lookups: loadDocument and getDocument route through findDocumentById; empty-string IDs match nothing. listDecisions/listDocuments also gained the upstream unreadable?: string[] out-param and the ported recordUnreadableDirectory helper: per-file parse failures push the file (docs use docs-relative paths), whole-scan failures record an empty-string directory marker, and ENOENT stays silent.

Surfaces: server GET/PUT for docs+decisions return 409 with message+candidates (handleGetDoc/handleUpdateDoc/handleGetDecision/handleUpdateDecision plus the entity preview endpoint); MCP maps AmbiguousIdError to AMBIGUOUS_ID with candidates in structuredContent, and document create/update handlers rethrow it instead of wrapping it into OPERATION_FAILED; cli doc view branches on ambiguity before the generic not-found swallow, decision view/update print candidates with exitCode 1; parser.ts parses with matter(toParse, {}) bypassing the gray-matter cache.

Web: api.ts throws the existing ApiError carrying status and server message via throwResponseError for all ten doc/decision endpoints and exports isAmbiguousIdConflict; new AmbiguousIdNotice renders the server message; DocumentationDetail error state is actually read and rendered and DecisionDetail gained an error state; neither falls back to cached props entries on 409; create routes clear stale state; slug normalization does not clear rendered errors.

Reviewed-and-intentional: a single path injection in the content-store decision watcher (the refresh path covers the rest) and the web props fallback for non-409 failures both match upstream behavior and were left unchanged.

Post-review hardening (code-review report , items 3.2.1 / 3.2.2 / 3.3-viewer):
- 3.2.1 AmbiguousTaskIdError relocated to src/utils/task-path.ts with the upstream constructor(taskId, candidates) signature and shared multi-line message ending with the doctor-preview guidance; throw sites in getTask pass taskId; the server import and the core-task-collision test import were repointed to the new module.
- 3.2.2 listDecisions/listDocuments gained the upstream unreadable?: string[] out-param and the ported recordUnreadableDirectory helper; covered by a new content-identity case asserting both decisions and the unreadable collection.
- 3.3 ui/decision-list-viewer now surfaces isAmbiguousIdError messages (full candidate list) instead of the generic Unable-to-load string.
- Reviewed-and-intentional (no change): the single path injection in the content-store decision watcher (refresh path covers the rest) and the web props fallback for non-409 failures both match upstream behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Identity resolution for documents and decisions now fails closed end to end. Equivalent padded IDs collapse to one canonical key, ambiguous lookups throw AmbiguousIdError naming every candidate relative path (CLI prints it and exits 1; server answers 409 with candidates and byte-identical proof; MCP returns AMBIGUOUS_ID; web renders the shared notice without falling back to cached entries), and blank IDs match nothing anywhere. Decisions moved to a backlog-relative path field consumed by CLI/TUI/server, replacing the absolute filePath field. AmbiguousTaskIdError now shares the base error shape with the upstream (taskId, candidates) signature. listDecisions/listDocuments isolate per-file parse failures and expose the unreadable out-param. Markdown parsing bypasses the gray-matter content cache so malformed frontmatter fails deterministically on every parse.

Verification: bunx tsc --noEmit clean; biome check clean on all touched files; targeted suites green - content-identity, server-documents-endpoint (409s + byte-identical proofs), web-ambiguous-id, mcp-documents (incl. AMBIGUOUS_ID), markdown, filesystem/content-store/core-task-collision, cli-doc-view/cli-doc-decision-board/cli-doc-search, server-preview (its decision fixture now carries id frontmatter per the new unaddressable-without-id contract). Manual smoke on a temp project confirmed decision view/update and doc view print candidate lists with exit code 1 on collisions, while unique-ID paths and doc/decision list behave as before.

Known pre-existing failures unrelated to this task (reproduced identically at HEAD via a git stash probe): cli.test.ts task-list plain-limit regrouping and the doc-update path-move assertion, plus assorted CLI-subprocess timeout flakes under load.
<!-- SECTION:FINAL_SUMMARY:END -->
