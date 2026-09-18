---
id: BACK-656
title: Correct the shipped agent guidance on overview cadence and task descriptions
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-30 20:59'
updated_date: '2026-09-18 09:01'
labels: []
dependencies: []
references:
  - 'src/guidelines/cli-agent-nudge.md:7'
  - 'AGENTS.md:82'
  - 'src/guidelines/cli-instructions/task-creation.md:79'
  - 'src/guidelines/cli-instructions/task-creation.md:91'
  - 'src/guidelines/cli-instructions/task-creation.md:97'
  - 'src/guidelines/mcp/task-creation.md:42'
  - 'src/guidelines/mcp/task-creation.md:75'
  - 'src/guidelines/mcp/task-creation.md:95'
  - '.claude/agents/project-manager-backlog.md:42'
  - 'src/test/cli.test.ts:143'
  - 'src/test/cli.test.ts:601'
  - 'src/test/mcp-server.test.ts:138'
modified_files:
  - AGENTS.md
  - src/guidelines/cli-agent-nudge.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/mcp/task-creation.md
  - .claude/agents/project-manager-backlog.md
  - src/test/cli.test.ts
  - src/test/mcp-server.test.ts
actual_start: '2026-09-18 08:47'
actual_end: '2026-09-18 09:01'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two shipped agent-guidance texts teach behaviour their own prose does not want. The CLI agent nudge injected into AGENTS.md at init tells agents to run `backlog instructions overview` for every user request, so one conversation re-reads the same static text many times. The task-creation guides have the opposite problem: the prose already asks a description to carry the why, but the only example description shipped with the CLI states the outcome alone and the MCP guide ships no example at all, and agents copy a demonstrated shape more reliably than they follow prose. The nudge trigger becomes once per conversation, and the description guidance is corrected at the demonstration rather than by adding more prose.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-664` and `--grep BACK-676`, plus `git show dedeaa06a` and `git show 04c4210fb`, and confirm each stated change against the fork before porting it.
- [x] #2 The shipped nudge instructs reading the overview at the start of each conversation rather than once per user request, and re-reads it only when it has not been read yet in the current conversation.
- [x] #3 This repository's own AGENTS.md instance carries the new nudge wording.
- [x] #4 The CLI task-creation guide states what a description must contain and explicitly says not to restate the acceptance criteria there.
- [x] #5 The CLI guide example shows a description that gives the need or trigger before what changes, followed by a short contrast noting why the outcome-only version is too thin.
- [x] #6 The MCP task-creation guidance carries an equivalent example description, since it currently shows none.
- [x] #7 Guidance that pushes toward trimming descriptions is reconciled with the new wording so the two no longer contradict each other.
- [x] #8 The outcome-only example in the project-manager agent guidance carries the need before what changes instead of restating the title as an instruction.
- [x] #9 Tests assert on the changed instruction text so the wording cannot silently drift back, and the affected suites pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reword the overview trigger in src/guidelines/cli-agent-nudge.md, the single source injected at init and update, from per-request to once per conversation, re-reading only when it has not been read yet.
2. Update this repository's own AGENTS.md instance to the same sentence and update the init assertion in src/test/cli.test.ts.
3. Reword the Step 4 description bullet in src/guidelines/cli-instructions/task-creation.md so it names the problem, trigger, or user need plus context a future agent cannot recover from the code, and explicitly forbids restating the acceptance criteria.
4. Replace the outcome-only `-d` example in the same guide with one that gives the need before the change, followed by a two-line Too thin contrast showing the old line and why it fails.
5. Give src/guidelines/mcp/task-creation.md the same requirement and prohibition plus an example description and the same contrast, in its existing bold-label and dashed-bullet shape.
6. Reconcile the MCP lines that read as trim-the-description instructions so they limit implementation detail rather than rationale.
7. Replace the outcome-only example in the project-manager agent guidance, which src/guidelines/project-manager-backlog.md symlinks to, carrying the reason in the user request rather than inventing one.
8. Pin the wording with assertions in src/test/cli.test.ts over the rendered `backlog instructions task-creation` output and the generated AGENTS.md, and in src/test/mcp-server.test.ts over MCP_TASK_CREATION_GUIDE.
9. Run bunx tsc --noEmit, bun run check ., and the affected suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guidance-only change; no runtime code path is touched.

Nudge (src/guidelines/cli-agent-nudge.md:7): the trigger now reads "At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation." That file is the single source imported by src/guidelines/index.ts and injected into AGENTS.md at init and update, so this repository's own instance (AGENTS.md:82) was updated with the same sentence. No other shipped surface still carries the old wording.

Description guidance: the CLI guide (src/guidelines/cli-instructions/task-creation.md:79) now names what belongs in a description - the problem, trigger, or user need plus context a future agent cannot recover from the code - and forbids restating the acceptance criteria there. Its example at line 91 gives the need before the change, followed by a two-line "Too thin" contrast at line 97 that labels the old outcome-only line. The MCP guide (src/guidelines/mcp/task-creation.md:75) carries the same requirement and prohibition, its first example description, and the same contrast; the two lines that read as trim-the-description instructions now limit code detail rather than rationale (line 42, line 95).

Project-manager guidance: the example description at .claude/agents/project-manager-backlog.md:42 no longer restates the title as an instruction, and the reason is carried in the quoted user request rather than invented. In this fork src/guidelines/project-manager-backlog.md is a symlink to that file (upstream keeps two separate copies), so a single edit covers both surfaces.

Deviation from the analysis report: doc-13 records CORE-29 as rewriting "the MCP guide", but the per-request sentence lives in the CLI nudge, not in the MCP guide; the MCP nudge uses a different, resource-based trigger and was left untouched. CORE-33 was widened by one file beyond the report's scope - the project-manager example - because it is part of the same upstream change and carries the same defect.

Verification. The change is text, so the new assertions were checked by revert rather than by a behavioural baseline: with the guides restored to HEAD and the test files kept, "prints selected instruction guides", "should default to CLI instructions when no mode is specified" and "task creation guide demonstrates a description that carries the why" each fail, and all three pass once the changes are back. bunx tsc --noEmit clean; bun run check . 418 files, 0 error and the 3 pre-existing assets.ts warnings; bun test src/test/mcp-server.test.ts src/test/agent-instructions.test.ts src/test/claude-agent-install.test.ts 29 pass / 0 fail. src/test/cli.test.ts is 90 pass / 2 fail, and both failures are pre-existing environment issues: "should accept dependencies from other active branches" and "should merge task status from remote branches" fail the same way with every changed file restored to HEAD.

Gotcha found while writing the MCP case: the afterEach in src/test/mcp-server.test.ts calls safeCleanup(TEST_DIR) unconditionally, so a case that leaves TEST_DIR unset throws ERR_INVALID_ARG_TYPE when the file is filtered to that case alone. The new case assigns TEST_DIR like its siblings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The shipped nudge now reads the overview at the start of each conversation instead of on every user request, and both task-creation guides demonstrate a description that carries the why instead of shipping an outcome-only example. The CLI guide example now gives the need before the change with a two-line contrast labelling the old line as too thin, the MCP guide gained its first example description plus the same contrast, its trim-the-description lines were reconciled so they limit code detail rather than rationale, and the project-manager example no longer restates the title as an instruction. Verified by revert: the three new assertions fail against the pre-change guides and pass with the changes in place; bunx tsc --noEmit and bun run check . clean; the MCP and agent-instruction suites 29 pass / 0 fail, and the only cli.test.ts failures are pre-existing environmental ones that fail at HEAD too.
<!-- SECTION:FINAL_SUMMARY:END -->
