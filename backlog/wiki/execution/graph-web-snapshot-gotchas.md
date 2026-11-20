---
title: Web 图谱预热与快照陷阱
labels: [execution, graph, web, cache, performance]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
extracted_from:
  - BACK-861
---

# Web 图谱预热与快照陷阱

## 适用场景

调整 Web GraphService 启动时机、复用派生图谱快照，或排查首个图谱请求过慢、hydrate 后报告缺失、旧快照误用和启动阻塞。

## 标准步骤

1. 在 `ensureServicesReady` 后启动同一个 memoized attempt，但不要在 bind 或首屏路径 await；API 与页面继续共享 started/ready 状态。
2. hydrate 前同时校验 corpus fingerprint、parser/schema version 与 snapshot hash；任何失败都走既有 full rebuild。
3. full build 后写快照；incremental sync 只有图实际变化才重写，no-change 保留 mtime。
4. 快照元数据携带 ParseReports，并比较 hydrate 与 full build 的节点、边和完整报告，而不只比较图计数。
5. 用真实仓库分别测冷/暖启动，验证暖启动 snapshot/meta mtime 不变，并在准备期间探测其它 API。

## 常见陷阱

- **把后台预热写成 await**：会重新阻塞首屏，失去 BACK-843 的启动优化。
- **只缓存图不缓存报告**：missing-dependency 等 payload 会在 hydrate 后悄悄减少；旧快照必须有一次重建边界。
- **缓存不匹配仍返回图**：派生缓存必须 fail-closed，不可为了速度提供空图或旧图。
- **HTTP 可响应等于完全无阻塞**：单线程 WASM 构建仍会造成主线程 jank，需要区分启动死锁与响应延迟。
- **只看 graph ready 时间**：还应检查 snapshot mtime 与完整 payload，确认提速来自 hydrate 而非漏工作。

## Related Sources

- [[sources/back-861-graph-startup-warmup-snapshot]] — 实现、127 项测试与冷/暖实测
- [[sources/back-772-derived-graph-snapshot-reuse]] — 快照机制来源
- [[sources/back-843-browser-startup-cache]] — 非阻塞启动前置约束
