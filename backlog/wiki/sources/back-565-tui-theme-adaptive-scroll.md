---
title: BACK-565 - TUI 主题自适应渲染与滚动
labels: [source, tui, theme, accessibility]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-565 - Add-theme-adaptive-rendering-scroll-improvements-and-stable-Tab-view-switching-to-TUI.md
---

# BACK-565 - TUI 主题自适应渲染与滚动

清除 TUI 部件中残留的硬编码 ANSI 颜色，并修复看板与任务列表之间不稳定的 Tab 切换。

## 实现要点

- `src/ui/tui.ts`：新增 `addScrollKeys(widget, screen)` helper（PageUp/PageDown/Home/End），接入 `scrollableViewer`（同时新增滚动条指示器）。
- `src/ui/components/generic-list.ts`：通过 `moveTo` helper 新增 pageup/C-u、pagedown/C-d、home、end 绑定；默认边框色从蓝色改为默认色。
- `src/ui/loading.ts`：加载框边框从青色改为默认色。
- 保留 fork 有意为之的看板移动状态青色高亮。
- 修复 Tab 视图切换：跨屏幕复用同一个 blessed `program`，并包装 `screen.destroy` 以移除累积的 key/keypress 监听器而不销毁共享 program。

每个屏幕新建 program 会在第一个屏幕销毁后使第二个屏幕的 stdin 输入失效；共享 program 上残留的监听器会使下一个屏幕崩溃。共享 program 修复已在两个切换方向上做 PTY 验证。

## Related Concepts

- [[concepts/cli-tui]] — TUI 看板与任务列表
- [[concepts/tui-theme-adaptive]] — 主题自适应渲染基础

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — 早期 TUI 主题自适应工作
