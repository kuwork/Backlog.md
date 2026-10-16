---
id: BACK-801
title: >-
  Bundle task-migration-architect skill with seed-only project memory install
  (backlog migrate install)
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-16 03:46'
updated_date: '2026-10-16 06:57'
labels: []
dependencies: []
modified_files:
  - scripts/embed-skills.ts
  - src/commands/migrate-install.ts
  - src/cli.ts
  - src/ui/root-entry.ts
  - src/skills/embedded/task-migration-architect.ts
  - src/skills/embedded/llm-wiki-for-backlog.ts
  - src/test/migrate-install.test.ts
  - src/test/cli-root-entry.test.ts
  - src/guidelines/cli-agent-nudge.md
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - .codex/skills/task-migration-architect/SKILL.md
  - >-
    .codex/skills/task-migration-architect/references/current-branch-migration-exclusions.template.md
ordinal: 363001
actual_start: '2026-10-16 03:47'
actual_end: '2026-10-16 04:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task-migration-architect skill currently lives only in this repo's .codex/skills directory. Like llm-wiki-for-backlog, it should be embedded into the binary and installable into other projects. The blocker is references/current-branch-migration-exclusions.md: it is per-fork project memory (this fork's evolved capabilities), not generic skill content. Embedding it as-is would leak this fork's private memory into the shipped binary, and the install command's full-overwrite semantics would clobber a user's maintained copy. Approach: ship the file as a template written only when missing (seed-only), and add a bootstrap rule to SKILL.md for projects where the file is still an unfilled template.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New command backlog skill install <skill> <agent> installs llm-wiki-for-backlog or task-migration-architect, with --force and --dry-run
- [x] #2 backlog wiki install <agent> keeps working as an alias for installing llm-wiki-for-backlog
- [x] #3 current-branch-migration-exclusions.md is not embedded verbatim; a template is installed only when the target file is missing and is never overwritten, even with --force
- [x] #4 task-migration-architect SKILL.md includes a bootstrap rule for when the exclusions file is missing or still a template
- [x] #5 Tests cover skill resolution, seed-only semantics, and wiki install compatibility
- [x] #6 New command backlog migrate install <agent> installs the task-migration-architect skill, with --force and --dry-run
- [ ] #7 backlog wiki install <agent> behavior and wiki-install.ts implementation stay unchanged
- [ ] #8 current-branch-migration-exclusions.md is not embedded verbatim; a template is installed only when the target file is missing and is never overwritten, even with --force
- [ ] #9 task-migration-architect SKILL.md includes a bootstrap rule for when the exclusions file is missing or still a template, plus agent-driven MIGRATION GUIDELINES injection instructions mirroring the wiki skill
- [ ] #10 Entry points advertise the new command: CLI root entry, agent nudge, instructions overview, agent guidelines
- [ ] #11 Tests cover seed-only semantics, template embedding, and install result formatting
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backlog migrate install <agent> command that embeds and installs the task-migration-architect skill, mirroring wiki install.

Changes:
- scripts/embed-skills.ts generalizes the old embed-wiki-skill.ts to embed multiple skills, with seed-file mappings: the fork-private references/current-branch-migration-exclusions.md is excluded from embedding; a .template.md is embedded under the target path instead
- src/commands/migrate-install.ts installs the skill like wiki install (central .agents/skills + symlink/fallback), but writes seed files only when missing — never overwritten, even with --force; wiki-install.ts untouched
- SKILL.md gained an exclusions bootstrap flow and agent-driven MIGRATION GUIDELINES injection instructions (same pattern as wiki guidelines)
- Entry guidance added to CLI root entry, agent nudge, instructions overview, agent guidelines, AGENTS.md

Verification:
- bun test migrate-install/wiki-install/cli-root-entry: 27 pass
- bunx tsc --noEmit: clean
- biome check on changed files: clean
- End-to-end smoke in a temp project: fresh install seeds template; --force reinstall keeps user-edited memory file
<!-- SECTION:FINAL_SUMMARY:END -->
