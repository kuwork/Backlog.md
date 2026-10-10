---
title: doc-13 - 上游 v1.50.1→v1.52.0 迁移分析（按领域）
labels: [source, upstream-migration]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-13 - v1.50.1-至-v1.52.0-上游任务迁移分析报告（按领域）.md
---

# doc-13 - 上游 v1.50.1→v1.52.0 迁移分析（按领域）

逐项深度分析报告，覆盖 `v1.50.1..v1.52.0` 区间内 doc-12 的全部条目（含 C 级跳过项）。每个条目按七个固定维度分析——目的、变更摘要、与 fork 定制的冲突风险（附 fork 侧 `file:line`）、需要移植的内容、需要排除的内容、优先级与建议——全部结论基于上游 merge commit 与 fork 工作区的逐文件比对。

报告要点：

- 每个条目使用固定的七维表；建议词汇：①直接复用 / ②参考重写 / ③忽略；与 fork 排除清单（`references/current-branch-migration-exclusions.md`）有交集的一律自动忽略。
- 覆盖五个领域约 70 个小节：CLI/Core（CORE-1…41）、TUI（TUI-1…14）、Web（WEB-1…19）、Server/MCP（SRV-1…4）、Infra/CI（INF-1…3）。
- 代表性冲突判定：CORE-1（上游 dueDate 为 UTC date-time）降为 C，因为 fork 已有端到端的 date-only dueDate，采用上游语义会造成回退；CORE-20（搜索单一来源）保留 fork 的 `fileName` 搜索键与 wiki 语料——上游没有这些。
- 许多小节带 2026-09-19…24 的「实测补齐」：在给出迁移建议前先在 fork 工作区复现上游缺陷——例如 TUI-4 的 composer 点击自失焦 bug 在 100x30 下现场复现。
- 逐条内嵌编号碰撞警告：上游 BACK-668/669/670/672/675–680 与 fork 同号迁移任务含义不同。
- 是每个迁移任务 BACK-642…BACK-699 的分析依据；doc-12 的「分析报告」列链接到本文件的小节。

## 验证

不适用（分析报告）；逐条七维表即交付物。

## Related Concepts

- [[concepts/upstream-migration]] — 本报告所运用的深度分析方法（file:line 验证、排除清单核对）
- [[concepts/core-architecture]] — 常见判定依据：保留 fork 原生模块（`readiness.ts`、`task-search.ts`），仅共享加载器/模型

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — 本报告逐项分析的分类表
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — 上一轮的按领域分析报告
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — v1.49.3→v1.50.1 的紧邻前一份分析报告
