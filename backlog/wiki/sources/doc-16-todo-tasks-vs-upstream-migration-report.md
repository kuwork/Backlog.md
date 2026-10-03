---
title: To-Do Tasks vs Upstream Migration (v1.47.1–v1.50.1) Cross-Check Report
created_date: '2026-09-08 17:00'
updated_date: '2026-10-03 01:25'
labels:
  - source
  - migration
  - backlog-hygiene
source_path: backlog/docs/migration/doc-16 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md
---

# To-Do Tasks vs Upstream Migration (v1.47.1–v1.50.1) Cross-Check Report

> **源文件已不存在（2026-10-03 lint）**：`source_path` 指向的 `backlog/docs/migration/doc-16 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md` 已于 2026-09-15 被 commit `720d58ad`（"1.50.1到1.52.0升级分析"）删除，git 中无改名记录，`backlog/` 下按 doc-16 精确匹配无同名文件。本页保留作为该报告的 wiki 摘要，不再做 source_path 改写。

Reconciliation report that cross-checked all open To-Do tasks against the three completed upstream migration waves (doc-4/doc-7/doc-9, covering v1.47.1..v1.50.1). Of 42 open tasks at analysis time, 13 were archived as already implemented by migration work, 2 archived as decided skips, 4 flagged as partially implemented pending manual AC comparison, and 25 confirmed still unimplemented. Every "already implemented" claim was verified with grep evidence in `src/`, not just documentation.

## Summary

- Archived as implemented via migration: BACK-430 (TUI task create, →BACK-563), BACK-427 (unassigned filter, →BACK-551), BACK-429 (unsaved web drafts, →BACK-535), BACK-426 (in-document hash links, →BACK-536), BACK-240 (Apple Silicon binary, →BACK-550), BACK-424 (web status filters, →BACK-548), plus BACK-257/310/259/260/415 already covered by fork-native code.
- Archived as decided skips: BACK-421 (dateFormat config stays "stored but not applied", doc-4 C16) and BACK-355 task type field with its 6 subtasks (dropped to avoid marginalizing labels, doc-4 C18).
- Partially implemented, awaiting AC-by-AC review: BACK-218 (sequences docs/tests), BACK-270 (command-substitution input guard), BACK-222 (web subtask visualization), BACK-239 (task↔doc/decision backlinks — forward links exist in `src/web/utils/task-id-links.ts:200`, reverse "Referenced by" missing).
- 25 tasks confirmed unimplemented via source verification and kept To Do (sequences Web UI, agent skill publishing, XDG_CONFIG_HOME, npx docs, core drift detection, etc.).
- Method: read the 3 classification docs, map features to tasks, grep `src/` for each suspected implementation, then archive via `backlog task archive` — no direct file edits.

## Related Concepts

- [[concepts/upstream-migration]] — this report closes the loop of the three migration waves by reconciling them against the pre-existing task backlog
- [[concepts/task-lifecycle]] — demonstrates archive-by-CLI as the correct way to close tasks superseded by migration work
- [[concepts/search-sequences]] — BACK-217/218 sequences items are among the largest unimplemented cluster

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — third wave classification reconciled here
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — second wave classification reconciled here
- [[sources/doc-4-upstream-migration-classification]] — first wave classification reconciled here
