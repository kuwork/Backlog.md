---
title: BACK-588 - vim 键在导航边界留在列表内
labels: [source, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-588 - Keep-vim-keys-inside-the-list-at-navigation-boundaries.md
---

# BACK-588 - vim 键在导航边界留在列表内

在任务列表、详情窗格和看板中，在导航边界按 j/k 过去会把焦点交给搜索输入框——这让 vim 用户感到意外。现在 j/k 在边界处留在列表内，而方向键保留交给搜索的行为；/ 和 Ctrl+F 仍直接聚焦搜索。未新增配置键。

## 解决方案

- `src/ui/components/generic-list.ts`：新增 `BoundaryNavigationKey` 类型（"arrow" | "vim"）传递到 `onBoundaryNavigation`；up/k 与 down/j 绑定被拆分，各自上报键族。无边界处理器的列表（过滤器弹窗、选择器）对两种键族保持循环环绕。
- `src/ui/task-viewer-with-search.ts`：`shouldMoveFromListBoundaryToSearch` 被 `resolveListBoundaryNavigation(direction, selectedIndex, total, key)` 取代，返回 move/search/stay；stay 被消费，使 j/k 既不环绕也不交出焦点。`shouldMoveFromDetailBoundaryToSearch` 接收键类型；详情窗格分别绑定 up 和 k，使 k 落到内置的截断滚动。
- `src/ui/board.ts`：屏幕级 up/k 与 down/j 处理器合并为 `moveBoardSelection(direction, key)`；空列特殊情况成为 resolver 的空列表分支。
- 测试：resolver/详情单元测试加上 `tui-vim-boundary-navigation.test.ts` 中真实按键的 GenericList 测试（上游 board-render 集成块被移除，因为 fork 的 FilterHeader 渲染在测试 harness 中崩溃）。

## 验收标准

- 最后一行按 j / 首行按 k 在全部三个界面（含空列）保持焦点原地不动；方向键保留搜索交接；斜杠/Ctrl+F 不变；过滤器弹窗保持循环环绕；测试驱动真实按键事件。

## Related Concepts

- [[concepts/cli-tui]] — GenericList 边界/导航架构

## Related Sources

- [[sources/back-589-vi-navigation-filter-popups]] — 姊妹任务，将 j/k 接入过滤器弹窗
