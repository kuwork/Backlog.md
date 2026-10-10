---
title: BACK-681 - TUI shift 方向键多选移动
labels: [source, tui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-681 - TUI-multi-select-move-with-shift-arrow-recruitment.md
---

# BACK-681 - TUI shift 方向键多选移动

TUI 看板的 `m` mover 一次只能移动一个任务。本任务把维护者设计的多选招募移植到同一单任务 mover——Shift+Up/Down 走动高亮，`M` 把任务切换进移动集，确认经 `core.moveTasksToStatus` 带 `orderedTaskIds` 路由，集合落在幽灵预览的确切位置——BACK-680 批次原语的 TUI 半部。

- `src/ui/board.ts`：`MoveOperation` 泛化出 `selectedIds` 与 `highlightTaskId`；两者都为空时每个现有路径逐字节一致（单幽灵、经 `core.reorderTask` 确认）
- Shift+Up/Down 在目标列的招募行走动高亮（列减去抓起的任务，幽灵插回），跳过幽灵行、绝不触碰看板顺序；`renderView` 选择 `highlightTaskId ?? taskId`，青色移动模式条显示高亮而幽灵保留品红 `►`
- `M`/`S-m` 经 `updateMoveSelection` 切换高亮任务（重锚 `targetIndex` 使幽灵视觉上不动）；无高亮时招募最近的未招募非跨分支邻居，使 shift 方向键到不了的终端上流程仍可用
- 招募后首个普通方向键折叠高亮并预览整个集合以看板显示顺序落在同一相邻块；有活跃高亮时确认只折叠并渲染落点顺序，下一次确认才持久化
- `performSetMove` 在任何 await 前快照投影，守卫"落在原处"无操作，在瞬态页脚上报逐任务失败；`movePending` 在写入期间冻结方向键/招募/取消
- `closeBoard` 现在 first-request-wins（`closingBoard ??= ...`）并 await `pendingMoveWrite`——也堵上了单任务 mover 存在的同一退出竞态洞
- 新 `src/test/board-tui-move.test.ts`，21 用例从上游键盘测试架套件移植；环境发现：持久化移动花 1.5–4s（需 40x250ms 轮询），在仓库外构建测试项目消除了使套件又慢又飘的 `git fetch origin --prune` 向上遍历
- 证据边界：本机无真 pty；上游的 `board-tui-multi-move-pty.test.ts` 刻意不移植（原始 `ESC[1;2B` 经 `expect` 无法在 win32 运行）

## 验收标准

- 无招募时 `m` 加普通方向键与单任务 mover 逐字节一致
- Shift+方向键走动视觉可辨的高亮而不移动抓起任务；`M` 以现有 `►` 指示器切换成员；招募任务保持原位直到确认
- 确认经 `core.moveTasksToStatus` 带 `orderedTaskIds` 移动集合；逐任务失败上报而其余仍移动；相同落点不写任何东西；Esc 清除一切
- `closeBoard` 幂等并 await 进行中的已确认写入；页脚提示与帮助弹窗 `M` 条目记录按键

## Related Concepts
- [[concepts/cli-tui]] — 看板 mover 与键盘测试架约定
- [[concepts/task-identity]] — 招募拒绝中的跨分支与规范 id 规则

## Related Sources
- [[sources/back-680-batch-status-move]] — 提供本确认路径调用的 Core `moveTasksToStatus` / `orderedTaskIds` 原语
- [[sources/back-588-vim-keys-boundary-navigation]] — 同一 mover 面上的早期看板键盘工作
