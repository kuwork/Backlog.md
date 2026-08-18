---
title: TUI composer 不迁移 type 字段与 git CAS 管线
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [decision, tui, composer, git]
---

# TUI composer 不迁移 type 字段与 git CAS 管线

## 背景

上游 BACK-430 / BACK-565 提供的 TUI 任务 composer 包含 type 选择器，并在 core/backlog.ts 与 git/operations.ts 中引入了创建失败回滚用的快照/临时索引 CAS 管线。

## 决策

BACK-563 采用上游 BACK-565 成熟版 composer，但：
- 移除 type 字段（fork Task 模型没有 `type`）
- 不移植上游 core 快照/rollback 和 git CAS 管线
- 跳过上游 BACK-566（临时隐藏 composer 入口）

## 理由

- fork Task 模型无 `type` 字段，保留 type 选择器会引入模型冲突
- mature composer 通过 persist 回调注入创建，调用方 try/catch 即可处理失败；无需 core 级回滚
- BACK-561 刚完成 exact-path autoCommit，上游 CAS 管线与之冲突
- 临时隐藏入口在 fork 无意义（原本就没有 composer）

## Related Sources

- [[sources/back-563-tui-intent-first-composer]] — TUI composer 实现
- [[sources/back-561-autocommit-exact-files]] — exact-path autoCommit
