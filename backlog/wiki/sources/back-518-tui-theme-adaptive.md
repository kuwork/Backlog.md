---
title: BACK-518 TUI 主题自适应渲染：移除硬编码颜色
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, enhancement, ui, tui, board, ux]
source_path: backlog/tasks/back-518 - TUI-theme-adaptive-rendering-remove-hardcoded-colors.md
---

# BACK-518 TUI 主题自适应渲染：移除硬编码颜色

TUI 改进，提升终端主题兼容性。移除硬编码的 ANSI 颜色，改用反色（inverse-video）高亮，使界面在任何终端主题（包括单色配色）下都能正常工作。

## 变更

### 主题自适应颜色（反色）

- 从屏幕/容器元素中移除所有硬编码的 `fg: "white"` 和 `bg: "black"`
- 高亮/选中样式使用 `inverse: true` + `bold: true` 代替命名颜色
- 看板（Board）活动高亮：反色 + 粗体；移动模式：反色 + cyan 背景
- 筛选器头部聚焦/失焦：反色 + 粗体，代替硬编码的 blue/cyan/black
- 通用列表选中行：反色 + 粗体，代替 `bg: blue`
- 筛选器弹窗（状态/优先级/里程碑/标签）：选中项和悬停使用反色 + 粗体
- 弹窗上的 Esc 按钮：反色 + 粗体
- 语义上的 "white" 改为 "gray"，用于状态图标（待办）、三级标题和优先级回退
- 代码路径高亮从 gray 改为 cyan，以提升跨主题可见性

### 筛选器导航修复

- 状态/优先级选择器：仅当位于最后一项时，按下箭头才退出到任务列表（此前在任何项上按向下都会立即退出）

## 修改的文件

`tui.ts`、`board.ts`、`generic-list.ts`、`filter-header.ts`、`filter-popup.ts`、`task-viewer-with-search.ts`、`loading.ts`、`overview-tui.ts`、`status-icon.ts`、`heading.ts`、`code-path.ts` 及对应的测试文件。

## 相关概念
- [[concepts/tui-theme-adaptive]] — 使用反色的终端主题自适应渲染
- [[concepts/cli-tui]] — TUI 架构与组件

## 相关来源
- [[sources/back-470-4-tui-docs-task-comments]] — TUI 评论渲染（使用相同的主题自适应模式）
