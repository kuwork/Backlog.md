---
title: BACK-810 - 服务端监听 graph-legends.yaml 并广播图例更新
labels: [source, web-ui, docs, graph, realtime]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-810 - Server-watch-graph-legends.yaml-and-broadcast-legend-updates.md
---

# BACK-810 - 服务端监听 graph-legends.yaml 并广播图例更新

**状态**: Done | **依赖**: BACK-806（由 BACK-809 发现的缺口催生）

`graph-legends.yaml` 有多个写入方：服务端自己的 PUT 路由、CLI（BACK-808）、MCP 工具（BACK-809），还可以用编辑器手改；但只有 API 路由会广播 `graph-legend-updated`，带外写入让所有已打开的图例面板停在旧值。本任务补上 watcher，把本地文件变化转成同一条按库广播。

## 关键实现

- **新工具** `src/utils/graph-legend-watcher.ts`：镜像 `milestone-watcher`。**监听目录而非文件**——存储用临时文件 + rename 写入，文件 inode 会变而目录看得见 rename；50ms 沉降 + 双读求稳；按库与基线做深度、**键序不敏感**的比对（只重排键的重写不算变化）。
- **新项目兜底**：全新项目连 `backlog/databases/` 都没有，watcher 先监听父目录，等目录出现再迁移过去，首次写入不丢。
- **接线位置**：在 `start()` 里挨着 config watcher 启动，**刻意不放进惰性初始化 services**——首个客户端连接才触发那段初始化，夹在中间的编辑会被漏掉。
- **不回声**：PUT 路由只在 `saveLegendConfig` 报告 `changed` 时广播，并在请求内**同步**把返回的 map 作为 watcher 基线（`notePublishedStore`），抢在该次写入的文件事件投递之前，因此一次 Web 侧保存只产生一条刷新。
- **浏览器侧**：广播仍只是提示（需重新 GET），但取回后用新的 `legendConfigsEqual` 与屏上配置比对，相同则不重绘。

## 三层「无变化不刷新」

路由层（只有语义变化才广播）→ watcher 层（基线深度比对）→ 浏览器层（取回后比对）。三者合起来保证一次真正的变化只刷新一次，而键序整理、重复保存、删除不存在的条目都静默。

## Related Concepts

- [[concepts/live-sync-pattern]] — watcher + 广播 + 幂等刷新的第四个落地面
- [[concepts/graph-legend-persistence]] — 带外写入热更新（本任务补上的最后一块）

## Related Sources

- [[sources/back-809-mcp-graph-legend-tools]] — 缺口在此任务中被发现
- [[sources/back-807-legend-persistence-browser]] — 广播的消费方
- [[sources/back-792-milestone-live-add-title-fix]] — 同形状的带外变更修复先例（里程碑）
