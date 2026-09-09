---
title: Agent first-round should load project config before acting
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - agent-guidance
  - cli-instructions
  - config
source_path: backlog/tasks/back-582 - Agent-first-round-should-load-project-config-before-acting.md
---

# Agent first-round should load project config before acting

Fixed a first-round failure mode: a new agent session ran `backlog instructions overview`, which only printed general workflow instructions, then answered using default assumptions about defaultAssignee, statuses, and active tasks — and the user had to correct it. The overview guide now requires agents to load live project state via the CLI before producing any answer or plan.

## Summary

- Implemented in `src/guidelines/cli-instructions/overview.md` instead of the project's `AGENTS.md` — a deliberate choice so the instruction ships with the Backlog.md CLI and applies to every project using it.
- Added an explicit first-session step listing `config list`, `search`, `task list`, `task view`, and `overview` commands to run before any work begins.
- Added a warning that agents must read configured `statuses`/`defaultStatus` from `config list` and must not assume the default `[To Do, In Progress, Done]` set; when setting or validating a task status it must be within the configured statuses.
- Added a `defaultStatus` validation reminder: `defaultStatus` must be a member of `statuses`; if not, agents should warn the user and ask them to add it to `statuses` or pick a different default.
- Documented initialization defaults (`statuses: [To Do, In Progress, Done]`, `defaultStatus: To Do`) while stressing that projects can customize them and agents must verify with `config list`. The now-redundant BACK-584 task was archived.
- Verification: `bun run check .` clean (pre-existing warnings only); `bun test src/test/cli.test.ts src/test/cli-root-entry.test.ts` 98 pass / 0 fail.

## Acceptance Criteria

- Startup instructions require reading live project config at session start; listed commands cover defaultAssignee, statuses, active tasks, and milestones.
- First-round answers use the fetched config instead of defaults; verification shows a simulated first-round prompt uses the correct defaultAssignee/statuses.

## Related Concepts

- [[concepts/cli-instructions]] — the shipped overview guide is the primary agent entry point
- [[concepts/mcp-workflow]] — the same load-config-first discipline applies to MCP-driven agents

## Related Sources

- [[sources/back-521]] — the CLI-first agent workflow refactor that created the overview surface
- [[sources/back-521.1]] — the shared workflow instruction registry the overview belongs to
- [[sources/back-579-default-assignee]] — one of the config values agents must now fetch live (same batch)
