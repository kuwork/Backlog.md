---
title: BACK-527 CLI task create/edit 对 plan、notes、finalSummary 解释 \n 转义序列
labels: [source, bug, cli, ux]
created_date: '2026-07-14 06:32'
updated_date: '2026-07-14 06:32'
source_path: backlog/tasks/back-527 - Interpret-n-escape-sequences-in-task-create-edit-plan-notes-and-final-summary.md
---

# BACK-527 CLI task create/edit 对 plan、notes、finalSummary 解释 \n 转义序列

将 BACK-508 引入的 `processCliEscapes` 辅助函数扩展到 `task create` 和 `task edit` 的 `--plan`、`--notes`、`--final-summary` 选项，实现与 `--description` 一致的跨平台换行输入。

## 问题

BACK-508 已修复 `--description`/`--desc` 的 `\n` 转义，但 `implementationPlan`、`implementationNotes`、`finalSummary` 字段仍直接保存字面量 `\n`，导致多行计划、备注和总结在 Markdown 中显示为不可读的转义字符。

受影响命令示例：

```bash
backlog task create "标题" --plan "1. Step one\n2. Step two"
backlog task edit BACK-1 --notes "Line one\nLine two"
backlog task edit BACK-1 --final-summary "Summary\nDetails"
```

## 解决方案

在 `src/cli.ts` 中对以下字段统一应用 `processCliEscapes`：

| 命令 | 字段 | 选项 |
|---|---|---|
| `task create` | `implementationPlan` | `--plan` |
| `task create` | `implementationNotes` | `--notes` |
| `task create` | `finalSummary` | `--final-summary` |
| `task edit` | `planSet` | `--plan` |
| `task edit` | `notesSet` | `--notes` |
| `task edit` | `finalSummary` | `--final-summary` |

`processCliEscapes` 继续沿用 BACK-508 的两层架构：
1. Windows 上先模拟 bash 双引号转义层（`\\` → `\`）
2. 全平台统一应用 C-style 转义（`\n` → 换行，`\\` → 字面反斜杠）

## 测试

- `bunx tsc --noEmit` 通过
- `bun test src/test/cli.test.ts` 通过（89 pass，1 个与文档更新路径相关的无关失败）
- `src/cli.ts` 通过 Biome 检查

## Related Concepts
- [[concepts/cli-entry]] — CLI 命令体系与转义处理

## Related Sources
- [[sources/back-508-cli-description-escapes]] — BACK-508 description 转义修复
