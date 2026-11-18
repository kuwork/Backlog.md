---
id: BACK-853
title: Add CLI and MCP delete for documents and decisions
status: Done
assignee:
  - '@hy4'
created_date: '2026-11-18 16:48'
updated_date: '2026-11-18 17:13'
labels:
  - mcp
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/file-system/operations.ts
  - src/utils/entity-id.ts
  - src/mcp/tools/documents/index.ts
  - src/mcp/tools/documents/schemas.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/decisions/index.ts
  - src/mcp/tools/decisions/schemas.ts
  - src/mcp/tools/decisions/handlers.ts
  - src/mcp/tools/memos/handlers.ts
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/cli-instructions/decisions.md
  - src/guidelines/mcp/documents.md
  - src/guidelines/mcp/decisions.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/test/cli-doc-view.test.ts
  - src/test/mcp-memos.test.ts
  - src/test/mcp-documents.test.ts
  - src/test/mcp-decisions.test.ts
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/cli.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/decisions.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/decisions.md
  - src/guidelines/mcp/documents.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/mcp/tools/decisions/handlers.ts
  - src/mcp/tools/decisions/index.ts
  - src/mcp/tools/decisions/schemas.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/index.ts
  - src/mcp/tools/documents/schemas.ts
  - src/test/cli-decision-delete.test.ts
  - src/test/cli-doc-delete.test.ts
  - src/test/mcp-decisions.test.ts
  - src/test/mcp-documents.test.ts
  - src/test/mcp-server.test.ts
ordinal: 412004
actual_start: '2026-11-18 16:56'
actual_end: '2026-11-18 17:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-852 added web delete for documents and decisions, along with the FileSystem primitives deleteDocument, deleteDecision and deleteDocsFolder plus the DELETE server routes. The CLI and MCP still have no delete surface: CLI doc and decision only offer create/list/view/update/search, and MCP exposes only document_* and decision_* read and update tools. This task wires the existing primitives into both interfaces.

CLI scope: doc delete <docId>, doc folder delete <path>, and decision delete <decisionId>. Follow memo delete for output and exit-code conventions, including no interactive confirmation on the CLI; ambiguous IDs must be surfaced with isAmbiguousIdError; missing targets and invalid folder paths must produce clear errors and a non-zero exit code.

MCP scope: document_delete, document_folder_delete and decision_delete. Follow memo_delete for JsonSchema inputs, createSimpleValidatedTool registration, destructiveHint annotations, text CallToolResult output, and BacklogToolError codes for not-found, invalid paths and ambiguous IDs.

Data model note: decisions are flat and have no folder concept, so only file deletion applies. Documents have a recursive folder tree, so both file and folder deletion apply. No new FileSystem primitives or server routes are needed.

Docs scope: keep help schemas, CLI-INSTRUCTIONS.md and the CLI/MCP agent guides in sync because guide examples are contract-checked. Wiki and concept docs remain out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog doc delete <docId> removes the document and prints a success message; a missing id exits non-zero with a clear error.
- [x] #2 backlog doc folder delete <path> removes the folder and all files beneath it; the docs root, absolute paths and paths containing .. are rejected with a non-zero exit code.
- [x] #3 backlog decision delete <decisionId> removes the decision and prints a success message; a missing id exits non-zero with a clear error.
- [x] #4 CLI delete commands follow the memo delete output and exit-code convention, including ambiguous-ID handling through isAmbiguousIdError.
- [x] #5 MCP exposes document_delete, document_folder_delete and decision_delete with destructiveHint annotations and validated JsonSchema inputs.
- [x] #6 MCP delete tools return a text confirmation on success and BacklogToolError codes for not-found, invalid paths and ambiguous IDs.
- [x] #7 Help schemas and agent guides list the new commands and tools with examples consistent across CLI-INSTRUCTIONS.md, cli-instructions/documents.md, cli-instructions/decisions.md, mcp/documents.md, mcp/decisions.md, mcp/overview-tools.md and mcp/overview.md.
- [x] #8 Tests cover CLI success, not-found, ambiguous-id, folder-traversal and folder-not-found cases.
- [x] #9 Tests cover MCP success, not-found, traversal and ambiguous-id cases for all three tools.
- [x] #10 No changes to the web UI, FileSystem primitives or server routes; TypeScript type-check, scoped lint and scoped tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CLI (src/cli.ts): add doc delete <docId>, doc folder delete <path> and decision delete <decisionId> after the existing doc view and decision update commands. Follow memo delete for output and exit codes, and doc view / decision update for isAmbiguousIdError handling with the existing candidate hints. Call Core.filesystem.deleteDocument / deleteDocsFolder / deleteDecision. Map a false result to a clear not-found error with exitCode 1, and map the plain Error thrown by normalizeDocumentRelativePath for traversal to stderr plus exitCode 1 instead of an unhandled throw. Add addHelpSchema blocks whose examples match the agent guides exactly. Confirm Commander nested subcommands under docCmd work with the shared help schema.
2. MCP documents (src/mcp/tools/documents/schemas.ts, handlers.ts, index.ts): add documentDeleteSchema { id } and documentFolderDeleteSchema { path } as JsonSchema with required fields and additionalProperties false; add DocumentHandlers.deleteDocument and deleteDocsFolder returning text confirmation, DOCUMENT_NOT_FOUND / FOLDER_NOT_FOUND on false, and VALIDATION_ERROR for path-normalization errors; register document_delete and document_folder_delete with destructiveHint true and export the new schemas and arg types.
3. MCP decisions (src/mcp/tools/decisions/schemas.ts, handlers.ts, index.ts): add decisionDeleteSchema { id }, a DecisionHandlers.deleteDecision method using DECISION_NOT_FOUND, and register decision_delete with destructiveHint true. AmbiguousIdError is left uncaught in both domains so handleBacklogToolError maps it to AMBIGUOUS_ID with candidates.
4. Guides: add the commands and tools to CLI-INSTRUCTIONS.md, src/guidelines/cli-instructions/documents.md, decisions.md, and src/guidelines/mcp/documents.md, decisions.md, overview-tools.md, overview.md. Grep agent-guidelines.md and src/mcp/utils/schema-generators.ts for stale command lists and update if they enumerate doc/decision tools. Use the same examples in the guides, CLI-INSTRUCTIONS.md and the new help schemas, then run bun .codex/skills/agent-guide-contract-editing/verify-guide-examples.ts. Wiki and concept docs stay out of scope.
5. Tests: add src/test/cli-doc-delete.test.ts and src/test/cli-decision-delete.test.ts following cli-doc-view.test.ts for success, not-found, ambiguous id, folder traversal, docs-root and folder-not-found cases; extend src/test/mcp-documents.test.ts and src/test/mcp-decisions.test.ts following the memo_delete assertions in mcp-memos.test.ts for success, not-found, ambiguous id and invalid-path cases.
6. Verify: bunx tsc --noEmit, bun run check . on the touched surface, bun test --timeout 30000 on the four test files, and the guide-example verifier. No FileSystem, server, web or locale changes are needed.
7. Updated src/test/mcp-server.test.ts tool-list assertion for the three new MCP tools, and src/guidelines/agent-guidelines.md so the shipped shared agent guide stays consistent with the CLI and MCP command surfaces.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: CLI doc delete <id>, doc folder delete <path> and decision delete <id> call the existing FileSystem primitives; ambiguous ids reuse a shared printDocumentReferenceHints helper parameterized by view/delete. Folder-path errors are converted to stderr with exitCode 1 instead of unhandled throws. MCP document_delete, document_folder_delete and decision_delete use validated JsonSchema, destructiveHint annotations and BacklogToolError codes; AmbiguousIdError stays uncaught so the wrapper maps it to AMBIGUOUS_ID with candidates. Docs updated across CLI-INSTRUCTIONS.md, CLI/MCP agent guides, MCP overview and agent-guidelines.md with matching examples.

Validation: bunx tsc --noEmit clean; bun run check . clean apart from 14 pre-existing warnings and 1 info; 40/40 tests pass across cli-doc-delete, cli-decision-delete, mcp-documents and mcp-decisions; cli-doc-view regression passes; doc delete help and nested doc folder help verified. Two pre-existing issues were found and left untouched: the agent-guide verifier flags asset-management.md:10-29 as missing in the existing wiki-link examples, and mcp-server.test.ts omits graph_legend_get/set/remove from its tool list even though they exist in HEAD. After adding the three new tools to that assertion, its only remaining diff is those three stale graph_legend entries.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed the BACK-852 delete primitives through CLI and MCP.

- CLI: doc delete <id>, doc folder delete <path>, decision delete <id>. Follows memo delete output and exit codes; ambiguous ids print ready-to-run references.
- MCP: document_delete, document_folder_delete, decision_delete with destructiveHint and BacklogToolError codes for not-found, invalid paths and ambiguous ids.
- Decisions remain flat with file-only deletion; no changes to FileSystem, server routes, web UI or locales.
- Guides, CLI-INSTRUCTIONS.md, help schemas and agent-guidelines.md updated with consistent examples.

Verification: bunx tsc --noEmit clean; bun run check . clean; 40/40 new and extended tests pass; doc view and CLI/MCP guide assemblies still pass. Two pre-existing stale expectations remain untouched: asset-management.md link in the guide verifier and graph_legend_* entries in mcp-server.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
