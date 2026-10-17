---
title: BACK-804 - cypher-query refresh:auto 订阅 graph-updated
labels: [source, web-ui, cypher, graph, realtime]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-804 - cypher-query-refresh-auto-via-graph-updated-subscription.md
---

# BACK-804 - cypher-query refresh:auto 订阅 graph-updated

**状态**: Done | **里程碑**: m-15 | **依赖**: BACK-802

SQL 块只能手动刷新（磁盘文件无变更通知），而图库有 GraphService 热更新链推到 WebSocket 的 `graph-updated` 广播。本任务让 `cypher-query` 复用这条既有通道实现真实时刷新，服务端零新状态。

## 关键实现

- **协议共享**：新增 `src/graph/updated.ts` 统一 `graph-updated` 的线上协议（消息类型、window 事件 `backlog-graph-updated`、编解码），服务端 / App / 块共用。
- **服务端唯一改动**：`onChanged` 载荷从裸字符串改为 `{type:'graph-updated', database:'default'}`——**不加 watcher、不加推送计算**。
- **客户端**：`QueryEngineConfig.refresh.auto.subscribe` 扩展点；块挂载即订阅，置脏后等 **500ms 静默期**再重跑；`resultFingerprint` 深比较（排除 `elapsedMs`）相同则保持同一状态对象不重渲染；重跑失败静默保留现值；暂停用 ref 实现（停重跑、不摘监听）；Live 徽标 + 暂停/恢复（四语种）。
- **库名匹配**：`detail.database === source` 才跑；用户库目前无广播源，因此其 `auto` 块表现为等同 manual。

## 验证插曲

全量 `bun test` 出现 3670 通过 / 298 失败，逐条核实为环境因素（`uv_spawn` git ENOENT、5s hook 超时），无一触及 graph/query/block 文件。

## Related Concepts

- [[concepts/live-sync-pattern]] — 广播 + 防抖 + 幂等刷新在本任务的 Cypher 变体
- [[concepts/cypher-live-query-block]] — `refresh: auto` 的块级语义

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — 设计依据（§7）
- [[sources/back-802-cypher-query-block-core]] — 前置：块核心
- [[sources/back-810-graph-legend-watcher]] — 同形状的另一条 watcher 广播（图例）
