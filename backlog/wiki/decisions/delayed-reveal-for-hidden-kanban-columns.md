---
title: 隐藏看板列的延迟 Reveal 用 setTimeout(0)
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 隐藏看板列的延迟 Reveal 用 setTimeout(0)

## 背景

BACK-573 在 `hideEmptyColumns` 开启时，用户拖拽任务经过隐藏列需要 reveal 该列。Chromium 在 `dragstart` 事件 dispatch 期间会提交原生拖拽。

## 决定

用 `setTimeout(0)` 把列 reveal 延迟一个 macrotask，而不是在 `isDragging` 变为 true 时同步变更布局。

## 理由

- Chromium 在 dragstart dispatch 期间对 DOM 布局的同步变更很敏感，会中止原生拖拽会话。
- 延迟一个 macrotask 后，拖拽已稳定启动，reveal 引起的布局变更不再干扰原生拖拽。
- 一个 macrotask 的延迟对用户不可感知，但足以跨越浏览器的拖拽启动窗口。

## 被否方案

- **同步 isDragging 标志驱动布局变更**：在 dragstart 期间触发 React 重排，Chromium 中止拖拽，拖动手感直接断裂。

## Related

- [[sources/back-573-web-board-dnd-hide-empty-columns]]
- [[concepts/web-ui-features]]
- [[concepts/browser-loading]]
