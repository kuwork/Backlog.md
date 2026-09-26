---
title: 图存储双后端抽象，默认 MemoryGraphStore
description: BACK-702 因 kuzu 原生绑定在 Bun/Windows 下段错误而采用可切换后端
labels: [decision, graph, kuzu]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 图存储双后端抽象，默认 MemoryGraphStore

## Context

doc-014 设计以 kuzu 作为依赖图的嵌入式数据库，但实测 kuzu 0.11.3 原生绑定在 Bun 1.3.14 / Windows 下直接 SEGFAULT（doc-014 §5 预判的风险成真），绑定在 Bun 进程内完全无法加载。

## Decision

`GraphStore` 定义为一个抽象接口，带两个后端：

- **默认**：纯 JS 的 `MemoryGraphStore`（即 doc 中的降级模式），任何主机都能跑
- **可选**：原生 `KuzuGraphStore`，需显式 `BACKLOG_GRAPH_BACKEND=kuzu` 开启

两者按项目根做进程级单例。Kuzu SQL 形状通过 Node 冒烟运行端到端验证（Bun 加载不了绑定）。

## Rejected alternatives

- 强制 kuzu 唯一后端——在 Bun/Windows 下根本起不来
- 等待上游修复绑定——阻塞整个图计划，且无时间表

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — 双后端抽象的落地点
- [[sources/back-713-filenode-rename]] — 在同一抽象上做的 schema 重构
- [[sources/back-709-dependency-closure-query]] — 因默认后端是纯 JS map 而选择语料闭包查询
