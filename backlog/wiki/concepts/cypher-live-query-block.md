---
title: 文档内实况 Cypher 查询块
labels: [concept, cypher, graph, web-ui, realtime]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
---

# 文档内实况 Cypher 查询块

`cypher-query` 围栏代码块让任何 Backlog 文档在阅读视图渲染实况只读 Cypher 结果，是 [[concepts/sql-query-blocks]] 在 RyuGraph 上的**引擎对偶**：交互语义与安全模型照搬，执行栈换成 `RyuGraphStore.runCypher`（WASM）。由里程碑 m-15（BACK-802~805）交付，设计稿 doc-27，演示页 doc-28。

## 块模型

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `source` | 是 | — | **数据库注册名**（`backlog graph list` 列出的名称），不是路径 |
| `query` | 是 | — | Cypher 语句（SQL 块对应字段是 `sql`），必须只读 |
| `view` | 否 | `table` | `table` / `list` / `value` / **`graph`** |
| `refresh` | 否 | `manual` | `manual` / **`auto`**（订阅 `graph-updated`） |

`style` 字段曾由 BACK-805 引入（compact/striped/borderless 三预设并回灌 SQL 块），后被 BACK-811 移除——预览 CSS 未分层导入压过所有 Tailwind 工具类，预设在像素上不生效；移除是 fail-closed 的，带该字段的块直接报未知字段错误。

## 与 SQL 块的三个本质差异

1. **`source` 是注册名而非路径**：图库是 `<backlog>/databases/` 下的**目录**，没有单文件语义；注册名经 `registry.json` 间接解析，天然没有逃逸面——拒绝未知名就是全部闸门，不需要 SQL 块的四道路径闸门。
2. **多一个 `graph` 视图 + `refresh: auto`**：图库有 GraphService 热更新链推到 WebSocket 的 `graph-updated` 广播，磁盘文件没有变更通知，所以只有 Cypher 块能做真实时刷新。
3. **类型强制**：Cypher 的 RETURN 除标量外还有 node / relationship / path——node 剥掉 `_id/_src/_dst` 后序列化为 JSON 并记入 `nodeKeys`，relationship 变 `(src)-[TYPE]->(dst)`；`graph` 视图不走此转换，直接吃原始结构。

## 只读保证

`runCypher` 的两层门禁**直接使用，不加第三层**：静态正则拦截 `CREATE`/`DROP`/`DELETE`/`MERGE`/`SET`/`UPDATE`；写路径只存在于 `runWrite`，查询块结构上摸不到写通道。与 SQL 块的差异是 SQL 需要三层（静态黑名单可被绕过，靠引擎物理只读兜底）。「校验放行却造成写入」被列为回归测试场景。

## 共享内核

`SqlQueryBlock` 泛化为引擎无关的 **`QueryBlock`**，薄壳只提供五个差异项：引擎 id、i18n 命名空间、api 方法、可用动作按钮、可用视图集合（`QueryEngineConfig` 后续再扩 `graph` / `refresh.auto.subscribe` / `highlightLanguage`）。验收硬约束是 **SQL 两块表面逐字节不变**——27 个既有 SQL 测试一字未改通过。

行数上限与 SQL 块同源，一律取 `queryMaxRows`（默认 500、硬顶 5000），明确禁止为 Cypher 新增常量；Cypher **不提供分页**（超限就该改查询）。

## 相关约束（实测）

- RyuGraph 不支持无类型关系模式（`-[r]->` 匹配 0 行）与多类型并集（`-[r:A|B]->` 报 binder 错误），查询需带具体关系类型。
- 用户库（如 `demo`）目前没有变更广播源，写 `refresh: auto` 表现为等同 manual；按名匹配逻辑已就绪。
- `graph` 视图超 3000 节点降级为强制后的表格并提示。

## Related Concepts

- [[concepts/sql-query-blocks]] — 被镜像的 SQL 块，共享同一内核与安全模型
- [[concepts/graph-legend-persistence]] — `view: graph` 所依赖的图例配置
- [[concepts/live-sync-pattern]] — `refresh: auto` 背后的广播 + 防抖 + 幂等刷新模式
- [[concepts/markdown-pipeline]] — 围栏分支挂载点（MermaidMarkdown）与未分层 CSS 级联问题

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — 设计稿
- [[sources/doc-28-cypher-live-query-demo]] — 演示页
- [[sources/m-15-cypher-live-query]] — 交付里程碑
- [[sources/back-802-cypher-query-block-core]] — 解析 / 路由 / 文本视图 / 内核泛化
- [[sources/back-803-cypher-query-graph-view]] — `view: graph` 与图例集成
- [[sources/back-804-cypher-query-refresh-auto]] — `refresh: auto`
- [[sources/back-811-remove-style-field-add-highlight]] — style 移除与查询源码高亮
