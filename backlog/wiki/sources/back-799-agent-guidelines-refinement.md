---
title: BACK-799 - 代理指南精炼：SQL 查询块、收尾完整性与状态机迁移
labels: [source, docs, agent-guidance, cli, mcp]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-799 - Refine-agent-guidelines-SQL-query-block-guidance-finalization-completeness-and-state-machine-relocation.md
---

# BACK-799 - 代理指南精炼：SQL 查询块、收尾完整性与状态机迁移

随功能交付，随产品发行的代理指南（CLI instructions 与 MCP 两套）与实际能力漂移：照做的代理要么错过既有功能、要么被迫读不需要的内容。本任务让每份指南的职责与信息密度对齐其使用阶段，并保持 CLI/MCP 两套一致。

## 目标

- nudge 与 overview 的指南索引覆盖全部指南（补 graph、memos、documents 条目）。
- documents 指南（CLI+MCP）补齐 sqlite-query / duckdb-query 活查询块的语法、安全规则与 copy_to 写出示例——此前 SQL 能力实际不可发现。
- task-finalization 要求记录 modified files 并对账实施计划，避免已关闭任务与实际交付分叉。
- 状态机细节（格式参考、transition/ai/evidence 规则、实时渲染的机器）只在 task-execution 渲染；overview 留指针，task-creation 只需 defaultStatus。

## 实现要点

- 指南索引对齐：cli-agent-nudge 与 overview 的 Detailed Guides 补 graph/memos 条目并同步 documents 条目描述；overview 引言补一段 wiki / graph / 活数据总览。
- documents 指南新增 Live SQL Query Blocks 小节：SQL 示例刻意按引擎拆分——纯 SQL 用 sqlite-query，CSV/Excel 一律 duckdb-query，source 与 SQL 读取的文件一致（演示 source 作为安全锚点）。CLI 版额外警告块内含反引号、不能走 `--content`/`--append-content`（须用复杂内容工作流：先创建再写文件）；MCP 版无需此警告（JSON 参数没有 shell 转义层）。
- task-finalization（CLI+MCP）加 modified-files 记录步骤与 DoD 勾选项；CLI 版补上缺失的实施计划对账步骤，与 MCP 对齐。
- 状态机小节从 overview 迁进 task-execution（CLI+MCP 共四个文件）：迁移无需改渲染器——`composeGuideText` 对每份指南替换 `{{STATE_MACHINE}}`（`src/commands/instructions.ts` 与 MCP workflow tool/resource），占位符一进 task-execution 即生效。overview 的 Start Every Request Here 保持原位（它是所有操作的会话引导，非创建专属；task-creation 已有自己的 Search First）。
- 同步代码注释（`src/commands/instructions.ts`、`src/mcp/tools/workflow/index.ts`、`src/mcp/resources/workflow/index.ts`）与测试（`state-machine-guidance`、`mcp-server`），README.md / README.en.md 一并更新。

备注（源文件评论）：本任务曾从 To Do 直接移到 Done，未沿状态机声明的边（合规路径为 To Do → Planning → Plan Review → In Progress → In Review → Done），系用户明确指示并验收，机器本身无需修改。

## 验证

`bunx tsc --noEmit` 通过；`bun run check` 无新问题；state-machine-guidance / mcp-server / agent-instructions / cli-agents 共 58 个测试绿。端到端：`bun run cli instructions task-execution` 渲染实时状态机，`instructions overview` 只显示指针。

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面，本任务的直接维护对象
- [[concepts/state-machine]] — 状态机指引的去向（execution）与指针（overview）

## Related Sources

- [[sources/back-716-state-machine-guidance-overviews]] — 状态机指引的静态章节与动态注入，本任务重排其落位
- [[sources/back-656-agent-guidance-overview-cadence]] — 早前一轮 agent 指南纠偏
- [[sources/back-796-duckdb-csv-excel-sources]] — documents 指南新增 SQL 块小节所记录的能力本体
