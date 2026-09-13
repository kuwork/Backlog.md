---
title: 模态路由历史栈不变式
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels: [execution, web-ui, routing, modal]
---

# 模态路由历史栈不变式

## 适用场景

在 fork 中为 Web UI 添加任何"overlay 模态 + 可钻取"的路由（任务模态框、草稿模态框、搜索对话框）。

## 不变式

**每次 push 一个模态路由 = 浏览器历史栈 +1 = 模态内部栈（`taskHistory`）+1；每次 pop = 两者同时 -1。** 历史栈与模态栈必须严格 1:1。

## 标准步骤

1. 打开模态：`navigate(url, { state: { backgroundLocation: location } })`（push，携带背景）
2. 钻取到子项：同样 push 一层，并把子项压入 `taskHistory`
3. 返回箭头（钻取回退）：`navigate(-1)`——父条目已经是上一个历史条目，**不要** push 父 URL
4. 关闭模态：存在 `state.backgroundLocation` 时 `navigate(-1)`；仅当直接加载了无背景的模态 URL 时回退 `navigate(backgroundPath, { replace: true })`
5. 背景保持：`mainLocation = state?.backgroundLocation || location`，底层页面持续挂载；仅模态目标（`type === "task"`）携带背景，整页目标走普通 push
6. 状态分层：可分享的查询进 URL（`?q=&type=`），不进入 URL 的 UI 状态进 `location.state`（如 `visibleStartIndex`）

## 常见陷阱

| 陷阱 | 症状 | 修正 |
|---|---|---|
| 返回箭头 push 父 URL | 关闭后落回子模态，每层多按一次关闭 | 改为 `navigate(-1)`（BACK-627） |
| 关闭用 replace 背景路径 | 背景条目累积，打开 N 次需 N+1 次关闭 | 有背景时改 pop（BACK-624 第 7 轮） |
| 给整页路由挂 `backgroundLocation` | URL 变了但页面不渲染 | 只给模态目标挂（BACK-624 Bug A） |
| 用 `/?highlight=id` 打开模态 | 浏览器后退落到 `/` 而非重开背景对话框 | 直接 `navigate` 到 `/task/:id/:slug`（BACK-624） |
| 依赖 `setShowModal` 之类独立状态 | 与 URL 双写产生关闭竞态 | 模态可见性完全由 URL 派生 |

## 验证方式

按序列走查 `bg → 614 → 511`：箭头 pop 回 614，X 单次 pop 回 `bg`；从 `/search` 连续打开/关闭 N 个任务后，一次关闭即离开对话框。

## 参考任务

- [[sources/back-624-global-search-dialog]] — `/search` 背景 + 任务模态
- [[sources/back-627-back-arrow-history-fix]] — 返回箭头 pop
- [[sources/back-505]] — 原始钻取栈
- [[sources/stable-task-modal-urls-task]] — modal-over-route 起点

## Related Concepts

- [[concepts/spotlight-search]] — 该不变式的第一个非任务模态使用者
- [[concepts/web-ui-features]] — 模态框交互惯例簇
