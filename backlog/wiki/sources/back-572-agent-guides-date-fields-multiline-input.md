---
title: BACK-572 - 日期字段与多行输入指南澄清
labels: [source, agent-guidance, cli, mcp, docs]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-572 - Clarify-CLI-and-MCP-agent-guides-for-date-fields-and-multi-line-input.md
---

# BACK-572 - 日期字段与多行输入指南澄清

修复两个 agent 经常搞错的 CLI/MCP 输入约定。日期/时间字段接受本地时间、转为 UTC 存储、显示时再转回本地——agent 曾把文件中可见的 UTC 值原样作为输入，导致本地时间错误。多行文本字段把两个字符 `\n` 解释为换行——agent 曾在带引号的参数里按真实回车，Bash 将其拆成多行，只有第一行被保存。

## 实现要点

- 在 `src/guidelines/cli-instructions/task-execution.md` 的 `Updating Task Dates` 下新增本地时间输入提示（约 127 行），并在 `src/guidelines/mcp/task-execution.md` 新增 `Date and Time Fields` 小节（约 78 行）：CLI/MCP 接受本地时间、UTC 存储、本地显示；agent 不得把文件中可见的 UTC 值当作输入。
- 从 MCP 指南移除 Markdown 文件回退说明，因为 MCP 不能直接编辑任务文件（一个微决策：死路径的指引比没有更糟）。
- 更新 `src/guidelines/agent-guidelines.md`、`src/guidelines/cli-instructions/task-execution.md` 和 `src/guidelines/cli-instructions/task-creation.md`，警告不要在带引号的参数中使用真实换行。
- 更新 `src/guidelines/cli-instructions/drafts.md`，在带引号的参数中使用字面两字符 `\n`；说明存储字面反斜杠-n 需要按 shell 规则双写反斜杠。
- 更新 `src/cli.ts` 中 `description`、`plan`、`notes`、`final-summary`、`comment`、`append-plan`、`append-notes`、`append-final-summary` 和文档内容选项的帮助文本，说明字面 `\n` 约定。

## 验收标准

- Agent 指南明确记录日期字段的本地时间输入（UTC 存储/本地显示，不要把存储的 UTC 值回环为输入）。
- 多行输入指引使用带引号的字面 `\n` 并警告真实换行。

## Related Concepts

- [[concepts/date-fields]] — 五个因存储格式造成回环混淆的日期字段
- [[concepts/cli-instructions]] — 这些指南所在的已发布指令面
- [[concepts/mcp-workflow]] — MCP agent 是修正约定的主要受众

## Related Sources

- [[sources/back-506-cli-utc-conversion-fix]] — 导致本次文档必要的本地到 UTC 转换 bug
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — 确立 plan/notes/summary 字面 `\n` 转义约定
- [[sources/back-547-avoid-bash-ansi-c-quoting]] — 多行输入 shell 引号的相关指引
