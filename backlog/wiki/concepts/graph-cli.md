---
title: 图谱 CLI 子命令体系
labels: [concept, graph, cli]
created_date: 2026-10-16 01:00
updated_date: 2026-10-18 01:00
---

# 图谱 CLI 子命令体系

`backlog graph` 子命令家族（里程碑 m-13，BACK-767~772）把图谱能力从 Web UI 面扩展到 CLI 面：对项目的任务/知识图谱跑只读 Cypher 查询，是 Web UI Cypher 搜索的 CLI 对应物，服务于临时分析、脚本化与管道输出。指南见 `backlog instructions graph`。

## 子命令

- `query <db> <cypher>`：只读 Cypher 查询，写关键字（`CREATE`/`DROP`/`DELETE`/`INSERT`/`MERGE`/`SET`/`UPDATE`）一律拒绝；默认 500 行上限，`--all` 解除，`--json` 机器可读输出
- `schema`（别名 `show-schema`）：打印全部节点表属性与关系表端点，底层用 ryu 只读过程 `show_tables` / `table_info` / `show_connection`，`--json` 输出结构化 schema
- `list` / `describe` / `create` / `drop`：named database 管理
- `insert`：对用户数据库的 Cypher 写路径
- `import`：CSV 导入节点与边到用户数据库（BACK-770/771）
- `legend get/set/remove <db>`：图例配置的 CLI 读写面（m-16，BACK-808），直接读写 `backlog/databases/graph-legends.yaml`——不经 HTTP、离线可用，与 Web 面板和 MCP 是同一份存储；默认打印人类可读摘要，`--json` 输出原始 JSON，删除沿用 CLI 惯例命名 `remove` 且幂等

## 两类数据库

- `default`：Markdown 语料的派生图谱，可重建的缓存，始终只读
- 用户数据库：`graph create` 建立，存于 `<backlog>/databases/`，因 ryu/WASM 后端数据只在 WASM 内存中，用 JSON 快照保持持久

## 性能：快照复用

BACK-772 起 CLI 的 derived 分支优先复用派生图谱快照（`reuseSnapshot`），不再每次运行都从语料全量重建；快照不可用时回退进程内重建（ryu/WASM 后端不跨进程持久化）。

## schema 要点

节点主表 `FileNode`（path 主键）+ `Tag` + `Meta`；关系表 `ParentOf` / `BelongsToMilestone` / `DependsOn` / `SourcedFrom` / `LinksTo` / `TaggedWith`。ryu 方言注意：`CALL db.labels()` 不存在；`show_connection` 只对关系表有效；含空格的保留列名（如 `primary key`）需反引号。

## Related Concepts

- [[concepts/kuzu-graph]] — CLI 所操作的图谱引擎与数据模型
- [[concepts/cli-entry]] — 命令注册与 plain/json 输出惯例
- [[concepts/graph-legend-persistence]] — `graph legend` 所读写的配置与三面共享存储

## Related Sources

- [[sources/m-13-graph-cli]] — 本子命令体系的里程碑
- [[sources/back-767-graph-query-cli-command]] — graph query 命令
- [[sources/back-768-graph-schema-cli-command]] — graph schema 子命令
- [[sources/back-769-graph-cli-multi-database]] — 多数据库与写路径
- [[sources/back-770-graph-import-csv]] — CSV 导入
- [[sources/back-771-graph-cli-followups]] — 关系 CSV 导入等后续加固
- [[sources/back-772-derived-graph-snapshot-reuse]] — 派生图谱快照复用
