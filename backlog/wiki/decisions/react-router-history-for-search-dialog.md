---
title: 搜索对话框历史语义复用 React Router 而非裸 history API
description: BACK-624 PRD 的 pushState/popstate 契约映射到 Router 语义
labels: [decision, web-ui, routing]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# 搜索对话框历史语义复用 React Router 而非裸 history API

## 背景

BACK-624 的 PRD 按浏览器原生 API 描述历史行为：打开用 `pushState`、输入/切换过滤用 `replaceState`、关闭依赖 `popstate`。fork 的代码库中不存在任何裸 history API 调用——React Router 已接管 popstate，任务模态框路由（BACK-509）也建立在 `navigate` + `location.state` 之上。

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. 直接调用 `window.history.pushState/replaceState` 并自行监听 `popstate` | 与 PRD 字面一致 | 与 Router 状态双写、易打架；`location.state` 不可用；测试需 mock 原生 API |
| B. 复用 React Router：`navigate` push/replace、`navigate(-1)`、`location.state` | 与既有 modal 路由一致、单一状态源、可测试 | 需把 PRD 术语翻译为 Router 术语 |

## 决策

选择 **方案 B**。映射关系：打开 = push；输入/过滤变化 = `{ replace: true }`；关闭（Esc/×/遮罩/后退）= `navigate(-1)`；跨会话状态（`q`、`type`、`visibleStartIndex`）放 `location.state`，与 URL 查询参数分工——URL 表达可分享的查询，state 表达不进入 URL 的滚动位置。

## 影响

- 该映射后来成为 fork 中所有模态路由的通用不变式（[[execution/modal-route-history-invariant]]）
- PRD 与实现的偏差被显式记录在任务描述中，而不是静默偏离

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 实现
- [[sources/stable-task-modal-urls-task]] — BACK-509 建立的 modal-over-route 模式
