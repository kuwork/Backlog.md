---
title: doc-11 To-Do 任务与上游迁移(v1.47.1-v1.50.1)对照分析报告
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - upstream-migration
  - housekeeping
source_path: backlog/docs/migration/doc-11 - To-Do-任务与上游迁移v1.47.1-v1.50.1对照分析报告.md
---

# doc-11 To-Do 任务与上游迁移(v1.47.1-v1.50.1)对照分析报告

Cross-check report reconciling all 42 then-To Do tasks against the three completed upstream migrations (doc-4/doc-7/doc-9, v1.47.1→v1.50.1). Unlike a classification table, every "already implemented" verdict here is backed by grep-verified `file:line` evidence in `src/`, not by documentation claims.

## Summary

- Verdict split for the 42 To Do tasks: 13 archived as implemented during migration (11 confirmed + 2 deliberately skipped, including BACK-355's six subtasks — 19 files total), 4 partially implemented pending manual AC comparison, 25 genuinely unimplemented and still scheduled
- Implemented-and-archived examples with evidence: BACK-430 TUI board task creation (`task-composer.ts`, via BACK-563), BACK-427 `--unassigned` filtering (BACK-551), BACK-429 preserved web drafts (BACK-535), BACK-240 Apple Silicon binary resolution (`scripts/resolveBinary.cjs`, BACK-550), BACK-424 multi-status web filters (BACK-548)
- Decision-skipped: BACK-421 (dateFormat config kept inert, doc-4 C16) and BACK-355 task `type` field with all six subtasks (dropped to avoid marginalizing labels, doc-4 C18)
- Partially implemented, needing human AC review: BACK-218 sequences docs/tests, BACK-270 command-subjection hardening (AC#3 unverified), BACK-222 web subtask visualization (no collapse/progress badge), BACK-239 task↔doc auto-links (missing "Referenced by" reverse links)
- The 25 unimplemented tasks are mostly fork-native requests unrelated to upstream (sequences web UI, agent skill publishing, XDG_CONFIG_HOME, Docker runtime, web theme customization, etc.)
- Method: read all three diff-classification docs, map each To Do task to migrated feature points, then grep `src/` for real implementations; archiving done via `backlog task archive`, never direct file edits

## Acceptance Criteria

- Not applicable (analysis report); the deliverable is the four-way verdict table plus source-code evidence for every "implemented" claim.

## Related Concepts

- [[concepts/upstream-migration]] — this report audits the outcome of the doc-4/doc-7/doc-9 migration rounds against the pre-existing backlog

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — v1.47.1→v1.48.0 classification, source of many migration provenance entries
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — second migration round referenced
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — third migration round referenced
- [[sources/doc-16-todo-tasks-vs-upstream-migration-report]] — sibling To Do reconciliation report
