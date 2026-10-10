---
title: BACK-567 - 跨分支同路径任务同一身份
labels: [source, core, identity, git]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-567 - Treat-same-path-cross-branch-task-versions-as-one-identity.md
---

# BACK-567 - 跨分支同路径任务同一身份

引入以规范 ID 加归一化仓库相对逻辑路径为键的共享任务身份，使同一任务的跨分支版本合并而不是冲突。

## 实现要点

- 新增 `src/core/task-identity-index.ts`：按 `canonicalTaskId + normalizeRecordPath` 分组记录；确定性胜者（工作副本优先，其次最新，再次进展最多）；不同活动路径抛 `AmbiguousTaskIdError`；全部归档的身份隐藏并释放 ID。
- 在 `src/utils/task-path.ts` 新增 `canonicalTaskId` helper，实现补零不敏感的点数十进制分组。
- `src/core/task-loader.ts`：分支记录将补全的内容挂到索引路径上。
- `src/core/backlog.ts`：移除 `buildLatestStateMap` 和 `filterTasksByStateSnapshots`；`loadTasks`/`loadAllTasksForStatistics` 构建一个 `TaskIdentityIndex` 并经 `getTasks(includeCompleted)` 投影；`getTask` 检测歧义 ID 并 fail-closed。
- `src/server/index.ts` 的 `handleGetTask`：经 `core.getTask` 解析，歧义时返回 `409` 和候选列表。
- 等时间戳解析现在是确定性的、与扫描顺序无关，修复了活动 ID 释放竞态。

保留 fork 的 `cross-branch-tasks.ts` `getLatestTaskStatesForIds`（仅最近分支语义）驱动 TUI 看板过滤；只有身份/合并层被替换。日期解析使用 fork 的 `getStoredUtcTimestamp`。

## Related Concepts

- [[concepts/task-identity]] — 共享任务身份模型
- [[concepts/core-architecture]] — Core 数据流

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — Core 浏览器边界建立在身份索引之上
