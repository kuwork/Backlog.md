---
id: m-9
title: 'Kuzu Task Graph Phase 1: Cold-Start Validation & Hot Update'
created_date: '2026-09-24 06:37'
updated_date: '2026-09-24 07:01'
actual_start: '2026-09-24 07:01'
documentation:
  - backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md
---
## Description

Phase 1 scope (doc-014 §6): cover backlog/tasks, drafts, milestones, completed (archive excluded); per-file fingerprint cold-start validation with incremental rebuild; hot update via core notify hook + Bun.watch fallback; Graph Service as the sole holder of backlog.kuzu, deployed in-process with the Web UI. Design doc: backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md
