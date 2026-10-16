---
title: BACK-768 - graph schema 子命令
labels: [source, cli, graph, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-768 - Add-`backlog-graph-schema`-CLI-subcommand-to-inspect-the-graph-schema.md
---

# BACK-768 - graph schema 子命令

里程碑 m-13 任务，依赖 BACK-767：为既有 `backlog graph` 命令加 `schema` 子命令，打印派生任务/知识图谱的结构——每个节点表的属性（名称、类型、主键）与每个关系表的源/目标端点，让用户不靠猜发现标签与关系。复用与 `graph query` 相同的只读 ryu/WASM 后端和一次性 reconcile 链路。

## 目标

`backlog graph schema` 打印全部节点表属性与关系表端点；`--json` 输出 `{ nodes: [...], relationships: [...] }`；schema 经 ryu 只读内省过程读取，不改动图；行为与 `graph query` 一致（进程内重建 / 同 slot / 同锁，每次约 5-7s）；`src/guidelines/cli-instructions/graph.md` 与 help 文档化。

## 实现要点

- 抽取共享助手 `withGraphStore(run)`（`src/cli.ts`）：解析项目根 → `graphPaths` → `openGraphStore(ryu)` → 后端守卫 → 礼节性锁 → `reconcileGraphStoreOnce(forceBuild: true)` → 回调 → finally 关 store 放锁；`graph query` 重构到其上，行为不变、仅去重。
- `loadGraphSchema(store)`：`show_tables()` 枚举表（列含 `id`、`name`、`type`、`database name`、`comment`，type 为 NODE 或 REL），NODE 表走 `table_info('<node>')`，REL 表走 `show_connection('<rel>')`（`source/destination table name` 及各自主键）。`CALL db.labels()` 在 ryu 不存在（Parser exception）。
- 内省列名带空格，统一用 `RETURN *` 加 `cypherCell(result, row, columnName)` 按列名取值，生成的查询字符串零引号更稳。`runCypher` 的只读守卫拦 `CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE` 但刻意放行 `CALL`，内省过程直通。
- 输出形状：默认按 `Node tables (NODE)`（每表属性行 `name  type  (primary key)`）与 `Relationship tables (REL)`（Cypher 模式形如 `FileNode -[:ParentOf]-> FileNode`）分节；`--json` 输出 `{ "nodes": [{name, properties:[{name,type,primaryKey}]}], "relationships": [{name, from, to}] }`。

## 验证

实图验证：9 张表（NODE：FileNode、Meta、Tag；REL：ParentOf、BelongsToMilestone、DependsOn、SourcedFrom、LinksTo、TaggedWith），plain 与 `--json` 输出均正确，`graph query` 回归正常；tsc、biome 干净；图谱套件 69 例通过。BACK-767 记录的 ryu/WASM MEMFS 限制同样适用（每次调用进程内重建，约 5-7s）。

## Related Sources

- [[sources/back-767-graph-query-cli-command]] — 提供共享的 `withGraphStore` 链路与 reconcile 助手
- [[sources/back-766-ryugraph-wasm-backend-switch]] — ryu 内省过程所在的后端
- [[sources/back-769-graph-cli-multi-database]] — 后续多数据库把 schema 内省复用为快照 DDL 重建手段
