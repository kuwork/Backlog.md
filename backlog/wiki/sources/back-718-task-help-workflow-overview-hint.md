---
title: BACK-718 - Point task create/edit --help at the workflow overview
labels:
  - source
  - cli
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:10'
source_path: backlog/tasks/back-718 - Point-task-create-edit-help-at-the-workflow-overview.md
---

# BACK-718 - Point task create/edit --help at the workflow overview

本任务解决一个引导断层：项目期望每次会话从 workflow 教程（`backlog instructions overview`，即"required first read"）开始，但这一期望只传达到加载了指引文件的 agent；直接打开 `backlog task create --help` 或 `backlog task edit --help` 的新读者看不到任何提示。方案是在两个 help 输出末尾各加一行提示，让提示随读者实际打开的命令一起出现。

实现上给 `HelpSchema`（src/commands/help-schema.ts）新增可选 `note` 字段，由 `renderHelpSchema` 渲染为 schema 块结尾的 `Note: …` 行（`addHelpText("after")` 已保证它落在 help 输出最末）。提示语是单个导出常量 `INSTRUCTIONS_OVERVIEW_HINT`，被 task create 与 task edit 两个 schema 共同引用，两个命令的页脚措辞无法漂移（AC 明确要求共享机制而非两处字面量）。

范围严格限于 `--help` 文本：正常的 task create/edit 运行不打印提示，MCP 的 task_create/task_edit 描述及所有其他命令 help 均不变。验证包括 tsc/biome、scoped cli.test.ts（94 通过，新增测试断言两个命令结尾 Note 行一致、task list --help 无提示、正常 create 运行安静），以及人工核对两个 help 输出尾部与正常运行的静默行为。

## Related Concepts
- [[concepts/cli-instructions]] — 提示所指向的 workflow overview 与 instructions 体系
- [[concepts/cli-entry]] — help-schema 渲染机制属于 CLI 入口层的输出约定

## Related Sources
- [[sources/back-716-state-machine-guidance-overviews]] — 上游任务：overview 内容（含状态机指引）在此任务中被大幅增强，是本提示指向的目标
