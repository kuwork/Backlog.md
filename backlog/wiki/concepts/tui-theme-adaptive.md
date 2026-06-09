---
title: TUI 主题自适应渲染
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [concept, tui, ui, terminal, accessibility]
---

# TUI 主题自适应渲染

终端 UI 渲染策略，避免硬编码 ANSI 颜色，使用反色（`inverse: true` + `bold: true`），使高亮在任何终端主题（包括单色配色）下都保持可见。

## 动机

硬编码的 `fg: "white"` / `bg: "black"` 或 `bg: "blue"` 在浅色主题、高对比度主题和单色终端（例如 Ghostty Retro）上会失效。反色将颜色选择委托给终端模拟器，确保在任何地方都可见。

## 模式

- **看板（Board）活动高亮**：`inverse + bold`（代替命名颜色）
- **看板移动模式**：`inverse + cyan bg`
- **筛选器头部聚焦/失焦**：`inverse + bold`（代替 blue/cyan/black）
- **通用列表选中行**：`inverse + bold`（代替 `bg: blue`）
- **筛选器弹窗选中/悬停**：`inverse + bold`（代替 `bg: blue` / `fg: white`）
- **Esc 标记**：`inverse + bold`
- **状态图标（待办）**：`"gray"` / `"default"`（代替 `"white"`）
- **三级标题**：`"gray"`（代替 `"white"`）
- **优先级回退**：`picocolors.gray`（代替 `picocolors.white`）
- **代码路径高亮**：`cyan-fg`（代替 `gray-fg`）

## 例外

背景遮罩覆盖层（`task-viewer-with-search.ts` 中的 `bg: "black"`）有意保持不变，因为它们是结构性覆盖层，而非可选中/高亮的文本。

## 相关概念
- [[concepts/cli-tui]] — TUI 架构与组件

## 相关来源
- [[sources/back-518-tui-theme-adaptive]] — BACK-518 实现任务
- [[sources/back-470-4-tui-docs-task-comments]] — TUI 评论渲染（使用相同模式）
