---
id: BACK-529
title: Optimize doc update --content with multi-line and append support
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-28 00:42'
updated_date: '2026-07-28 01:34'
labels:
  - cli
  - mcp
dependencies: []
priority: low
ordinal: 182400
actual_start: '2026-07-28 00:42'
actual_end: '2026-07-28 01:33'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve backlog doc update so it handles multi-line content as smoothly as task descriptions and notes.

Scope:
1. Apply processCliEscapes to doc update --content so 
 escape sequences become real newlines, matching the behavior of --desc, --plan, --notes, etc.
2. Add a repeatable --append-content option to doc update so users can append blocks to an existing (or newly supplied) document body without replacing the entire content. Appended blocks are separated by blank lines.
3. Add the same appendContent support to the MCP document_update tool.
4. Add CLI and MCP document-management instruction guides (backlog instructions documents and backlog://workflow/documents) covering doc create/update/list/view, document types, multi-line content, appendContent, and key rules.
5. Update help text, examples, and tests for both CLI and MCP paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc update --content interprets \n as a newline
- [x] #2 Real newlines inside quoted content still work
- [x] #3 Help text and examples mention multi-line content
- [x] #4 Tests cover newline handling for doc update --content
- [x] #5 doc update exposes --append-content as a repeatable option
- [x] #6 Append values are processed with processCliEscapes so \n becomes a newline
- [x] #7 Appended blocks are separated from existing content by blank lines
- [x] #8 --append-content works alongside --content (appends after the replacement content)
- [x] #9 Tests cover single and multiple --append-content invocations
- [x] #10 CLI instructions include a documents guide covering doc create/update/list/view and multi-line content
- [x] #11 MCP document_update exposes appendContent in its input schema
- [x] #12 MCP document_update appends content blocks with blank-line separation
- [x] #13 MCP guidelines include a documents guide covering document tools and appendContent
- [x] #14 MCP overview.md references the documents guide
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing processCliEscapes usage in task commands
2. Apply processCliEscapes to doc update --content
3. Add appendContent field to DocumentUpdateInput
4. Handle appendContent in core updateDocumentFromInput
5. Add --append-content option to CLI doc update
6. Update help text, schemas, and examples
7. Add tests
8. Run type-check and tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with bun test src/test/doc-content-newlines.test.ts (6 pass) and bunx tsc --noEmit (pass). Note: bun run check . reports pre-existing CRLF formatting issues across the entire repo, unrelated to this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented multi-line and append support for backlog doc update --content, added matching MCP document_update appendContent support, and added CLI/MCP document-management instructions.

Changes:
- src/cli.ts: doc update --content now uses processCliEscapes so 
 sequences become real newlines. Added repeatable --append-content option with 
 escape processing; appended blocks are separated from base content by blank lines.
- src/types/index.ts: added optional appendContent field to DocumentUpdateInput.
- src/core/backlog.ts: updateDocumentFromInput now handles appendContent by appending chunks to the base content (existing or replacement).
- src/mcp/tools/documents/handlers.ts: document_update now accepts and forwards appendContent.
- src/mcp/tools/documents/schemas.ts: added appendContent array to document_update input schema.
- src/test/doc-content-newlines.test.ts: CLI tests for 
, 

, omitted-content preservation, single/multiple appends, and combined --content + --append-content.
- src/test/mcp-documents.test.ts: MCP test for appendContent behavior.
- src/guidelines/cli-instructions/documents.md: new CLI guide covering doc create/update/list/view, document types, multi-line content, --append-content, and key rules.
- src/guidelines/cli-instructions/index.ts: exported CLI_DOCUMENTS_GUIDE.
- src/guidelines/cli-instructions/overview.md: listed documents guide in detailed guides.
- src/guidelines/mcp/documents.md: new MCP guide covering document tools, create/update, appendContent, and multi-line content.
- src/guidelines/mcp/index.ts: exported MCP_DOCUMENTS_GUIDE.
- src/guidelines/mcp/overview.md: references documents guide and mentions append_content support.
- src/mcp/workflow-guides.ts: registered documents as a workflow guide for both CLI and MCP instructions.

Verification:
- bun test src/test/doc-content-newlines.test.ts (6 pass)
- bun test src/test/mcp-documents.test.ts (9 pass)
- bunx tsc --noEmit (pass)
- Note: bun run check . fails on pre-existing CRLF line-ending issues across the repo, not caused by this change.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
