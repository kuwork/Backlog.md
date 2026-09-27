---
title: CLI 拒绝草稿的非 Draft --status，提升保持显式步骤
description: BACK-683 让 draft edit 与 web/MCP 在状态语义上刻意分叉
labels: [decision, cli, drafts, task-lifecycle]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# CLI 拒绝草稿的非 Draft --status，提升保持显式步骤

## Context

`draft edit` 复用了 `task edit` 的全部字段选项（56 个选项逐一核对一致）。剩下一个分歧点：web/MCP 路径里给草稿一个已配置状态会**提升**它为任务，CLI 要不要照做？

## Decision

CLI 的 `--status` 只接受 Draft，其他值被拒并指向 `backlog draft promote`。理由：藏在一次编辑里的提升对脚本是惊吓——脚本作者预期编辑是幂等的内容操作，而提升会移动文件、分配新身份。web/MCP 的提升语义（BACK-644）保留不变；拒绝是 fail-closed 的（exit 1、文件字节不变）。

## Rejected alternatives

- 与 web/MCP 一致，状态变更即提升——交互界面里"改状态"是用户的显式手势，脚本里它只是参数，两者的意外代价完全不同
- 加 `--promote` 旗标合并两条路——`draft promote` 已经存在，再造一个入口只会分裂文档与肌肉记忆

## Related Sources

- [[sources/back-683-cli-draft-edit]] — 本决策的落地
- [[sources/back-644-web-draft-editing-fix]] — web/MCP 侧的相反取舍
