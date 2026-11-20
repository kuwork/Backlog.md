---
title: BACK-853 - CLI/MCP 文档与决策删除
labels: [source, cli, mcp, documentation, decisions, delete]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-853 - Add-CLI-and-MCP-delete-for-documents-and-decisions.md
---

# BACK-853 - CLI/MCP 文档与决策删除

`doc delete` 与 `decision delete` 通过共享 Core 删除唯一源文件；歧义 ID、跨分支候选、子任务式 ID 和历史完成决策都按 fail-closed 规则处理。

## 目标

删除能力需要同时进入 CLI、MCP、Core 和公共工作流指南。文档歧义必须继续列出活跃与跨分支候选；决策完成状态不能靠归档释放 ID，因为完成决策继续占用身份。

## 实现要点

- 删除先解析并锁定完整逻辑源路径，只删除该文件，不把关联文件加入 Git 暂存。
- 决策与文档使用相同锁定/删除路径；跨分支候选绝不写成写操作。
- 重名文档继续报 `AmbiguousDocumentIdError`；`doc-1.1` 等结构化 ID 拒绝猜测；删除完成决策时同时考虑当前与完成存储路径。
- MCP 与 CLI 的帮助、指南和错误语义保持一致。

## 验证

文档/决策 CLI 测试、决策回归、帮助与 MCP 测试通过；真实 CLI 和 MCP 本地调用已验收。TypeScript、Biome 与全量文档/决策套件通过。

## Related Concepts

- [[concepts/task-identity]] — 唯一源选择、完成状态与歧义拒绝
- [[concepts/mcp-workflow]] — CLI/MCP 公共契约同步

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — 文档/决策身份规则基础
- [[sources/back-852-web-document-decision-delete]] — 同一共享动作的 Web 暴露
- [[sources/back-858-entity-id-update-source-selection]] — 后续以 source path 精确选择重复 ID
