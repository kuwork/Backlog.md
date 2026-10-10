---
title: BACK-615 - TUI 与 browser 增加依赖就绪指引
labels: [source, cli, tui, web-ui, mcp]
created_date: 2026-09-07 05:57
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-615 - Add-dependency-readiness-guidance-to-TUI-and-browser.md
---

# BACK-615 - TUI 与 browser 增加依赖就绪指引

回答"我现在可以接什么"，同时不悄悄恢复被放弃的派生序列模型：共享的就绪裁决（fail-closed——任何未完成或不可解析的依赖都阻塞）呈现在五条路径上。本任务接管贡献者 PR #814（David Cottrell），为正确性与性能大幅改写，又经三轮 Codex 评审加固。

- `src/utils/readiness.ts`（新增，纯函数核心）：`createReadinessGraph` / `getTaskReadiness` / `formatReadinessBlockers` / `loadReadinessGraph`；blockingDependencies = 已解析但未完成，missingDependencies = 不可解析，两者均 fail-closed；重复规范身份按 first-wins-then-fail-closed 解析（歧义身份规则）；completed 语料的*位置*即完成证据，与状态字符串无关；`statuses: []` 配置在 createReadinessGraph 内回退 DEFAULT_STATUSES。
- CLI：`task list --ready` 覆盖 plain/json/interactive 路径；交互加载器返回未过滤语料作为 readinessTasks，使裁决不依赖显示过滤；`applyTaskFilters` 接受 `ready?: ReadinessGraph`（图必填，每次过滤构建一次——非每候选一次）。
- TUI：详情窗格 Readiness 行（✓ Ready to start / ● Blocked by <ID>，单宽字形——沙漏为东亚宽字符，blessed 会数错），仅为有依赖的任务渲染；`listCompletedTasks()` 并行加载（112ms vs `loadTasks({includeCompleted:true})` 的 6.6s）；C/A 快捷键维护该图。
- Web：TaskDetailsModal 依赖卡中的就绪徽章；未解析依赖 ID 经 GET /api/task/:id（读取已完成任务）解析，使 browser/CLI/TUI 一致而无需下发 completed 语料；徽章跟随乐观内联状态。
- MCP：`task_list` 新增 `ready: true` 参数（schema + 指南），无新工具。
- 移除上游的 `TaskListFilter.ready`（Core.applyTaskFilters 从未处理——一个静默空操作的过滤字段）与 fullGraphTasks 管道；依赖身份以 canonicalTaskId 为键，而非原始小写字符串相等。
- 后续事项延期到 BACK-601：浏览器中 draft-on-draft 依赖、board 页签上的就绪过滤、跨分支终态依赖。

## 验收标准

- 部分图、环、缺失依赖与跨状态依赖的 ready/blocked 语义有明确定义。
- TUI 与 browser 呈现一致、非变更性的就绪指引。
- 既有 ordinal 顺序仍为权威。
- 环与歧义依赖数据被如实表示并 fail-safe。
- 用户能识别哪些依赖阻塞了任务。

## Related Concepts

- [[concepts/task-lifecycle]] — 以终态与 completed 语料位置为键的就绪裁决。
- [[concepts/cli-tui]] — TUI 详情窗格 Readiness 行与快捷键图维护。
- [[concepts/mcp-workflow]] — 由既有工具与 schema 承载的 task_list ready 参数。
- [[concepts/core-architecture]] — 经 queryTasks 的 ContentStore 热加载 loadReadinessGraph。
