---
title: BACK-571 - 并发任务编辑快速失败锁
labels: [source, migration, concurrency, core, bug]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-571 - Fail-fast-instead-of-silently-losing-concurrent-task-edits.md
---

# BACK-571 - 并发任务编辑快速失败锁

堵住任务编辑漏斗中一个静默丢数据的洞：`updateTaskFromInput` 是一个无锁的读-改-写，被 CLI `task edit`、MCP `update_task` 工具和 Web PUT 处理器共享，因此同一任务的两次并发编辑会静默丢失一次写入，而两边都报告成功。修复方案是文件系统级、快速失败的每任务锁（proper-lockfile，`retries: 0`），可跨独立的 backlog 进程生效；冲突时失败方立即得到错误，不等待、不合并、不自动重试。Web 返回 HTTP 409，MCP 报 `OPERATION_FAILED`，CLI 以非零码退出。

## 实现要点

- `src/file-system/operations.ts`：将 `withCreateLock` 共享的 proper-lockfile 机制提取为私有 `withLockTarget(target, lockDir, settings, toError, fn)`，并在旁边新增 `FileSystem.withTaskLock(task, fn)`；新错误码 `ETASKLOCK`，带 `isTaskLockError` / `taskLockErrorMessage(taskId)`，产出 `Edit failed: <id> is being modified by another process; retry if appropriate.`
- 锁目标是任务文件本身（proper-lockfile 按目标路径键控进程内注册表，因此每任务锁文件路径会破坏进程内并发锁）；锁文件位于项目的 backlog 目录下；过期超时 10s。
- `src/core/backlog.ts`：用 `fs.withTaskLock` 包裹 `updateTaskFromInput` 和 `demoteTaskWithUpdates`，并在锁内重读——重读是正确性要求而非合并手段，因此临界区覆盖读取。锁定 `demoteTaskWithUpdates` 本身封住了 MCP `editTaskOrDraft` 路径的漏斗；锁顺序恒为任务锁 → 创建锁（无死锁）。
- 错误透出：Web PUT `/api/tasks/:id` 返回 409（扩展 `src/server/index.ts` 中 `isCreateLockError` 的映射）；MCP `task_edit` 抛 `BacklogToolError` `OPERATION_FAILED`（`src/mcp/tools/tasks/handlers.ts`）；CLI 无需改动（`formatTaskEditError` 已打印该信息并以 1 退出），并由测试锁定。
- `USE_GLOBAL_TASK_ID_LOCK=false` 逃生舱可绕过锁（自上游保留）。
- 测试：新的 9 测试套件 `src/test/atomic-task-edit.test.ts`（进程内竞态、跨进程 CLI 子进程竞态、降级竞态、Web 409、MCP 错误、逃生舱）；`scripts/smoke-parallel-task-locking.sh` 新增场景 4（从独立 CLI 进程并行 `task edit`，预填填充任务以加宽竞态窗口，断言最终文件与退出码为 0 的任务完全一致）。

## 验收标准

- 同一任务的并发编辑永不静默丢数据：一个成功，另一个失败。
- 锁保护跨独立 backlog 进程，而不仅进程内。
- 失败的 CLI 编辑以非零退出并给出包含任务名和冲突原因的信息；Web 返回 409；MCP 返回操作错误。
- 冲突时不等待、不合并、不自动重试；并发测试证明防丢更新。

## Related Concepts

- [[concepts/core-architecture]] — 锁位于 Core 读-改-写漏斗之下的 FileSystem 层
- [[concepts/task-lifecycle]] — 覆盖 `updateTaskFromInput` 和草稿降级（`demoteTaskWithUpdates`）两条路径

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 归类为条目 A1（必须合并，数据丢失类）
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — 上游修复的 CLI-1 深度分析（合并 `3b4fab0`，PR #860）
- [[sources/back-555-tui-live-refresh-atomic-writes]] — 相邻的原子写入并发工作（对比 TUI 文件监视器）
