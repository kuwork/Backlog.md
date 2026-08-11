---
title: BACK-534 仅序号变更保留 updated_date
labels: [source, core, dates]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-534 - Preserve-updated_date-for-ordinal-only-task-reorders.md
---

# BACK-534 仅序号（ordinal）变更的任务重排保留 updated_date

仅改变任务序号（如看板重排、排序）时不再刷新 `updated_date`，消除无意义的 diff 噪音。

## 解决方案

新增 `buildUpdatedDateComparableTask` 与 `hasUpdatedDateRelevantChanges` 辅助函数，比较持久化任务内容时忽略 ordinal 与 updatedDate。更新 `Core.updateTask`：仅当内容/元数据变化时打 `updated_date` 时间戳，否则恢复原值（或缺失时省略）。看板重排与批量更新改走集中式逻辑，不再自行打时间戳。

## 实现位置

- `src/core/backlog.ts`（updateTask 集中化时间戳逻辑）
- 看板重排/批量更新调用点

## 测试

`src/test/reorder-utils.test.ts`（16 项）：直接 ordinal 编辑、混合编辑、仅序号批量更新、同列重排。

## Related Concepts
- [[concepts/task-lifecycle]] — 任务字段与时间戳
- [[concepts/core-architecture]] — 核心更新管线

## Related Sources
- [[sources/back-540-content-store-stale-refresh-guard]] — 状态一致性相关
