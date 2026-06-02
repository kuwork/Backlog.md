---
title: BACK-504 修复看板拖拽列排序重置与跨列放置定位
labels:
  - source
  - web-ui
  - bug
created_date: '2026-05-31 13:51'
updated_date: '2026-06-01 22:50'
source_path: backlog/tasks/back-504 - Fix-kanban-drag-and-drop-column-sort-reset-and-cross-column-drop-positioning.md
---

## 概述

修复看板视图中拖拽任务时的两个交互缺陷：

1. **拖拽开始时列排序被重置**：当列已手动排序（如按 ID 降序），开始拖拽会立即通过 `setColumnSort(null)` 清除排序，导致任务列表在光标下方重新排序，被拖拽的任务看起来跳到了不同位置。
2. **跨列放置总是追加到末尾**：每个 `TaskColumn` 维护自己的本地 `draggedTaskId` 状态。跨列拖拽时，目标列的 `draggedTaskId` 保持为 null，`onDragOver` 处理器提前返回而未设置 `dropPosition`，导致放置时总是插入到目标列末尾。

## 修复方案

- 从 `onDragStart` 中移除 `setColumnSort(null)`，拖拽期间保持视觉顺序稳定
- `handleDrop` 改为从 `getDisplayTasks()`（视觉顺序）而非 `tasks` prop（默认顺序）计算 `orderedTaskIds`
- 将 `draggedTaskId` 状态从 `TaskColumn` 提升到 `Board` 组件，通过 prop 下发，使所有列都能感知拖拽中的任务
- 跨列放置后清除目标列的手动排序，使默认 ordinal 排序生效，新任务出现在正确位置

## 附加清理

同时修复了 13 个文件中预先存在的 lint/format 问题：
- 移除非空断言（`match[N]!`、`timePart!` 等）
- 将 `catch (err: any)` 替换为 `catch (err)` + `err instanceof Error`
- CRLF → LF 换行符统一

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览

## Related Sources
- [[sources/sidebar-collapse-button-fix]] — BACK-499 侧边栏折叠按钮修复（同批次 UI 优化）
