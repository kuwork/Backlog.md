---
title: BACK-682 - Web 看板多选落点位置插入
labels: [source, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-682 - Insert-a-web-board-multi-selection-at-a-chosen-position.md
---

# BACK-682 - Web 看板多选落点位置插入

单卡 Web 看板落点遵守落点位置，但多选落点静默追加到列尾，因为批量路径从不传 `orderedTaskIds`。本任务把位置感知批量落点端到端接通，并统一手动排序规则：任何重写列顺序的落点使该列的手动排序退役，被外来拖拽悬停的列在访问期间让出排序。BACK-684 的排序让渡变更并入本记录。

- `src/server/index.ts`（`handleMoveTasks`）：读取可选 `orderedTaskIds`，非空时转发，把契约违约（顺序遗漏被移动任务、重复 id）映射为 400 客户端错误
- `src/web/lib/api.ts`：`MoveTasksPayload.orderedTaskIds?: string[]`，原样转发
- `src/web/components/Board.tsx`：`selectionOrderIds` memo（按看板阅读顺序的选择）替换每次调用重算；`handleBatchMove` 从 memo 构建顺序，落点指定顺序时跳过基于状态的无操作测试
- `src/web/components/TaskColumn.tsx`：一个 `resolveInsertion` 辅助函数为单卡和批量落点把落点映射为下标；`isDragFromSameColumn` 比较状态加泳道（有泳道时一列是 (lane, status)，不只是状态）；排序在未变顺序守卫之后退役；批量拖拽不再抑制插入指示器
- 排序让渡（并入的 BACK-684）：`getDisplayTasks` 在来自另一列的拖拽悬停该列时把读取者排序读为 `null`，指示器与落点按落点将写入的默认顺序解析；掠过或取消的拖拽保留读取者排序
- 验证：四个看板套件 69 个 JSDOM 用例、端点用例、八变体回退矩阵（`tmp/rollback-682.py`）、实测 CDP 拖拽——两卡落点恰好发一个同时带 `taskIds` 与 `orderedTaskIds` 的 `POST /api/tasks/move`，拖入手动排序列把它翻为默认顺序并把卡片落在邻居之间 ordinal 4500
- 记录的陷阱：JSDOM 落点必须在列内分发（冒泡只向上走），只触 `drop` 的落点辅助看不到列自己的拖拽状态——辅助必须重放 `dragenter`

## 验收标准

- `POST /api/tasks/move` 接受可选 `orderedTaskIds`；无它时追加行为不变；破损顺序为 400，失败 id 落在 `failures`
- 批量落点到卡片上把选择插入该下标（看板顺序而非点击顺序）；空白仍追加；同列重定位可用，原位释放不写任何东西
- 任何重写列顺序的落点使该列手动排序退役——跨状态、同状态跨泳道与同列重排一视同仁
- 多选拖拽在落点将遵守的位置上显示插入指示器；实测 CDP 检查确认单请求带两个字段

## Related Concepts
- [[concepts/web-ui-features]] — 看板拖拽与列排序语义
- [[concepts/milestones]] — 泳道感知的列身份（(lane, status) 而非仅状态）

## Related Sources
- [[sources/back-680-batch-status-move]] — 在 Core 引入 `orderedTaskIds`；本任务从 Web 面传它
- [[sources/back-681-tui-shift-arrow-multi-select]] — 同一位置原语的 TUI 消费方
- [[sources/back-504]] — 本任务推广的手动排序退役规则发源地
