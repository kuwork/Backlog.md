---
id: BACK-572
title: Clarify CLI and MCP agent guides for date fields and multi-line input
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-22 07:55'
updated_date: '2026-08-22 08:09'
labels:
  - agent-guidelines
dependencies: []
modified_files:
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/drafts.md
  - src/cli.ts
ordinal: 193400
actual_start: '2026-08-22 07:50'
actual_end: '2026-08-22 08:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent guides did not clearly explain two CLI/MCP input conventions that agents frequently get wrong:

1. Date and datetime fields accept local time through the CLI/MCP. The value is converted to UTC before it is stored in the task frontmatter and converted back to local time when displayed. Agents were sometimes using the UTC value visible in the file as input, producing the wrong local time.
2. Multi-line text fields interpret the two characters backslash-n as a newline. Agents were sometimes pressing Enter for real newlines inside quoted arguments, which Bash splits across lines and leaves only the first line saved. To store a literal backslash-n, the backslashes must be doubled according to shell rules.

Updated the CLI and MCP agent execution guides, the task creation/drafts guides, the main agent guidelines, and the CLI help text to make these conventions explicit.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes:
- Added a local-time input callout to src/guidelines/cli-instructions/task-execution.md under 'Updating Task Dates' (line ~127).
- Added a new 'Date and Time Fields' section to src/guidelines/mcp/task-execution.md (line ~78).
- Clarified that CLI/MCP accept local time, convert to UTC for storage, and convert back for display; agents should not use the UTC value visible in the file as input.
- Removed the Markdown-file fallback note from the MCP guide, since MCP cannot directly edit task files.

Also updated multi-line input guidance:
- Updated src/guidelines/agent-guidelines.md, src/guidelines/cli-instructions/task-execution.md, and src/guidelines/cli-instructions/task-creation.md to warn against using real newlines inside quoted arguments.
- Updated src/guidelines/cli-instructions/drafts.md to use the two characters backslash-n literally in quoted arguments.
- Updated src/cli.ts help text for description, plan, notes, final-summary, comment, append-plan, append-notes, append-final-summary, and document content options to state that multi-line values should use the two characters backslash-n literally inside single-quoted or double-quoted arguments.
- Updated src/guidelines/agent-guidelines.md to clarify that storing a literal backslash-n sequence in any multi-line field requires doubling backslashes according to shell rules, so the CLI receives two backslashes followed by n rather than a newline.
- Verified tsc --noEmit passes and biome formatting is clean.
<!-- SECTION:NOTES:END -->
