---
title: RyuGraph WASM 在 Bun 下的陷阱集
labels: [execution, graph, wasm]
created_date: 2026-10-16 01:00
updated_date: 2026-10-28 15:20
extracted_from:
  - BACK-766
  - BACK-767
  - BACK-769
  - BACK-770
  - BACK-771
  - BACK-823
---

# RyuGraph WASM 在 Bun 下的陷阱集

## 适用场景

在 Bun 运行时里使用 `ryugraph-wasm`（Kuzu MIT fork 的 WASM 构建）执行 Cypher、导入数据或维护持久化图谱文件时。BACK-766 起 Backlog.md 默认图谱后端即为此组合。

## 标准步骤

1. 依赖固定 `ryugraph-wasm@25.9.2`，安装后跑幂等补丁 `scripts/patch-ryugraph.cjs`（挂 `postinstall`）：给 `bufferPoolSize`/`maxNumThreads`/`checkpointThreshold` 包 `BigInt()`，`maxDBSize` 替换为字面量 `4611686018427387904n`，修 Bun/embind 的 int64→BigInt 不兼容。Node 不需要补丁但无害。
2. 读结果行：`QueryResult.getAllRows()` 返回的是列并行数组而非对象行，用 `rowsFromResult` 把列名 zip 回去。
3. 边导入走 `upsertEdgesViaRunner`（`UNWIND + MATCH + MERGE`，批量内去重，端点缺失跳过），不要用 `COPY FROM`。
4. 开库路径必须是 MEMFS 可见的路径（`/tmp/...`），宿主绝对路径一律换成 `/tmp/ryu-<sha256(宿主路径)>.kuzu` 句柄；持久化依赖显式导出/落盘路径，不假设 WASM 内存文件系统会保留数据。

## 常见陷阱

- **INT64 结果列崩溃**：`ToBigInt` 异常来自 Bun 自己的 wasm embind shim，JS 层无法根治；`rowsFromResult` 捕获后回退 `rowsFromResultString`（解析 `toString()` 的 `|` 分隔单元，INT64 安全），`parseCypherCell` 把节点/关系单元归一为 `{_label,_id,_src,_dst}` 形状。解析注意值在 `m[2]`。
- **`COPY FROM` 静默零行**：WASM 下 `COPY ... FROM CSV` 不报错但导入零条边（用户表现为"图谱没有边"）；务必改用 UNWIND+MERGE 路径，`fullImport` 与增量路径都要走同一接口。
- **MEMFS 不持久**：WASM 内存文件系统的内容进程退出即失，任何"写库"语义都要显式持久化。
- **MEMFS 也看不见宿主路径**：`ryugraph-wasm/sync` 是浏览器构建，根目录是 `FS.mount(MEMFS, {}, "/")`，只有 `createDefaultDirectories()` 预建的 `/tmp`、`/home`、`/dev`、`/proc`。把 `/Users/...`、`C:\Users\...` 或 `~/.cache/...` 交给 `new ryu.Database(...)` 会 ENOENT，随后 `openGraphStore` **静默降级 memory**——症状是「进程能起、有告警、缓存目录里只有 `.lock` 和 `.meta.json`、Cypher 检索全死」。修法是把宿主路径哈希成 `/tmp/ryu-<hex>.kuzu`（完整路径哈希，不用 basename：跨项目会撞、Windows 反斜杠不是 POSIX 安全字符），宿主路径只留给锁与边车。切 `ryugraph-wasm/nodejs/sync`（真 NODEFS）不是出路：Bun 下崩 `Aborted(Module.thisProgram has been replaced by thisProgram)`（[[sources/back-823-ryugraph-wasm-memfs-handle]]）。
- **补丁耦合版本**：`patch-ryugraph.cjs` 针对 25.9.2 的字面量打补丁，升级 ryugraph-wasm 时必须复核补丁是否仍命中。

## Related Sources

- [[sources/back-766-ryugraph-wasm-backend-switch]] — 后端切换与 INT64/边导入修复的原始记录
- [[sources/back-767-graph-query-cli-command]] — 构建在 ryu 后端上的查询命令
- [[sources/back-769-graph-cli-multi-database]] — 多数据库写路径复用 UNWIND+MERGE 教训
- [[sources/back-770-graph-import-csv]] — CSV 导入避开 COPY FROM 静默零行
- [[sources/back-771-graph-cli-followups]] — 关系 CSV 导入等后续加固
- [[sources/back-823-ryugraph-wasm-memfs-handle]] — MEMFS 路径不可达的根因、句柄命名与六平台推理

## Related Decisions

- [[decisions/memfs-handle-over-nodejs-backend]] — 为什么是句柄而不是 NODEFS 构建
