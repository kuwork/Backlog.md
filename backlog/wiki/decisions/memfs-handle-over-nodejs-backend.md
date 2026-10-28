---
title: 用 MEMFS 句柄而非 NODEFS 构建
labels: [decision, graph, wasm]
created_date: 2026-10-28 15:20
updated_date: 2026-10-28 15:20
description: BACK-823 在三条出路里选了「宿主路径换成 /tmp 句柄」，拒绝切 nodejs 构建，也拒绝用 basename 命名
---

# 用 MEMFS 句柄而非 NODEFS 构建

## 背景

RyuGraph WASM 初始化失败、Cypher 检索全线不可用，根因是 `new ryu.Database(<宿主绝对路径>)` 在 `ryugraph-wasm/sync` 的 MEMFS 里不可达（ENOENT），`openGraphStore` 随即降级 memory。三条出路摆在面前：换 WASM 构建、换路径、换命名。

## 决定

保留 `ryugraph-wasm/sync`，把交给引擎的路径换成 MEMFS 可见的 `/tmp/ryu-<sha256(完整宿主路径)[0:32]>.kuzu`；宿主缓存路径原样保留，继续承载 `.lock` 与 `.kuzu.meta.json` 边车。

## 理由

- **换构建不可行**：`ryugraph-wasm/nodejs/sync` 是真 NODEFS 构建，能直接访问宿主路径，但在 Bun 下崩 `Aborted(Module.thisProgram has been replaced by thisProgram)`——与 BACK-766 选 WASM 的原因同源（绕开原生/嵌入运行时的崩溃面）。
- **MEMFS 本来就够用**：图谱是**可丢弃的派生缓存**，Markdown 才是真源；`.kuzu` 从不落宿主也无所谓，持久化语义由边车（指纹）承担，重建随时可发生。
- **全路径哈希而非 basename**：basename 跨项目不唯一，Windows 分隔符也和 POSIX 不同；hex 摘要在六个发布目标上都是安全字符，且天然让「项目 × slot × 用户库」互不共用内存库（共用会让第二个 store 的 `wipe()` 清掉第一个的表）。
- **不可达的 `/tmp` 也要防御**：`createDefaultDirectories()` 已经建了 `/tmp`，但仍用 `ryu.getFS()` 做 `analyzePath`/`mkdirTree` 守卫，避免将来构建裁剪默认目录时静默退化。

## 被否方案

- **切 `ryugraph-wasm/nodejs/sync`（NODEFS）** — 宿主路径可达，但 Bun 下直接 abort；等于把 BACK-766 已解决的问题重开。
- **用宿主 basename 建 MEMFS 路径** — 看似可读，实则跨项目碰撞 + Windows 反斜杠进 WASM；一旦碰撞，`wipe()` 会互删。
- **搬家目录名到 `.graph` 或迁移旧库** — 宿主上从未存在过 `.kuzu`，没有数据可迁；曾经提出的改名请求在确认原目录本来就叫 `graph` 后撤回，本决策不含任何缓存路径变更。
- **降级时静默或只打中文告警** — 告警改英文并分离「路径不可见」与「引擎故障」两种原因，否则真实回归会被当成环境噪声。

## Related Sources

- [[sources/back-823-ryugraph-wasm-memfs-handle]] — 本决策的落地任务（含六平台推理与 14 项 AC）
- [[sources/back-766-ryugraph-wasm-backend-switch]] — 为什么默认后端是 WASM 而不是原生绑定

## Related Decisions

- [[decisions/ryugraph-wasm-default-backend]] — 上游决策：默认后端切换为 RyuGraph WASM

## Related Execution

- [[execution/ryugraph-wasm-gotchas]] — MEMFS 陷阱集
