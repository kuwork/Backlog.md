---
title: doc-9 - 上游 v1.49.3→v1.50.1 差异分类
labels: [source, upstream-migration]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-9 - Upstream-v1.49.3-to-v1.50.1-Migration-Diff-Classification.md
---

# doc-9 - 上游 v1.49.3→v1.50.1 差异分类

上游 `MrLesk/Backlog.md` `v1.49.3..v1.50.1` 区间（87 个 commit、44 个任务组）的分类表，按领域（CLI/Core、TUI、Web、Server、Infra/CI）组织，带 A/B/C 优先级与迁移建议。深度评审将许多 B 项升为 A（真实的数据正确性/交互缺陷或共用根因 bug），最终定为 17 A / 9 B / 7 C；本文与逐项分析报告 [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] 配套，是 v1.50.1 迁移轮的权威任务跟踪表。

分类要点：

- 范围：`v1.49.3`（不含）到 `v1.50.1`（含），覆盖 v1.50.0 功能版本与 v1.50.1 性能 hotfix；区间内每个任务都有 commit 登记。
- 分类方案：**A** 必须合入（安全、关键 bug、共用路径性能回退）、**B** 评估（功能、非核心优化，需冲突检查）、**C** 跳过（与 fork 方向冲突、上游独有、纯跟踪或已覆盖）。
- 2026-08-14 深度分析后的再分类：14 个 B 项升为 A（B1/B3/B7/B9/B10/B12/B13/B16/B17/B18/B19/B21/B22/B25/B26 及 B21 迟到项），B24 降为 C；最终 17 A / 9 B / 7 C。
- 关键架构决策（B16，「方案 1」）：BACK-559→BACK-624 的跨分支加载演进视为一套架构——BACK-601 先补齐 fork 轻量版 BACK-568 移植缺失的 publication-owner 基础，BACK-602 再移植完整 BACK-624（tip 快照、共享缓存、bounded fetch、ref lease、MCP 搜索本地路径），目标热读 ≤3 次 Git 操作。
- 六个迁移波次加一个可选阶段定义执行顺序：独立 A 项先行、CLI 小功能第二、共用校验器的 CLI 正确性第三、defaultAssignee 依赖项第四、TUI 系列第五、服务器身份第六，B16 作为独立大阶段。
- 每个迁移任务（BACK-571 至 BACK-615）在文档底部跟踪状态；最终更新时全部 Done。
- 本批任务映射：B10→BACK-596、B23→BACK-599、B16→BACK-600/601/602、CI-1→draft-102（作为 C 跳过）。

## 验证

不适用（分析文档）；分类表与迁移任务状态跟踪表即交付物。

## Related Concepts

- [[concepts/upstream-migration]] — 全部迁移轮次共用的 A/B/C 分类方案与波次排序
- [[concepts/core-architecture]] — B16 架构决策框架（先 publication-owner 基础，后增量加载）

## Related Sources

- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — 每个 A/B 条目的逐项深度分析配套文档
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — 上一轮迁移分析（v1.48.0→v1.49.3）
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — 上一轮分类表
- [[sources/back-602-incremental-cross-branch-task-loading]] — 最大的 B16 交付物，其两阶段计划由本文定义
