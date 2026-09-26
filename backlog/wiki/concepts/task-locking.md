---
title: 任务锁与并发编辑
created_date: '2026-09-08 17:00'
updated_date: '2026-09-26 14:45'
labels: [concept, concurrency, core]
---

# 任务锁与并发编辑

BACK-571 引入的 per-task 文件锁体系，保证同一任务文件不会被两个并发写入者交叉修改。

## 锁机制

- **helper 层**：`withTaskLock` / `withLockTarget` 封装 `proper-lockfile` 调用
- **fail-fast**：锁配置 `retries: 0`——不等待、不合并、不重试；锁被占用立即抛错
- **锁目标**：锁的就是任务文件本身；进程内注册表按 target path 键控，避免同进程内自我死锁
- **锁序**：先取任务锁，再取创建锁（task → create lock），保证全局顺序一致
- **旁路**：`USE_GLOBAL_TASK_ID_LOCK` 环境变量可在特殊场景下绕过任务锁
- **锁内必须重读**：获取锁后必须重新从磁盘读取任务内容，不能用加锁前的缓存快照写入

## 实体锁拆分（BACK-642）

`withTaskLock` 拆分为共享的 `withEntityFileLock` 与草稿专用的 `withDraftLock`：

- `withEntityFileLock` 是通用的 per-file 锁 helper，任务与草稿共用同一 fail-fast 语义
- `withDraftLock` 在草稿的 read-modify-write 区间（如 `promoteDraft`/`archiveDraft`）持锁，配合 `resolveDraftFilePath` 对歧义草稿身份 fail-closed（`AmbiguousIdError` 列出全部候选）
- 草稿歧义身份绝不猜测，与任务侧的 fail-closed 原则一致（[[sources/back-642-draft-identity-fail-closed|BACK-642]]）

## 冲突表面行为

| 表面 | 行为 |
|---|---|
| Web UI | HTTP 409 |
| MCP | `OPERATION_FAILED` |
| 内部 | `TaskLockError` |

## Related Concepts

- [[concepts/core-architecture]] — 核心架构与数据流
- [[concepts/task-identity]] — 共享任务身份

## Related Sources

- [[sources/back-571-fail-fast-concurrent-task-edits]] — BACK-571 fail-fast 并发任务编辑锁
- [[sources/back-580-milestone-detail-view-edit-modal]] — BACK-580 rename 级联撞上 fail-fast 锁的修复
- [[sources/back-642-draft-identity-fail-closed]] — BACK-642 草稿身份 fail-closed 与 withEntityFileLock/withDraftLock 拆分
