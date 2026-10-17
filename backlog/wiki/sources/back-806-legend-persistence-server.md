---
title: BACK-806 - 图例持久化：服务端存储与 /api/graph/legend 端点
labels: [source, docs, graph, web-ui]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-806 - Graph-legend-persistence-server-storage-api-graph-legend-endpoints.md
---

# BACK-806 - 图例持久化：服务端存储与 /api/graph/legend 端点

**状态**: Done | **里程碑**: m-16 | **PRD**: doc-29

建立图例配置的项目级存储与 HTTP 面：单文件 `backlog/databases/graph-legends.yaml`（库名 → 配置映射），块状 YAML + LF 行尾便于 review 与手改，深度校验留给客户端 `normalizeLegendConfig`。

## 关键实现

- **存储模块** `src/graph/legend-store.ts`：load / save / reset，原子写（临时文件 + rename），容忍读（文件缺失或损坏视为空映射）。
- **广播编解码** `src/graph/legend-updated.ts`：`graph-legend-updated` 载荷造型沿用 `graph/updated.ts`。
- **端点**：`GET /api/graph/legend?database=X`（有配置返 JSON、无配置 204、缺参数 400）；`PUT /api/graph/legend`（非 plain object 返 400 且不动文件；`config: null` 删除该库条目；成功则经既有 WS 通道广播带库名的 `graph-legend-updated`）。
- **测试**：`src/test/server-graph-legend-endpoint.test.ts` 7 个用例（往返 / 204 / 400 / 重置 / 广播载荷）全绿。

## Related Concepts

- [[concepts/graph-legend-persistence]] — 本任务确立的存储与端点契约

## Related Sources

- [[sources/doc-29-graph-legend-persistence-prd]] — 设计依据
- [[sources/back-807-legend-persistence-browser]] — 后继：浏览器恢复与 write-through
- [[sources/back-808-cli-graph-legend]] — 后继：CLI 读写同一文件
- [[sources/back-809-mcp-graph-legend-tools]] — 后继：MCP 三工具
