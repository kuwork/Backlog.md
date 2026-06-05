---
title: 使用 backgroundLocation 实现模态框背景保持
description: BACK-509 采用 React Router state 模式保持模态框底层页面可见
labels: [decision, web-ui, routing, modal]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
---

# 使用 backgroundLocation 实现模态框背景保持

## 背景

BACK-509 需要任务详情模态框打开时，底层页面（看板、任务列表等）保持可见，且关闭后回到原页面。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. React Router backgroundLocation state | 官方推荐模式，与路由深度集成 | 需要重构 Routes 渲染逻辑 |
| B. 全局 Modal 覆盖层（z-index） | 简单，不改路由 | URL 不反映模态框状态，无法分享 |
| C. 嵌套路由 + 布局保持 | 结构清晰 | 所有页面需支持嵌套，侵入性大 |

## 决策

选择 **方案 A**。

理由：
1. 模态框状态必须可分享（`/task/:id` 直接访问）
2. backgroundLocation 是 React Router 原生支持的 Modal Route 模式
3. `Routes` 通过 `location={state.backgroundLocation \|\| location}` 渲染背景页面，模态框在 `Routes` 外部渲染，逻辑清晰

## 实现要点

- `navigate('/task/:id', { state: { backgroundLocation: location } })`
- `Routes` 使用 `location={state.backgroundLocation || location}`
- 模态框受 `showModal` state 控制，独立于路由

## 相关来源
- [[sources/stable-task-modal-urls-task]] — BACK-509 实现
