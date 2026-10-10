---
title: BACK-568 - Core 唯一浏览器任务边界
labels: [source, server, web-ui, core]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-568 - Make-Core-the-sole-browser-task-boundary.md
---

# BACK-568 - Core 唯一浏览器任务边界

让 Core 成为浏览器任务读写的唯一边界，消除重复文件系统读取和重排操作后的全量语料刷新。

## 实现要点

- `src/server/index.ts`：`handleUpdateTask` 和创建任务的父级解析现在经 `core.getTask` 解析，不再二次读取文件系统；`AmbiguousTaskIdError` 表现为 `409`。
- `tasks-updated` WebSocket 广播去抖（75ms），批量更新只发布一次；定时器在 `stop()` 时清除。
- `handleReorderTask` 返回 `changedTasks`；`src/web/lib/api.ts` 类型更新；`App.tsx` 应用 `applyReorderedTasks` 原子合并；`Board.tsx` 直接应用载荷而不做全量刷新。
- `src/core/task-identity-index.ts` 扩展 `withWorkingCopyCorpus`、`withRecord`、`getFingerprint`。
- `src/core/content-store.ts` 保存轻量 `TaskCorpusSnapshot`（activeTasks/completedTasks 分离 + 索引解析），以 `resolveTaskForRead`/`resolveTaskForMutation` 桥接到 Core；未移植上游 publication-owner 机制。
- 修复潜在缺口：`FileSystem.findTaskFilePaths` 检测同 ID 在不同任务文件路径的冲突，使 `Core.getTask` 的歧义检测真正生效。

Fork 的 ContentStore 是深度重写，没有上游 publication-owner/batchTaskUpdates 体系，因此语料快照保持轻量并桥接到现有 Core 语义。

## Related Concepts

- [[concepts/core-architecture]] — Core 与 ContentStore
- [[concepts/web-server]] — 服务器 WebSocket 与处理器架构
- [[concepts/task-identity]] — 任务身份索引

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — 共享任务身份
