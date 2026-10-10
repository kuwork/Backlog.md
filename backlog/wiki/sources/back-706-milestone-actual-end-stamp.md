---
title: BACK-706 - 末个任务达终态时盖印 actual_end
labels: [source, milestones, core]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-706 - Stamp-a-milestones-actualEnd-when-its-last-task-reaches-a-terminal-status.md
---

# BACK-706 - 末个任务达终态时盖印 actual_end

BACK-493 分支本想自动盖印 milestone 的 `actual_end`，但永远不可能触发：它通过 `fs.listTasks()` 判断任务集合，而此刻被翻转的任务在磁盘上还是保存前的状态，因此 `every(isTerminalStatus)` 永远为 false。本任务让该分支在判断前把被翻转任务解析到新状态。

## 解决方案

- 用一次性 corpus 加埋点证明了死分支诊断：`listTasks()` 返回 "TASK-1:Done, TASK-2:In Progress"，而 TASK-2 正被翻转为 Done，因为 `saveTask` 在 milestone 代码块之后才运行；真实仓库证据吻合（m-9 只有 `actual_start`）
- 修复在 `src/core/backlog.ts`（`updateTask`，milestone 自动填充）：在做全终态判断前，按 id 把被翻转任务在 `listTasks()` 结果中解析到新状态；写入点、守卫（任务有 milestone、milestone 可加载、`actual_end` 未设置）与保存顺序不变
- 刻意保持原状（已在描述中记录）：`POST /tasks/:id/complete` 是裸重命名，既不填任务日期也不填 milestone 日期；直接以终态创建的任务不会关闭其 milestone；draft 与归档任务对 `listTasks()` 不可见，永不阻塞关闭
- `src/test/milestone-timestamps.test.ts` 中的回归测试：`actual_end` 只在最后一个任务翻转后出现；已设置的 `actual_end` 与不触发关闭的过渡保持不动；mutation check 确认新用例在没有修复时变红
- 关卡：`tsc`/biome 无告警；五个 milestone 套件共 79 通过，外加服务端/web milestone 时间戳套件 13 通过；在真实的一次性 corpus 上端到端验证

## 验收标准

- 翻转最后一个活跃任务会盖印 `actual_end`；仍有未完成任务的 milestone 不盖印
- 已有的 `actual_end` 与无关过渡保持不动
- 最后任务与仍有未完成任务两种情形都有回归覆盖

## Related Concepts

- [[concepts/milestones]] — 本任务补全的 milestone 生命周期日期
- [[concepts/task-lifecycle]] — 驱动盖印的终态过渡

## Related Sources

- [[sources/milestone-actual-dates-task]] — 更早的 milestone 实际日期字段工作
- [[sources/actual-dates-auto-create-task]] — 任务级 actual_start/actual_end 自动盖印
