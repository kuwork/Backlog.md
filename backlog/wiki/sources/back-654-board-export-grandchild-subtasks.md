---
title: BACK-654 - 看板导出纳入孙级子任务
labels: [source, cli, board-export, task-hierarchy, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-654 - Include-grandchild-subtasks-in-board-export-grouping.md
---

# BACK-654 - 看板导出纳入孙级子任务

Markdown 看板导出把每个状态列构建为顶层任务加它们的直接子任务；父任务本身是子任务的孙级任务被挂到中间 ID 名下，而输出循环从不遍历它，于是孙级任务从导出中悄悄消失。本任务按现有 children 映射对每列做深度优先展平。

- `generateKanbanBoardWithMetadata`（`src/board.ts:128-147`）现在用 `pushWithChildren` 递归沿现有 children 映射深度优先构建最终列列表；每层保持 ID 升序，孙级任务保留单个 `└─` 子任务前缀——不引入新的缩进形态
- 扁平父子输出逐字节一致：精确输出测试在修复前与修复后代码上都通过，改动 hunk 与上游 ea809c223 逐字节一致
- `buildKanbanStatusGroups` 不动（它只按状态分区，从不嵌套）；`generateMilestoneGroupedBoard` 经检查刻意未改——其小节构建器把该状态下每个任务直接映射为一行，不会丢孙级任务；改用测试钉住这一点
- 测试：`src/test/board.test.ts` 新增三个用例——嵌套父/子/孙精确输出、扁平父/子精确输出、里程碑看板孙级用例
- 经 tsc、Biome、六个文件共 42 个看板测试加 7 个看板 CLI 用例验证，回退检查恰好只有嵌套用例变红

## 验收标准

- 子任务的子任务出现在导出的看板中，与其祖先同列、紧邻自己的父任务之下
- 扁平父子导出输出不变（顺序、`└─` 前缀、行内容均相同）
- 展平按现有 children 映射深度优先进行，每层 ID 升序
- 回归测试以精确期望输出钉住嵌套链与扁平用例；里程碑看板由孙级用例覆盖、无需改代码

## Related Concepts

- [[concepts/upstream-migration]] — 移植自上游 BACK-659（commit ea809c223）
- [[concepts/task-lifecycle]] — 导出现在完整遍历的父子层级

## Related Sources

- [[sources/back-653-readme-board-export-in-memory]] — 兄弟看板导出修复；BACK-653 婉拒了本任务报告同样指出的非变更排序
- [[sources/subtask-grouping-fix]] — BACK-496 看板/列表视图子任务分组
- [[sources/back-628-task-hierarchy-section]] — Web 任务模态框中的层级渲染
