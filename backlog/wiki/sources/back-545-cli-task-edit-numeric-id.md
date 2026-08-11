---
title: BACK-545 自定义前缀下 CLI task edit 数字 ID 查找
labels: [source, cli, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-545 - Fix-CLI-task-edit-numeric-ID-lookup-with-custom-prefix.md
---

# BACK-545 修复自定义前缀下 CLI task edit 数字 ID 查找

修复非默认前缀项目（如 `back`）下 `backlog task edit` 裸数字 ID 无法解析的问题。

## 问题

BACK-364 已修复核心层（`core.loadTaskById`/`core.getTask`）的数字 ID 查找，但 `backlog task edit` 仍在 `src/cli.ts` 中先用 `normalizeTaskId` 预归一化输入再调核心层。当项目使用非默认前缀时，裸数字 ID 如 544 会被转成 TASK-544，无法解析到实际 back-544 文件。

## 解决方案

移除 task edit（交互向导与非交互两条路径）的 `normalizeTaskId` 预归一化，让 `core.loadTaskById` 接收原始 ID，从而 `getTaskPath` 能为数字 ID 自动探测配置前缀，与 view/archive/complete 行为一致。后续编辑使用 `existingTask.id`，保证始终使用规范前缀 ID。

## 实现位置

- `src/cli.ts`（依赖 `src/utils/task-path.ts`、`src/core/backlog.ts`；依赖 BACK-364）

## 测试

`src/test/task-edit-preservation.test.ts` 新增回归，覆盖自定义前缀下裸数字 ID 与带前缀 ID 两种情形。

## Related Concepts
- [[concepts/cli-entry]] — task edit 数字 ID 查找
- [[concepts/core-architecture]] — 前缀解析
