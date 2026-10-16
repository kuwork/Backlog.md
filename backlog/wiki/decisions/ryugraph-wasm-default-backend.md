---
title: 默认图谱后端切换为 RyuGraph WASM
labels: [decision, graph, wasm]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
description: BACK-766 用 Kuzu MIT fork 的 WASM 构建取代原生 NAPI 绑定作为默认后端
---

# 默认图谱后端切换为 RyuGraph WASM

## 背景

kuzu 原生 NAPI 绑定在 Bun/Windows 下段错误（崩溃日志指向 `kuzujs.node`），且本环境无法升级 Bun/kuzu；BACK-702 的权宜之计是默认纯 JS `MemoryGraphStore`、原生 kuzu 需显式开启，但这意味着默认路径没有持久化与真正的 Cypher 引擎。BACK-765 的 Cypher 搜索 UI 完成后，引擎问题成为阻塞点。

## 决定

用 RyuGraph 的 WebAssembly 构建（`ryugraph-wasm`，Kuzu 的 MIT fork）替换原生引擎，并把 ryu 设为默认后端：用户不再需要设置 `BACKLOG_GRAPH_BACKEND`；`RyuGraphStore.init()` 失败时告警并回退 memory 单例；`BACKLOG_GRAPH_BACKEND=memory` 仍可强制降级。kuzu npm 依赖与 `KuzuGraphStore` 整体移除，后端类型收敛为 `"ryu" | "memory"`（`resolveGraphBackend()` 仅识别 memory 覆盖，其余一律 ryu）。

## 理由

- WASM 在 Bun 的 WebAssembly 运行时内执行，完全绕开 NAPI 崩溃面，且 Node 下同样可跑
- ryu 是 Kuzu 的 fork，`RyuGraphStore` API 与 kuzu 约 1:1（`prepare`/`execute`、`CALL show_tables()` 均可用），移植成本低
- 六平台 `bun build --compile` 打包不再需要 kuzu native sidecar
- Bun/embind 的 int64→BigInt 不兼容用幂等补丁脚本 `scripts/patch-ryugraph.cjs`（挂 `postinstall`）修复

## 被否方案

- 继续 kuzu 原生绑定——段错误在本环境无解，且阻塞整个图谱计划
- 长期默认 MemoryGraphStore——无持久化、无原生 Cypher 引擎能力，只是降级模式
- patch-package 维护补丁——项目用 `bun.lock`，patch-package 不可用，故选幂等 postinstall 脚本

## Related Sources

- [[sources/back-766-ryugraph-wasm-backend-switch]] — 本决策的落地任务（含 INT64/边导入坑的修复）
- [[sources/back-765-knowledge-graph-cypher-search]] — 触发切换的直接原因
- [[sources/back-702-kuzu-graph-foundation]] — 被取代的原生 kuzu 地基

## Related Decisions

- [[decisions/memory-graph-store-default-backend]] — 前一代默认后端决策，本决策为其后继
