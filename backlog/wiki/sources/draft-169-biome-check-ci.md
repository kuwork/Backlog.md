---
title: draft-169 Add biome check to CI and fix task-composer formatting drift
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - ci
  - tooling
source_path: backlog/drafts/draft-169 - Add-biome-check-to-CI-and-fix-task-composer-formatting-drift.md
---

# draft-169 Add biome check to CI and fix task-composer formatting drift

Infra entry (doc-12 INF-2) with **no upstream task file** — reconstructed from upstream commit `38eabc1f6` for migration evaluation. Two-file change: run biome check in CI and fix formatting drift in the TUI task composer.

## Summary

- Commit `38eabc1f6` "Run biome check in CI and fix task-composer format drift", 2 files changed (2 insertions, 6 deletions)
- `.github/workflows/ci.yml`: one-line change adding the biome check step to CI
- `src/ui/components/task-composer.ts`: 6-line reduction fixing formatting drift the new CI gate would flag
- doc-12 classifies it B with recommendation ①直接复用 (direct reuse), insertable at any point in the migration waves

## Acceptance Criteria

- Not applicable beyond the commit itself: biome check runs in CI and the composer file passes it.

## Related Concepts

- [[concepts/ci-platform-contracts]] — CI workflow surface this commit extends
- [[concepts/upstream-migration]] — INF-2, an example of the doc-12 "no task number" candidate class

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — INF-2 entry tracking this draft
- [[sources/back-587-repair-tui-task-composer-ux]] — the fork's composer work where formatting drift matters
