---
title: BACK-703 - 增量重建与热更新同步（Graph Service）
labels: [source, graph, kuzu, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-703 - Incremental-rebuild-and-hot-update-sync-core-notify-hook-watcher-Graph-Service.md
---

# BACK-703 - 增量重建与热更新同步（Graph Service）

doc-014 在 BACK-702 之上的第 1 阶段同步引擎：语料变化时保持图谱实时。它新增增量重建引擎、可注入的核心 notify 钩子、带去抖的热更新管道，以及向 Web UI 提供 `/api/graph` 的进程内 Graph Service。

## 实现要点

- 增量引擎（`src/graph/incremental.ts`）：`computeChangeSet` 比对逐文件哈希缓存；`applyChangeSet` 把受影响记录分为同 id 原地更新（`updateNodes` 保留边）与删除+插入（demote/promote），按缓存的 filePath 清除过时节点，然后只重建触及受影响 id 的边；`RecordCache` 保证未触碰的文件绝不重读
- `GraphStore` 新增 `updateNodes`、`deleteNodesByFilePath`、`deleteEdgesTouching`、`getAllNodes`/`getAllEdges`，kuzu 与 memory 双后端均实现
- 核心 notify 钩子：公开可注入的 `FileSystem.onFilesChanged`（null = no-op），在每个变更层文件出口发出——saveTask、drafts、archive/complete 重命名、promote/demote 解链、milestone 写入；批量操作按每次写入发出、由消费方去重，因此 CLI/TUI/Web/MCP 零改动
- GraphService：`graph.kuzu.lock` O_EXCL 单持有者锁，带过期 pid 接管；notify() + `node:fs` 对四个白名单目录的监视收敛到同一个 pending Set，150 ms 去抖并串行化同步；5 分钟一次的 stat 扫描对账作为第三层一致性保障
- 服务端：启动时急切 fire-and-forget（锁丢失绝不阻塞）；`GET /api/graph` 在首次导入期间返回 `building`、另一进程持有锁时返回 503，响应体为 `{status, backend, nodes, edges, reports, nodeCount}`；更新经由既有 WebSocket 通道推送（`graph-updated`），不用 SSE
- 校验（`src/graph/validation.ts`）：冷启动后毫秒级计数检查；惰性 DFS 环检测移出关键路径；`isReady`/`isBlocked` 委托给 `readiness.ts`，绝不在 Cypher 里重新实现
- 测试：`graph-sync.test.ts` 新增 11 个，外加真实仓库 Node+kuzu E2E（744 节点 / 125 边）
- 任务已关闭为 Done（实际 2026-09-24 07:43→08:40，milestone m-9，依赖 BACK-702）；更新经由既有 WebSocket 通道（`graph-updated`）到达 Web UI，而非 doc-014 最初草拟的 SSE

## 验收标准

- 缓存 diff 变更集、批量插入、节点就位后建边；同 id 移动保留边，demote/promote 在新 id 下重建
- 核心变更层的可注入 no-op notify 钩子报告每个变更路径
- 单一去重 + 去抖 + 锁管道；每次同步后广播 `graphChanged`
- 单持有者锁、进程内托管、带 building/503 语义的 `/api/graph` 响应体
- 快速计数校验、惰性环检测、readiness.ts 保持为唯一就绪状态来源

## Related Concepts

- [[concepts/web-server]] — 托管进程内 Graph Service 与 `/api/graph`
- [[concepts/task-lifecycle]] — 驱动 notify 钩子的变更（complete/archive/demote/promote）

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — 本任务增量同步的 schema、指纹与 store（同一批）
- [[sources/back-704-graph-view-web-ui]] — 消费 `/api/graph` 的可视化页面（同一批）
