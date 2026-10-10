---
title: BACK-562 - 读取命令稳定 JSON 输出
labels: [source, cli, json, api-contract]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-562 - Add-stable-JSON-output-to-read-commands.md
---

# BACK-562 - 读取命令稳定 JSON 输出

为读取命令新增稳定、带版本号的 `--json` 输出：`task list`、`task view`、裸 `task` 简写、`search` 和 `doc list`。

## 实现要点

- 新增 `src/utils/read-output-mode.ts`，`resolveReadOutputMode(options, hasInteractiveTTY)` 返回 `json`/`plain`/`interactive`，并拒绝 `--json` 与 `--plain` 同时使用。
- 新增 `src/formatters/json-output.ts`，包含 fork 适配的契约信封（`schemaVersion: 1, kind`）、可空字段、ISO 日期归一化（`normalizePublicDate`）、项目相对路径，以及只写 stdout 的 `printJson`。
- `src/cli.ts` 将 `--json` 接入 search、task list、task view 和裸 task 简写；`preSubcommand` 钩子对非读取类 task 子命令拒绝 `--json`。
- 契约省略 `type`（fork Task 无此字段），包含 fork 日期字段（`dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd`），并序列化 wiki 搜索结果。
- 查看不存在的任务现在以退出码 1 结束。
- 后续：`doc list` 也获得 `--json`，带版本化的文档列表信封。

刻意不移植上游的 `printDuplicateIntegrityWarning` 闸门：重复 ID 完整性仍由 `backlog doctor` 和 Web `/api/tasks/duplicate-ids` 负责。已由 `read-output-mode` 单元测试和 `cli-json-output` 集成测试验证。

## Related Concepts

- [[concepts/cli-entry]] — CLI 命令面
- [[concepts/json-output]] — 稳定 JSON 输出契约

## Related Sources

- [[sources/back-545-cli-task-edit-numeric-id]] — task edit 的数字 ID 查找
