---
title: BACK-499 修复侧边栏折叠按钮与调整大小手柄重叠
labels: [source]
source_path: backlog/tasks/back-499 - Fix-sidebar-collapse-button-overlapping-resize-handle.md
created_date: 2026-05-30 10:20
updated_date: 2026-05-30 10:20
---

# BACK-499 修复侧边栏折叠按钮与调整大小手柄重叠

**状态**: Done | **标签**: web-ui, bug | **优先级**: medium

修复侧边栏折叠按钮（toggle collapse）与 BACK-483 引入的 resize handle 之间的鼠标事件冲突。

## 问题现象

- **Hover 干扰**：鼠标悬停在折叠按钮上时，resize handle 的 `hover:bg-blue-400/50` 效果被触发，出现蓝色 ghost bar
- **拖拽干扰**：点击折叠按钮时，resize handle 的 `onMouseDown` 抢先捕获事件，导致进入 resize 模式而非折叠侧边栏

## Root Cause

Z-index 层级错误：resize handle 为 `z-20`，折叠按钮为 `z-10`，resize handle 覆盖在按钮上方。

## 修复方案

将折叠按钮的 `className` 从 `z-10` 提升至 `z-30`，使其位于 resize handle（`z-20`）之上，优先接收鼠标事件。

**修改文件**：`src/web/components/SideNavigation.tsx`（单行 z-index 调整）

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览（含侧边栏调整大小）

## Related Sources
- [[sources/sidebar-resize-search-task]] — BACK-483 侧边栏调整大小与搜索类型下拉
