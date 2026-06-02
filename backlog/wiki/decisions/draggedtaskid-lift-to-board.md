---
title: draggedTaskId 状态提升到 Board 组件
labels:
  - decision
  - web-ui
created_date: '2026-05-31 13:51'
updated_date: '2026-06-01 22:50'
---

## 决策

将 `draggedTaskId` 状态从每个 `TaskColumn` 的本地 state 提升到 `Board` 组件级别，通过 prop 下发给所有列。

## 背景

BACK-504 发现：当任务跨列拖拽时，目标列的 `draggedTaskId` 为 null，导致 `onDragOver` 提前返回，`dropPosition` 无法设置，放置结果总是追加到列末尾。

## 选项对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A. 提升到 Board** (选中) | 所有列共享同一拖拽状态，跨列 drop indicator 正常；改动面小，逻辑清晰 | 增加 Board 组件 state 数量 |
| **B. 使用 React Context** | 避免层层 prop drilling | 对于只有两个层级（Board → TaskColumn）过于复杂 |
| **C. 保持本地 + 事件广播** | 不改现有结构 | 需要自定义事件或回调链，容易遗漏边界情况 |

## 结果

采用方案 A。`Board.tsx` 新增 `draggedTaskId` state，通过 `onDragStart`/`onDragEnd` 回调与 `TaskColumn` 同步。跨列拖拽时目标列能正确渲染 drop indicator，放置位置精确。

## 参考来源
- [[sources/back-504]] — 原始修复任务
