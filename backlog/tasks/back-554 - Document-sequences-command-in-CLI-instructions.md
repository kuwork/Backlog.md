---
id: BACK-554
title: Document sequences command in CLI instructions
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-11 06:52'
updated_date: '2026-08-11 07:01'
labels:
  - documentation
  - cli
dependencies: []
priority: low
ordinal: 189400
actual_start: '2026-08-11 06:52'
actual_end: '2026-08-11 06:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI instructions surface (src/guidelines/cli-instructions/) covers task list/search but not the sequences feature. Agents reading 'backlog instructions' cannot discover 'backlog sequence list', even though the code and wiki concept page exist. Add a Sequences Quick Reference section to src/guidelines/cli-instructions/overview.md so the sequences capability is visible to AI agents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 overview.md gains a ### Sequences Quick Reference section with backlog sequence list --plain example
- [x] #2 Section explains derived layered sequences from dependencies and that same-sequence tasks run in parallel
- [x] #3 bunx biome check passes on changed file
- [x] #4 backlog sequence list --plain still works
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a '### Sequences Quick Reference' section to src/guidelines/cli-instructions/overview.md so the sequences capability (backlog sequence list) is discoverable to AI agents via 'backlog instructions'. The fork keeps the sequences feature (upstream removed it in v1.48.0 / BACK-520) but the CLI-instructions surface had been left at the post-removal state. Verified backlog sequence list --plain works.
<!-- SECTION:FINAL_SUMMARY:END -->
