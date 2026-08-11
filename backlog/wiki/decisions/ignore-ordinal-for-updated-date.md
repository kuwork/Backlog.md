---
title: ordinal 变更忽略 updated_date 差异
labels: [decision, core, dates]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
---

# 仅 ordinal 变更的任务重排忽略 updated_date 差异（BACK-534）

## 决策

`Core.updateTask` 通过 `hasUpdatedDateRelevantChanges` 比较持久化任务内容时忽略 ordinal 与 updatedDate；仅当内容/元数据变化时打 `updated_date` 时间戳，否则恢复原值。看板重排与批量更新改走集中式逻辑。

## 理由

- 仅改变任务序号（看板重排、排序）时刷新 `updated_date` 造成无意义的 diff 噪音
- 集中式时间戳逻辑消除各调用点自行打时间戳的不一致

## 关联

- 相关任务：[[sources/back-534-preserve-updated-date-ordinal-reorder]]
- 相关概念：[[concepts/core-architecture]]、[[concepts/task-lifecycle]]
