---
title: 稳定 JSON 输出
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [concept, cli, api-contract]
---

# 稳定 JSON 输出

Backlog.md 为只读命令提供版本化的 `--json` 输出，便于脚本、AI 代理和自动化消费。

## 命令覆盖

- `backlog task list --json`
- `backlog task view <id> --json`
- `backlog <id> --json`（任务简写）
- `backlog search <query> --json`
- `backlog doc list --json`

## 输出契约

- 统一信封：`{ schemaVersion: 1, kind, ...payload }`
- `kind` 示例：`task-list`、`task-details`、`search-results`、`document-list`
- 字段可空：`nullable()` 将 `undefined` 转为 `null`，保持固定字段集
- 日期：`normalizePublicDate` 输出 ISO UTC（fork 存储 UTC 策略）
- 路径：`toProjectRelativePath` 返回项目相对路径
- JSON 只写 stdout，错误写 stderr
- `--json` 与 `--plain` 冲突时返回非零
- 非读取类 `task` 子命令拒绝 `--json`

## Fork 定制

- 无 `task.type` 字段（fork Task 模型没有）
- 包含 fork 日期字段：`dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd`
- wiki 搜索结果序列化为 `WikiSummaryJson`
- 未移植上游的 `printDuplicateIntegrityWarning`：重复 ID 检测保留给 `backlog doctor` 和 Web 端点

## Related Sources

- [[sources/back-562-stable-json-output]] — BACK-562 实现
