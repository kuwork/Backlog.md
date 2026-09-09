---
title: Deduplicate generateNextDecisionId and remove the core-to-CLI dynamic import
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - cli
  - core
  - refactoring
source_path: backlog/tasks/back-576 - Deduplicate-generateNextDecisionId-and-remove-the-core-to-CLI-dynamic-import.md
---

# Deduplicate generateNextDecisionId and remove the core-to-CLI dynamic import

Removed a byte-identical duplicated `generateNextDecisionId` and the awkward dynamic-import cycle workaround around it. `src/utils/id-generators.ts` already held the helper with zero importers, while `src/cli.ts` carried a 67-line local copy used by `decision create`, and `src/core/backlog.ts:createDecisionWithTitle` dynamically imported `../cli.js` to reach the CLI copy. Follow-up to upstream BACK-612 / draft-115.

## Summary

- `src/core/backlog.ts`: static import of `generateNextDecisionId` from `../utils/id-generators.ts` (alongside `generateNextDocId`); `createDecisionWithTitle` calls it directly; the `await import("../cli.js")` workaround and its comment are deleted.
- `src/cli.ts`: imports `generateNextDecisionId` from `./utils/id-generators.ts`; the 67-line local copy is deleted. Grep confirms exactly one definition remains and no `../cli.js` dynamic imports exist in `src/`.
- Verified sequentially: CLI `decision create` produced decision-1 and decision-2; the built binary's web server `POST /api/decisions` produced decision-3 and decision-4 — sequential ID allocation preserved across both surfaces.
- `bunx tsc --noEmit`, `bun run check .` (only pre-existing `src/core/assets.ts` warnings), scoped `cli-doc-decision-board.test.ts`, and `bun run build` all pass.

## Acceptance Criteria

- One `generateNextDecisionId` remains, in `src/utils/id-generators.ts`, with both former callers repointed to it.
- The dynamic `await import("../cli.js")` in `src/core/backlog.ts` is gone.
- CLI `decision create` and web `POST /api/decisions` both still allocate sequential decision IDs.

## Related Concepts

- [[concepts/core-architecture]] — dependency direction: core must never import from the CLI layer
- [[concepts/cli-entry]] — the CLI now consumes the shared util like every other caller

## Related Sources

- [[sources/back-574-decision-list-view-update-commands]] — the decision-surface expansion this cleanup supports
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — entry B6 (upstream BACK-612)
