---
title: m-9 - Kuzu 任务图谱一期里程碑
labels: [source, milestone, graph, kuzu]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/milestones/m-9 - kuzu-task-graph-phase-1.md
---

# m-9 - Kuzu 任务图谱一期里程碑

本里程碑界定 Kuzu 任务图谱设计的一期范围（doc-14 §6），2026-09-24 一天内执行完成（actual_start 07:01 → actual_end 21:44）。其 `documentation` 字段以旧文件名 `doc-014` 引用设计文档。

- 范围：覆盖 `backlog/tasks`、`drafts`、`milestones` 和 `completed`（不含 archive），与 doc-14 一期完全一致
- 交付物：逐文件指纹冷启动校验 + 增量重建；通过核心 notify 钩子加热更新，`Bun.watch` 回退
- 部署决定：Graph Service 是 `backlog.kuzu` 的唯一持有者，与 Web UI 同进程部署
- 设计文档：`backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md`（现改名 `doc-14 - …`；数据异常见摄取报告中的说明）

## 验收标准

不适用（里程碑记录）；上述一期范围要点即作为完成定义。

## Related Concepts

- [[concepts/milestones]] — documentation 字段指向 governing 设计文档的里程碑记录
- [[concepts/web-server]] — Graph Service 与 Web UI 同进程共驻

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — 本里程碑实施的设计文档（一期）
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — 三期后续设计
