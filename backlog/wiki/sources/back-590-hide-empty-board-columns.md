---
title: BACK-590 - 看板隐藏空状态列
labels: [source, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-590 - Hide-empty-board-columns-in-the-TUI.md
---

# BACK-590 - 看板隐藏空状态列

将已有的 `hideEmptyColumns` 设置接入 TUI 看板，并新增 Shift+H 切换。开启后空状态列消失；移动任务期间所有列临时恢复，保证每个放置目标可达。切换会持久化到共享的 `hide_empty_columns` 配置键，管道（非 TTY）输出应用同一过滤。

- `src/ui/board.ts`：新增导出的纯函数 helper `filterVisibleColumns(data, hideEmptyColumns, isMoving)`——开启且非移动状态时隐藏空状态列；全部为空时保留所有列以避免看板空白；isMoving 时保留每一列。
- `renderView` 从未过滤的投影派生 `currentStatuses`，使隐藏不会收窄移动目标；`filterVisibleColumns` 仅应用于渲染列。
- Shift+H 切换（`screen.key(['S-h'])`）：乐观翻转 → `core.fs.saveConfig`，失败时回滚并显示临时 footer，`pendingSettingWrite` 在途守卫；`closeBoard()` 在 q/C-c、Esc、Tab 及视图切换退出前等待未完成的写入，确保切换后立即退出不丢失。
- 管道分支一次性派生 `visibleStatuses` 并传给 `generateMilestoneGroupedBoard` 与 `generateKanbanBoardWithMetadata`（含 --milestones）。
- `src/ui/unified-view.ts` 传 `hideEmptyColumns: config?.hideEmptyColumns ?? false`；帮助弹窗新增 `{ key: 'H', desc: 'Hide/show empty columns' }`，默认 footer 不变。
- 测试：`src/test/board-hide-empty-columns.test.ts`，14 个测试，含配置往返与关闭竞态（84 pass / 4 Windows-PTY skips）。

## 验收标准

- 空列可开/关隐藏；移动模式恢复所有列；Shift+H 持久化到 hide_empty_columns；管道输出含 --milestones 均过滤；帮助弹窗有说明、footer 不变；测试覆盖 helper、render、move-mode、round trip。

## Related Concepts

- [[concepts/cli-tui]] — 看板渲染/持久化架构与 footer/帮助约定

## Related Sources

- [[sources/back-594-align-filter-footer-hint]] — 同一 footer 的内容约定
