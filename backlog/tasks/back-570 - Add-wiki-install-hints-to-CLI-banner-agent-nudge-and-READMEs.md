---
id: BACK-570
title: 'Add wiki install hints to CLI banner, agent nudge, and READMEs'
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-22 05:30'
updated_date: '2026-08-22 05:39'
labels:
  - cli
dependencies: []
modified_files:
  - src/ui/root-entry.ts
  - src/guidelines/cli-agent-nudge.md
  - src/test/cli-root-entry.test.ts
  - README.md
  - README.en.md
ordinal: 192400
actual_start: '2026-08-22 05:24'
actual_end: '2026-08-22 05:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The backlog wiki install command lets users install the bundled llm-wiki-for-backlog skill for their AI agent, but today it is not discoverable from the CLI entry point, agent instructions, or README. Supported targets are claude, codex, and agents. Installation can be previewed with --dry-run and overwritten with --force. This task makes the command visible in the CLI root entry banner, adds guidance to the CLI agent nudge so agents can help users install the skill, and documents the installation steps in both README files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `src/guidelines/cli-agent-nudge.md` contains wiki skill installation guidance
- [x] #2 `README.md` and `README.en.md` wiki sections include installation instructions
- [x] #3 Tests assert the new CLI banner line is present
- [x] #4 CLI root entry has a dedicated LLM Wiki section with backlog wiki install <agent>
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated "LLM Wiki:" section to the CLI root entry (src/ui/root-entry.ts) and place "backlog wiki install <agent>" there so it is visually separate from local workflow instructions.
2. Update src/guidelines/cli-agent-nudge.md with a Wiki Skill Installation subsection that lists supported agents and the --dry-run / --force options.
3. Add an "Install the Wiki Skill" subsection to README.en.md and the equivalent Chinese section in README.md under the LLM Wiki Knowledge Base area.
4. Update src/test/cli-root-entry.test.ts to assert the new LLM Wiki section and command line appear in both initialized and non-initialized output.
5. Run scoped tests, type check, and biome check for touched files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented exactly as planned.
- src/ui/root-entry.ts: added a new "LLM Wiki:" section after "Local instructions:" with commandLine("backlog wiki install <agent>", "Install the LLM wiki skill for your agent").
- src/guidelines/cli-agent-nudge.md: added a "Wiki Skill Installation" subsection with claude/codex/agents examples and --dry-run / --force notes.
- README.en.md and README.md: added "Install the Wiki Skill" / "安装 Wiki Skill" subsections under the LLM Wiki Knowledge Base usage area.
- src/test/cli-root-entry.test.ts: added assertions for "LLM Wiki:" and "backlog wiki install <agent>" in both initialized and non-initialized root entry tests.

Verification:
- bun test src/test/cli-root-entry.test.ts: 6 pass
- bun test src/test/agent-instructions.test.ts: 13 pass
- bunx tsc --noEmit: pass
- npx biome check on touched files: pass
- bun test src/test/cli.test.ts: 90 pass, 2 fail (pre-existing unrelated failures in task list limit grouping and doc update path)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a dedicated "LLM Wiki:" section to the CLI root entry with backlog wiki install <agent>, added wiki skill installation guidance to src/guidelines/cli-agent-nudge.md, and documented the installation steps in README.md and README.en.md. Updated src/test/cli-root-entry.test.ts to assert the new section. Scoped tests (cli-root-entry, agent-instructions) passed; bunx tsc --noEmit passed; biome check passed for all touched files. The full bun test src/test/cli.test.ts still has two pre-existing unrelated failures in task list limit grouping and doc update paths.
<!-- SECTION:FINAL_SUMMARY:END -->
