---
title: BACK-625 - 任务 JSON 输出返回验收标准进度
labels: [source, cli, json, api-contract]
created_date: 2026-09-13 01:12
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-625 - Return-acceptance-criteria-progress-in-task-JSON-outputs.md
---

# BACK-625 - 任务 JSON 输出返回验收标准进度

机器可读的任务摘要遗漏了验收标准进度，任何想要 `4/7` 信号的消费方都必须拉取任务完整清单。本任务把完成/总数计数加进单个共享摘要格式化器，同时升级任务列表、任务查看与搜索结果三种输出。

- `src/formatters/json-output.ts`：`TaskSummaryJson` 新增 `acceptanceCriteriaCompleted` 与 `acceptanceCriteriaCount`；`toTaskSummaryJson` 从 `task.acceptanceCriteriaItems` 推导（勾选数 / 总数），任务无验收标准时默认 `0`/`0`
- 一个漏斗、三个面：任务列表、任务查看与搜索任务结果都流经 `toTaskSummaryJson`，无需逐面接线
- 刻意未动：现有日期字段（`dueDate`、`plannedStart/End`、`actualStart/End`）、`normalizePublicDate` 本地化，以及明细层的清单结构
- 测试：`src/test/cli-json-output.test.ts`（9 通过，81 断言）在完整（1/1）、部分（1/2）、空（0/0）三种进度下钉住三个 JSON 面的新字段
- 参考实现：上游 `git show 5158868`（上游 BACK-622）；字段名刻意保持一致，便于跨 fork 消费方
- 验证：类型检查、Biome、定向套件全绿；端到端冒烟显示 BACK-625 经 list/view/search `--json` 报告 `0/6`；全量套件唯一失败是已知的负载敏感并行任务编辑锁测试，不相关且单独运行时通过

## 验收标准

- 任务列表 JSON 暴露每个任务摘要的验收标准完成数与总数
- 任务详情 JSON 在清单旁暴露同样的计数
- 搜索 JSON 任务结果与列表输出使用相同字段
- 无验收标准的任务两个计数都返回 `0`
- 定向测试覆盖完整、部分、空三种进度

## Related Concepts

- [[concepts/json-output]] — 这些字段扩展的版本化 `--json` 契约
- [[concepts/task-lifecycle]] — 作为计数来源的任务内容中的验收标准

## Related Sources

- [[sources/back-562-stable-json-output]] — BACK-562 建立了摘要格式化器与 schemaVersion 1 信封
- [[sources/back-569-acceptance-criteria-progress-ui]] — BACK-569 把同样的 `checked/total` 进度放进 TUI/Web 任务摘要
