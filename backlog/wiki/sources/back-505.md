---
title: BACK-505 Web UI 任务依赖项钻取导航
labels:
  - source
  - web-ui
  - feature
created_date: '2026-06-01 14:36'
updated_date: '2026-06-01 22:50'
source_path: backlog/tasks/back-505 - Add-drill-down-navigation-for-task-dependencies-in-Web-UI.md
---

## 概述

在 Web UI 的任务详情面板中，用户现在可以点击 **Dependencies** 区域的依赖任务，直接打开该依赖任务的详情。同时支持通过标题栏左侧的返回按钮回到父任务，点击关闭按钮则关闭整个任务窗口堆栈。

## 技术实现

采用任务历史堆栈（`taskHistory`）而非路由跳转，保持单 Modal 架构：

- **`App.tsx`**：新增 `taskHistory` 状态和 `taskHistoryRef` 引用。`handleDrillDown` 将当前任务压入历史后打开子任务；`handleBack` 从历史弹出并恢复父任务；`handleCloseModal` 清空整个堆栈
- **`Modal.tsx`**：新增 `leftActions` prop，支持在标题栏左侧渲染返回按钮
- **`DependencyInput.tsx`**：新增 `onTaskClick` prop，预览模式下依赖项标签渲染为可点击按钮
- **`TaskDetailsModal.tsx`**：接收 `onDrillDown` 和 `onBack` prop，将 `onTaskClick` 传递给 `DependencyInput`，并在 `leftActions` 中渲染返回箭头按钮

## 设计决策

- 保留单 Modal 全局实例，通过 React state 管理堆栈，避免引入路由复杂性
- 新建任务/草稿模式会清空历史堆栈，确保创建模式不继承导航上下文

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/task-lifecycle]] — 任务生命周期

## Related Sources
- [[sources/back-504]] — BACK-504 看板拖拽修复（同批次 Web UI 优化）
