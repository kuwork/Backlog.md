---
title: Add pagination to MCP list tools and decision_list
labels:
  - source
  - mcp
  - web
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 09:25'
source_path: backlog/tasks/back-742 - Add-pagination-to-MCP-list-tools-and-decision_list.md
---

# Add pagination to MCP list tools and decision_list

问题：MCP 列表工具与 CLI（BACK-741）相比缺分页能力。`task_list`、`task_search`、`document_search`、`memo_list` 只有 `limit` 且静默截断，没有 `total`/`hasMore` 信号，agent 无法判断拿到的是否完整列表；`document_list`、`milestone_list` 完全没有分页参数；`memo_list` 用不透明 cursor；且没有 `decision_list` 工具（decisions 指南还明确写着"列表未在 MCP 暴露"）。

Phase 1：为所有 MCP 列表工具统一引入 `offset`+`limit` 分页，结果通过统一 structuredContent 信封 `{ items, total, offset, limit, hasMore }` 返回，文本输出附加 CLI 风格的 `Showing X-Y of N items` 提示；`memo_list` 移除 cursor 改用 offset；新增 `decision_list`（limit/offset/status/search 过滤）。`task_list` 先把各状态桶按 `orderedStatuses` 展平为一个有序序列再分页、再按桶重组渲染，桶顺序不变；`milestone_list` 的 unconfigured/archived 诊断段不分页，保证警告不消失。

Phase 2：把同一 offset 方案贯通全栈——`src/utils/list-page.ts` 承载共享的 `ListPage<T>` + `selectListPage`（core 与 MCP 层共用一份实现，MCP 侧仅保留需要 CallToolResult 的 `buildListResult`）；core `listMemosPage` 改为 offset 窗口返回 `ListPage<Memo>`（`MemoPageOptions.cursor`、`MemoPage.nextCursor` 删除）；REST `GET /api/memos` 接受 offset、`cursor` 参数以 400 明确拒绝；web 侧 `fetchMemosPage`/`MemoFeedState`/`MemosPage.tsx` 全部迁移到 hasMore 驱动，feed 既有的 id 去重吸收 offset 漂移产生的重复行，无限滚动保持可用。CLI `backlog memo list` 行为不变（本来就不传 cursor）。

关键区分：`src/utils/list-page.ts` 的 `ListPage<T>`（offset/total/limit/hasMore）与 `src/utils/list-window.ts` 的 `ListPage<T>`（skip/total/nextSkip/cut，CLI --skip/--max-count 窗口 + Next 命令 footer）是两个故意不同的模型，文件内有对照文档。注意 `ListPage` 类型重名是设计决策。文档：overview.md（用户实际读取、测试断言的那份）加 List Paging 节与 decision_list 条目，overview-tools.md、decisions.md、memos.md 同步修正（Phase 1 遗留的 memos.md cursor 文档在 Phase 2 补齐）。36 个文件改动，相关测试套件全部通过。

> 注（2026-10-03 复核收尾）：schema 迁移时漏改 `memo_list` 工具描述字符串，仍写 "cursor pagination"，与实际 offset 行为不符。修复以 fixup 方式并入本提交（`src/mcp/tools/memos/index.ts` 描述改为 offset/limit 信封措辞）。

## Related Concepts
- [[concepts/mcp-server]] — 所有列表工具的信封契约与 decision_list 注册
- [[concepts/mcp-workflow]] — overview.md/overview-tools.md/decisions.md/memos.md 指南更新
- [[concepts/web-server]] — REST /api/memos 从 cursor 迁移到 offset，cursor 参数 400 拒绝
- [[concepts/list-paging]] — 两个刻意不同的分页模型：CLI 窗口（list-window.ts）vs offset 信封（list-page.ts）

## Related Sources
- [[sources/back-741-cli-list-paging]] — 前置任务：CLI 八命令的 --max-count/--skip/--count 分页，本任务补齐 MCP 侧对等能力
- [[sources/back-740-memo-mcp-tools]] — 前置任务：memo MCP 工具组（本任务将其 memo_list 从 cursor 迁移到 offset）
