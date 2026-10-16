---
title: BACK-767 - graph query CLI 命令
labels: [source, cli, graph, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-767 - Add-`backlog-graph-query`-CLI-command-for-Cypher-graph-search.md
---

# BACK-767 - graph query CLI 命令

里程碑 m-13 首任务：把既有的只读 Cypher 能力（BACK-765 加入 `GraphStore.runCypher`、BACK-766 经 RyuGraph WASM 设为默认）经新 CLI 子命令 `backlog graph query "<cypher>"` 暴露出来：解析项目根、打开 ryu store、进程内建图、执行只读语句，默认打印对齐表格、`--json` 输出原始结果。

## 目标

`graph query` 打开 ryu store 运行只读 Cypher，表格（默认）或 JSON（`--json`）输出 columns/rows/nodeKeys；写关键字被 `runCypher` 拦截、memory 后端给出明确不支持信息；使用独立 graph slot/lock，不与 Web 服务器冲突，并发 CLI 各自建独立进程内图互不损坏。

## 实现要点

- 新一次性协调助手 `src/graph/reconcile-once.ts` 的 `reconcileGraphStoreOnce`：复用扫描/指纹/变更集/`buildGraphFromFiles` 等导出件，镜像 `GraphService.reconcile` 但无 watcher/定时器/就绪门；接受 `forceBuild` 标志。
- 关键发现（硬约束）：唯一 Bun 兼容的 ryu 构建 `ryugraph-wasm/sync` 把图存在 Emscripten 的进程内 MEMFS，不落真盘——同进程 build→close→reopen 有 1385 节点，独立 bun 进程打开同一 dbPath 得到 0 且报 `Table FileNode does not exist`，`.kuzu` 目录从不出现在盘上（只有 `.meta.json` 指纹缓存）；`nodejs/sync` 构建用真 fs 但因 `worker_threads` 在 Bun 下 Aborted。故每个 CLI 进程都从空 store 开始，CLI 必传 `forceBuild: true` 永远全量重建，不信任指向当前进程不可见数据的陈旧指纹；Web 服务器仍走 `GraphService.reconcile` 增量路径。
- `src/cli.ts` 注册 `graph` 命令与 `query <cypher>` 子命令；`tryAcquireGraphLock` 为礼节性单持锁（MEMFS 本就按进程隔离，锁只为避免与 Web 服务器同槽告警）；`printCypherResult` 用 `text.length` 量列宽、无 ANSI 转义，管道/重定向下对齐。
- 顺带修的数据模型 bug：测试中发现 `ParentOf` 边存反了（child→parent，与 `relations.ts` 注释及"父 -[:ParentOf]-> 子"语义矛盾），根因是 `resolveRelations` 用 `addEdge("ParentOf", record, target.filePath)` 而 record 是子节点；交换参数后全量与增量路径同时修正。其他边类型本就是"属性持有方→目标"无需动；`task-subgraph.ts` 无向遍历不受影响，仅对齐测试断言；文档与 help 示例同步改向并去掉自定义列别名。正确查询：子节点 `MATCH (p {id:X})-[:ParentOf]->(c)`，父节点 `MATCH (c {id:X})<-[:ParentOf]-(p)`。
- 节点标签是 `FileNode` 不是 `File`（早期 "Table does not exist" 误报即因查 `(n:File)`）；标签节点为 `Tag`。

## 验证

`graph-reconcile-once.test.ts` 4 例 + 图谱套件 77 例通过；tsc、biome 干净。实测：`count(n)` → 1385；`BACK-521 -[:ParentOf]-> c` 返回 14 个子任务；`--json` 与写语句拒绝正常；非法 Cypher 优雅失败。性能：每次调用约 5–7s（≈0.8s bun 启动 + ≈5.6s 全量建 ~1385 FileNode）——跨进程复用在 MEMFS 后端下不可达，需 native Kuzu 或 Bun 兼容的 ryu `nodejs` 构建（后续见 BACK-772 的快照折中）。

## Related Concepts

- [[concepts/kuzu-graph]] — FileNode 图模型与关系类型，CLI 查询的 schema 基础
- [[concepts/cli-entry]] — CLI 命令注册体系

## Related Sources

- [[sources/back-766-ryugraph-wasm-backend-switch]] — ryu 默认后端与 MEMFS 限制的来源
- [[sources/back-765-knowledge-graph-cypher-search]] — Web 侧同一 runCypher 能力
- [[sources/back-768-graph-schema-cli-command]] — 复用同一 reconcile 链路的 schema 子命令
- [[sources/back-772-derived-graph-snapshot-reuse]] — 后续用快照复用消除每次全量重建
