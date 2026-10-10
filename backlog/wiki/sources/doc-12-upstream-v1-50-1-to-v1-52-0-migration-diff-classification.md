---
title: doc-12 - 上游 v1.50.1→v1.52.0 差异分类
labels: [source, upstream-migration]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/migration/doc-12 - Upstream-v1.50.1-to-v1.52.0-Migration-Diff-Classification.md
---

# doc-12 - 上游 v1.50.1→v1.52.0 差异分类

上游 `v1.50.1..v1.52.0` 区间（131 个 commit、80 条候选条目）的分类表，按领域（CLI/Core、TUI、Web、Server、Infra/CI）组织，给出最终 A/B/C 优先级与逐条迁移任务跟踪。深度分析结果为 7 A / 43 B / 30 C；与逐项报告 [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] 配套，是 v1.52.0 迁移轮的权威跟踪表。

分类要点：

- 候选范围为**双源并集**（区间内 commit 编号 ∪ 区间内任务文件新增），因为 BACK-589/590/592/401 等任务在 v1.50.1 之前提出、但只在本区间合并——仅按文件枚举会漏掉整批。
- 深度分析相对初筛的再分类（7/54/19 → 7/43/30）：4 条晋升为 A（CORE-19 标点符号标题文件名、CORE-24 已完成任务的依赖解析、TUI-5 Unicode 安全插入、TUI-10 共享 ID 比较器），14 条降为 C；WEB-8 被纠正领域为 TUI-14（上游改动完全在 `src/ui/board.ts` + `task-watcher.ts`）并回到 B。
- 数据质量备注：BACK-641/BACK-670 互相抵消（dependencies 命令先加后删——净零）；任务记录状态滞后于实现（BACK-222 仍标 To Do，但 BACK-222.1 已交付）；若干上游/fork 的 BACK 编号含义不同（BACK-669、BACK-672、BACK-675–680），按链接目标而非编号判定。
- A/B 条目以上游草稿 DRAFT#121–#169 导入；草稿逐步晋升为 fork 任务 BACK-642 至 BACK-699——底部状态表显示最终更新时每个迁移任务均为 Done。
- 迁移排序：八个波次——A 级正确性修复先行、跨分支索引正确性（CORE-4/5）、依赖图链（CORE-2→CORE-28、CORE-23→CORE-30）、搜索收敛（CORE-20→21）、碰撞条目与排除清单（CORE-34/31，CORE-3+32 合并为 BACK-691）、大型独立条目（CORE-12 项目属性）、TUI 系列串行化以避免 `src/ui` 踩踏，最后 web/infra。
- 值得注意的合并：TUI-1+TUI-7+TUI-9 合并为 BACK-675，直接落地上游的最终 AC-bar 表单；CORE-3+CORE-32 合并为 BACK-691；CORE-29+CORE-33 合并为 BACK-656。
- CORE-2 排在依赖图波次首位；它尚未晋升为 fork 任务。
- INF-2（CI 中的 biome check）不带上游任务编号，是从 commit 重构而来。

## 验证

不适用（分类文档）；分类表、迁移波次序与迁移任务状态跟踪表即交付物。

## Related Concepts

- [[concepts/upstream-migration]] — 与前几轮相同的 A/B/C 方案与波次排序，并以双源候选枚举细化
- [[concepts/task-identity]] — 逐条反复出现的上游与 fork BACK 编号碰撞、草稿/任务歧义标识处理

## Related Sources

- [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] — 本表每条目的逐项深度分析配套页
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 上一轮分类表
