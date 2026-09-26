---
title: doc-13 v1.50.1 至 v1.52.0 上游任务迁移分析报告（按领域）
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - upstream-migration
source_path: backlog/docs/migration/doc-13 - v1.50.1-至-v1.52.0-上游任务迁移分析报告（按领域）.md
---

# doc-13 v1.50.1 至 v1.52.0 上游任务迁移分析报告（按领域）

Per-item deep-analysis report covering every doc-12 entry (including C-class skips) for the `v1.50.1..v1.52.0` range. Each item is analyzed on seven fixed dimensions — purpose, change summary, conflict risk with fork customizations (with fork-side `file:line`), what to port, what to exclude, priority, and recommendation — with all conclusions grounded in upstream merge-commit vs fork-worktree file comparison.

## Summary

- Fixed seven-dimension table per item; recommendation vocabulary: ①直接复用 (direct reuse) / ②参考重写 (reference rewrite) / ③忽略 (skip); anything overlapping the fork's exclusion list (`references/current-branch-migration-exclusions.md`) is auto-skip
- Covers ~70 sections across five domains: CLI/Core (CORE-1…41), TUI (TUI-1…14), Web (WEB-1…19), Server/MCP (SRV-1…4), Infra/CI (INF-1…3)
- Representative conflict verdicts: CORE-1 (upstream dueDate as UTC date-time) demoted to C because the fork already has date-only dueDate end-to-end and upstream semantics would regress it; CORE-20 (search single-sourcing) kept the fork's `fileName` search key and wiki corpus, which upstream lacks
- Many sections carry "实测补齐" (verification supplements) dated 2026-09-19…24 that reproduce upstream defects on the fork worktree before recommending migration — e.g. TUI-4's composer click self-blur bug reproduced live at 100x30
- Numbering-collision warnings embedded per entry: upstream BACK-668/669/670/672/675–680 mean different things than the fork's same-numbered migration tasks
- Serves as the analytical basis for every migration task BACK-642…BACK-699; doc-12's "分析报告" column links into this document's sections

## Acceptance Criteria

- Not applicable (analysis report); the per-item seven-dimension tables are the deliverable.

## Related Concepts

- [[concepts/upstream-migration]] — the deep-analysis methodology (file:line verification, exclusion-list checks) this report operationalizes
- [[concepts/core-architecture]] — frequent verdict basis: keep fork-native modules (`readiness.ts`, `task-search.ts`) and share only loaders/models

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — the classification table this report analyzes item by item
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — previous round's per-domain analysis report
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — immediate predecessor analysis report for v1.49.3→v1.50.1
