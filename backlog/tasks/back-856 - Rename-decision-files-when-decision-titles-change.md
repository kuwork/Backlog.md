---
id: BACK-856
title: Rename decision files when decision titles change
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 08:44'
updated_date: '2026-11-19 09:01'
labels:
  - cli
  - mcp
dependencies: []
modified_files:
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/test/core-autocommit-scope.test.ts
  - src/test/file-rename-plan.test.ts
  - src/guidelines/cli-instructions/decisions.md
  - src/guidelines/mcp/decisions.md
ordinal: 415004
actual_start: '2026-11-19 08:44'
actual_end: '2026-11-19 08:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate the reusable FileRenamePlan with decision title updates so a title change that alters the sanitized filename renames the decision file and repairs local references. Preserve the decision ID and directory, update only /decisions/:id/:title title segments, and reuse existing reference rewriting across tasks, documents, decisions, and optional Wiki content. Keep decision creation and non-title updates on their existing save flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Changing a decision title renames its file when the sanitized filename changes while preserving the decision ID and directory
- [x] #2 Decision file renames use FileRenamePlan to update matching local references and structured path fields across tasks, documents, decisions, and Wiki content without changing unrelated links
- [x] #3 Decision title changes update matching /decisions/:id/:title segments while preserving IDs, link text, queries, fragments, and ranges; task and documentation routes are not triggered
- [x] #4 No-op title updates and unchanged sanitized paths keep the existing save flow; target conflicts and apply failures preserve the original decision and references
- [x] #5 Core tests cover decision renames, reference and slug updates, no-op behavior, conflicts, and auto-commit; TypeScript, Biome, and scoped tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect decision update, filename generation, and auto-commit paths and confirm the shared Core entry point.
2. Extract shared decision filename generation and integrate title-driven renames with FileRenamePlan while preserving the decision ID and directory.
3. Trigger only decision title-route normalization and include primary and reference changes in existing auto-commit behavior.
4. Add Core regressions for decision renames, cross-entity references, slugs, no-op updates, conflicts, and auto-commit.
5. Run scoped tests, bunx tsc --noEmit, and bun run check .; update implementation notes and final summary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed:
- Added shared getDecisionFilename generation and reused it in FileSystem.saveDecision so creation and title renames use identical sanitization.
- Core.updateDecision now loads the persisted decision and only builds a FileRenamePlan when the title changed and the sanitized target path differs. Creation, status-only updates, and same-path title updates keep the existing save flow.
- The rename preserves the decision ID and directory, serializes the updated decision through the shared plan, updates matching local references and structured task path fields, and triggers only /decisions/:id/:title normalization.
- Auto-commit stages the decision move and every changed reference with the existing Update decision commit message. CLI, MCP, and Web entry points inherit the behavior through Core.updateDecision/updateDecisionFromContent.
- Same-ID target conflicts fail closed through existing decision identity resolution before writes; generic plan preflight and rollback coverage remains unchanged.
- Updated CLI and MCP decision guides with automatic rename semantics and mv plus manual reference repair as a failure fallback.

Validation:
- Decision rename and auto-commit tests: 23 pass, 0 fail, 141 assertions.
- Existing FileSystem and ContentStore regressions: 92 pass, 0 fail, 212 assertions.
- bunx tsc --noEmit: passed.
- bun run check .: exit code 0 with only pre-existing graph/duckdb warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented automatic decision file renaming when a decision title changes its sanitized filename.

Changes:
- Reused one decision filename generator across creation and rename flows.
- Integrated Core decision updates with FileRenamePlan for atomic primary-file and reference updates.
- Updated matching local links, task structured fields, Wiki source_path values, and /decisions/:id/:title segments while leaving task and documentation routes untouched.
- Preserved decision IDs, directories, no-op behavior, and existing auto-commit semantics.
- Updated public CLI/MCP decision guidance, including mv plus manual reference repair as a fallback if automatic renaming fails.

Verification:
- Decision rename and auto-commit tests: 23 pass, 0 fail.
- Existing FileSystem and ContentStore tests: 92 pass, 0 fail.
- TypeScript and full Biome checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
