---
title: 'BACK-755 - Include completed subtasks in parent task views'
labels:
  - source
  - bug
  - subtasks
created_date: '2026-10-07 22:50'
updated_date: '2026-10-07 22:50'
source_path: backlog/tasks/back-755 - Include-completed-subtasks-in-parent-task-views.md
---

# Include completed subtasks in parent task views

父子链接仅存在于子记录（`parent_task_id` 前字段）；父任务在读取时反向扫描任务语料发现子任务。每条读取路径目前只扫 `backlog/tasks/`，于是子任务一旦到达终态移入 `backlog/completed/` 就从父任务中静默消失。复现：`bun run cli task view 217 --plain` 列出 BACK-217.02/.03/.04 却没有 BACK-217.01，尽管该记录仍带指向 BACK-217 的 `parent_task_id`。依赖已解决同类问题（依赖就绪度经 completed 语料解析）；子任务派生从未拿到该语料。

在每条表面都经过的单一 chokepoint（`Core.getTaskWithSubtasks`）拓宽子任务派生的语料，复用已加载的 completed 记录而非重扫。

- **核心**：`getTaskWithSubtasks` 默认池扩为 active + completed，经 `mergeCompletedIntoActive`（canonical id 去重、active 优先），CLI 明文/JSON 视图、MCP、TUI 一致；TUI 复用依赖就绪度已加载的 completed 记录，无额外扫描；`attachSubtaskSummaries` 保持纯函数
- **web UI**：`/api/tasks` 增 opt-in `completed=true`（镜像 `/api/search`）；详情视图只解析自身语料缺失的亲属（一个 parent 请求取子 + 缺父时一次读取），`useTaskHierarchyCorpus` + `TaskHierarchySection` 按 canonical id 去重（调用方语料优先）并 per-task 缓存，避免首开重复/回钻闪烁
- **验证**：`completed-subtasks-hierarchy.test.ts` 3 pass（核心/CLI 明文/CLI JSON，回退核心改动让其中两项变红）；`server-hierarchy-endpoint.test.ts` 2 pass；`tsc`/`biome` 在改动文件干净
- **范围外记录**：~100 个 backlog 文件仍用旧 `task-` 前缀写 `parent_task_id`/依赖条目（如 BACK-217.01 用 `task-217`、BACK-217.02+ 用 `BACK-217`），语料拓宽无法修复——那是数据迁移或共享身份语义放宽，不属于本次层级 bug 修复

## Related Concepts

- [[concepts/task-identity]] — canonical id 去重、前缀严格相等与陈旧 `task-` 引用
- [[concepts/task-lifecycle]] — 子任务完成移入 completed 与其可见性

## Related Sources

- [[sources/back-754-re-parent-an-existing-task]] — 同批父子/层级相关修复
- [[sources/back-709-dependency-closure-query]] — 依赖就绪度已走 completed 语料（本任务对齐的对象）
