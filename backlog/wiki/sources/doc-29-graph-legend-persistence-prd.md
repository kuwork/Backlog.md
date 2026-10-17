---
title: doc-29 - Graph Legend 配置持久化设计
labels: [source, design, graph, web-ui, config]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
---

# doc-29 - Graph Legend 配置持久化设计

**类型**: specification

图例配置（per-type 颜色、caption 模板、配色规则、关系线样式与箭头）此前只存在浏览器 localStorage（键 `backlog.graph.<database>.legend`），带来三个问题：**易丢**（换浏览器/设备/清缓存即消失）、**不可共享**（同库在不同人屏幕上长得不一样）、**文档渲染不确定**（`cypher-query` 块的 `view: graph` 取决于读者浏览器而非项目本身）。

## 设计

- **存储**：`backlog/databases/graph-legends.yaml`（与 `registry.json` 并排，随 git 提交），单文件按库名映射；块状 YAML + LF 行尾，便于 review、diff 与手改。缺字段/坏规则由客户端 `normalizeLegendConfig` 降级，服务端不做深度校验。
- **端点**：`GET /api/graph/legend?database=X`（有配置返 JSON，无配置 204）；`PUT /api/graph/legend`（`{database, config}`，非 plain object 返 400，原子写临时文件 + rename，`config: null` 表示重置）；成功后经既有 WS 通道广播 `graph-legend-updated`。
- **启动恢复**（`CypherResultGraph` 是唯一消费方）：先用 localStorage 渲染首帧 → GET 服务器：服务器有且不同则应用并回写本地缓存；服务器没有而本地有则 PUT 一次完成**迁移**；两边都无则维持默认。收到本库广播则重新 GET。
- **保存链路**：写 localStorage（即时生效）+ PUT 服务器（write-through）；PUT 失败不阻断，本地副本保留，下次启动重试迁移兜底。
- **CLI**：挂在 `graph` 命令组下，直接读写同一 YAML（不经 HTTP，离线可用）；删除沿用 CLI 惯例命名 `remove`。

## 非目标与冲突策略

不做多用户实时协同与合并，**last-writer-wins**（图例是低频单人配置）；不改动 `graph-legend-config.ts` 的纯函数层；不为 SQL 块的 `style` 字段引入项目级配置（块字段已在文档里，天然版本化）。

## Related Concepts

- [[concepts/graph-legend-persistence]] — 本设计的落地形态（三层写入面 + watcher）
- [[concepts/kuzu-graph]] — 图例所服务的图谱渲染与 RyuGraph 后端

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — `view: graph` 依赖图例配置，是本次持久化的动因之一
- [[sources/m-16-graph-legend-persistence]] — 依本文档拆分的里程碑
- [[sources/back-794-cypher-graph-configurable-legend]] — 被持久化的 localStorage 版图例（BACK-794）
