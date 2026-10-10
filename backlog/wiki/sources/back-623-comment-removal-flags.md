---
title: BACK-623 - task edit 支持删除与清空评论
labels: [source, cli, mcp, web-ui, comments]
created_date: 2026-09-08 17:40
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-623 - Add-remove-comment-and-clear-comments-support-to-task-edit.md
---

# BACK-623 - task edit 支持删除与清空评论

任务评论曾是只增不减：每个入口（CLI --comment、MCP commentsAppend、服务器 API、Web UI）都能加评论却无法删除，只能手工编辑任务 markdown，从而破坏元数据同步。本任务在所有入口补齐评论删除——CLI 旗标加 core/serializer 支持、MCP task_edit 对齐、服务器透传、Web UI 按条删除与“清空评论”页头按钮——删除后按位置确定性重编号（索引不落盘，见 BACK-470）。

- Core（`src/core/backlog.ts` updateTask）：依次执行清空 → 删除（索引校验，越界报“Comment #N not found”并给出可用索引提示，过滤后按位置重编号）→ 追加；兼容现行分隔格式与旧式 `<!-- COMMENT:BEGIN -->` 块；删除会流入搜索索引与 plain/JSON 输出
- CLI（`src/cli.ts`）：`task edit --remove-comment <index>`（可重复）与 `--clear-comments`，与 `--comment` 互斥；增强——`--remove-comment` 还通过 `src/utils/task-builders.ts` 的共享 `parsePositiveIndexList` 辅助函数接受逗号分隔索引（2,3），于是 --remove-ac/--check-ac/--uncheck-ac/--remove-dod/--check-dod/--uncheck-dod 也都接受逗号
- MCP：`task_edit` schema 增加 commentRemove/commentClear（`src/mcp/utils/schema-generators.ts`），处理器内做清空冲突校验
- 服务器：任务更新 API 透传；Web（`TaskDetailsModal.tsx`）：每条评论悬停 X 删除与“Clear comments”页头按钮——经用户反馈，两者在不进入编辑模式时也可见，推翻了 BACK-470 仅限编辑模式的门控（仅受 !isFromOtherBranch 门控），4 种语言
- 指南：agent-guidelines、mcp（overview/overview-tools/task-execution）、cli-instructions（overview/task-execution）、README——包括一条规则：编辑已有评论的正文/作者没有 CLI 旗标，必须对任务文件直接使用文本替换工具（Edit）
- 测试：comments.test.ts（+7，22 通过）、mcp-tasks（+1）、server-search-endpoint 扩展、Web 模态框（+2）；在 BACK-623 文件上通过 `bun run cli` 实测冒烟

## 验收标准

- --remove-comment 删除给定 1 基位置的评论并拒绝越界索引；可重复；--clear-comments 删除整个小节
- 剩余评论按位置确定性重编号
- 删除兼容现行分隔格式与旧式 COMMENT 块
- MCP task_edit 暴露等价的 commentRemove/commentClear 输入
- 删除反映在搜索索引与 plain/JSON 输出中
- 指南已更新；agent 说明中写明正文/作者编辑须走任务文件上的文本替换工具
- Web UI 通过服务器 API 暴露按条删除操作

## Related Concepts

- [[concepts/task-comments]] — 评论存储格式、基于位置的索引与删除语义
- [[concepts/mcp-workflow]] — task_edit 对 commentRemove/commentClear 的对齐
- [[concepts/cli-instructions]] — 同步更新的指南面（“只增不减”措辞已替换）

## Related Sources

- [[sources/back-470-task-comments]] — 本任务为其扩展删除能力的原始只增评论设计
