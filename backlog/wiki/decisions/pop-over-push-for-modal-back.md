---
title: 模态框返回与关闭改为 pop 而非 push/replace
description: BACK-624/627 修正历史栈与模态栈的 1:1 不变式
labels: [decision, web-ui, routing, modal]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# 模态框返回与关闭改为 pop 而非 push/replace

## 背景

BACK-509 曾决定"模态框关闭使用 `navigate(backgroundPath, { replace: true })` 替代 `navigate(-1)`"，理由是消除历史残留与 `setShowModal` 竞态（[[decisions/replace-over-navigate-minus-one]]）。

BACK-624 引入 `/search` 作为可被模态框覆盖的背景后，该决策的副作用暴露：

1. 每次从搜索对话框打开任务模态框再关闭，`replace` 都会把当前历史条目改写为背景路径，背景条目不断累积——打开 N 个任务后需要 N+1 次关闭才能离开对话框
2. 钻取到依赖任务后，返回箭头用 push 写回父任务 URL（BACK-627），留下未消费的子任务历史条目，下一次关闭又会落回子模态框

## 决策

**修正为**：每个模态层级恰好消费一个历史条目。

- `handleCloseModal`：存在 `state.backgroundLocation` 时执行 `navigate(-1)`（pop）；仅在直接加载了无背景的模态 URL 时回退到 `navigate(backgroundPath, { replace: true })`
- `handleBack`（钻取返回箭头）：执行 `navigate(-1)`，不再 push 父任务 URL——父条目本就是上一个历史条目
- 不变式：**每次 push 一个模态路由 = 历史栈 +1 = taskHistory +1**；每次 pop = 两者同时 -1

## 为什么 509 的竞态担忧不再成立

关闭竞态源于早期 `setShowModal(false)` 与 `navigate(-1)` 的时序耦合；当前关闭路径完全由 URL 驱动（`taskIdFromUrl` 派生模态可见性），不再有独立的 `showModal` 状态，因此 pop 不引入竞态。509 的残留问题由"1:1 消费"而非 `replace` 解决。

## 取代关系

本决策 **取代** [[decisions/replace-over-navigate-minus-one]]；后者仅保留为直接加载模态 URL（无 `backgroundLocation`）时的回退路径。

## Related Sources

- [[sources/back-624-global-search-dialog]] — 发现背景条目累积
- [[sources/back-627-back-arrow-history-fix]] — 修正返回箭头
- [[sources/back-505]] — 钻取导航与返回箭头来源
