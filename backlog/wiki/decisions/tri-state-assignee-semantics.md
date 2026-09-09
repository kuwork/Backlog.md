---
title: 字段三态语义：缺席 / 显式空列表 / 列表
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 字段三态语义：缺席 / 显式空列表 / 列表

## 背景

BACK-579/584/585 统一创建与编辑表面的字段语义。列表类字段（如 assignee）需要区分"用户没提这个字段"和"用户明确要求清空"。

## 决定

字段采用三态语义：

- **absent**（字段缺席）：未表态，应用默认值。
- **显式 `[]`**：清空该字段。
- **非空列表**：按给定值设置。

配套三条落地决策：

1. 默认值应用在 core 的 `createTaskFromInput` 漏斗层，而非 CLI 层——所有创建表面（CLI、wizard、TUI、Web、MCP）在漏斗层一处生效。
2. `defaultAssignee` 配置类型从 `string` 改为 `string[]`，与多负责人模型对齐。
3. `-a ""` 不再作为清空手段，改为报错并提示 `--unassign`。

## 理由

- 三态语义让"未表态"与"显式清空"在数据结构上可区分，避免默认值把用户的清空意图覆盖掉。
- 默认值放漏斗层消除了每个表面各自实现默认逻辑的分叉风险，新增创建表面自动继承。
- 显式 `[]` 清空语义一致后，`defaultAssignee: string[]` 与字段类型天然对齐。

## 被否方案

- **`-a ""` 作为清空手段**：空字符串语义含混（是没填还是故意清空？），改为报错并指向 `--unassign`。
- **默认值在 CLI 层应用**：wizard/TUI/Web/MCP 各自需要重复实现，且容易漏。

## Related

- [[sources/back-579-default-assignee]]
- [[sources/back-584-explicit-unassign-across-surfaces]]
- [[sources/back-585-multi-assignee-parity-task-create]]
- [[concepts/task-lifecycle]]
- [[concepts/core-architecture]]
