---
id: BACK-525
title: Update wiki skill and CLI multi line input docs
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-27 23:40'
updated_date: '2026-06-28 03:45'
labels: []
dependencies:
  - BACK-523
  - BACK-524
  - BACK-508
modified_files:
  - .codex/skills/llm-wiki-for-backlog/SKILL.md
  - src/skills/embedded/llm-wiki-for-backlog.ts
  - scripts/embed-wiki-skill.ts
  - src/guidelines/agent-guidelines.md
  - CLI-INSTRUCTIONS.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
ordinal: 177400
actual_end: '2026-06-27 23:40'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update agent-facing documentation to reflect the changes introduced by BACK-508, BACK-523, and BACK-524.

This includes refreshing the llm-wiki-for-backlog skill docs and embedded skill for BACK-523 (wikilink aliases and markdown-it-attrs) and BACK-524 (media wikilinks), as well as updating agent-guidelines.md, CLI-INSTRUCTIONS.md, and the CLI task-creation, task-execution, and task-finalization guides for the BACK-508 CLI multi-line input behavior.

This task does not introduce new product behavior; it records the documentation and tooling changes so the project history stays consistent.

Note: description-newlines.test.ts currently fails in this Windows environment (pre-existing issue; manual CLI invocation preserves newlines correctly).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update llm-wiki SKILL.md with alias/attrs/media wikilink docs
- [x] #2 Regenerate src/skills/embedded/llm-wiki-for-backlog.ts
- [x] #3 Fix scripts/embed-wiki-skill.ts $ escaping
- [x] #4 Update agent-guidelines.md and CLI-INSTRUCTIONS.md Multi-line Input sections
- [x] #5 Add Multi-line Input section to CLI task-creation guide
- [x] #6 Verify bunx tsc --noEmit passes
- [x] #7 Update CLI task-execution guide with multi-line input examples
- [x] #8 Update CLI task-finalization guide with multi-line input examples
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Sync wikilink documentation for BACK-523 and BACK-524:
   - Update .codex/skills/llm-wiki-for-backlog/SKILL.md with alias/attribute syntax and media wikilink examples.
   - Regenerate src/skills/embedded/llm-wiki-for-backlog.ts from the updated skill source.
   - Fix $ escaping in scripts/embed-wiki-skill.ts so embedded Python regexes stay valid.

2. Sync CLI multi-line input documentation for BACK-508:
   - Update src/guidelines/agent-guidelines.md and CLI-INSTRUCTIONS.md to focus their Multi-line Input sections on --desc / --description.
   - Add focused Multi-line Input sections for --desc, --plan, --notes, --comment, and --final-summary to src/guidelines/cli-instructions/task-creation.md, task-execution.md, and task-finalization.md.

3. Verify:
   - Run bunx tsc --noEmit and scoped tests for the touched areas.
   - Note the pre-existing Windows failure in description-newlines.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wikilink support is fully documented:
- `[[target|alias]]` aliases support Markdown inline formatting and arbitrary HTML.
- `[[target]]{...}` supports markdown-it-attrs style/class attributes.
- `![[path]]`, `![[path|alt]]`, `![[path|W]]`, `![[path|alt|W]]`, and `![[path|alt|WxH]]` media wikilinks are supported for images, video, and audio; sizes apply to images and video only, audio ignores dimensions.
- The llm-wiki skill docs, embedded skill module, and embed script have been updated accordingly; `bun test src/test/wiki-install.test.ts` passes.

CLI multi-line input is documented:
- `src/guidelines/agent-guidelines.md` and `CLI-INSTRUCTIONS.md` now focus their Multi-line Input sections on `--desc` / `--description` for both `backlog task create` and `backlog task edit`.
- `src/guidelines/cli-instructions/task-creation.md`, `task-execution.md`, and `task-finalization.md` include focused Multi-line Input examples for `--desc`, `--plan`, `--notes`, `--comment`, and `--final-summary` using \n escape sequences (for `--desc`) or real line breaks (for other fields).
- `bunx tsc --noEmit` passes and the relevant wikilink tests pass.
- `description-newlines.test.ts` still fails on this Windows environment in both HEAD and the current tree, but manual CLI invocation confirms newlines are preserved correctly.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
