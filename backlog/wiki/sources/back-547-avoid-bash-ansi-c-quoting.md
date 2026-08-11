---
title: BACK-547 多行 CLI 输入避免 bash ANSI-C 引号
labels: [source, cli, docs, agent-guidance]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-547 - Document-multi-line-CLI-input-without-bash-ANSI-C-quoting.md
---

# BACK-547 记录多行 CLI 输入时避免 bash ANSI-C 引号

在 agent 指令指南中显式警告不要用 bash ANSI-C 引号（`$'...'`）输入多行 CLI 字段。文档/规范类修复。

## 问题

当 agent 用 `$'...'` 包装多行值时，shell 会把 `\n` 转义序列转换成真正的换行，导致回显命令跨行断裂，CLI 只把第一行作为参数值（例如 `--plan` 只取到第一步）。

## 根因

bash 的 `$'...'` 引号在 CLI 看到参数之前就把 `\n` 解析成了真实换行。

## 解决方案

在 agent 指令指南中显式警告不要对 `--plan`、`--notes`、`--comment`、`--final-summary`、`--append-notes`、`--append-final-summary` 使用 `$'...'`，提醒 agent 改用 CLI 自身在普通双引号内的转义处理。统一了 CLI task-execution、task-creation 与 agent-guidelines 三处的 `$'...'` 警告措辞。MCP 指南不含等价 CLI 示例，已核验无需改动。

## 实现位置

- `src/guidelines/cli-instructions/task-execution.md`、`task-creation.md`、`agent-guidelines.md`（文档类，未涉及 src 代码）

## 测试

Biome check 通过（src/core/assets.ts 残留警告为既有、与本改动无关）；文档改动无需单元测试。

## Related Concepts
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/cli-entry]] — 多行输入转义

## Related Sources
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — \n 转义
- [[sources/back-508-cli-description-escapes]] — description 转义
