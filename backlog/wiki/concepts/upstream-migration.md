---
title: 上游迁移策略
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
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

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — v1.47.1→v1.48.0
- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — v1.48.0→v1.49.3 分类
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — v1.48.0→v1.49.3 领域分析
