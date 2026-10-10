---
title: BACK-680 - 批量状态移动单次动作完成
labels: [source, cli, web-ui, core]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-680 - Move-multiple-selected-tasks-between-statuses-in-one-action.md
---

# BACK-680 - 批量状态移动单次动作完成

经一个共享 Core 原语在 CLI、Web 看板与（后来的）TUI 上批量状态移动。始于贡献者 PR #945（janosmiko），就地接手以保留署名，再经多轮维护者 QA 与评审返工；维护者否决了 TUI 多选流程并拆出 BACK-681。

- CLI：`task edit` 接受多个 ID；仅单任务可用的 flag（标题、描述、plan、备注、评论、ordinal、修改文件、清单项、最终摘要、AC/DoD、日期清除）在多 ID 调用中被拒；共享 flag 循环走现有单任务编辑路径，逐任务失败上报而不中断批次；无批次适用 flag 的多 ID 调用报错，而不是静默为第一个 ID 打开向导
- Core/服务器：`Core.moveTasksToStatus({taskIds, targetStatus, orderedTaskIds?, targetMilestone?})` 对每个任务解析与守卫一次，与 `reorderTask` 共享 id 解析/跨分支辅助函数（约 45 行重复移除），返回逐任务失败，并经 `calculateBlockOrdinals` 播种块 ordinal（count=1 等于 `calculateNewOrdinal` 中点计算）；暴露为 `POST /api/tasks/move`
- Web 看板：Ctrl/Cmd/Shift 多选、选择工具栏、单请求批量拖拽、拖拽幽灵徽标计实际移动的集合（在未选中卡片上 ctrl/cmd 按下拖拽在 dragstart 时加入选择）、折叠泳道与过滤对选择的修剪、原位释放经 `'self'` dropPosition 触发现有 `isOrderUnchanged` 守卫成为纯无操作
- 评审轮修复：去重用规范任务身份（前导零折叠、裸数字保留默认前缀）、跨分支卡片排除出批次写集、泳道级追加排序、已在状态任务的混合批次留任裁决、TUI 确认的双 Enter 守卫、批量拖拽插入指示器抑制
- TUI：维护者否决 m 键多标记流程（与列内重排冲突）；`src/ui/board.ts` 除 7 行 `movePending` 双 Enter 守卫外回到 main 的单任务 mover；多选拆到后续任务
- 测试：四个 BACK-680 套件 75 通过 / 0 失败（`cli-task-batch-edit`、`core-move-tasks-to-status`、`server-move-tasks-endpoint`、`web-board-batch-move`），回退矩阵 A–F，外加真实浏览器 CDP 验证（两卡片拖拽一次 `POST /api/tasks/move`；原位释放无请求）
- 文档更新：`agent-guidelines.md`、`cli-instructions/task-execution.md`、`CLI-INSTRUCTIONS.md`

## 验收标准

- CLI 批量编辑经单任务路径更新每个列出任务并逐任务上报失败，无批次适用 flag 时明确失败
- Web 批量移动经 `moveTasksToStatus` 路由；milestone 视图批量拖拽应用与单任务拖拽相同的 milestone 语义
- 批次中歧义/不可解析 ID 以逐任务错误 fail-closed；id 解析/跨分支守卫逻辑与 `reorderTask` 共享
- 自动化测试覆盖 CLI 批量编辑、逐任务失败、Web 批量移动与 milestone 泳道情形

## Related Concepts
- [[concepts/task-identity]] — 批量去重与 fail-closed 解析使用的规范 id 匹配
- [[concepts/task-lifecycle]] — 批量移动执行的状态转换
- [[concepts/milestones]] — 看板批量拖拽中的 milestone 泳道语义
- [[concepts/web-ui-features]] — 看板多选、拖拽幽灵与无操作落点守卫

## Related Sources
- [[sources/back-681-tui-shift-arrow-multi-select]] — 被拆出的 TUI 半部，消费 `orderedTaskIds`
- [[sources/back-505]] — 依赖钻取；早期看板交互先例
- [[sources/back-541-board-column-created-sort]] — ordinal 播种所构建的列排序上下文
