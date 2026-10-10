---
title: BACK-662 - queryTasks 与 SearchService 接入 completed 语料
labels: [source, core, cli, mcp, web-ui, completed-corpus]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-662 - Add-completed-corpus-option-to-queryTasks-and-SearchService.md
---

# BACK-662 - queryTasks 与 SearchService 接入 completed 语料

`queryTasks` 与 SearchService 语料排除了 `backlog/completed/` 任务，因此 CLI 搜索、MCP list/search 和 Web 搜索都漏掉了已完成工作，而单任务读取能到达。本任务增加一个可选的 `includeCompleted` 标志，仅扩大任务来源语料——过滤、排序、格式化与限制都走完全相同的管道，且所有默认行为不变。

- `SearchOptions.includeCompleted`（types）→ `ContentStore.getTasks(filter, options)` 在设置时从 `taskIdentityIndex.getTasks(true)` 取数（索引已打上 `source: "completed"` 标签），并有手动合并回退；`TaskQueryOptions.includeCompleted` 贯穿 Core 的跨分支与本地路径，按规范 ID 去重、活跃优先
- `SearchService`：`TaskSearchEntity` 增加 `isCompleted`；`applySnapshot` 把 `ContentSnapshot.taskCorpus` 的已完成条目与活跃任务一起索引；`search()`/`collectWithoutQuery` 除非显式加入，否则在 limit 检查之前跳过已完成实体，默认输出逐字节一致
- 消费方：CLI `task list --completed` 与 `search --completed`；MCP `list_tasks`/`search_tasks` 布尔 `completed` 参数并更新 schema 描述；`/api/search?completed=true` 透传
- 行为变化：MCP `task_search` 以前总是用已完成任务扩大语料；现在默认只读活跃任务，除非传 `completed: true`，与其他所有面一致
- 契约：`TaskSummaryJson` 增加可空 `source` 字段（仅活跃读取为 `null`，扩大行上为 `"completed"`），消费方可据此路由或差异化渲染已完成结果
- 范围扩展（用户指令）：Web 搜索对话框增加 completed 语料开关，发送 `completed=true`；已完成行带 Completed 徽标，点击通过 `preloadedTask` 导航负载打开任务模态框；徽标打磨复用了本地化的优先级/决策状态标签而非原始枚举值
- 指南仅用过滤场景示例更新（verify-guide-examples 通过）；实测探针：默认 349 任务 vs 带标志 653，已完成行有标签；在 SearchService 与 CLI 两层均回退验证为红

## 验收标准

- `queryTasks` 与 SearchService 接受默认关闭的可选选项合并已完成任务；默认调用返回完全相同的仅活跃语料
- CLI `--completed` 与 MCP `completed` 参数包含已完成任务；schema 描述有文档
- 合并结果中可区分已完成任务（`source: "completed"`）
- `/api/search` 接受 `completed=true`；Web 看板组合不变，搜索对话框仅在开关打开时发送该参数
- 指南示例落在过滤场景，绝不出现裸露的 list-all

## Related Concepts
- [[concepts/search-sequences]] — 被该标志扩大的 SearchService 语料与排序
- [[concepts/json-output]] — `TaskSummaryJson` 增加可空 `source` 字段
- [[concepts/mcp-server]] — MCP 契约增加 `completed` 参数
- [[concepts/task-lifecycle]] — 已完成归档作为可查询语料
- [[concepts/statistics-corpus-scope]] — completed 语料可选参数作为统计指标的 scope 参数

## Related Sources
- [[sources/back-663-completed-popup-read-only]] — 渲染本任务浮出的已完成记录
- [[sources/back-664-dependency-input-completed-predecessors]] — 为依赖建议复用 `/api/search?completed=true` 标志
- [[sources/back-567-cross-branch-task-identity]] — 合并所基于的身份索引语料机制
