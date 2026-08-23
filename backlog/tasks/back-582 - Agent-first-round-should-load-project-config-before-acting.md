---
id: BACK-582
title: Agent first-round should load project config before acting
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 13:52'
updated_date: '2026-08-23 14:25'
labels: []
dependencies: []
references:
  - AGENTS.md
  - ADVANCED-CONFIG.md
  - src/guidelines/cli-instructions/overview.md
modified_files:
  - src/guidelines/cli-instructions/overview.md
ordinal: 198400
actual_start: '2026-08-23 13:52'
actual_end: '2026-08-23 13:59'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a new conversation starts in this project, the agent currently runs backlog instructions overview, which only prints general workflow instructions. It does not fetch the live project configuration (defaultAssignee, statuses, labels, current active tasks, milestones, etc.) before answering. This causes the first round of conversation to use default or wrong assumptions, and the user has to correct it. Update the project instructions so that every new session first loads the actual project state via the CLI before producing any answer or plan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AGENTS.md or equivalent startup instructions require reading live project config at session start
- [x] #2 Listed config/state commands cover defaultAssignee, statuses, active tasks, and milestones
- [x] #3 First-round answers use the fetched config instead of defaults
- [x] #4 Verification shows a simulated first-round prompt uses the correct defaultAssignee/statuses
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update AGENTS.md startup instructions to require agents to fetch live project config (defaultAssignee, statuses, active tasks, milestones) at session start.
2. List concrete CLI commands to run.
3. Verify the updated instructions are clear and executable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/guidelines/cli-instructions/overview.md instead of AGENTS.md, so the instruction ships with the Backlog.md CLI and applies to all projects using it.
Added an explicit first-session step to load live project state (config list, task lists, overview) before relying on defaults.
Verified with bun run check (only pre-existing warnings) and bun test src/test/cli.test.ts src/test/cli-root-entry.test.ts (98 pass / 0 fail).

Added explicit warning about configured statuses/defaultStatus in overview.md: agents must read them from config list and must not assume the default [To Do, In Progress, Done] set. When setting/validating a task status, ensure it is within the configured statuses.

Added defaultStatus validation reminder to overview.md: defaultStatus must be a member of statuses; if not, agents should warn the user and ask them to add it to statuses or choose a different defaultStatus. Archived the unnecessary BACK-584 task.

Documented initialization defaults for statuses/defaultStatus in overview.md: default initialization uses statuses [To Do, In Progress, Done] and defaultStatus To Do, but agents must verify with config list because projects can customize them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated backlog instructions overview (src/guidelines/cli-instructions/overview.md) to tell agents to load live project state on the first interaction of a new session. The instruction now lists config list, search, task list, task view, and overview commands before any work begins, so agents do not rely on default assumptions for defaultAssignee, statuses, or active tasks. The change ships with the Backlog.md CLI, so any project using it benefits. Verified with bun run check (only pre-existing warnings) and bun test src/test/cli.test.ts src/test/cli-root-entry.test.ts (98 pass / 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
