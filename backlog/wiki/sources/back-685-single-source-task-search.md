---
title: BACK-685 - 任务搜索配置与过滤 Core 单一来源
labels: [source, cli, search, core]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-685 - Single-source-task-search-config-and-filters-in-core.md
---

# BACK-685 - 任务搜索配置与过滤 Core 单一来源

任务搜索与过滤被实现了五次，行为真实漂移（any-label 与 all-label 匹配、大小写敏感的 MCP label 循环、label/assignee 本地可搜但经 `backlog search` 或 Web API 搜不到）。本任务让 `src/utils/task-search.ts` 成为可搜索文本构建器、Fuse 配置与一个共享过滤谓词的单一所有者，由 SearchService、Core、CLI 与 MCP 适配器消费。

- `src/utils/task-search.ts` 重写为单一所有者：新导出 `buildTaskSearchBodyText` / `buildTaskSearchFields` / `TASK_SEARCH_FUSE_OPTIONS` / `createTaskFilterMatcher(options, corpus)`；`applyTaskFilters` / `applySharedTaskFilters` / `createTaskSearchIndex` 保持签名，看板/统一视图消费方零改动；谓词语义是五份副本的并集；`labelMatch` 默认 `any`
- label 与 assignee 进入每个面的可搜索文本，弥合查询经 `task list --search`/TUI 能找到任务而经 `backlog search`/Web API 不能的漂移（此前探针验证）
- `src/core/search-service.ts`：任务实体用共享构建器；内联 Fuse 配置、`NormalizedFilters`、两份私有过滤副本与四个 normalize 辅助函数删除；wiki 实体语料与 `fileName: 0.25` key 作为服务端扩展保留；还修复了预先存在的 `dispose()` 缺口
- `src/cli.ts`：`taskMatchesAllLabels` 删除；`--labels` 经 `baseFilters.labels` + `labelMatch "all"` 流转；`src/mcp/tools/tasks/handlers.ts`：手搓的大小写敏感 label 循环删除——MCP label 匹配顺带变为大小写不敏感
- `labelMatch` 解析：默认 `any`；CLI `--labels` 与 MCP `task_list` labels 传 `all`（匹配文档化契约）；交互 picker 保持 `any`
- `src/types/index.ts`：`TaskListFilter` 与 `SearchFilters` 增加 `labelMatch?: "any" | "all"`（增量）
- 新 `src/test/task-search-parity.test.ts`（14 用例）钉住跨面一致性，含 label/assignee、labelMatch 语义、CLI/MCP 接线与 wiki 语料；变异矩阵证明每个守卫都有区分度

## 验收标准

- 一个模块拥有 Fuse 配置与可搜索文本构建器；SearchService 导入它并删除重复配置
- label 或 assignee 查询经 `backlog search`、`task list --search`、MCP 与 Web API 一致找到任务
- 一个共享过滤实现带显式 labelMatch 语义；五份分歧副本删除或改为委托
- fork 扩展存活：语料中的 wiki 实体、`fileName` key（0.25）、看板/统一视图消费方不变；MCP label 匹配大小写不敏感

## Related Concepts
- [[concepts/search-sequences]] — 本任务统一的搜索/过滤管道
- [[concepts/spotlight-search]] — 跨面搜索消费方
- [[concepts/core-architecture]] — 谓词的共享 Core 位置
- [[concepts/mcp-server]] — 现委托共享过滤器的 MCP 适配器

## Related Sources
- [[sources/back-686-shared-search-consumers]] — 把 TUI 查看器与 milestones 页面接到本共享搜索的后续
- [[sources/back-564-search-score-threshold]] — 同一索引上的早期阈值调优
- [[sources/back-624-global-search-dialog]] — 从语料一致性受益的 Web 搜索面
