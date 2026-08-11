---
title: BACK-529 doc update 多行与追加支持
labels: [source, cli, mcp, doc]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-529 - Interpret-n-escape-sequences-in-doc-update-content.md
---

# BACK-529 优化 doc update --content，支持多行与追加模式

让 `backlog doc update` 处理多行内容的方式与任务描述、备注一致，并支持追加文档块而无需整段替换。

## 问题

- `doc update --content` 不解释 `\n` 转义序列，与 `--desc`、`--plan`、`--notes` 等行为不一致
- 缺少在保留原文档体的情况下追加内容块的能力

## 解决方案

1. 对 `doc update --content` 应用 `processCliEscapes`，使 `\n` 变为真实换行
2. 新增可重复的 `--append-content` 选项，追加块与基础内容之间以空行分隔；可与 `--content` 组合（追加在替换内容之后）
3. MCP `document_update` 增加 `appendContent` 字段
4. 新增 CLI 与 MCP 文档管理指南（documents guide），覆盖 doc create/update/list/view、多行内容、appendContent

## 实现位置

- `src/cli.ts`（`--content` 转义、`--append-content` 选项）
- `src/types/index.ts`（`DocumentUpdateInput.appendContent`）
- `src/core/backlog.ts`（`updateDocumentFromInput` 追加逻辑）
- `src/mcp/tools/documents/handlers.ts`、`schemas.ts`
- `src/guidelines/cli-instructions/documents.md`、`src/guidelines/mcp/documents.md` 等

## 测试

`src/test/doc-content-newlines.test.ts`（6 项）与 `src/test/mcp-documents.test.ts`（9 项）覆盖 `\n`、`\r\n`、省略内容保留、单/多次追加与组合。

## Related Concepts
- [[concepts/cli-entry]] — CLI 转义与命令体系
- [[concepts/mcp-server]] — MCP 文档工具
- [[concepts/markdown-pipeline]] — 文档内容处理

## Related Sources
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — plan/notes/finalSummary 转义
- [[sources/back-530-append-description]] — 任务追加描述
