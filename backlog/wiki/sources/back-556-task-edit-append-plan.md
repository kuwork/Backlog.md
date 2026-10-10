---
title: BACK-556 - task edit 新增 --append-plan
labels: [source, cli, task-editing]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-556 - Add-append-plan-option-to-task-edit-CLI.md
---

# BACK-556 - task edit 新增 --append-plan

为 `backlog task edit` 新增可重复的 `--append-plan` 选项，让人和 agent 无需替换已有内容或打开编辑器即可扩展实现计划。

## 实现要点

- 在 `src/cli.ts` 的五处接线：`hasEditFieldFlags`、帮助 schema、commander 选项声明、经 `toStringArray` 收集值、`editArgs.planAppend`
- 复用现有的共享 plan 追加管线（`src/core/backlog.ts` 的 `sanitizeAppendInput` + `appendImplementationPlan`），未做改动
- 多个追加值按 CLI 顺序应用，与已有/先前追加的 plan 文本之间恰好以一个空行分隔
- 仅含空白的追加值被忽略；第一个非空追加在缺少 plan 小节时创建它
- `--plan` 与 `--append-plan` 同时使用时，`--plan` 先替换，随后追加值依次应用
- 文档同步更新至 `src/guidelines/cli-instructions/task-execution.md`
- 追加值不经过 `processCliEscapes`，与既有 `--append-notes` 约定一致

## 验证

聚焦的真实 CLI 测试覆盖非交互与 PTY 无编辑器行为。

## Related Concepts
- [[concepts/cli-entry]] — CLI 命令架构
- [[concepts/task-lifecycle]] — 任务创建与编辑流程

## Related Sources
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — plan/notes/final-summary 转义支持
- [[sources/back-530-append-description]] — append-description 先例
