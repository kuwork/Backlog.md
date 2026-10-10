---
title: BACK-573 - 隐藏空列时看板拖拽修复
labels: [source, migration, web-ui, bug, drag-and-drop]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-573 - Fix-web-board-drag-and-drop-when-hideEmptyColumns-is-enabled.md
---

# BACK-573 - 隐藏空列时看板拖拽修复

修复 `hideEmptyColumns` 开启时 Web 看板卡片无法拖拽的问题。`Board.tsx` 在 `dragstart` 处理器内同步翻转 `isDragging` 标志；该状态变化在 Chromium 仍在提交原生拖拽时重渲染看板并重新插入隐藏的空列，Chromium 于是中止拖拽。

## 实现要点

- 根因：`dragstart` 分发中的同步状态更新在 Chromium 拖拽提交中途改变了看板布局。
- 修复：在 `src/web/components/Board.tsx` 引入 `hiddenColumnsRevealed` 状态标志和 `revealHiddenColumnsTimer` ref。`handleColumnDragStart` 保持 `dragSourceStatus`/`dragSourceLane` 同步，但启动 `setTimeout(0)`，只在浏览器提交拖拽之后且 `hideEmptyColumns` 开启时才显示隐藏列。
- `handleColumnDragEnd` 取消未完成的显示定时器并重置 `dragSourceStatus`、`dragSourceLane`、`draggedTaskId` 和 `hiddenColumnsRevealed`；`useEffect` 清理在卸载时取消定时器。
- 在用延迟显示替换基于同步 `isDragging` 的 `visibleStatuses` 逻辑，泳道与非泳道渲染路径都改了。
- 拖拽进行中隐藏的空列仍作为放置目标出现，与 TUI 移动模式行为一致。
- 测试：新的 `src/test/web-board-drag-hidden-columns.test.tsx`（带 I18nProvider 包装），覆盖 dragstart 不变性、下一个任务时显示、放到显示的列、dragend 时重新隐藏、hideEmptyColumns 关闭行为。

## 验收标准

- hideEmptyColumns 开启时，卡片可以在 Chromium 的 Web 看板上拖拽放置。
- 拖拽期间隐藏的空列成为放置目标，与 TUI 移动模式一致。
- 保留贡献者署名；测试覆盖隐藏列开与关的拖拽。

## Related Concepts

- [[concepts/web-ui-features]] — 看板视图渲染与拖拽行为

## Related Sources

- [[sources/back-549-hide-empty-board-columns]] — 引入 hideEmptyColumns 功能（本 bug 回归的对象）
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 归类为条目 A2（必须合并，fork 在 Board.tsx 有相同 bug 模式）
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — WEB-1 深度分析（macrotask 显示修复的上游合并）
