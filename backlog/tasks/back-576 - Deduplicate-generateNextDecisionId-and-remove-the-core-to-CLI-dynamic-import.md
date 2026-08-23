---
id: BACK-576
title: Deduplicate generateNextDecisionId and remove the core-to-CLI dynamic import
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-08 22:14'
updated_date: '2026-08-23 06:03'
labels: []
dependencies: []
actual_start: '2026-08-23 05:59'
actual_end: '2026-08-23 06:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to upstream BACK-612 / draft-115. In the current fork, src/utils/id-generators.ts already holds generateNextDecisionId but has zero importers, while src/cli.ts still carries a byte-identical local copy used by decision create. src/core/backlog.ts:createDecisionWithTitle dynamically imports ../cli.js to obtain the helper. Remove the CLI local copy and repoint both callers to the shared utils helper, eliminating the core-to-CLI dynamic import cycle workaround. Verify that CLI decision create and web POST /api/decisions still allocate sequential decision IDs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One generateNextDecisionId remains, in src/utils/id-generators.ts, with both former callers repointed to it
- [x] #2 The dynamic await import("../cli.js") in src/core/backlog.ts is gone
- [x] #3 decision create via CLI and POST /api/decisions via the built web server both still allocate sequential decision IDs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the two generateNextDecisionId bodies match and enumerate callers (CLI decision create and core/backlog.ts createDecisionWithTitle). 2. Update src/core/backlog.ts static import from ../utils/id-generators.ts to include generateNextDecisionId alongside generateNextDocId, replace the dynamic import with a direct call, and remove the stale comment. 3. Update src/cli.ts to import generateNextDecisionId from ./utils/id-generators.ts and delete the local copy. 4. Grep src/ for any remaining ../cli.js dynamic imports. 5. Run bunx tsc --noEmit, bun run check ., bun run build, and scoped decision/doc tests; verify the web route if feasible.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on current fork: src/core/backlog.ts now statically imports generateNextDecisionId from ../utils/id-generators.ts alongside generateNextDocId; createDecisionWithTitle calls it directly and the dynamic await import('../cli.js') plus its comment are removed. src/cli.ts imports generateNextDecisionId from ./utils/id-generators.ts and the 67-line local copy is deleted. Grep confirms only one generateNextDecisionId definition remains and no ../cli.js dynamic imports exist in src/. Verified sequentially: CLI 'decision create' produced decision-1 and decision-2; built binary 'browser' served POST /api/decisions which produced decision-3 and decision-4. tsc --noEmit and bun run check . passed with only pre-existing assets.ts warnings; scoped cli-doc-decision-board.test.ts passed; bun run build succeeded.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapsed the duplicated generateNextDecisionId onto the shared helper in src/utils/id-generators.ts and removed the core-to-CLI dynamic import workaround. Both former callers now use one allocator; CLI and web decision creation continue to produce sequential IDs.
<!-- SECTION:FINAL_SUMMARY:END -->
