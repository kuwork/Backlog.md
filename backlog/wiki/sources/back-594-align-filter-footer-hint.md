---
title: BACK-594 - 统一看板与任务列表过滤 footer 提示
labels: [source, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-594 - Align-the-filter-footer-hint-between-TUI-kanban-and-task-list.md
---

# BACK-594 - 统一看板与任务列表过滤 footer 提示

看板 footer 显示 `[P/F/I] Filter`，任务列表显示小写 `[s/p/i/l] Filter`，且各视图帮助弹窗与自身 footer 不一致。现在两个 footer 统一为相同的大写斜杠分隔按键指示约定，顺序与共享过滤头部一致：看板 `[P/I/F]`（列即状态；L 用于列导航故 labels 绑定 F），任务列表 `[S/P/I/L]`。

- `src/ui/footer-content.ts`：在 `formatFooterContent` 旁导出 `BOARD_FOOTER_CONTENT` 与 `TASK_LIST_FOOTER_CONTENT` 常量，替换 `src/ui/board.ts`（删除 DEFAULT_FOOTER_CONTENT）与 `src/ui/task-viewer-with-search.ts` 中的内联字符串。
- 约定：大写字母是"按该键"的显示指示，不是 Shift 组合键；实际绑定键仍为小写。
- 顺序遵循共享过滤头部渲染顺序（`src/ui/components/filter-header.ts` 中 ALL_FILTER_ITEMS 去掉 search）：status、priority、milestone、labels。
- `src/ui/components/help-popup.ts`：看板过滤行重排为 P/I/F；任务列表行改写为大写 S/P/I/L，并加注释记录该约定。
- 未改任何键绑定；`footer-content.test.ts` 与 `help-popup.test.ts` 中的测试断言精确的字母集合与顺序（11 pass）；实时 PTY 抓取验证全部四个界面，审计确认五个 TUI 视图中所有提示按键均有活绑定。

## 验收标准

- 两个 footer 共享大小写/分隔符约定；各自按过滤头部顺序精确列出活过滤键（看板 [P/I/F]、任务列表 [S/P/I/L]）；帮助弹窗与各自 footer 一致；两个字符串均为导出常量并有测试。

## Related Concepts

- [[concepts/cli-tui]] — 各 TUI 视图的 footer/帮助弹窗内容约定

## Related Sources

- [[sources/back-590-hide-empty-board-columns]] — H 仅加入帮助弹窗时 footer 保持字节级不变
