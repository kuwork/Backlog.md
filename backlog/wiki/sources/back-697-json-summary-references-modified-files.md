---
title: BACK-697 - task list --json 新增 references 与 modifiedFiles
labels: [source, cli, json-output]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-697 - Add-references-and-modifiedFiles-to-task-list-json.md
---

# BACK-697 - task list --json 新增 references 与 modifiedFiles

消费 `backlog task list --json` 的外部工具需要每个任务的 `references` 与 `modifiedFiles`，而不必逐个获取任务。两个数组从详情负载移到共享摘要投影上，因此 list、search、view 与 `--watch` 流都一次编辑全部携带。

## 实现要点

- `src/formatters/json-output.ts`：`TaskSummaryJson` 在验收标准计数之后声明 `references` 与 `modifiedFiles`；`toTaskSummaryJson` 两者默认填空数组
- `TaskDetailsJson` 删掉两处重复声明——它扩展 summary，因此 spread 将两个字段原样带入 view 负载；没有任何重命名，也没有既有键改变值，使该新增在 `schemaVersion 1` 下保持纯增量
- 该投影在同一文件有三个调用点（task list 信封、search 信封、detail 负载）；三者都从单次编辑继承字段，`--watch` 流逐字重发同一信封——MCP 读面构建自己的形状，不在范围内
- fork 的仅摘要字段（`dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd`、`isReady`、`source`）与验收标准字段命名未动
- 文档：本 fork 没有已发布面枚举摘要字段列表，因此没有可更新的锚点——发明一个会给 fork 增加它不维护的契约；落地记录改入迁移台账
- 测试：`cli-json-output.test.ts` 11 个绿色（填充的列表行、两字段皆缺的空数组、search 行、未变化的 view 负载）；list 信封用例中一个既有红色（缺 `source` 期望）先被修复；4 变体 × 4 用例回滚矩阵固定每个条款

## 验收标准

- `task list --json` 与 `search --json` 中每个任务都携带 `references` 与 `modifiedFiles`，缺失时为空数组
- `task view --json` 保持相同负载内容——无键被重命名、删除或改类型
- 新增在 `schemaVersion 1` 下保持纯增量，fork 的仅摘要字段不变
- 测试固定填充行、空数组用例与未变化的 view 负载

## Related Concepts

- [[concepts/json-output]] — 摘要/详情投影与 schemaVersion 1 稳定性规则
- [[concepts/cli-tui]] — 消费该投影的 CLI 面

## Related Sources

- [[sources/back-562-stable-json-output]] — 本新增遵循的 JSON 信封稳定性
- [[sources/back-625-ac-progress-json-output]] — 新字段所紧邻的验收标准计数
- [[sources/back-526-create-task-references-and-backlog-autocomplete]] — 任务 references 的来源
