---
title: doc-27 - Cypher Live Query 只读图查询块设计
labels: [source, design, cypher, graph, web-ui]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
---

# doc-27 - Cypher Live Query 只读图查询块设计

**类型**: specification

Cypher Live Query 的设计稿 v2，是 SQLite Explorer（doc-23）与 DuckDB Explorer（doc-25）的**引擎对偶**：交互语义、安全模型、组件核心全部照搬，只把执行栈换成 `RyuGraphStore.runCypher`。一期只做 `cypher-query` 围栏块在阅读视图的渲染，CLI 子命令与 MCP 工具不在期内（Cypher 已各有现成通道）。

## 与 SQL Explorer 的差异

| 维度 | SQLite / DuckDB | Cypher |
|---|---|---|
| 引擎 | `bun:sqlite` / `@duckdb/node-api` | `ryugraph-wasm/sync`（WASM） |
| `source` | 项目相对**文件路径**（四道闸门防逃逸） | 数据库**注册名**（注册表内名称，非路径） |
| 只读保证 | 静态校验 + 黑名单 + 物理只读打开 | `runCypher` 两层门禁（正则拦截 + 调用面收窄） |
| 视图 | `table` / `list` / `value` | 三者 + **`graph`** |
| 刷新 | 仅 `manual` | `manual` / **`auto`**（订阅 `graph-updated`） |
| 响应 | `{columns, rows, truncated, elapsedMs}` | 同形，另带 `nodeKeys` |

## 关键设计决策

- **`source` 是注册名而非路径**：图库是 `<backlog>/databases/` 下的**目录**，没有单文件语义；注册名经 `registry.json` 间接解析，天然没有逃逸面——**拒绝未知名就是全部闸门**。
- **行数上限配置驱动**：一律取 `queryMaxRows`（默认 500，硬顶 5000），明确禁止为 Cypher 新增 `CYPHER_MAX_ROWS` 式常量——SQL 块「先常量后配置化」的历史不重演。
- **类型强制（Cypher 特有）**：node 剥掉 `_id/_src/_dst` 后序列化为 JSON 并记入 `nodeKeys`；relationship 变 `(src)-[TYPE]->(dst)`；path 为节点关系交替紧凑串。`graph` 视图不走此转换。
- **`refresh: auto`**：订阅既有 `graph-updated` 广播 → 置脏 → 500ms 静默期 → 重跑 → 结果深比较相同则不重渲染；块头 Live 徽标 + 暂停/恢复；仅 `source` 与载荷库名匹配才跑。服务端零新状态。
- **共享件泛化**：`SqlQueryBlock.tsx` 抽为引擎无关的 `QueryBlock`，薄壳只提供「引擎 id / i18n 命名空间 / api 方法 / 动作按钮 / 可用视图集合」五个差异项；验收第 10 条要求 SQL 两块**逐字节不变**。
- **`style` 块级字段**（`compact` / `striped` / `borderless`，可组合）与图例复用（按 `source` 库名读同一份 `graph-legend-config`）。

## 保留未实现

`Embed` 静态快照：与 m-11 / m-12 一致保留设计——服务端按原块文本精确匹配后替换为带时间戳注释的 GFM 表格，`graph` 视图不可快照。

## Related Concepts

- [[concepts/cypher-live-query-block]] — 本设计稿的落地形态与共享内核结构
- [[concepts/sql-query-blocks]] — 被镜像复用的 SQL Explorer 语义与安全模型
- [[concepts/live-sync-pattern]] — `graph-updated` 广播链所属的实时同步模式

## Related Sources

- [[sources/doc-23-sqlite-explorer-prd]] — 同源设计：SQLite Explorer
- [[sources/doc-25-duckdb-explorer-prd]] — 同源设计：DuckDB Explorer
- [[sources/doc-28-cypher-live-query-demo]] — 本文档的验收演示页
- [[sources/m-15-cypher-live-query]] — 依本文档拆分的里程碑
