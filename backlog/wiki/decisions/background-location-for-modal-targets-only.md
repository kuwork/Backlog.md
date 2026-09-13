---
title: backgroundLocation 只挂给模态目标
description: BACK-624 任务走模态、文档/决策/wiki 走整页 push
labels: [decision, web-ui, routing]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# backgroundLocation 只挂给模态目标

## 背景

搜索结果打开目标时，任务/草稿、文档、决策、wiki 四类混在同一个列表里。任务与草稿在 fork 中是 overlay 模态路由（`/task/:id/:slug`、`/draft/:id/*`），文档/决策/wiki 是整页路由（`/documentation/:id/:slug`、`/decisions/:id/:slug`、`/wiki/:path`）。

## 问题

统一为所有结果挂 `state.backgroundLocation` 时，文档/决策/wiki 结果"URL 变了但不渲染"：App 把 `backgroundLocation` 当作底层页面，于是没有任何整页组件被挂载。

## 决策

`isModalSearchTarget(result)` 只对 `type === "task"` 返回 true：

- 模态目标：`navigate(url, { state: { backgroundLocation: location } })`，底层保持 `/search`，关闭后回对话框
- 整页目标：普通 push，无 backgroundLocation，浏览器 back 回到 `/search`

## 影响

- 该判定是"目标是否模态"的唯一来源，避免在多个调用点重复推断路由类型
- 与 [[decisions/pop-over-push-for-modal-back]] 配合：只有真正带 `backgroundLocation` 的条目才以 pop 关闭

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 实现与 Bug A 修复
