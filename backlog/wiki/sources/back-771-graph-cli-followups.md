---
title: BACK-771 - 图谱 CLI 后续：关系导入与 Web 浏览
labels: [source, cli, graph, web-ui, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-771 - Graph-CLI-follow-ups-relationship-CSV-import-scoped-hydrate-Web-UI-browsing.md
---

# BACK-771 - 图谱 CLI 后续：关系导入与 Web 浏览

里程碑 m-13 任务（依赖 BACK-769/770）：三件刻意留在 BACK-769 多数据库核心之外的独立后续——关系 CSV 导入、限定范围 hydrate（scoped hydrate）、Web UI 只读浏览用户数据库。各自可独立交付。

## 目标

①关系 CSV 导入：`import <db> <csv> --rel KNOWS --from <col> --to <col>` 按两端键匹配建边，复用节点导入的 CSV reader。②scoped hydrate：冷开只加载语句引用的表，无法判定时回退全量 hydrate。③Web UI 只读浏览用户数据库（列表 + 按库限定的 Cypher 框），前端需通用渲染器（现有图视图假定 FileNode 语料 schema）。

## 实现要点

- 关系导入：`importCsvRelations()` 原样复用 `readCsvFile`（header/`--map`/`--no-header`/畸形文件守卫全同）。端点是匹配而非创建：`MATCH (a:F {key: row.from}), (b:T {key: row.to}) MERGE (a)-[:R]->(b)`；节点不存在的行绑定不上即无边（ryu 视角静默），CLI 计数报 `跳过 N 行`；`MERGE` 不叠重边，重导入幂等（实测二次导入加 0 条边）。已存在的关系表以 `show_connection` 声明的端点为准（`--from-node`/`--to-node` 不再必需）；需建表时二者必填（`--node` 是两端同表的简写）。数值端点键绑定带 `CAST(row.x AS <type>)`（JS number 传 INT64 参数在 Bun 下抛错，文本匹配 INT64 键又绑不上）。
- 连带 bug：INT64 键重载丢全部边——hydrate 的边回放未 CAST，快照把 INT64 键存成文本，绑到 INT64 列抛 `ToBigInt`；修成与节点属性同规则 CAST。回归测试："an INT64 primary key re-links its edges after a round-trip"。
- scoped hydrate：`referencedTables(statement, snapshot)` 返回语句触及的表，判不出返回 `null`（= 全量 hydrate，所有不传语句的调用方的默认）——错误的部分 hydrate 会让查询对着没建的表跑出"无行"而非报错，是只读工具最坏的失败模式。识别规则：标签只在 `(` 后、关系名只在 `[` 后（属性 map 不误判为表）；`CALL table_info('X')`/`show_connection('X')` 也算；`show_tables()`、无标签 `MATCH (n)`、快照不存在的名字一律 `null`。被引关系自动拉入两端表；端点未载的关系跳过而非向虚空回放。仅 `graph query` 传语句；`schema`/`describe`/`insert`/`import` 一律全量。实测收益有限：5050 行两表库上只查 50 行表为 3.08s vs 全量 3.71s（~1.7s 进程启动与 JSON 解析占大头）；`BACKLOG_GRAPH_DEBUG=1` 打印所选范围。
- Web 浏览：新增 Databases 页（各库列表带行计数 + 按库限定的 Cypher 框），后端加 `GET /api/graph/databases` 与 `POST /api/graph/db-cypher`，结果表通用渲染（不假定 FileNode schema）。`default` 路由到既有 graph service（其拥有语料重建与锁），`UserDatabaseBrowser` 拒绝之；仅用户库走浏览器。常驻进程服务的关键 bug：CLI 是一次性进程可每次重放快照，服务器不能（每次击键都全量 hydrate 不可行）——故首次 hydrate 后按快照指纹比对、文件变了才重放（CLI 原子替换快照，并发读看到的是一致的旧版）。同进程重开同一路径曾静默服务旧数据：ryu 把文件留在 WASM 内存、`close()` 不释放，第二次 `openGraphStore(path)` 看到的是上次 hydrate 的行，再 hydrate 又因批量 `CREATE` 遇重复主键整批不插而零写入——修在 `RyuGraphStore.init()`：用户库（`schema: "none"`）启动即空，其持久副本是快照 sidecar 而非此文件。这是同一 ryu 行为第二次造成静默零行（第一次见 BACK-769 异构 `$rows`）。页面构造上只读（无写路径，`db-cypher` 只收只读语句）。

## Related Concepts

- [[concepts/kuzu-graph]] — Web 图视图的 FileNode 语料模型，通用渲染器刻意不依赖它

## Related Sources

- [[sources/back-769-graph-cli-multi-database]] — 多数据库核心与快照层，本任务三项均建在其上
- [[sources/back-770-graph-import-csv]] — 节点 CSV 导入，关系导入复用其 reader
- [[sources/back-772-derived-graph-snapshot-reuse]] — 同为 BACK-769 拆出的派生图快照复用
