---
title: BACK-498 创建任务时自动填充 actualStart 与 actualEnd
source_path: backlog/tasks/back-498 - Auto-populate-actualStart-and-actualEnd-on-task-creation.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, bug, dates, core]
---

# BACK-498 创建任务时自动填充 actualStart 与 actualEnd

修复直接以进行中或终态创建任务时，`actualStart`/`actualEnd` 未被自动填充的问题。

## 问题

自动填充逻辑此前仅在 `updateTask`（状态变更路径）中存在，未在 `createTaskFromInput` 中实现。因此使用 `--status Done` 或 `--status 'In Progress'` 创建任务时，actual 字段保持为空。

## 修复

在 `createTaskFromInput`（`src/core/backlog.ts`）中添加：
- 若 resolvedStatus 为进行中且未提供 actualStart → 设置 actualStart = createdDate
- 若 resolvedStatus 为终态（如 Done）且未提供 actualEnd → 设置 actualEnd = createdDate

## 行为

- 手动 `--actual-start` / `--actual-end` 选项仍然优先
- 仅在字段缺失时自动填充

## Related Sources

- [[sources/actual-start-end-fields-task]] — BACK-492 任务级 actual 字段原始实现
