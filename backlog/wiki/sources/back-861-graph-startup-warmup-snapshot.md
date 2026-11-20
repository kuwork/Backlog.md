---
title: BACK-861 - Web 图谱后台预热与快照复用
labels: [source, graph, web, performance, cache]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-861 - Warm-the-Web-UI-graph-at-startup-and-reuse-its-snapshot.md
---

# BACK-861 - Web 图谱后台预热与快照复用

Web 内容服务就绪后后台启动共享 GraphService，不在 bind 或首屏路径等待；Web slot 复用 CLI 的 fail-closed 派生图谱快照，冷进程可直接 hydrate。

## 问题

BACK-843 为保首屏把图谱改为首个 `/api/graph` 请求才启动，首个访问者因此要承担完整 RyuGraph WASM 构建。BACK-772 的快照只服务 CLI/MCP，Web 既不读也不写，长驻进程无法复用已验证结果。

## 解决方案

- `ensureServicesReady` 后触发同一个 memoized GraphService attempt，但不 await；API 与两个图谱页面共享 attempt 和 started/ready 广播。
- Web full build 写图谱 JSON 与元数据；增量同步仅在图实际变化时刷新快照。
- corpus fingerprint、parser/schema version 与 snapshot hash 全部匹配才 hydrate；缺失、不匹配、被替换或不可读均回退全量重建。
- 快照元数据增加 ParseReports，保证 hydrate 后 missing-dependency 等完整 payload 不丢失；旧快照无 reports 时有意重建一次。

## 验证

127 项图谱测试、TypeScript 与 Biome 通过。真实仓库冷/暖 graph ready 为 5859ms → 3240ms，暖启动不改快照 mtime；两次均返回 973 nodes / 260 edges，暖启动保留 78 条 missing-dependency reports。准备期间 `/api/config` 可响应，但仍有主线程 jank，并非完全无阻塞。

## Related Concepts

- [[concepts/kuzu-graph]] — RyuGraph 派生图谱与快照校验
- [[concepts/browser-startup-cache]] — 首屏非阻塞与派生缓存复用

## Related Sources

- [[sources/back-843-browser-startup-cache]] — 延迟图谱保护首屏的前置决策
- [[sources/back-772-derived-graph-snapshot-reuse]] — CLI/MCP 快照机制来源
- [[sources/back-857-cache-write-failure-stability]] — 同期磁盘缓存容错
