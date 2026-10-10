---
title: BACK-584 - 全端显式取消负责人分配
labels: [source, cli, web-ui, mcp, bug]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-584 - Allow-explicit-unassign-across-CLI-web-and-MCP-when-defaultAssignee-is-set.md
---

# BACK-584 - 全端显式取消负责人分配

在 BACK-579/581 发布 defaultAssignee 应用之后，补全所有界面的"显式未分配"表达。核心规则：字段缺失 = 无意见（应用默认值），显式空 `[]` = 显式未分配。

## 实现要点

- Core：`src/core/backlog.ts` 的 `createTaskFromInput` 用 `input.assignee === undefined` 决定是否回退 defaultAssignee；显式 `[]` 保留为空。
- `src/utils/task-edit-builder.ts`：负责人使用 `sanitizeClearableStringArray`，使显式 `[]` 到达 updateInput（MCP task_edit assignee: [] 清除）。
- CLI（`src/cli.ts`）：task create、draft create、task edit 新增 `--unassign`；`-a ""` 报错并提示 `--unassign`；`--unassign` 与 `-a` 互斥。
- Web：`src/web/App.tsx` 将 defaultAssignee + availableAssignees 传给 TaskDetailsModal；创建模式预填 chips 并以三态逻辑提交（未改时省略、清除为 `[]`、修改时为列表）；编辑模式用 ChipInput 列表带下拉。
- MCP：`src/mcp/utils/schema-generators.ts` 记录空数组语义。
- 文档：ADVANCED-CONFIG.md、`src/guidelines/cli-instructions/task-creation.md`、`task-execution.md`、`drafts.md` 更新；88 个限定测试通过。

## 验收标准

- Core 区分缺失与显式 []；CLI 支持 --unassign；Web 创建预填默认值、清除 chips 存空；Web 编辑以 ChipInput 列表编辑负责人；MCP task_edit assignee: [] 清除；文档和帮助模式更新。

## Related Concepts

- [[concepts/task-identity]] — 创建时缺失与显式空字段语义
- [[concepts/web-ui-features]] — TaskDetailsModal 创建/编辑表单行为
- [[concepts/mcp-workflow]] — 可清空字段的 MCP 工具 schema 语义

## Related Sources

- [[sources/back-585-multi-assignee-parity-task-create]] — 使 -a 可重复且保留 --unassign 防护的后续任务
