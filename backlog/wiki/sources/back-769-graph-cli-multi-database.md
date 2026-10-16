---
title: BACK-769 - 图谱 CLI 多数据库支持
labels: [source, cli, graph, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-769 - Add-multi-database-support-to-the-graph-CLI-named-databases-write-path-CSV-import.md
---

# BACK-769 - 图谱 CLI 多数据库支持

里程碑 m-13 任务（依赖 BACK-767/768）：把 `backlog graph` CLI 从单一派生图扩展为多数据库工具。硬约束是 BACK-767 证实的：`ryugraph-wasm/sync` 把图存在 Emscripten MEMFS，永不写真盘，每个 CLI 进程从空 store 开始——因此用户数据库必须自带持久层。本任务交付多数据库核心（P1/P2）：命名用户数据库、写路径、JSON 快照持久化；CSV 导入（AC #7）与 P4 后续拆为 BACK-770/771/772。

## 目标

`graph query <db> "<cypher>"` 接受数据库参数（单参数旧形式仍视为 `default`）；`graph schema <db>`/`show-schema` 打印指定库 schema；`graph list`/`describe` 列出各库描述、kind 与表/节点/边计数；`graph create <db> "<desc>"`/`drop <db>` 注册与删除用户库（连快照）；`graph insert <db> "<cypher>"` 执行写 Cypher 并持久化；写 `default` 被拒并指向 `create`；快照跨进程往返完整；按库单持锁使不同库的并发 CLI 互不阻塞。

## 实现要点

- 持久化：用户库快照存 `<backlog>/databases/<name>.graph.json`（经 `resolveBacklogDirectory` 解析，`backlog/`、`.backlog/`、自定义目录都适用；`backlog/databases/` 不在图谱扫描白名单内，快照永远不会被当语料摄取）。快照含 version、nodeTables（含属性与主键）、relTables（含端点与端点主键）、nodes、edges；schema DDL 可由 `show_tables`/`table_info`/`show_connection` 内省重建，用户无需重复声明。hydration 顺序固定 DDL → 全部节点 → 边（`MATCH` 绑定不上会静默丢边，正是 BACK-766 的坑），且每行先投影到表声明属性再插入。
- `default`（派生库）保持只读：它是 markdown 事实的可重建缓存，`forceBuild` 会覆盖任何写入；故留在 OS 缓存目录（与指纹 sidecar 相邻），而用户库是用户数据、随项目版本化。
- 写守卫从纯关键字改为 kind 感知：`runCypher` 仍拦 `CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE`；新 `runWrite(statement, params?)` 对用户库放行但拒绝 `DROP DATABASE|ATTACH|DETACH|INSTALL|LOAD EXTENSION`；对 `default` 的 insert 在开 store 前即按 `kind === "derived"` 拒绝。`openGraphStore(path, { schema: "none" })` 开文件不建不洗表（`init()` 否则会盖 SCHEMA_VERSION 并丢弃不认识的表）。
- 写方需守两个窗口：锁对写是强制的（`openSync(lockPath, "wx")` 按库加锁，读可无锁——快照原子替换，无锁读者看到的是一致的旧版本）；文件本身另由 `registry.json` 记录的 `snapshotFingerprint` 防护（写前比对"登记值 vs 载入值 vs 盘上现值"，不符即中止并展示两个哈希，`--force` 显式覆盖），每次 dump 成功后 `recordSnapshot()` 刷新。
- Web UI 占 `port-<port>` 槽位，与 CLI 的 `default` 库文件和锁都不同（实测：Web UI 在 6431 端口服务时 `graph query default` 仍返回 1387 个 FileNode）。
- 验证中修掉的五个缺陷：①快照 dump 继承 500 行展示上限致静默丢行（修：`runCypher` 加 `maxRows` 选项，`DEFAULT_CYPHER_ROW_CAP = 500`，dumpDatabase 传 `Number.POSITIVE_INFINITY`）；②并发写互相覆盖（修：写强制持锁）；③异构 `$rows` 列表被 ryu 当空 LIST<STRUCT> 静默载入零行（修：逐行投影到声明属性，缺声明属性则响亮报错）；④`countNodes()` 硬编码 `MATCH (n:FileNode)` 在用户库抛 Binder exception（修：schema 感知——有 FileNode 表时保持语料语义，否则计全部节点表）；⑤测试因 `if (store.backend !== "ryu") return;` 可能空转通过（修：断言 `expect(store.backend).toBe("ryu")`——缺陷③正是这样藏住的）。

## 验证

tsc、biome 干净；11 个 snapshot/reconcile 测试加图谱套件通过；所有用户库流程跨进程端到端验证。已知限制：快照是全量 dump/hydrate，O(库大小)，约 1e5 行以内可用；每次 insert 是一条语句加一次快照写，多语句载入非原子；最终检查与原子重命名之间的窗口不防护。范围仅 CLI，Web UI/TUI 刻意出范围。

## Related Concepts

- [[concepts/kuzu-graph]] — 派生语料图（default 库）的模型基础

## Related Sources

- [[sources/back-767-graph-query-cli-command]] — 单图查询命令与 MEMFS 硬约束的来源
- [[sources/back-768-graph-schema-cli-command]] — 快照 DDL 重建复用的内省链路
- [[sources/back-770-graph-import-csv]] — 拆出的 CSV 导入任务（本任务 AC #7）
- [[sources/back-771-graph-cli-followups]] — 拆出的关系 CSV / 限定 hydrate / Web 浏览
- [[sources/back-772-derived-graph-snapshot-reuse]] — 拆出的派生图快照复用
