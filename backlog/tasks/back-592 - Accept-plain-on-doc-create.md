---
id: BACK-592
title: Accept --plain on doc create
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-24 06:31'
updated_date: '2026-08-24 06:33'
labels:
  - tui
dependencies: []
references:
  - src/cli.ts
  - src/test/cli-doc-decision-board.test.ts
priority: low
ordinal: 202400
actual_start: '2026-08-24 06:31'
actual_end: '2026-08-24 06:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The doc create subcommand never registered --plain, so commander rejected it with 'unknown option'. Agent guidance passes --plain on every command, which made doc create unusable from that path. Register the flag and document it in the help schema, following the existing decision create --plain precedent: create output is already plain text, so the flag is accepted rather than switching formats.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream fix with git show 2f747cd -- src/cli.ts (doc create --plain hunk) and the decision create --plain precedent
- [x] #2 doc create accepts --plain instead of rejecting it as an unknown option
- [x] #3 The help schema documents --plain as a Boolean 'Use plain text output' option
- [x] #4 Running 'doc create <title> --plain' exits 0 and prints the created id and path
- [x] #5 Tests cover doc create --plain
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add { name: 'plain', type: 'Boolean', description: 'Use plain text output' } to the doc create help schema.
2. Add .option('--plain', 'use plain text output') to the doc create subcommand, mirroring decision create.
3. Verify 'doc create <title> --plain' exits 0 and prints the created id and path.
4. Add a CLI test asserting doc create --plain succeeds and does not print 'unknown option'.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/cli.ts: added a plain Boolean option to the doc create help schema and registered the plain flag on the subcommand, mirroring the existing decision create plain flag precedent. Create output is already plain text, so the flag is accepted rather than switching formats.

### Verification

- src/test/cli-doc-decision-board.test.ts: added 'should accept plain when creating a document' asserting exit 0, no unknown option in stderr, and the created id/path printed.
- Smoke: a temp-project run of doc create with the plain flag exits 0 and prints the created id and path.
- bunx tsc --noEmit clean; bunx biome check clean; cli-doc-decision-board.test.ts 12 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
doc create now accepts the plain flag instead of rejecting it as an unknown option. Registered the flag and documented it in the help schema following the decision create precedent: create output is already plain text, so the flag is accepted rather than switching formats. Verified by a new CLI test and a real temp-project run that exits 0 and prints the created id and path.
<!-- SECTION:FINAL_SUMMARY:END -->
