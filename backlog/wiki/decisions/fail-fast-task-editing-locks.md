---
title: 并发任务编辑采用 Fail-Fast 文件锁
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 并发任务编辑采用 Fail-Fast 文件锁

## 背景

BACK-571 需要为并发任务编辑建立互斥保护。多条调用路径（CLI、Web、MCP、TUI）可能同时编辑同一任务文件，若无锁则相互覆写。

## 决定

采用 fail-fast 文件锁：基于 proper-lockfile 且 `retries: 0`，无等待、无合并、无自动重试。锁获取失败时，Web 返回 409、MCP 返回 `OPERATION_FAILED`，由调用方决定重试策略。

同时明确三条锁纪律：

1. **锁目标必须是任务文件本身**——进程内注册表按 target path 键控；按 lockfile 路径键控会损坏进程内并发锁。
2. **锁内必须重读任务内容**——只锁写路径而不重读，仍会基于过期内容覆写，等于丢更新。
3. 锁粒度限定在单个任务文件，不引入全局锁。

## 理由

- fail-fast 让冲突立即暴露给调用方，等待与自动重试会把瞬时竞争放大为长尾延迟，且掩盖了"谁在编辑"这一用户层信息。
- 由调用方决定重试保留了各表面的自主权：CLI 可直接报错退出，Web 可在 UI 提示用户重试。
- 按任务文件本体做锁键，锁的语义与受保护资源一一对应，进程内注册表才不会把同一任务的两个编辑误判为两把不同的锁。

## 被否方案

- **Wait-and-merge 锁**：等待期间用户已看到旧内容，合并策略复杂且容易错误合并。
- **只锁写、不重读**：读-改-写之间无刷新，丢失并发的其他编辑。
- **按 lockfile 路径做进程内注册表键**：lockfile 路径与任务文件路径不一致，导致进程内锁与文件锁脱节。

## Related

- [[sources/back-571-fail-fast-concurrent-task-edits]]
- [[concepts/task-locking]]
- [[concepts/task-identity]]
- [[concepts/core-architecture]]
