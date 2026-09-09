---
title: Identity Index 改从 cachedTasks 重建
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# Identity Index 改从 cachedTasks 重建

## 背景

BACK-612 测试稳定化过程中暴露了一个真实 store bug：identity-index 从 stale 的 `activeTasks` 重建，导致索引落后于实际缓存的任务集。

## 决定

identity-index 改为从 `cachedTasks` 重建，与真实缓存的任务集保持一致。

同时明确 BACK-602 引入的 publication gating 判定为"预期行为，不得削弱"——测试去适配 gating，而不是放宽 upsert 门槛来迁就测试。

## 理由

- 索引从 stale 数据源重建，identity 查询会命中已不在缓存中的任务，属正确性 bug 而非测试问题。
- cachedTasks 是 store 的真实任务集，索引与其对齐才能保证查询结果可信。
- gating 是 publication 正确性的一部分，放宽 upsert 门槛会用错误正确性换测试通过。

## 被否方案

- **保留 stale 重建并只改测试**：索引会继续返回过期身份。
- **放宽 upsert 门槛让测试绕过 gating**：削弱了 publication 的正确性保障。

## Related

- [[sources/back-612-content-store-test-stabilization]]
- [[sources/back-602-incremental-cross-branch-task-loading]]
- [[concepts/task-identity]]
- [[concepts/browser-loading]]
