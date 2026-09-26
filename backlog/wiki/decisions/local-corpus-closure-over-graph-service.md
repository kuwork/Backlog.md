---
title: 依赖闭包查询走本地语料，不走图服务
description: BACK-709 选择从磁盘语料做 BFS 闭包，而非依赖 GraphStore
labels: [decision, dependencies, graph]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 依赖闭包查询走本地语料，不走图服务

## Context

BACK-709 要回答三个此前任何界面都答不了的依赖问题（传递依赖与跳数、反向依赖、真正的根阻塞者）。当时已有 Kuzu 图基础设施，直觉上该用它。但 2026-09-24 的评估发现：默认后端是纯 JS map（kuzu 在 Bun 下段错误）、GraphStore 接口没有多跳调用、且只有 web 主机会启动图服务——CLI/TUI/MCP 上根本没有图可用。

## Decision

闭包从本地语料（tasks + completed）上的 BFS 遍历回答，与写门禁共享 `dependency-closure.ts` 的遍历与语料定义，因此门禁、doctor、查询三者不可能漂移。visited 集合让有环语料有界；再次到达起点按环报告而非报错；未解析引用随结果带出。Kuzu 图只服务可视化。

## Rejected alternatives

- 给 GraphStore 加多跳查询接口——默认后端是内存 map，加了也是重造 BFS；且非 web 主机没有图服务进程
- 每个宿主各自实现遍历——三份实现必然漂移

## Related Sources

- [[sources/back-709-dependency-closure-query]] — 本决策的落地
- [[sources/back-702-kuzu-graph-foundation]] — 默认后端为何是纯 JS 的背景
- [[sources/back-707-dependency-gate-cycles]] — 共享同一遍历的写门禁
