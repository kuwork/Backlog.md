---
title: BACK-596 Fail closed on ambiguous document and decision identity
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - cli
  - server
  - web-ui
  - mcp
  - bug
source_path: backlog/tasks/back-596 - Fail-closed-on-ambiguous-document-and-decision-identity.md
---

# BACK-596 Fail closed on ambiguous document and decision identity

Document and decision identity resolution was a silent fail-open: filename-prefix matching, first-match document lookup, and a swallowed CLI catch-all meant ambiguous or missing IDs resolved to arbitrary files. This task unified identity resolution into a shared `src/utils/entity-id.ts` module that treats ambiguity as a hard error carrying every candidate path, and wired fail-closed behavior through CLI, TUI, server (409), MCP (AMBIGUOUS_ID), and web surfaces. It also switched decisions to a backlog-relative `path` field (replacing absolute `filePath`) and fixed gray-matter cache poisoning in the markdown parser.

## Summary

- New shared module `src/utils/entity-id.ts`: `entityIdKey` (strips `doc-`/`decision-` prefix, blank body returns null, zero-padded numeric normalization), `normalizeEntityId`, `entityIdsEqual`, `AmbiguousIdError` (carries candidate relative paths), `findUniqueEntityById`.
- `src/utils/document-id.ts` rebuilt as a thin wrapper (`findDocumentById`); new `src/utils/decision-id.ts` provides the decision-side equivalent; `AmbiguousTaskIdError` moved to `src/utils/task-path.ts` and now extends `AmbiguousIdError` with the upstream `(taskId, candidates)` signature plus doctor-preview guidance.
- `Decision` type gained backlog-relative `path?: string` and lost `filePath?: string`; `operations.listDecisions` attaches paths and catches per-file parse failures (new `unreadable?: string[]` out-param with `recordUnreadableDirectory`); the content-store decision watcher injects `path` at its single parse site.
- Fail-closed lookups: `loadDocument`/`core.getDocument` route through `findDocumentById`; empty-string IDs match nothing anywhere; entities without `id` frontmatter stay listed but unaddressable.
- Surface wiring: server doc/decision GET/PUT return 409 with message + candidates; MCP maps to `AMBIGUOUS_ID` in `structuredContent` (handlers rethrow instead of wrapping in `OPERATION_FAILED`); CLI doc view branches on ambiguity before the not-found swallow, decision view/update print candidates with exit code 1.
- Web: `api.ts` throws `ApiError` preserving status/message across all ten doc/decision endpoints and exports `isAmbiguousIdConflict`; new `web/components/AmbiguousIdNotice.tsx`; `DocumentationDetail` error state actually rendered, `DecisionDetail` gained one; no fallback to cached props entries on 409.
- `src/markdown/parser.ts` parses with `matter(toParse, {})` to bypass the gray-matter content cache so malformed frontmatter fails deterministically on every parse (later generalized by [[sources/back-599-gray-matter-no-cache-parse-wrapper]]).

## Acceptance Criteria

- Equivalent zero-padded IDs resolve to one canonical key; an ID matching multiple files throws an ambiguous error listing every candidate relative path.
- The empty-string ID matches nothing; documents/decisions missing `id` frontmatter remain listed but unaddressable.
- Decision carries a backlog-relative optional `path` end to end; no `Decision.filePath` usage remains (Task.filePath untouched).
- Ambiguous CLI lookups print the candidate list with exit code 1; unique-ID behavior unchanged.
- Server GET/PUT return 409 with candidates and byte-identical-file proof; MCP returns explicit `AMBIGUOUS_ID` with candidates.
- Web detail views render the shared ambiguity notice without falling back to cached entries; gray-matter cache bypassed.

## Related Concepts

- [[concepts/task-identity]] — Shared entity-ID key normalization (prefix strip, zero-pad collapse, blank-body rejection) applied to documents and decisions, extending the task-side identity model.
- [[concepts/core-architecture]] — ContentStore decision watcher path injection and per-file error isolation in listDecisions/listDocuments.
- [[concepts/mcp-server]] — `AMBIGUOUS_ID` error mapping with candidates in structuredContent.
- [[concepts/markdown-pipeline]] — matter(options-object) cache bypass in the markdown parser.

## Related Sources

- [[sources/back-552-doc-view-plain]] — Prior doc view CLI work whose catch-all error swallow this task replaced with ambiguity-first branching.
- [[sources/back-568-core-browser-task-boundary]] — Related fail-closed 409 identity boundary for tasks that this task mirrors for docs/decisions.
