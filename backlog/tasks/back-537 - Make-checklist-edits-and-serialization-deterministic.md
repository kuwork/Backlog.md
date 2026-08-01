---
id: BACK-537
title: Make checklist edits and serialization deterministic
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-11 23:02'
updated_date: '2026-08-01 23:37'
labels:
  - migration
  - upstream
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/utils/task-edit-builder.ts
  - src/markdown/structured-sections.ts
  - src/mcp/utils/schema-generators.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/markdown.test.ts
  - src/test/mcp-tasks.test.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/overview-tools.md
actual_start: '2026-08-01 23:05'
actual_end: '2026-08-01 23:22'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AC and DoD checklist editing currently lacks deterministic serialization and a clear atomic clear operation.

Keep --ac and --acceptance-criteria as additive aliases with consistent semantics in task edit (unchanged in task create); add --clear-ac for atomic clear-all; and apply deterministic checklist serialization for AC and DoD. For full replacement, users should clear then re-add via CLI, or edit the task Markdown directly. Update CLI and MCP guidelines to document the semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-537 and git show f73ddc0 as implementation reference.
- [x] #2 Keep --ac and --acceptance-criteria as additive aliases in task edit; do not change task create behavior.
- [x] #3 Add --clear-ac to atomically clear all acceptance criteria and reject ambiguous combinations with --ac, --remove-ac, --check-ac, --uncheck-ac.
- [x] #4 Add MCP task_edit acceptanceCriteriaClear boolean field to schema and handler, matching CLI --clear-ac semantics.
- [x] #5 Shared checklist serialization preserves canonical section order, custom content, stable whitespace, and CRLF for AC and DoD.
- [x] #6 Regression tests cover additive edits, clear-all, re-add cycles, MCP clear, whitespace stability, custom sections, DoD, and CRLF.
- [x] #7 Update CLI and MCP guidelines to explain AC editing semantics: for large changes use --clear-ac (or MCP acceptanceCriteriaClear) then batch --ac (or acceptanceCriteriaAdd) to replace the full list; for small changes use --remove-ac/--check-ac/--uncheck-ac; or edit the task Markdown directly as fallback.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review upstream BACK-537 changes (git show f73ddc0) for the checklist resolver and serialization approach, but exclude the --acceptance-criteria replacement semantics.
2. In src/cli.ts task edit, add --clear-ac option and validation to reject combining it with --ac, --remove-ac, --check-ac, --uncheck-ac. Keep --ac and --acceptance-criteria additive and aliased.
3. Wire --clear-ac to acceptanceCriteriaSet = [] in src/utils/task-edit-builder.ts so it atomically clears the checklist.
4. Migrate the deterministic checklist serialization from src/markdown/structured-sections.ts (canonical section order, boundary whitespace, CRLF preservation, custom content masking, malformed marker fail-closed) for both AC and DoD.
5. In src/mcp/utils/schema-generators.ts, add acceptanceCriteriaClear boolean to the task_edit schema; update src/mcp/tools/tasks/handlers.ts to set acceptanceCriteriaSet = [] when the field is true.
6. Update src/guidelines/agent-guidelines.md, src/guidelines/cli-instructions/task-execution.md, and src/guidelines/mcp/task-execution.md / overview-tools.md to explain: --ac/--acceptance-criteria are additive aliases; when ACs are still unchecked (e.g. before execution), large replacements should prefer --clear-ac (or MCP acceptanceCriteriaClear) then batch --ac (or acceptanceCriteriaAdd); for small or index-specific changes use --remove-ac/--check-ac/--uncheck-ac; or edit the Markdown file directly as fallback.
7. Add and update regression tests in src/test/acceptance-criteria.test.ts, src/test/markdown.test.ts, and src/test/mcp-tasks.test.ts to cover additive edits, clear-all, batch re-add, re-add cycles, MCP clear, whitespace stability, custom sections, DoD, and CRLF.
8. Run bunx tsc --noEmit, bun run check ., and bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented deterministic AC/DoD checklist editing while preserving --ac/--acceptance-criteria additive alias semantics.

Key implementation points:
- Replaced regex-based sentinel matching in src/markdown/structured-sections.ts with a tokenizer + range resolver that tokenizes all known sentinels, masks foreign family ranges, pairs target AC/DoD markers, and fails closed on ambiguous marker structures (repeated-begin, unexpected-end, unclosed-begin).
- Added task edit --clear-ac in src/cli.ts that atomically clears all acceptance criteria by setting acceptanceCriteriaSet = []; rejects combination with any other AC mutation option.
- Added acceptanceCriteriaClear boolean to TaskEditArgs type, MCP task_edit schema, and handler; mirrors CLI validation.
- Updated toAcceptanceCriteriaEntries in src/utils/task-edit-builder.ts to return an empty array for empty acceptanceCriteriaSet so clear operations actually empty the checklist instead of being skipped.
- Updated agent, CLI, and MCP guidelines with the clear-then-add workflow for large unchecked AC replacements, and index-based operations for small changes.
- Added focused regression tests for clear-all, rejection of ambiguous combinations, additive alias preservation, batch re-add, CRLF/custom content stability, malformed marker fail-closed, and MCP acceptanceCriteriaClear.

Verification: bunx tsc --noEmit passed; bun run check . passed with 3 pre-existing warnings in src/core/assets.ts; scoped tests (acceptance-criteria, markdown, mcp-tasks) passed 118/118.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed BACK-537: AC/DoD checklist editing is now deterministic and supports atomic clear-all.

--ac and --acceptance-criteria remain additive aliases in both task create and task edit. The new --clear-ac CLI option and acceptanceCriteriaClear MCP field provide an explicit atomic clear operation, rejecting ambiguous combinations. The shared markdown serializer now preserves canonical section order, custom content, stable whitespace, and CRLF line endings, and fails closed on malformed AC/DoD marker structures.

All acceptance criteria are checked; type checking, Biome checks, and focused regression tests pass. Full suite has 29 failures, but baseline HEAD has 33 failures in the same files, confirming the failures are pre-existing and unrelated to this task.
<!-- SECTION:FINAL_SUMMARY:END -->
