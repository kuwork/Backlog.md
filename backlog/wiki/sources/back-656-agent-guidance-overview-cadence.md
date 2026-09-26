---
title: BACK-656 Correct the shipped agent guidance on overview cadence and task descriptions
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - mcp
  - agent-guidance
  - upstream-migration
source_path: backlog/tasks/back-656 - Correct-the-shipped-agent-guidance-on-overview-cadence-and-task-descriptions.md
---

# BACK-656 Correct the shipped agent guidance on overview cadence and task descriptions

Two shipped agent-guidance texts taught behaviour their own prose did not want: the CLI agent nudge told agents to re-read `backlog instructions overview` on every user request, and the task-creation guides asked descriptions to carry the why while shipping only outcome-only example descriptions (agents copy a demonstrated shape more reliably than they follow prose). Guidance-only change; no runtime code touched.

## Summary

- Nudge (`src/guidelines/cli-agent-nudge.md:7`, the single source injected into AGENTS.md at init/update): trigger reworded from per-request to once per conversation — "run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation"; this repo's own AGENTS.md instance updated with the same sentence
- CLI task-creation guide (`src/guidelines/cli-instructions/task-creation.md`): description bullet now names what belongs (problem, trigger, or user need plus context a future agent cannot recover from the code) and explicitly forbids restating the acceptance criteria; the example gives the need before the change, followed by a two-line "Too thin" contrast labelling the old outcome-only line
- MCP guide (`src/guidelines/mcp/task-creation.md`) gained its first example description plus the same requirement, prohibition, and contrast; its trim-the-description lines were reconciled to limit code detail rather than rationale
- Project-manager agent guidance example no longer restates the title as an instruction — the reason is carried in the quoted user request; in this fork the file is a symlink, so one edit covers both surfaces
- Deviation from the analysis report: the per-request sentence lives in the CLI nudge, not the MCP guide (the MCP nudge uses a resource-based trigger, left untouched); scope widened by the project-manager example because it shares the same upstream defect
- Tests pin the wording in `src/test/cli.test.ts` (rendered guide + generated AGENTS.md) and `src/test/mcp-server.test.ts` so it cannot silently drift back; verified by revert (three new assertions fail against pre-change guides)

## Acceptance Criteria

- The shipped nudge reads the overview at the start of each conversation, re-reading only if not yet read
- Both task-creation guides state what a description must contain, forbid restating acceptance criteria, and demonstrate a need-first example with a "too thin" contrast
- The project-manager example carries the need in the user request instead of restating the title
- Tests assert on the changed instruction text so wording cannot drift back

## Related Concepts

- [[concepts/cli-instructions]] — the shipped guidance surface this task corrects
- [[concepts/mcp-workflow]] — MCP task-creation guide gained its first example description
- [[concepts/upstream-migration]] — ports upstream BACK-664 (dedeaa06a) and BACK-676 (04c4210fb)

## Related Sources

- [[sources/back-532-cli-draft-workflow-guides]] — earlier CLI instruction guide work
- [[sources/back-572-agent-guides-date-fields-multiline-input]] — previous agent-guide corrections
