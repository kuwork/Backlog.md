---
title: Clarify CLI and MCP agent guides for date fields and multi-line input
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - agent-guidance
  - cli
  - mcp
  - docs
source_path: backlog/tasks/back-572 - Clarify-CLI-and-MCP-agent-guides-for-date-fields-and-multi-line-input.md
---

# Clarify CLI and MCP agent guides for date fields and multi-line input

Fixed two CLI/MCP input conventions that agents frequently got wrong. Date/datetime fields accept local time, convert to UTC for storage, and convert back for display — agents were feeding the UTC value visible in the file back as input, producing wrong local times. Multi-line text fields interpret the two characters `\n` as a newline — agents were pressing real Enter inside quoted arguments, which Bash splits across lines and leaves only the first line saved.

## Summary

- Added a local-time input callout under `Updating Task Dates` in `src/guidelines/cli-instructions/task-execution.md` (~line 127) and a new `Date and Time Fields` section in `src/guidelines/mcp/task-execution.md` (~line 78): CLI/MCP accept local time, store UTC, display local; agents must not use the file-visible UTC value as input.
- Removed the Markdown-file fallback note from the MCP guide, since MCP cannot directly edit task files (a micro-decision: dead-path guidance is worse than none).
- Updated `src/guidelines/agent-guidelines.md`, `src/guidelines/cli-instructions/task-execution.md`, and `src/guidelines/cli-instructions/task-creation.md` to warn against real newlines inside quoted arguments.
- Updated `src/guidelines/cli-instructions/drafts.md` to use the literal two-character `\n` in quoted arguments; clarified that storing a literal backslash-n requires doubling backslashes per shell rules.
- Updated help text in `src/cli.ts` for `description`, `plan`, `notes`, `final-summary`, `comment`, `append-plan`, `append-notes`, `append-final-summary`, and document content options to state the literal-`\n` convention.

## Acceptance Criteria

- Agent guides explicitly document local-time input for date fields (store UTC / display local, do not round-trip the stored UTC value).
- Multi-line input guidance uses literal `\n` inside quotes and warns against real newlines.

## Related Concepts

- [[concepts/date-fields]] — the five date fields whose storage format caused the round-trip confusion
- [[concepts/cli-instructions]] — the shipped instruction surface these guides live in
- [[concepts/mcp-workflow]] — MCP agents are a primary audience of the corrected conventions

## Related Sources

- [[sources/back-506-cli-utc-conversion-fix]] — the local-to-UTC conversion bug that made this documentation necessary
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — established the literal-`\n` escape convention for plan/notes/summary
- [[sources/back-547-avoid-bash-ansi-c-quoting]] — related guidance on shell quoting for multi-line input
