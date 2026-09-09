---
title: doc-9 Upstream v1.49.3 to v1.50.1 Migration Diff Classification
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - upstream-migration
source_path: backlog/docs/migration/doc-9 - Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md
---

# doc-9 Upstream v1.49.3 to v1.50.1 Migration Diff Classification

Classification table for the upstream `MrLesk/Backlog.md` `v1.49.3..v1.50.1` range (87 commits, 44 task groups), organized by domain (CLI/Core, TUI, Web, Server, Infra/CI) with priority A/B/C and migration recommendations. A deep review reclassified many B items to A (real data-correctness/interaction defects or shared-root bugs), landing at 17 A / 9 B / 7 C; this document pairs with the per-item analysis report [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] and is the authoritative task tracker for the v1.50.1 migration wave.

## Summary

- Scope: `v1.49.3` (exclusive) to `v1.50.1` (inclusive), covering the v1.50.0 feature release and the v1.50.1 performance hotfix; every in-range task registered by commit.
- Classification scheme: **A** must-merge (security, critical bugs, shared-path performance regressions), **B** evaluate (features, non-core optimizations needing conflict check), **C** skip (conflicts with fork direction, upstream-only, pure tracking, or already covered).
- Reclassification after 2026-08-14 deep analysis: 14 B items promoted to A (B1/B3/B7/B9/B10/B12/B13/B16/B17/B18/B19/B21/B22/B25/B26 and B21 late), B24 demoted to C; final 17 A / 9 B / 7 C.
- Key structural decision (B16, "方案 1"): the BACK-559→BACK-624 cross-branch loading evolution is treated as one architecture — BACK-601 first backfills the publication-owner foundation missing from the fork's lightweight BACK-568 port, then BACK-602 ports the complete BACK-624 (tip snapshots, shared caches, bounded fetch, ref lease, MCP search local path) targeting ≤3 Git ops on warm reads.
- Six migration waves plus an optional phase define the execution order: independent A items first, CLI small features second, shared-validator CLI correctness third, defaultAssignee-dependent items fourth, TUI series fifth, server identity sixth, and B16 as a standalone large stage.
- Every migration task (BACK-571 through BACK-615) is tracked with status at the bottom of the document; at final update all are Done.
- This batch's tasks map to: B10→BACK-596, B23→BACK-599, B16→BACK-600/601/602, CI-1→draft-102 (skipped as C).

## Acceptance Criteria

- Not applicable (analysis document); the classification table and migration-task status tracker are the deliverables.

## Related Concepts

- [[concepts/upstream-migration]] — The A/B/C classification scheme and wave-based migration ordering used across all migration rounds.
- [[concepts/core-architecture]] — B16 architecture decision framing (publication-owner foundation before incremental loading).

## Related Sources

- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — Per-item deep analysis companion document for every A/B entry.
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — The previous migration round's analysis report (v1.48.0→v1.49.3).
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — The previous round's classification table.
- [[sources/back-602-incremental-cross-branch-task-loading]] — The largest B16 deliverable whose two-stage plan this document defines.
