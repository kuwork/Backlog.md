---
title: BACK-766 - 图谱后端切换 RyuGraph WASM
labels: [source, graph, kuzu, wasm, migration]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-766 - Switch-graph-backend-to-RyuGraph-WASM-as-the-default-and-remove-the-Kuzu-dependency.md
---

# BACK-766 - 图谱后端切换 RyuGraph WASM

BACK-765 的 Cypher 搜索 UI 已完成，但 kuzu native NAPI binding 在 Bun/Windows 下段错误（崩溃日志指向 `kuzujs.node`），且本环境无法升级 Bun/kuzu。本任务用 RyuGraph 的 WebAssembly 构建（`ryugraph-wasm`，Kuzu 的 MIT fork）替换原生引擎——WASM 在 Bun 的 WebAssembly 运行时执行，绕开 NAPI 崩溃；同时把 ryu 设为默认后端（不再需要 `BACKLOG_GRAPH_BACKEND`），并整体移除 kuzu npm 依赖与 `KuzuGraphStore`，后端类型收敛为 `"ryu" | "memory"`。

## 目标

`RyuGraphStore` 作为 KuzuGraphStore 的移植版建 schema、upsert 节点、执行只读 `runCypher`；默认后端为 ryu、失败优雅回退 memory、`BACKLOG_GRAPH_BACKEND=memory` 仍可强制降级；INT64 结果列不再抛 `ToBigInt`；边正确持久化；kuzu 依赖及所有 `"kuzu"` 代码路径移除。

## 实现要点

- 依赖 `ryugraph-wasm@25.9.2`；Bun/embind 的 int64→BigInt 不兼容用幂等脚本 `scripts/patch-ryugraph.cjs` 修（挂 `postinstall`；patch-package 因项目用 `bun.lock` 不可用）：给 `bufferPoolSize`/`maxNumThreads`/`checkpointThreshold` 包 `BigInt()`，`maxDBSize` 替换为字面量 `4611686018427387904n`。Node 不需要补丁但无害。
- `RyuGraphStore` API 与 kuzu 约 1:1（`prepare`/`execute`、`query(sql, params)`、`CALL show_tables()` 均可用）；唯一实质差异是 `QueryResult.getAllRows()` 返回列并行数组而非对象，`rowsFromResult` 把列名 zip 回去并复用 `serializeCypherValue`/`collectCypherNodeKeys`；新增环境类型 `src/types/ryugraph-wasm.d.ts`（包不带 .d.ts）。
- INT64 结果列崩溃：`ToBigInt` 来自 Bun 自己的 wasm embind shim，JS 层无法修；`rowsFromResult` 捕获后回退 `rowsFromResultString`（解析 `toString()` 的 `|` 分隔单元，INT64 安全），`parseCypherCell` 把节点/关系单元归一为 `{_label,_id,_src,_dst}` 形状以保留高亮键。解析坑：值在 `m[2]`（第三个候选 `[^,}]*` 不是独立捕获组）。
- 边静默丢失（用户报"任务图谱/知识图谱没有边"）：`upsertEdges` 沿用 `COPY ... FROM CSV`，在 RyuGraph WASM 下静默导入零条边；改用共享的 `upsertEdgesViaRunner`（`UNWIND + MATCH + MERGE`，批量内去重，端点缺失的边跳过），死代码 `writeEdgeCsv`/`csvField` 移除；`fullImport`（import.ts:31）与增量路径（incremental.ts:146）都走该接口。
- `resolveGraphBackend()` 取代 `isKuzuRequested`/`isRyuRequested`：默认 ryu、仅识别 memory 覆盖；`openGraphStore` 对 `RyuGraphStore.init()` 包 try/catch、失败 warn 回退 memory 单例。残留 "kuzu" 字符串仅历史性/命名性：`.kuzu` 缓存文件扩展名（改名会使既有缓存失效故保留）、注释中的 "ryu is a Kuzu fork"、特性名 "Kuzu task graph"。

## 验证

graph-foundation（新增 RyuGraphStore 用例、INT64 回退用例、边持久化回归用例）+ graph-sync + web-graph-cypher-reveal 共 60 例通过；tsc 干净；biome 仅剩既有 any 警告；`bun install` 后 `bun.lock` 无 kuzu 引用（`node_modules/kuzu` 残留 13MB `kuzujs.node` 需手动删）。已知限制：补丁耦合 25.9.2 版本；六平台 `bun build --compile` 二进制内联 `.wasm` 尚未端到端验证。收益：六平台打包不再需要 kuzu native sidecar。

## Related Concepts

- [[concepts/kuzu-graph]] — 图谱概念页，其后端实现自此从 Kuzu 换成 RyuGraph WASM

## Related Decisions

- [[decisions/memory-graph-store-default-backend]] — BACK-702 的默认 Memory 后端决策，本任务把默认改为 ryu

## Related Sources

- [[sources/back-765-knowledge-graph-cypher-search]] — 触发本次切换的直接原因（kuzu native 在 Bun/Windows 段错误）
- [[sources/back-702-kuzu-graph-foundation]] — 被替换的 Kuzu 图谱基础
- [[sources/back-767-graph-query-cli-command]] — 构建在 ryu 后端上的 CLI 查询命令
- [[sources/back-769-graph-cli-multi-database]] — 多数据库写路径复用本任务的 UNWIND+MERGE 边导入教训
