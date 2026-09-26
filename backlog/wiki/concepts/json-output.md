---
title: 稳定 JSON 输出
created_date: '2026-08-17 23:00'
updated_date: '2026-09-26 14:45'
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
- **验收标准进度**：每个任务摘要含 `acceptanceCriteriaCompleted` 与 `acceptanceCriteriaCount`（无 AC 时为 `0`/`0`）；三者共用 `toTaskSummaryJson` 单一漏斗，字段名与上游 BACK-622 对齐（BACK-625）
- 日期：`normalizePublicDate` 输出 ISO UTC（fork 存储 UTC 策略）
- 路径：`toProjectRelativePath` 返回项目相对路径
- JSON 只写 stdout，错误写 stderr
- `--json` 与 `--plain` 冲突时返回非零
- 非读取类 `task` 子命令拒绝 `--json`

## Watch 流（BACK-657）

`task list --json --watch` 复用现有 JSON 输出做持续监听：每次底层任务数据变化时重新发射一份完整 JSON 快照到 stdout，供 agent/脚本以流方式消费任务列表变化（[[sources/back-657-task-list-json-watch|BACK-657]]）。

## Readiness 发布（BACK-658）

JSON 读取路径暴露任务 readiness（`isReady`），将"任务是否可开始"（依赖是否满足）的判断以稳定字段形式发布给脚本消费者，而非让消费方自行解析依赖图（[[sources/back-658-json-readiness-publication|BACK-658]]）。

## references / modifiedFiles 与 completed source（BACK-697/662）

- `task list --json` 的任务摘要包含 `references` 与 `modifiedFiles` 字段，自动化可直接拿到任务关联的文件与链接（[[sources/back-697-json-summary-references-modified-files|BACK-697]]）
- 启用 completed 语料搜索时，结果带 `source` 字段区分任务来自 active 还是 completed 语料（[[sources/back-662-completed-corpus-query-search|BACK-662]]）

## Fork 定制

- 无 `task.type` 字段（fork Task 模型没有）
- 包含 fork 日期字段：`dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd`
- wiki 搜索结果序列化为 `WikiSummaryJson`
- 未移植上游的 `printDuplicateIntegrityWarning`：重复 ID 检测保留给 `backlog doctor` 和 Web 端点

## Related Sources

- [[sources/back-562-stable-json-output]] — BACK-562 实现
- [[sources/back-625-ac-progress-json-output]] — BACK-625 补齐验收标准进度字段
- [[sources/back-657-task-list-json-watch]] — BACK-657 JSON watch 流
- [[sources/back-658-json-readiness-publication]] — BACK-658 readiness 发布
- [[sources/back-662-completed-corpus-query-search]] — BACK-662 completed source 字段
- [[sources/back-697-json-summary-references-modified-files]] — BACK-697 references/modifiedFiles 字段
