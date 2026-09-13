---
title: 模态框关闭使用 replace 替代 navigate(-1)
description: BACK-509 消除关闭竞态，避免历史残留（已被 BACK-624/627 取代）
labels: [decision, web-ui, routing, modal, superseded]
created_date: '2026-06-05 15:19'
updated_date: '2026-09-13 01:12'
---

# 模态框关闭使用 replace 替代 navigate(-1)

> **⚠️ 已被取代（2026-09-13）**：BACK-624 引入可被模态覆盖的 `/search` 背景后，`replace` 会导致背景条目累积（打开 N 个任务需 N+1 次关闭）。现行规则是"每个模态层级 pop 一个历史条目"，见 [[decisions/pop-over-push-for-modal-back]]。本文仅保留为**直接加载无 `backgroundLocation` 的模态 URL** 时的回退路径。

## 背景

BACK-509 早期使用 `navigate(-1)` 关闭模态框，但出现两个问题：
1. 历史栈中残留 `/task/:id` 条目，用户点击浏览器返回会重新打开已关闭的任务
2. `setShowModal(false)` 与 `navigate(-1)` 产生竞态，模态框状态与 URL 不同步

## 备选方案

| 方案 | 优点 | 缺点 |
|---|---|---|
| A. `navigate(backgroundPath, { replace: true })` | 无历史残留，无竞态 | 需显式计算背景路径 |
| B. `navigate(-1)` + 历史清理 | 简单 | 竞态和残留问题 |
| C. `window.history.back()` | 直接 | 无法控制，与 React Router 冲突 |

## 决策

选择 **方案 A**。

## 实现

```ts
navigate(backgroundPath, { replace: true });
```

- 关闭模态框时 `replace` 当前历史条目为背景页面路径
- 浏览器后退不会重新打开模态框
- 与 `setShowModal(false)` 无时序依赖

## 相关来源
- [[sources/stable-task-modal-urls-task]] — BACK-509 实现
