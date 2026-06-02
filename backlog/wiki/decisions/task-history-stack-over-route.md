---
title: 使用任务历史堆栈替代路由实现钻取导航
labels:
  - decision
  - web-ui
created_date: '2026-06-01 14:36'
updated_date: '2026-06-01 22:50'
---

## 决策

在任务详情 Modal 中实现钻取导航时，使用 React state (`taskHistory` 堆栈) 管理导航历史，而非引入路由页面或嵌套 Modal。

## 背景

BACK-505 需要在任务详情中点击依赖项打开子任务详情，并支持返回和关闭整个堆栈。当前架构使用全局单 Modal 实例管理任务详情。

## 选项对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A. State 堆栈** (选中) | 完全复用现有 Modal 架构；返回/关闭逻辑简单；create/edit 模式不受影响 | 不支持浏览器前进/后退 |
| **B. 路由页面** (`/tasks/:id`) | 支持 URL 深链接和浏览器导航 | 需要将 Modal 改为独立页面，改动面极大；会破坏现有的全局 Modal 设计 |
| **C. Modal 嵌套** | 视觉上分层明显 | 多层 Modal 叠加体验差；关闭逻辑复杂（需逐层关闭） |

## 结果

采用方案 A。`App.tsx` 中新增 `taskHistory: Task[]`，`handleDrillDown` 压栈，`handleBack` 出栈，`handleCloseModal` 清空。`TaskDetailsModal` 的 `useEffect` 会在 `task` prop 变化时自动重置所有表单状态，无需额外处理堆栈切换。

## 参考来源
- [[sources/back-505]] — 原始实现任务
