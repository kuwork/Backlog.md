---
title: 移除 overview 命令的 --json 选项
labels: [decision, cli, ux]
created_date: 2026-05-26 23:42
updated_date: 2026-05-26 23:42
---

# 移除 overview 命令的 --json 选项

## 背景

BACK-490 在设计 CLI `overview` 命令时，最初规划了三种输出模式：
1. 交互式 TUI（默认）
2. `--plain` 纯文本
3. `--json` 机器可读 JSON

## 决策

**移除 `--json` 支持**，仅保留 TUI 和 `--plain`。

## 原因

- `TaskStatistics` 原始输出包含完整 Task 对象数组（如 `atRiskTasks`），JSON 结构过于冗长，不适合 CLI 管道场景。
- `--plain` 已覆盖「机器可读 + 管道处理」需求，且结构更紧凑。
- 减少维护面：无需维护 JSON Schema 变更与版本兼容性。

## 影响

- `src/cli.ts` 中移除 `--json` option 注册。
- `src/commands/overview.ts` 和 `src/ui/overview-tui.ts` 无需处理 JSON 序列化分支。

## Related Sources
- [[sources/back-490-overview-command-task]] — BACK-490 实现详情
