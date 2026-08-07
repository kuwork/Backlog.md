---
id: BACK-547
title: Document multi-line CLI input without bash ANSI-C quoting
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 01:52'
updated_date: '2026-08-07 04:25'
labels:
  - docs
  - cli
dependencies: []
ordinal: 188400
actual_start: '2026-08-07 01:53'
actual_end: '2026-08-07 01:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When agents wrap multi-line values with bash ANSI-C quoting ($'...'), the shell converts 
 sequences into real newlines before the CLI sees them. This causes the echoed command to break across lines and the CLI to receive only the first line as the argument value (e.g., --plan ends up with just the first step).

This is a documentation/guideline fix: the agent instruction guides should explicitly warn against using $'...' for --plan, --notes, --comment, --final-summary, --append-notes, and --append-final-summary, and remind agents to use the CLI's own 
 escape handling inside regular double quotes instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI task-execution guide includes a warning about $'...' quoting for multi-line fields
- [x] #2 Agent guidelines multi-line input section warns against $'...' and explains the breakage
- [x] #3 MCP task-execution guide is updated if it contains equivalent examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated CLI task-execution, task-creation, and agent-guidelines with warnings against bash $'...' quoting for multi-line fields.

Unified the wording of the $'...' warnings across CLI task-execution, task-creation, and agent-guidelines so the message is consistent everywhere.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added explicit warnings against bash ANSI-C quoting ($'...') for multi-line CLI fields in the agent instruction guides. Changes cover CLI task-execution, CLI task-creation, and agent-guidelines. MCP guide has no equivalent CLI examples so it was verified and left unchanged. Biome check passes; the remaining warnings are pre-existing in src/core/assets.ts and unrelated to this change.
<!-- SECTION:FINAL_SUMMARY:END -->
