---
title: BACK-740 - memo MCP 五工具组
labels: [source, mcp]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-740 - Memo-MCP-tools-memo_create-list-view-update-delete.md
---

# BACK-740 - memo MCP 五工具组

Memo 实体此前只有 CLI 面（`backlog memo ...`）和 HTTP API（`/api/memos`，BACK-729），MCP 客户端无法读写备忘录。本任务在 `src/mcp/tools/memos/` 下新增 memo 工具组（handlers.ts / index.ts / schemas.ts），完全镜像 documents 工具组的结构。

## 实现要点

五个工具全部委托 `src/core/memos.ts`（createMemo / listMemosPage / getMemo / updateMemo / deleteMemo），保证 CLI、API、MCP 三方共享同一 ID 方案（YYYYMMDD-N）和文件格式：memo_create（content 必填、tags 可选）、memo_list（limit/cursor/date/tags 过滤，structuredContent 返回 items + nextCursor）、memo_view、memo_update（content 与 append 恰好二选一，可带 tags，bump updated_date）、memo_delete；未知 ID 统一报 MEMO_NOT_FOUND。

注册与文档：在 `createMcpServer` 和 `upgradeToProject` 两条引导路径都注册 `registerMemoTools`；新增 MCP 使用指南 `src/guidelines/mcp/memos.md`（以 drafts.md 风格撰写参数/过滤/分页/未找到语义），注册为完整工作流指南 `backlog://workflow/memos` 并挂入 get_backlog_instructions 'memos'；overview-tools.md 枚举 memo 工具。

注：本任务实现的 memo_list 使用 cursor 分页；BACK-742 已将其改为 offset 分页并移除 cursor。

## 验证

测试：新建 `src/test/mcp-memos.test.ts` 9 个用例（mkdtemp 临时项目，覆盖 create/view/list/filter/pagination/replace/append/delete/not-found），并更新 mcp-server.test.ts 的工具列表断言。tsc、biome、测试全部通过。

## Related Concepts
- [[concepts/mcp-server]] — 工具组在 MCP server 双引导路径的注册方式
- [[concepts/mcp-workflow]] — memos 使用指南作为 workflow 资源（backlog://workflow/memos）挂入指令面
- [[concepts/memos]] — memo MCP 五工具所属的 memos 子系统

## Related Sources
- [[sources/back-742-mcp-list-pagination]] — 后续任务：memo_list 从 cursor 迁移到 offset 分页，decision_list 补齐
