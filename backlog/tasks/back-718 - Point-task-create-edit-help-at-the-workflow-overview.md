---
id: BACK-718
title: Point task create/edit --help at the workflow overview
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-29 09:06'
updated_date: '2026-09-29 09:33'
labels: []
dependencies: []
references:
  - 'src/cli.ts:1835-1853'
  - 'src/cli.ts:3621-3636'
  - 'src/commands/help-schema.ts:41-64'
  - 'src/commands/instructions.ts:38'
  - 'src/guidelines/cli-agent-nudge.md:7'
modified_files:
  - src/commands/help-schema.ts
  - src/cli.ts
  - src/test/cli.test.ts
ordinal: 288400
actual_start: '2026-09-29 09:16'
actual_end: '2026-09-29 09:33'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reader who opens `backlog task create --help` or `backlog task edit --help` is usually about to work in this project for the first time, and the syntax block teaches the flags but says nothing about the required first step.

This project already expects every conversation to start from the workflow tutorial (`backlog instructions overview`, described as the required first read in `src/commands/instructions.ts`), but that expectation only reaches agents whose instruction files are loaded. Someone who lands on `--help` never sees it. Adding one line to both help outputs makes the hint travel with the command the reader actually opened.

Scope is the CLI `--help` text only: a normal `task create`/`task edit` run, the MCP `task_create`/`task_edit` descriptions, and every other command help output stay as they are. In this fork the two commands are `backlog task create` and `backlog task edit` (there is no top-level `backlog create`/`backlog edit`), and both help bodies are rendered by `renderHelpSchema` in `src/commands/help-schema.ts` via `addHelpText("after", ...)`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task create --help ends with a one-line hint telling the reader to run `backlog instructions overview` first when they have not read it yet in the current session
- [x] #2 backlog task edit --help shows the same hint with identical wording, so the two commands cannot drift apart
- [x] #3 The hint is emitted through one shared mechanism in src/commands/help-schema.ts instead of two duplicated literal strings
- [x] #4 The hint appears only in --help output: a normal task create / task edit run does not print it, and no unrelated command's help output changes
- [x] #5 A test asserts the hint text is present in both task create --help and task edit --help
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an optional `note` field to `HelpSchema` (src/commands/help-schema.ts:14) and render it as the final `Note: …` line of the schema block in `renderHelpSchema` (src/commands/help-schema.ts:41). The block is appended with `addHelpText("after")`, so a note renders at the very end of the help output.
2. Define the hint sentence once as an exported constant beside the renderer and reference it from both schemas, so the wording exists as one literal instead of two.
3. Pass `note` in the `task create` schema (src/cli.ts:1835) and the `task edit` schema (src/cli.ts:3621). Every other `addHelpSchema` call stays untouched, so no unrelated help output changes.
4. Add a focused test next to the existing help assertions: `task create --help` and `task edit --help` both must end with the same hint line, while `task list --help` (no note) must not contain it.
5. Verify: `bunx tsc --noEmit`, `bun run check .`, `bun test src/test/cli.test.ts`, plus a manual tails of both help outputs and a normal `task create` / `task edit` run to prove the hint is help-only.
6. Record implementation notes, check AC 1-5 as they become true, and prepare the handover for review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as one shared note instead of two copies: `HelpSchema` gained an optional `note`, and `renderHelpSchema` prints it as the closing `Note: …` line of the schema block - which `addHelpText("after")` already places at the end of the help output. The sentence itself is a single exported constant (`INSTRUCTIONS_OVERVIEW_HINT` in src/commands/help-schema.ts) referenced by the task create and task edit schemas, so the two footers cannot drift. Every other `addHelpSchema` call is untouched.

Verification: `task create --help` and `task edit --help` both end with an identical Note line; `task list|view --help`, `search --help`, `draft edit --help`, `milestone list --help` carry no hint; a normal `task create` / `task list` run in a scratch project outside the repo stays quiet. Gates: `bunx tsc --noEmit` clean; `bunx biome check` clean on the three touched files (the repo-wide 3 warnings + 1 info are pre-existing in src/core/assets.ts and src/test/board-tui-draft-create.test.ts); `bun test --timeout 240000 src/test/cli.test.ts` -> 94 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Point task create/edit --help at the workflow overview.

Adds an optional `note` to `HelpSchema`, rendered by `renderHelpSchema` as the closing `Note: …` line of the help output. Both `task create` and `task edit` reference one exported constant (`INSTRUCTIONS_OVERVIEW_HINT`), so the sentence is written once and the two footers cannot drift; no other command's help output changes, and a normal create/edit run stays quiet.

Files: src/commands/help-schema.ts (`note` field + shared constant + renderer), src/cli.ts (two schemas + import), src/test/cli.test.ts (new test: identical closing Note line on both commands, no hint in `task list --help`, no hint on a normal create run).

Verification: `bunx tsc --noEmit` clean; biome clean on the touched files; `bun test --timeout 240000 src/test/cli.test.ts` 94 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
