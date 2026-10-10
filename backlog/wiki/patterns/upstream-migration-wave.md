---
title: 上游迁移波次执行模式
labels: [pattern, migration, upstream]
created_date: 2026-09-08 17:45
updated_date: 2026-10-09 23:30
---

# 上游迁移波次执行模式

从上游 backlog.md 仓库迁移一批变更到 fork 时的标准执行结构。本模式在 v1.47.1→v1.53.0 五波共 150+ 个迁移任务中反复验证（BACK-570~623、630~699、715~744 共 153 个任务全部一次 Done），跨波决策经验的综合见 [[comparisons/migration-decision-process]]。

## 适用场景

- 上游发布新版本，需要将差异分类并映射到 fork 任务
- 上游 issue / PR / 任务草稿需要导入为 fork 任务
- 单次移植范围从单点修复（A 类）到大型架构项（B 类，如 BACK-624 增量加载）

## 标准步骤

| 阶段 | 目的 | 关键产出 | v1.50.1 示例 |
|---|---|---|---|
| **1. 差异分类** | 上游版本间 diff 按 A/B/C 分类（A=直接相关 / B=需适配 / C=可忽略）；候选范围用**双源并集**（区间 commit 号 ∪ 区间新增任务文件，防漏"早立项晚合入"项） | 分类表文档（commits 分组、最终计数） | doc-9（87 commits / 44 组 → 17A/9B/7C）、doc-12（131 commits / 80 条目 → 7A/43B/30C） |
| **2. 领域分析** | 逐条给出核心目的、变更文件、与 fork 定制冲突风险、可复用/需排除部分、迁移建议 | 按领域（CLI/TUI/Web/Server/CI）分析报告 | doc-10（CLI-1~13 / TUI-1~8 / WEB-1~4 / SVR-1~2 / CI-1） |
| **3. draft 导入** | 上游 issue / 原始任务草稿先进入 `drafts/`，保留来源与原始 AC | draft 页面（含上游 issue/任务 ID） | draft-92（#839）、draft-96（#853）、draft-125（BACK-624） |
| **4. 任务落地** | 每个条目创建 BACK 任务，AC #1 固定为审查上游变更 | 任务描述含 `git log --grep BACK-<id>` / `git show <sha>` 审查步骤 | BACK-570~623（54 任务全部 Done） |
| **5. 适配与验证** | 按 fork 定制点适配（分叉决策必须台账化记录）；固定三段式收尾；直接复用类追求 byte-identical 移植 + revert-check（逐个半段回退确认测试转红再恢复）；不确定条目先复现上游缺陷再定迁移 | scoped tests + `tsc --noEmit` + `biome check` 通过 | 每任务 Implementation Notes 末尾记录验证计数；实测补齐见 doc-13 |
| **6. 清算闭环** | 对照 backlog To-Do 与三波迁移，清算未实现项 | 清算报告（归档实现 / 决策跳过 / 部分实现 / 未实现） | doc-16（42 个 To-Do 对照，全部 src/ grep 实证） |

## 常见陷阱

| 陷阱 | 示例 | 预防 |
|---|---|---|
| **轻量移植缺地基** | fork 的 BACK-568 轻量移植 publication-owner 缺 epoch/generations 地基，无法直接接 BACK-624 | B 类大项先评估上游架构演进链（559→624），必要时拆"补地基 + 整体移植"两阶段（见 [[decisions/b16-publication-foundation-first]]） |
| **盲目跟随上游语义** | 上游 emptyClears（显式空值=清除）与 fork setter 语义冲突 | 分叉决策必须显式记录理由（doc-10 CLI-4、[[decisions/empty-setter-rejection-over-emptyclears]]） |
| **移植不可用的上游测试** | BACK-602 上游 3 个测试依赖 fork 没有的路由 | 丢弃并记录理由，不为凑覆盖率造伪测试 |
| **全量测试噪音淹没验证** | 本仓库 full `bun test` 长期有 ~39 个 pre-existing 失败 | 用 scoped tests + 基线对照，分诊方法见 [[execution/pre-existing-failure-triage]] |
| **迁移后 To-Do 漂移** | 上游已实现的功能在 fork To-Do 里重复出现 | 波次末端必须做 doc-16 式清算，防止重复劳动 |
| **ID 撞号按号码判断** | 上游与 fork 的 BACK-669/672/675~680 号码相同但任务完全不同，按号码匹配会误配整条迁移链 | 撞号一律按**链接目标**判断（doc-12 起为纪律） |
| **未复现就建议迁移** | fork 形态不同，上游缺陷在 fork 可能根本不存在，白移植 | 不确定条目先在 fork worktree 实测复现，确认受影响再迁移（doc-13 实测补齐） |

## Related Concepts

- [[concepts/upstream-migration]] — 三波迁移的总体策略与 A/B/C 分类法
- [[comparisons/migration-decision-process]] — 五波决策过程的综合总结（分类口径、divergence 台账、验证策略的演进）

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 阶段 1 产物
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — 阶段 2 产物
- [[sources/doc-16-todo-tasks-vs-upstream-migration-report]] — 阶段 6 产物
- [[sources/back-602-incremental-cross-branch-task-loading]] — B 类大项两阶段打法的落地任务
