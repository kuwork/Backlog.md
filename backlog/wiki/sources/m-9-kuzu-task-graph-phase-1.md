---
title: m-9 Kuzu Task Graph Phase 1
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - milestone
  - graph
  - kuzu
source_path: backlog/milestones/m-9 - kuzu-task-graph-phase-1.md
---

# m-9 Kuzu Task Graph Phase 1

Milestone scoping phase 1 of the Kuzu task-graph design (doc-14 §6), executed 2026-09-24 in a single day (actual_start 07:01 → actual_end 21:44). Its `documentation` field references the design doc by its former `doc-014` filename.

## Summary

- Scope: cover `backlog/tasks`, `drafts`, `milestones`, and `completed` (archive excluded), exactly matching doc-14 phase 1
- Deliverables: per-file fingerprint cold-start validation with incremental rebuild; hot update via the core notify hook plus `Bun.watch` fallback
- Deployment decision: Graph Service is the sole holder of `backlog.kuzu`, deployed in-process with the Web UI
- Design doc of record: `backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md` (now renamed `doc-14 - …`; see data anomaly note in the ingestion report)

## Acceptance Criteria

- Not applicable (milestone record); the phase-1 scope bullets above serve as completion definition.

## Related Concepts

- [[concepts/milestones]] — milestone record whose documentation field points at the governing design doc
- [[concepts/web-server]] — Graph Service co-hosted in-process with the Web UI

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — the design doc this milestone implements (phase 1)
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — phase-3 follow-on design
