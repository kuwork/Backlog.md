---
id: BACK-521.14
title: Update CLI/MCP instruction guides with missing agent guidance
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-14 23:18'
updated_date: '2026-07-15 00:04'
labels:
  - docs
  - agent-guidance
dependencies:
  - BACK-521.1
  - BACK-521.6
  - BACK-521.7
parent_task_id: BACK-521
ordinal: 181400
actual_start: '2026-07-14 17:19'
actual_end: '2026-07-14 23:19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backport missing operational guidance from agent-guidelines.md into the new CLI/MCP instruction surfaces. Add directory layout, golden rule, task field reference, milestones guide, image/assets handling, common issues (including doc reference path examples), and update tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create separate milestones guide files for CLI and MCP and register them in workflow-guides.ts
- [x] #2 Add missing operational content to CLI and MCP overview guides
- [x] #3 Move Task Field Quick Reference and AC/DoD operations into task-execution guides
- [x] #4 Update CLI and MCP tests for new guides and content
- [x] #5 All relevant tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created src/guidelines/cli-instructions/milestones.md and src/guidelines/mcp/milestones.md; registered milestones guide in workflow-guides.ts, index.ts, and commands/instructions.ts.

Added Backlog Directory Layout, Golden Rule, NEVER EDIT direct warning with DO/DON'T examples, Task Images/Assets, Search Quick Reference, Other Useful Commands, Common Issues (including doc reference path examples) to CLI and MCP overviews.

Moved Task Field Quick Reference and Acceptance Criteria/DoD Operations sections from overviews into task-execution guides.

Updated src/test/cli.test.ts and src/test/mcp-server.test.ts to cover the new milestones guide and relocated overview content.

Added explicit 'Do NOT include an Implementation Plan when creating a task' guidance to CLI and MCP task-creation guides, and strengthened CLI task-execution guide to require user approval before coding.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backported missing operational guidance from agent-guidelines.md into the new CLI/MCP instruction surfaces.

Changes:
- Created separate milestones guides for CLI and MCP and registered them as workflow guides accessible via backlog instructions milestones and backlog://workflow/milestones.
- Added Backlog Directory Layout, Golden Rule, direct-edit warnings with DO and DON'T examples, Task Images/Assets, Search Quick Reference, Other Useful Commands, and Common Issues including doc reference path examples to CLI and MCP overviews.
- Moved Task Field Quick Reference and AC/DoD operations sections from overviews into task-execution guides.
- Added explicit 'Do NOT include an Implementation Plan when creating a task' guidance to CLI and MCP task-creation guides, and strengthened CLI task-execution guide to require user approval before coding.
- Updated CLI and MCP tests to cover the new milestones guide and relocated content.
- Rebuilt dist/backlog.exe so the new milestones guide is available in the shipped binary.

Verification:
- bun test src/test/cli.test.ts --test-name-pattern "backlog instructions command" — 7 pass
- bun test src/test/mcp-server.test.ts — 10 pass
- bunx tsc --noEmit — no new type errors in changed files
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
