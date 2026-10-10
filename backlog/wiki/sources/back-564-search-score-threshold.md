---
title: BACK-564 - 搜索评分阈值对齐多端
labels: [source, search, fuse, tui, cli, mcp]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-564 - Align-search-score-threshold-across-TUI-CLI-and-MCP-with-web-search.md
---

# BACK-564 - 搜索评分阈值对齐多端

将 Web UI 使用的相同 Fuse.js 评分阈值（`<= 0.45`）应用到 TUI 看板、TUI 任务列表、CLI search 和 MCP search，消除短数字误报。

## 实现要点

- `src/utils/task-search.ts` 新增可选 `scoreThreshold` 选项；Fuse 分支在设置时按 `result.score <= scoreThreshold` 过滤结果。
- `src/ui/board.ts` 的 `getFilteredTasks` 传 `scoreThreshold: 0.45`。
- `src/ui/unified-view.ts` 的 `filterTasksForKanban` 传 `scoreThreshold: 0.45`。
- `src/ui/task-viewer-with-search.ts` 对内存分支和 SearchService 分支都按 `0.45` 过滤。
- `src/cli.ts` search 命令按 `score <= 0.45` 过滤 SearchService 结果。
- MCP task/document search 处理器传 `scoreThreshold: 0.45`，或按同一阈值过滤 SearchService 结果。
- 最初试过数字特判的子串分支，已回退，改用与 Web 完全一致的评分阈值方案。

对照 Web UI 验证行为：`6` 不再匹配 `BACK-428`；`63` 不再匹配 `BACK-410`。文本查询保持与 Web 相同的 Fuse 语义。

## Related Concepts

- [[concepts/search-sequences]] — Fuse.js 搜索与过滤
- [[concepts/web-ui-features]] — Web UI 搜索行为

## Related Sources

- [[sources/milestone-search-fix]] — BACK-480 短数字误报问题类别
