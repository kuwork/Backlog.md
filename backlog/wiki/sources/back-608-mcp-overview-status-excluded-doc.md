---
title: BACK-608 - MCP workflow 概述 task_list 行补记 statusExcluded 过滤
labels: [source, mcp, docs]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-608 - Document-statusExcluded-filter-in-MCP-workflow-overview-task_list-line.md
---

# BACK-608 - MCP workflow 概述 task_list 行补记 statusExcluded 过滤

`src/test/mcp-server.test.ts` 中的一致性测试断言 MCP workflow 概述资源的 `task_list` 速查行列出 `task_list` 工具 schema 的每个过滤属性。BACK-548 给 schema 新增了 `statusExcluded` 过滤，但 `src/guidelines/mcp/overview.md` 中的概述行仍只列旧过滤，测试在每次全量运行中失败。本任务更新文档行；守护测试有意保持不变。

- `src/guidelines/mcp/overview.md` 的 `- task_list` 速查行现在与既有过滤并列列出 `statusExcluded` 过滤（排除一个或多个状态），与 BACK-548 新增的 `task_list` schema 属性一致。
- 文档/schema 一致性测试即守卫：未削弱，只是被满足。
- Scoped `bun test src/test/mcp-server.test.ts` 11/11 通过；全量运行（2049 pass / 9 fail）显示 workflow 概述失败消失；其余失败为已知不稳定计时测试与依赖干净提交的 ContentStore 陈旧刷新测试。

## 验收标准

- MCP workflow 概述中的 `task_list` 行列出 `statusExcluded` 过滤。
- `bun test src/test/mcp-server.test.ts` 通过；tsc 与 biome 干净。

## Related Concepts

- [[concepts/mcp-workflow]] — 作为由 schema 一致性测试守护的活文档的 MCP workflow 概述资源。
- [[concepts/mcp-server]] — task_list 工具 schema 过滤含 statusExcluded。

## Related Sources

- [[sources/back-548-status-exclude-filtering]] — 给 schema 新增 statusExcluded 过滤、造成本文档漂移的任务。
