---
title: 上游迁移策略
created_date: '2026-08-17 23:00'
updated_date: '2026-09-08 17:00'
labels: [concept, migration, upstream]
---

# 上游迁移策略

Fork 对上游 `MrLesk/Backlog.md` 版本差异进行 A/B/C 分类并按领域分析，决定直接复用、参考重写或忽略。

## A/B/C 分类

| 分类 | 含义 | 处理建议 |
|---|---|---|
| A | 必须合入 | 安全漏洞、关键 bug 修复、fork 已规划但未实现的核心功能 |
| B | 评估合入 | 新功能、非核心优化，需确认是否与 fork 定制冲突 |
| C | 跳过 | 与 fork 演进方向冲突、上游特有方向、或无关 |

## 分析维度

- 上游任务核心目的
- 实际改动文件与逻辑
- 与 fork 定制代码的交集风险
- 可复用部分 vs 需排除/调整部分
- 迁移建议：① 直接复用 / ② 参考重写 / ③ 忽略

## 关键 fork 约束

- 保留 `sequences` 功能（上游已移除）
- 日期存储 UTC、显示本地时区（上游部分版本改为 UTC 显示）
- Task 模型无 `type` 字段
- 使用 `get-port@7.2.0` 进行端口探测
- ContentStore 无 upstream publication-owner / batchTaskUpdates / refreshLocalTaskCorpus 机制

## 迁移文档

- doc-4：v1.47.1→v1.48.0 分类
- doc-7：v1.48.0→v1.49.3 分类
- doc-8：v1.48.0→v1.49.3 按领域详细分析
- doc-9：v1.49.3→v1.50.1 分类
- doc-10：v1.49.3→v1.50.1 按领域详细分析
- doc-16：To-Do 任务 vs 上游迁移清算报告

## 第三波完整闭环（v1.49.3 → v1.50.1，BACK-570~623）

第三波共 54 个任务（BACK-570~623），全部 Done，形成完整迁移闭环：

1. **doc-9 分类**（[[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]]）：17A / 9B / 7C 三档分类
2. **doc-10 按领域分析**（[[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]]）：逐领域给出复用/重写/忽略建议
3. **上游 draft 导入**：draft-92 / draft-96 / draft-125 承载可直接落地的功能设计
4. **BACK-570~623 落地**：54 个任务实现并收尾
5. **doc-16 To-Do 清算**（[[sources/doc-16-todo-tasks-vs-upstream-migration-report]]）：对全部待办逐项经 src/ grep 实证——13 项归档为实现、2 项决策跳过、4 项部分实现、25 项未实现

**本波标志性结构**：

- 每个迁移任务 AC #1 固定为 "Review upstream changes using `git log --grep` / `git show`"——先查证上游原始改动再动手
- 收尾固定三段式验证：`tsc` / `biome` / scoped tests

**与上游刻意分叉点**：BACK-577 保留 fork 的 `emptyClears` 语义（拒绝空值 setter 清空字段），明确不合入上游变更，记录在 doc-10 CLI-4。

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — v1.47.1→v1.48.0
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — v1.48.0→v1.49.3 分类
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — v1.48.0→v1.49.3 领域分析
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — v1.49.3→v1.50.1 分类
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — v1.49.3→v1.50.1 领域分析
- [[sources/doc-16-todo-tasks-vs-upstream-migration-report]] — doc-16 To-Do 清算报告
