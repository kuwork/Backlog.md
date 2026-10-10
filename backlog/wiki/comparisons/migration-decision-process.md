---
title: 五次上游迁移的决策过程总结
labels: [comparison, migration, upstream, decision-process]
created_date: 2026-10-10 14:10
updated_date: 2026-10-10 14:10
---

# 五次上游迁移的决策过程总结

跨五波上游迁移（v1.47.1→v1.48.0 → v1.48.0→v1.49.3 → v1.49.3→v1.50.1 → v1.50.1→v1.52.0 → v1.52.0→v1.53.0）的决策过程综合：不逐波罗列，按**决策类型**提炼反复出现的判断模式、其演进轨迹与代价。执行结构本身见 [[patterns/upstream-migration-wave]]，逐波文档见 [[concepts/upstream-migration]]。

## 决策类型一：分类判断（A/B/C 归类的口径演进）

| 波次 | 分类口径 | 关键判断 |
|---|---|---|
| 一（doc-4） | 39 项变更单源枚举 | A1 类型字段经用户决策放弃 |
| 二（doc-7） | 13A / 5B / 10C | B1 路由、B9 dateFormat、B2 自定义优先级**决策跳过**并留理由 |
| 三（doc-9） | 87 commits / 44 组 → 17A / 9B / 7C | 深分析重分类机制首次出现 |
| 四（doc-12） | 131 commits / 80 条目 → 7A / 43B / 30C | **双源并集口径**：候选 = 区间 commit 号 ∪ 区间新增任务文件——BACK-589/590/592 等在 v1.50.1 前立项但本区间才合入，单看文件枚举会整批漏掉；深分析 7/54/19 → 7/43/30，含域修正（WEB-8 实为 TUI 改动） |
| 五（doc-21） | 沿用双源口径 | 口径已稳定，无新判断 |

**演进教训**：撞号必须按**链接目标而非号码**判断——上游与 fork 的 BACK-669/672/675~680 含义不同，看号码会误配整条迁移链（doc-12 教训，波四起为纪律）。

## 决策类型二：刻意分叉（deliberate divergence 台账）

与上游语义刻意分叉的完整清单，按留痕强度可看到演进轨迹：

| 分叉点 | 波次 | 理由 | 留痕位置 |
|---|---|---|---|
| `emptyClears` 拒绝（空 setter 拒绝并指向 --clear-*） | 三 | fork setter 语义与上游显式空值=清除冲突 | doc-10 CLI-4 散文 → [[decisions/empty-setter-rejection-over-emptyclears]] |
| sequences 功能保留（上游已移除） | 二起 | fork 用户依赖，且 fork 持续补 CLI 文档 | [[decisions/keep-sequences-upstream-removed]] |
| BACK-646 `demotionState`/409 分类 | 四 | fork 形态不可达，只移植 web 韧性部分 | doc-13 divergence 台账 |
| BACK-647 doctor 分支位置 | 四 | 与上游有意不同（fork 的 doctor 结构差异） | doc-13 divergence 台账 |
| 自研状态机校验器而非引擎 | 五 | 现成引擎只覆盖需求 30%，出边权限列出与教学式报错无引擎提供 | [[decisions/hand-rolled-state-machine-validator-over-engine]] |
| CLI 分页窗口模型（移除 cursor） | 五 | grep/git 风格对人/代理更透明 | [[decisions/cli-list-window-over-cursor]] |

常驻 fork 约束（跨波不动点）：保留 sequences、UTC 存储本地显示、Task 无 `type` 字段、`get-port@7.2.0`、无 publication-owner 机制——见 [[concepts/upstream-migration]] 关键 fork 约束节。

**演进教训**：分叉留痕强度逐波升级——波三埋在领域分析散文里（检索困难）、波四建立台账（doc-13 逐条）、波五直接成 decision 页。**越早台账化，下次迁移的检索成本越低**；不记录的分叉会在两波之后变成"为什么和上游不一样"的悬案。

## 决策类型三：验证策略

- **AC #1 审查纪律**（波三起）：每个迁移任务 AC 第一条固定为 "Review upstream changes using `git log --grep` / `git show`"——先查证上游原始改动再动手，是"JIT 建任务 + 一次通过"的前提
- **三段式收尾**（波三起）：`tsc --noEmit` / `biome check` / scoped tests，每任务 Implementation Notes 末尾记录验证计数
- **byte-identical + revert-check**（波四）：直接复用类追求逐字节一致移植，用逐个半段回退确认测试转红再恢复来验证"真的移植对了"
- **实测补齐 / 复现先行**（波四，doc-13）：不确定的条目先在 fork worktree 复现上游缺陷，确认 fork 也存在该问题再建议迁移——避免移植一个 fork 不受影响的功能
- **存量失败分诊**（波三产物，跨波复用）：本仓 full `bun test` 长期有 ~39 个 pre-existing 失败，scoped + 基线对照 + 先红后绿的方法沉淀为 [[execution/pre-existing-failure-triage]]

## 决策类型四：范围与节奏

- **JIT 建任务**：先审查上游 commit 再建任务，波三 31/54、波四 34/69、波五 21/30 当日建当日完；五波迁移任务零返工、全部一次 Done
- **大项前置拆解**：B16（增量跨分支加载）评估出缺 publication 地基，拆为"补地基（BACK-601）+ 整体移植（BACK-602）"两阶段（[[decisions/b16-publication-foundation-first]]），避免中途卡死——波三 9 天空档期即此次攻坚
- **波末清算是防漂移唯一手段**：doc-16（42 个 To-Do 对照：13 归档实现 / 2 决策跳过 / 4 部分实现 / 25 未实现，全部 src/ grep 实证）→ doc-11（跨波交叉核对）——不清算，已迁移功能会在 To-Do 里重复立项
- **draft 导入管道**：上游 issue/原始任务先进 `drafts/` 保留来源（draft-92/96/125），波四起固化为"原始任务文件导入规范 → 提升为 fork 任务"的批量管道

## 数据一览

| 波次 | 上游区间 | 分类产物 | 落地任务 | 周期中位 | 当日完成 |
|---|---|---|---|---|---|
| 三 | v1.49.3→v1.50.1 | doc-9 / doc-10 / doc-16 | BACK-570~623（54） | 0 天 | 31/54 |
| 四 | v1.50.1→v1.52.0 | doc-12 / doc-13 / doc-11 | BACK-630~699（69） | 1 天（p90 40） | 34/69 |
| 五 | v1.52.0→v1.53.0 | doc-21 / doc-22 | BACK-715~744（30） | 0 天（p90 2） | 21/30 |

波四 p90 40 天的长尾来自 Kuzu 图谱系列（BACK-702~714）这类 B 类大项攻坚；波五回到 0 天中位，说明双源口径 + 台账 + 分诊的组合已使迁移节奏稳定。

## 元经验（关于决策过程本身）

1. **分类文档是所有后续决策的锚点**——没有 doc-N 编号，分叉与跳过的理由就失去可追溯上下文
2. **判断标准要从"看号码"进化到"看链接目标"**——ID 撞号时号码是陷阱
3. **不确定就实测**——复现先行比读 diff 更能暴露 fork 差异
4. **分叉决策的留痕强度决定下一次迁移的检索成本**——散文 < 台账 < decision 页
5. **大项先评估架构地基再动手**——轻量移植缺地基是波三最贵的一个陷阱
6. **波末必须清算**——防 To-Do 漂移没有更便宜的办法

## Related Concepts

- [[concepts/upstream-migration]] — 逐波文档台账与 A/B/C 分类法
- [[patterns/upstream-migration-wave]] — 六阶段执行结构与陷阱表
- [[execution/pre-existing-failure-triage]] — 存量测试失败分诊方法

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — 双源并集口径与撞号纪律的出处
- [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] — divergence 台账与七维分析格式
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — 分叉留痕的起点（CLI-4）
- [[sources/doc-16-todo-tasks-vs-upstream-migration-report]] — 波末清算的样板
- [[sources/doc-21-upstream-v1-52-0-to-v1-53-0-migration-diff-classification]] — 第五波分类

## Related Decisions

- [[decisions/empty-setter-rejection-over-emptyclears]] — 最早的分叉决策
- [[decisions/b16-publication-foundation-first]] — 大项前置拆解
- [[decisions/keep-sequences-upstream-removed]] — 跨波常驻分叉
