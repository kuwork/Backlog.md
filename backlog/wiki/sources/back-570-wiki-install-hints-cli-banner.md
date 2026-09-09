---
title: Add wiki install hints to CLI banner, agent nudge, and READMEs
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
  - agent-guidance
  - wiki
source_path: backlog/tasks/back-570 - Add-wiki-install-hints-to-CLI-banner-agent-nudge-and-READMEs.md
---

# Add wiki install hints to CLI banner, agent nudge, and READMEs

Made the bundled `backlog wiki install <agent>` skill-installation command discoverable across all entry points. The command existed (targets: claude / codex / agents, with `--dry-run` and `--force`) but was invisible from the CLI root entry, agent instructions, and both READMEs, so users and agents never found it.

## Summary

- Added a dedicated `LLM Wiki:` section to the CLI root entry banner in `src/ui/root-entry.ts`, placed after `Local instructions:` with `commandLine("backlog wiki install <agent>", ...)`, visually separated from local workflow instructions.
- Added a `Wiki Skill Installation` subsection to `src/guidelines/cli-agent-nudge.md` listing supported agents (claude / codex / agents) and the `--dry-run` / `--force` options.
- Added `Install the Wiki Skill` / `安装 Wiki Skill` subsections under the LLM Wiki Knowledge Base area in `README.en.md` and `README.md`.
- Extended `src/test/cli-root-entry.test.ts` to assert the new section and command line appear in both initialized and non-initialized root entry output (6 tests pass).
- Full `src/test/cli.test.ts` run showed 2 pre-existing unrelated failures (task list limit grouping, doc update path).

## Acceptance Criteria

- `src/guidelines/cli-agent-nudge.md` contains wiki skill installation guidance.
- `README.md` and `README.en.md` wiki sections include installation instructions.
- Tests assert the new CLI banner line is present.
- CLI root entry has a dedicated LLM Wiki section with `backlog wiki install <agent>`.

## Related Concepts

- [[concepts/cli-entry]] — root entry banner is the CLI's primary discovery surface for commands
- [[concepts/cli-instructions]] — the agent nudge ships as part of the local instruction surface
- [[concepts/embedded-skills]] — the wiki skill is embedded in the binary and installed per agent

## Related Sources

- [[sources/wiki-install-task]] — BACK-474 introduced the `backlog wiki install` command itself
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — adjacent wiki-skill documentation update
- [[sources/back-521.2]] — short CLI nudge design that this task extends
