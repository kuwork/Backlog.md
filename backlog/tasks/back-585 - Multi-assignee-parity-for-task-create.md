---
id: BACK-585
title: Multi-assignee parity for task create
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-23 23:40'
labels:
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/utils/task-builders.ts
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/drafts.md
  - src/guidelines/cli-instructions/task-execution.md
priority: medium
actual_start: '2026-08-23 23:24'
actual_end: '2026-08-23 23:34'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
task create -a "@a,@b" stores one literal assignee "@a,@b" because the create path wraps the raw option value while task edit parses comma-separated input. Repeated -a flags silently keep only the last value because the option is non-collecting. The same defect class was already fixed for --labels; create/draft should reach parity with edit by routing assignees through the shared parseDelimitedStringList helper and making -a repeatable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-576 and git show d8f394f as implementation reference.
- [x] #2 Comma-separated assignees parse into separate assignees on task create and draft create.
- [x] #3 Repeated -a flags collect into multiple assignees on task create, task edit, and draft create.
- [x] #4 Create/draft assignee parsing uses the same parseDelimitedStringList helper as task edit and labels.
- [x] #5 Tests cover comma-separated and repeated-flag input on create, edit, and draft.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Repeatable -a/--assignee option

- 1.1 Register createMultiValueAccumulator on -a/--assignee for task create, task edit, and draft create, mirroring the labels option shape.
- 1.2 Parse create and draft-create assignees through parseDelimitedStringList so comma-separated values split into separate assignees, matching task edit.

### Phase 2 - Align help and shared helpers

- 2.1 Document repeatability and comma-separated input in the create/edit help schema and option descriptions.
- 2.2 Replace the duplicated inline label split in task create and draft create with parseDelimitedStringList so assignees and labels share one helper.

### Phase 3 - Audit other surfaces

- 3.1 Audit the task-creation wizard and MCP create/edit handlers for the same asymmetry; align only if a real gap exists.

### Phase 4 - Tests and verification

- 4.1 Add CLI tests: comma-separated and repeated -a on task create, repeated -a on task edit, comma-separated and repeated -a on draft create, plus help-schema assertions.
- 4.2 Verify with bunx tsc --noEmit, bun run check ., scoped tests, and one full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- Made -a/--assignee repeatable on task create, task edit, and draft create by registering createMultiValueAccumulator, and routed create/draft-create assignees through the shared parseDelimitedStringList helper so comma-separated values split into separate assignees. This mirrors the existing labels handling: comma-separated parsing plus repeatable flags.
- Replaced the duplicated inline label split in task create and draft create with parseDelimitedStringList. Behavior is identical because createTaskFromInput already runs normalizeStringList over labels.
- Preserved the existing --unassign guard and empty -a validation added by the explicit-unassign work: the assignee assignment keeps the options.unassign ? [] branch, and -a "" still errors with a prompt to use --unassign.
- The edit path already parsed assignees through parseClearableStringList; it needed only the repeatable option registration to align with create/draft.

### Audit

- The task-creation wizard already parsed comma-separated assignees (parseListInput in src/commands/task-wizard.ts, shared by create and edit), and MCP task_create/task_edit already accept assignee as a JSON array on both sides. Neither surface had the create/edit asymmetry, so no changes were needed there.

### Verification

- bunx tsc --noEmit clean; bun run check clean over the touched files; scoped tests on cli-plain-create-edit and draft-create-consistency (20 pass, 0 fail).

### Documentation

- Updated the CLI usage guides to document multi-assignee support on -a/--assignee: task-creation.md (task create), drafts.md (draft create), and task-execution.md (task edit, added an Assignees (multiple) row). MCP guides were left unchanged because task_create/task_edit already accept assignee as a JSON array.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Brought task create and draft create to multi-assignee parity with task edit: -a/--assignee is now repeatable on all three commands and comma-separated values split into separate assignees, matching the shape of the labels fix. The inline label split in create/draft was replaced with the shared parseDelimitedStringList helper, and the existing --unassign guard and empty -a validation were preserved. The wizard and MCP create/edit paths were audited and already handled multi-assignee input, so they were left unchanged. Verified with CLI tests covering comma-separated and repeated -a on create, edit, and draft create plus help-schema assertions, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->
