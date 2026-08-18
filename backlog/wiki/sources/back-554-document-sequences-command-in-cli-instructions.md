---
title: BACK-554 Document sequences command in CLI instructions
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - documentation
  - cli
  - sequences
source_path: backlog/tasks/back-554 - Document-sequences-command-in-CLI-instructions.md
---

# BACK-554 Document sequences command in CLI instructions

Added a Sequences Quick Reference section to `src/guidelines/cli-instructions/overview.md` so agents reading `backlog instructions` can discover `backlog sequence list`.

## Summary

- `overview.md` now includes a `### Sequences Quick Reference` section with a `backlog sequence list --plain` example.
- Explains that sequences are derived from dependencies and that tasks in the same sequence can run in parallel.
- Keeps the fork's sequences feature alive even though upstream removed it in v1.48.0 / BACK-520.

## Acceptance Criteria

- `overview.md` gains a Sequences Quick Reference section.
- Section explains derived layered sequences and parallel execution within the same sequence.
- `bunx biome check` passes on the changed file.
- `backlog sequence list --plain` still works.

## Related Concepts

- [[concepts/cli-instructions]] — CLI instruction surface
- [[concepts/search-sequences]] — Search and dependency sequences

## Related Sources

- [[sources/back-521.14]] — CLI/MCP instruction guide updates
