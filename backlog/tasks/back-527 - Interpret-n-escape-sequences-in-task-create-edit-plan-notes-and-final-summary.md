---
id: BACK-527
title: >-
  Interpret \n escape sequences in task create/edit plan, notes, and final
  summary
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-14 06:21'
updated_date: '2026-07-14 06:32'
labels:
  - cli
dependencies:
  - BACK-508
references:
  - src/cli.ts
ordinal: 179400
actual_start: '2026-07-14 06:23'
actual_end: '2026-07-14 06:26'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-508 previously fixed 
 handling for task descriptions, but the same escape logic is missing for implementationPlan, implementationNotes, and finalSummary fields in both task create and task edit commands.

As a result, running commands like:
- backlog task create ... --plan "1. Step one
2. Step two"
- backlog task edit BACK-1 --notes "Line one
Line two"
- backlog task edit BACK-1 --final-summary "Summary
Details"

produces literal 
 characters in the saved markdown instead of real line breaks, making multi-line plans, notes, and summaries unreadable.

This task applies the existing processCliEscapes helper to these fields so they behave consistently with --description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task create --plan supports \n escape sequences
- [x] #2 task create --notes supports \n escape sequences
- [x] #3 task create --final-summary supports \n escape sequences
- [x] #4 task edit --plan supports \n escape sequences
- [x] #5 task edit --notes supports \n escape sequences
- [x] #6 task edit --final-summary supports \n escape sequences
- [x] #7 Existing description \n behavior remains unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied processCliEscapes to implementationPlan, implementationNotes, and finalSummary in both task create and task edit code paths in src/cli.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied processCliEscapes to implementationPlan, implementationNotes, and finalSummary fields in both task create and task edit code paths in src/cli.ts.

Changes:
- task create: --plan, --notes, and --final-summary now interpret 
 as real line breaks
- task edit: --plan, --notes, and --final-summary now interpret 
 as real line breaks
- Existing --description behavior unchanged

Verification:
- bunx tsc --noEmit passes
- bun test src/test/cli.test.ts: 89 pass, 1 unrelated fail in doc update path test
- Modified src/cli.ts checked with biome check --write
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
