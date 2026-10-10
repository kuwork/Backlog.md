---
title: BACK-587 - TUI 任务创建器交互修复
labels: [source, tui, cli]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-587 - Repair-TUI-task-composer-UX-and-navigation.md
---

# BACK-587 - TUI 任务创建器交互修复

修复重建的 TUI 任务创建器中的三个交互缺陷：单选 picker 打开时高亮首行而非当前值，多选 picker 渲染重复的 `id - title` 标签，帮助弹窗固定高度在窄终端裁掉最后一行。

## 实现要点

- `src/ui/components/filter-popup.ts`：单选 picker 构造后调用 `picker.select(selectedIndex)`，打开时高亮当前值，Enter 确认。
- 多选 picker 传 `itemRenderer: (item) => item.title`，选项只渲染一次标签文本，而不是默认的 id - title 重复。
- `src/ui/components/help-popup.ts`：新的 `getHelpPopupHeight` 按内容定尺寸、夹在 `screenHeight - 2`（最小 5），并经由可滚动视口渲染，支持上下滚动和底部滚动提示。
- 既有创建器导航、光标/多行编辑、Tab 惰性、picker 激活和创建/取消行为不变。
- 测试：help-popup 夹紧用例、generic-list 默认 vs itemRenderer 渲染、composer 和 filter-header 套件（四个文件共 20 pass / 0 fail）。

## 验收标准

- 单选 picker 打开时高亮当前值；多选经 itemRenderer 渲染；帮助弹窗按内容定尺寸并可滚动；所有既有创建器行为保留；回归测试覆盖三个修复。

## Related Concepts

- [[concepts/cli-tui]] — TUI 组件模式（picker、弹窗、列表）
